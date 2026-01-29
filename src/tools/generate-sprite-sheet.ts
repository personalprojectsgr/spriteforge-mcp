import { z } from "zod";
import * as path from "path";
import type { GeneratedImage, ImageConfig } from "../types/index.js";
import { OpenRouterClient } from "../services/openrouter.js";
import { jobQueue } from "../services/job-queue.js";
import { 
  saveImage, 
  generateFilename, 
  assembleSpriteSheet,
  reducePalette
} from "../services/image-utils.js";
import { buildEnhancedPrompt, getStylePrompt } from "../resources/palettes.js";

export const generateSpriteSheetSchema = z.object({
  prompt: z.string().describe("Character/object description. Example: 'A blue slime monster' or 'A warrior knight with sword'"),
  animation_type: z.enum([
    "walk_cycle", "run_cycle", "idle", "attack", "jump", "death", "hit", "cast", "custom"
  ]).describe("Type of animation to generate. Affects frame composition and motion style."),
  frame_count: z.number().min(2).max(32).describe("Number of frames (4, 6, 8, 12, 16 typical). More frames = smoother animation."),
  directions: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]).optional().describe("Directional variants. 4 = up/down/left/right, 8 = includes diagonals"),
  frame_width: z.number().min(16).max(512).describe("Width of each frame in pixels (16-512)"),
  frame_height: z.number().min(16).max(512).describe("Height of each frame in pixels (16-512)"),
  view_angle: z.enum(["side", "top_down", "isometric", "front", "3/4"]).optional().describe("Camera perspective for the sprite"),
  style: z.enum([
    "pixel_art", "retro_8bit", "retro_16bit", "retro_32bit", "vector", 
    "realistic", "cartoon", "anime", "chibi", "watercolor", "flat_design", 
    "3d_render", "hand_drawn", "minimalist", "cyberpunk", "fantasy", "sci_fi"
  ]).optional().describe("Art style for the sprite sheet"),
  color_palette: z.array(z.string()).optional().describe("Hex color codes to use"),
  palette_name: z.enum([
    "nes", "gameboy", "snes", "commodore64", "cyberpunk", 
    "pastel", "earth", "neon", "grayscale"
  ]).optional().describe("Pre-defined color palette"),
  color_count: z.number().min(2).max(256).optional().describe("Limit to N colors"),
  padding: z.number().min(0).max(32).optional().describe("Pixels between frames (default: 0)"),
  layout: z.enum(["horizontal", "vertical", "grid"]).optional().describe("How frames are arranged in the sheet"),
  transparency: z.boolean().optional().describe("PNG with transparent background"),
  model: z.string().optional().describe("OpenRouter model ID"),
  seed: z.number().optional().describe("Random seed for consistent style across frames"),
  output_path: z.string().optional().describe("Custom save path"),
  filename: z.string().optional().describe("Custom filename")
});

export type GenerateSpriteSheetInput = z.infer<typeof generateSpriteSheetSchema>;

const ANIMATION_PROMPTS: Record<string, string> = {
  walk_cycle: "walking animation sequence, one foot in front of the other, natural stride, looping motion",
  run_cycle: "running animation sequence, dynamic fast movement, legs extended, looping sprint",
  idle: "idle breathing animation, subtle movement, standing pose, slight sway or breath",
  attack: "attack animation sequence, wind up, strike, follow through, combat action",
  jump: "jump animation, crouch preparation, leap, airborne, landing",
  death: "death animation sequence, hit reaction, falling, lying down, defeat pose",
  hit: "hit reaction animation, recoil, pain expression, recovery",
  cast: "spell casting animation, hands raised, magical energy, release",
  custom: "animation sequence"
};

const VIEW_ANGLE_PROMPTS: Record<string, string> = {
  side: "side view, profile perspective, 2D platformer style",
  top_down: "top-down view, bird's eye perspective, overhead",
  isometric: "isometric view, 45 degree angle, 2.5D style",
  front: "front facing view, looking at camera",
  "3/4": "three-quarter view, slight angle, RPG style"
};

export async function generateSpriteSheet(
  params: GenerateSpriteSheetInput,
  apiKey: string,
  outputDir?: string
): Promise<{
  success: boolean;
  job_id?: string;
  sprite_sheet?: GeneratedImage;
  individual_frames?: GeneratedImage[];
  saved_path?: string;
  error?: string;
  metadata?: {
    model: string;
    frame_count: number;
    sheet_dimensions: { width: number; height: number };
    generation_time_ms: number;
  };
}> {
  const startTime = Date.now();
  
  const client = new OpenRouterClient(apiKey);
  const model = params.model || client.selectBestModel({
    style: params.style,
    requiresSpeed: false
  });

  const directions = params.directions || 1;
  const totalFrames = params.frame_count * directions;

  const stylePrompt = params.style ? getStylePrompt(params.style) : "";
  const animationPrompt = ANIMATION_PROMPTS[params.animation_type] || ANIMATION_PROMPTS.custom;
  const viewPrompt = params.view_angle ? VIEW_ANGLE_PROMPTS[params.view_angle] : "";

  const frames: GeneratedImage[] = [];
  const errors: string[] = [];
  const baseSeed = params.seed || Math.floor(Math.random() * 1000000);

  for (let dir = 0; dir < directions; dir++) {
    const directionName = getDirectionName(dir, directions);
    
    for (let frame = 0; frame < params.frame_count; frame++) {
      let framePrompt = buildEnhancedPrompt(
        `${params.prompt}, ${animationPrompt}, frame ${frame + 1} of ${params.frame_count}${directionName ? `, facing ${directionName}` : ""}, ${viewPrompt}, sprite sheet frame, consistent character design, same character throughout`,
        {
          style: params.style,
          colorPalette: params.color_palette,
          paletteName: params.palette_name,
          transparency: params.transparency ?? true
        }
      );

      if (stylePrompt) {
        framePrompt = framePrompt + ". " + stylePrompt;
      }

      try {
        const images = await client.generateImage(framePrompt, {
          model,
          seed: baseSeed + frame + (dir * 100),
          imageConfig: {
            aspect_ratio: "1:1"
          }
        });

        if (images.length > 0) {
          let frameImage = images[0];
          
          if (params.color_count) {
            frameImage.base64 = await reducePalette(frameImage.base64, params.color_count);
          }
          
          frames.push(frameImage);
        }
      } catch (error) {
        errors.push(`Frame ${frame + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }

      jobQueue.updateJobProgress(
        "", 
        Math.round(((dir * params.frame_count + frame + 1) / totalFrames) * 90)
      );
    }
  }

  if (frames.length === 0) {
    return {
      success: false,
      error: `Failed to generate any frames. Errors: ${errors.join("; ")}`
    };
  }

  const columns = params.layout === "vertical" ? 1 : 
                  params.layout === "grid" ? Math.ceil(Math.sqrt(frames.length)) : 
                  params.frame_count;

  const spriteSheet = await assembleSpriteSheet(frames, {
    frameWidth: params.frame_width,
    frameHeight: params.frame_height,
    columns,
    padding: params.padding || 0,
    layout: params.layout || "horizontal"
  });

  let savedPath: string | undefined;
  if (outputDir) {
    const filename = params.filename 
      ? `${params.filename}.png`
      : generateFilename(`spritesheet_${params.animation_type}`, "png");
    const fullPath = params.output_path 
      ? path.join(outputDir, params.output_path, filename)
      : path.join(outputDir, "spritesheets", filename);
    
    savedPath = await saveImage(spriteSheet, fullPath);
    spriteSheet.local_path = savedPath;
  }

  return {
    success: true,
    sprite_sheet: spriteSheet,
    individual_frames: frames,
    saved_path: savedPath,
    metadata: {
      model,
      frame_count: frames.length,
      sheet_dimensions: { width: spriteSheet.width, height: spriteSheet.height },
      generation_time_ms: Date.now() - startTime
    }
  };
}

function getDirectionName(index: number, totalDirections: number): string {
  if (totalDirections === 1) return "";
  if (totalDirections === 2) return index === 0 ? "right" : "left";
  if (totalDirections === 4) return ["down", "left", "right", "up"][index] || "";
  if (totalDirections === 8) {
    return ["down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right"][index] || "";
  }
  return "";
}

export const generateSpriteSheetToolDefinition = {
  name: "generate_sprite_sheet",
  description: `Create animation sprite sheets with multiple frames. Perfect for:

ANIMATIONS: walk cycles, run cycles, idle breathing, attack sequences, jump animations, death animations, hit reactions, spell casting

FEATURES:
- Multiple directions (1, 2, 4, or 8 directional)
- Configurable frame count (2-32 frames)
- Custom frame dimensions
- Consistent style across all frames using seed
- Automatic assembly into single sprite sheet image
- Layout options: horizontal strip, vertical strip, or grid

VIEWS: side (platformer), top_down (RPG), isometric, front, 3/4

Generates individual frames and assembles them into a ready-to-use sprite sheet.`,
  inputSchema: generateSpriteSheetSchema
};
