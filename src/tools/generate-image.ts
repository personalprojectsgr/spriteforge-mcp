import { z } from "zod";
import * as path from "path";
import type { GenerateImageParams, GeneratedImage, ImageConfig } from "../types/index.js";
import { OpenRouterClient } from "../services/openrouter.js";
import { jobQueue } from "../services/job-queue.js";
import { 
  saveImage, 
  generateFilename, 
  getImageDimensions, 
  convertFormat,
  reducePalette,
  makeSeamless
} from "../services/image-utils.js";
import { buildEnhancedPrompt, getPresetConfig } from "../resources/palettes.js";

export const generateImageSchema = z.object({
  prompt: z.string().describe("Detailed description of the image. Include subject, style, colors, mood. Example: 'A pixel art knight character with silver armor and blue cape, 64x64, transparent background'"),
  negative_prompt: z.string().optional().describe("What to avoid in the image. Example: 'blurry, text, watermark, low quality'"),
  preset: z.enum([
    "sprite", "sprite_sheet", "icon", "background", "hero_section", 
    "testimonial", "ui_element", "game_asset", "illustration", 
    "texture", "pattern", "character", "tileset"
  ]).optional().describe("Quick preset that configures optimal settings. 'sprite' = small transparent game asset, 'hero_section' = wide website banner, etc."),
  style: z.enum([
    "pixel_art", "retro_8bit", "retro_16bit", "retro_32bit", "vector", 
    "realistic", "cartoon", "anime", "chibi", "watercolor", "flat_design", 
    "3d_render", "hand_drawn", "minimalist", "cyberpunk", "fantasy", "sci_fi"
  ]).optional().describe("Visual style. 'pixel_art' for retro games, 'realistic' for photos, 'flat_design' for modern UI"),
  width: z.number().min(16).max(4096).optional().describe("Width in pixels (16-4096). Common: 32, 64, 128 for sprites; 1920 for web"),
  height: z.number().min(16).max(4096).optional().describe("Height in pixels (16-4096)"),
  aspect_ratio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4", "21:9", "2:3", "3:2", "4:5", "5:4"]).optional().describe("Aspect ratio. '1:1' for icons/sprites, '16:9' for hero sections, '9:16' for mobile"),
  resolution: z.enum(["1K", "2K", "4K"]).optional().describe("Output resolution quality"),
  color_palette: z.array(z.string()).optional().describe("Hex color codes to use. Example: ['#FF5733', '#33FF57', '#3357FF']"),
  palette_name: z.enum([
    "nes", "gameboy", "snes", "commodore64", "cyberpunk", 
    "pastel", "earth", "neon", "grayscale"
  ]).optional().describe("Pre-defined palette. 'gameboy' = 4 green shades, 'nes' = 54 NES colors"),
  color_count: z.number().min(2).max(256).optional().describe("Limit output to N colors (for retro effect)"),
  transparency: z.boolean().optional().describe("PNG with transparent background. Essential for sprites/icons"),
  seamless: z.boolean().optional().describe("Tileable texture that repeats without visible seams"),
  format: z.enum(["png", "jpg", "webp"]).optional().describe("Output format. PNG for transparency, JPG for photos, WebP for web"),
  output_dir: z.string().optional().describe("Directory to save the image. If provided, saves file and returns path (no base64). Example: 'C:/Projects/MyGame/assets' or '/home/user/images'"),
  output_subdir: z.string().optional().describe("Subdirectory within output_dir. Example: 'sprites/characters'"),
  filename: z.string().optional().describe("Custom filename (without extension)"),
  return_base64: z.boolean().optional().default(false).describe("If true, includes base64 data in response. Default: false (just returns file path)"),
  model: z.string().optional().describe("OpenRouter model ID. Auto-selected if not specified"),
  seed: z.number().optional().describe("Random seed for reproducible results"),
  guidance_scale: z.number().min(1).max(20).optional().describe("Prompt adherence strength (1-20)"),
  async: z.boolean().optional().describe("Return job_id immediately instead of waiting for completion"),
  priority: z.enum(["low", "normal", "high"]).optional().describe("Job priority for async mode")
});

export type GenerateImageInput = z.infer<typeof generateImageSchema>;

export async function generateImage(
  params: GenerateImageInput,
  apiKey: string
): Promise<{
  success: boolean;
  job_id?: string;
  file_path?: string;
  image?: GeneratedImage;
  error?: string;
  metadata?: {
    model: string;
    prompt_used: string;
    generation_time_ms: number;
    width: number;
    height: number;
    format: string;
  };
}> {
  const startTime = Date.now();
  
  const presetConfig = params.preset ? getPresetConfig(params.preset) : undefined;
  const width = params.width || presetConfig?.defaultWidth || 512;
  const height = params.height || presetConfig?.defaultHeight || 512;
  const transparency = params.transparency ?? presetConfig?.transparency ?? false;
  const format = params.format || (transparency ? "png" : "jpg");

  const enhancedPrompt = buildEnhancedPrompt(params.prompt, {
    preset: params.preset,
    style: params.style,
    colorPalette: params.color_palette,
    paletteName: params.palette_name,
    transparency,
    seamless: params.seamless
  });

  const client = new OpenRouterClient(apiKey);
  const model = params.model || client.selectBestModel({
    preset: params.preset,
    style: params.style,
    resolution: params.resolution,
    requiresSpeed: params.async === false
  });

  if (params.async) {
    const job = jobQueue.createJob("image", params as GenerateImageParams, params.priority);
    return {
      success: true,
      job_id: job.id
    };
  }

  try {
    const imageConfig: ImageConfig = {};
    if (params.aspect_ratio) {
      imageConfig.aspect_ratio = params.aspect_ratio;
    }
    if (params.resolution) {
      imageConfig.image_size = params.resolution;
    }

    const images = await client.generateImage(enhancedPrompt, {
      model,
      negativePrompt: params.negative_prompt,
      imageConfig: Object.keys(imageConfig).length > 0 ? imageConfig : undefined,
      seed: params.seed
    });

    if (images.length === 0) {
      return {
        success: false,
        error: "No images generated"
      };
    }

    let resultImage = images[0];

    const dimensions = await getImageDimensions(resultImage.base64);
    resultImage.width = dimensions.width;
    resultImage.height = dimensions.height;

    if (params.color_count) {
      resultImage.base64 = await reducePalette(resultImage.base64, params.color_count);
    }

    if (params.seamless) {
      resultImage.base64 = await makeSeamless(resultImage.base64);
    }

    if (format !== resultImage.format) {
      resultImage.base64 = await convertFormat(resultImage.base64, format);
      resultImage.format = format;
    }

    let filePath: string | undefined;
    
    if (params.output_dir) {
      const filename = params.filename 
        ? `${params.filename}.${format}`
        : generateFilename(params.preset || "image", format);
      const fullPath = params.output_subdir 
        ? path.join(params.output_dir, params.output_subdir, filename)
        : path.join(params.output_dir, filename);
      
      filePath = await saveImage(resultImage, fullPath);
      resultImage.local_path = filePath;
    }

    const returnBase64 = params.return_base64 ?? false;

    return {
      success: true,
      file_path: filePath,
      image: returnBase64 ? resultImage : (filePath ? undefined : resultImage),
      metadata: {
        model,
        prompt_used: enhancedPrompt,
        generation_time_ms: Date.now() - startTime,
        width: resultImage.width,
        height: resultImage.height,
        format: resultImage.format
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export const generateImageToolDefinition = {
  name: "generate_image",
  description: `Universal AI image generator. Creates any visual asset and saves directly to your project.

GAME ASSETS: sprites, characters, items, enemies, NPCs, power-ups, collectibles
TILESETS: platformer tiles, top-down terrain, isometric buildings, dungeon tiles
WEB ASSETS: hero backgrounds, illustrations, testimonial avatars, profile pictures
UI ELEMENTS: buttons, panels, health bars, inventory slots, dialogs, icons, frames

STYLES: pixel_art (8-bit, 16-bit, 32-bit), vector, realistic, cartoon, anime, chibi, watercolor, flat_design, 3d_render, minimalist, cyberpunk, fantasy, sci_fi

FEATURES: Custom dimensions, color palettes (NES, GameBoy, etc.), transparency, seamless textures, seed for reproducibility.

OUTPUT: Provide output_dir to save directly to your project folder. Returns file_path (no base64 bloat). Set return_base64=true if you need the raw data.`,
  inputSchema: generateImageSchema
};
