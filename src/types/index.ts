export interface ImageConfig {
  aspect_ratio?: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";
  image_size?: "1K" | "2K" | "4K";
}

export interface GenerateImageParams {
  prompt: string;
  negative_prompt?: string;
  preset?: ImagePreset;
  style?: ImageStyle;
  width?: number;
  height?: number;
  aspect_ratio?: AspectRatio;
  resolution?: "1K" | "2K" | "4K";
  color_palette?: string[];
  palette_name?: PaletteName;
  color_count?: number;
  transparency?: boolean;
  seamless?: boolean;
  format?: "png" | "jpg" | "webp";
  output_path?: string;
  filename?: string;
  model?: string;
  seed?: number;
  guidance_scale?: number;
  async?: boolean;
  priority?: "low" | "normal" | "high";
}

export interface GenerateSpriteSheetParams {
  prompt: string;
  animation_type: AnimationType;
  frame_count: number;
  directions?: 1 | 2 | 4 | 8;
  frame_width: number;
  frame_height: number;
  view_angle?: ViewAngle;
  style?: ImageStyle;
  color_palette?: string[];
  palette_name?: PaletteName;
  padding?: number;
  layout?: "horizontal" | "vertical" | "grid";
  transparency?: boolean;
  model?: string;
  seed?: number;
  output_path?: string;
  filename?: string;
}

export interface GenerateTilesetParams {
  prompt: string;
  tileset_type?: TilesetType;
  theme?: string;
  tile_size: number;
  tile_count?: number;
  include_variations?: boolean;
  include_tiles?: string[];
  generate_transitions?: boolean;
  style?: ImageStyle;
  seamless?: boolean;
  model?: string;
  output_path?: string;
}

export type ImagePreset = 
  | "sprite" 
  | "sprite_sheet" 
  | "icon" 
  | "background" 
  | "hero_section" 
  | "testimonial" 
  | "ui_element" 
  | "game_asset" 
  | "illustration" 
  | "texture" 
  | "pattern" 
  | "character" 
  | "tileset";

export type ImageStyle = 
  | "pixel_art" 
  | "retro_8bit" 
  | "retro_16bit" 
  | "retro_32bit"
  | "vector" 
  | "realistic" 
  | "cartoon" 
  | "anime" 
  | "chibi"
  | "watercolor" 
  | "flat_design" 
  | "3d_render" 
  | "hand_drawn"
  | "minimalist" 
  | "cyberpunk" 
  | "fantasy" 
  | "sci_fi";

export type AspectRatio = 
  | "1:1" 
  | "16:9" 
  | "9:16" 
  | "4:3" 
  | "3:4" 
  | "21:9" 
  | "2:3" 
  | "3:2" 
  | "4:5" 
  | "5:4";

export type PaletteName = 
  | "nes" 
  | "gameboy" 
  | "snes" 
  | "commodore64" 
  | "cyberpunk" 
  | "pastel" 
  | "earth" 
  | "neon" 
  | "grayscale";

export type AnimationType = 
  | "walk_cycle" 
  | "run_cycle" 
  | "idle" 
  | "attack" 
  | "jump" 
  | "death" 
  | "hit" 
  | "cast" 
  | "custom";

export type ViewAngle = 
  | "side" 
  | "top_down" 
  | "isometric" 
  | "front" 
  | "3/4";

export type TilesetType = 
  | "platformer" 
  | "top_down" 
  | "isometric" 
  | "wang" 
  | "autotile";

export interface Job {
  id: string;
  status: "queued" | "in_progress" | "completed" | "failed" | "cancelled";
  type: "image" | "sprite_sheet" | "tileset" | "batch";
  params: GenerateImageParams | GenerateSpriteSheetParams | GenerateTilesetParams;
  progress: number;
  result?: JobResult;
  error?: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

export interface JobResult {
  images: GeneratedImage[];
  metadata: {
    model: string;
    generation_time_ms: number;
    prompt_used: string;
  };
}

export interface GeneratedImage {
  base64: string;
  format: string;
  width: number;
  height: number;
  local_path?: string;
}

export interface OpenRouterImageResponse {
  choices: {
    message: {
      role: string;
      content?: string;
      images?: {
        type: "image_url";
        image_url: {
          url: string;
        };
      }[];
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: number;
    completion: number;
    image?: number;
  };
  context_length: number;
  output_modalities: string[];
}
