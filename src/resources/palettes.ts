export interface ColorPalette {
  name: string;
  description: string;
  colors: string[];
}

export const COLOR_PALETTES: Record<string, ColorPalette> = {
  nes: {
    name: "NES",
    description: "Classic Nintendo Entertainment System 54-color palette",
    colors: [
      "#7C7C7C", "#0000FC", "#0000BC", "#4428BC", "#940084", "#A80020", "#A81000", "#881400",
      "#503000", "#007800", "#006800", "#005800", "#004058", "#000000", "#000000", "#000000",
      "#BCBCBC", "#0078F8", "#0058F8", "#6844FC", "#D800CC", "#E40058", "#F83800", "#E45C10",
      "#AC7C00", "#00B800", "#00A800", "#00A844", "#008888", "#000000", "#000000", "#000000",
      "#F8F8F8", "#3CBCFC", "#6888FC", "#9878F8", "#F878F8", "#F85898", "#F87858", "#FCA044",
      "#F8B800", "#B8F818", "#58D854", "#58F898", "#00E8D8", "#787878", "#000000", "#000000",
      "#FCFCFC", "#A4E4FC", "#B8B8F8", "#D8B8F8", "#F8B8F8", "#F8A4C0", "#F0D0B0", "#FCE0A8",
      "#F8D878", "#D8F878", "#B8F8B8", "#B8F8D8", "#00FCFC", "#F8D8F8", "#000000", "#000000"
    ]
  },
  gameboy: {
    name: "Game Boy",
    description: "Original Game Boy 4-shade green palette",
    colors: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"]
  },
  gameboyPocket: {
    name: "Game Boy Pocket",
    description: "Game Boy Pocket grayscale palette",
    colors: ["#000000", "#545454", "#a8a8a8", "#fcfcfc"]
  },
  snes: {
    name: "SNES",
    description: "Super Nintendo 16-color starter palette",
    colors: [
      "#000000", "#1D2B53", "#7E2553", "#008751", "#AB5236", "#5F574F", "#C2C3C7", "#FFF1E8",
      "#FF004D", "#FFA300", "#FFEC27", "#00E436", "#29ADFF", "#83769C", "#FF77A8", "#FFCCAA"
    ]
  },
  commodore64: {
    name: "Commodore 64",
    description: "Classic C64 16-color palette",
    colors: [
      "#000000", "#FFFFFF", "#880000", "#AAFFEE", "#CC44CC", "#00CC55", "#0000AA", "#EEEE77",
      "#DD8855", "#664400", "#FF7777", "#333333", "#777777", "#AAFF66", "#0088FF", "#BBBBBB"
    ]
  },
  cyberpunk: {
    name: "Cyberpunk",
    description: "Neon cyberpunk color scheme",
    colors: [
      "#0D0221", "#0F0326", "#261447", "#3D1E6D", "#8758FF", "#5CB8E4", "#2DE2E6", "#FF6AC1",
      "#FF3864", "#F9C80E", "#F86624", "#EA3546", "#43BCCD", "#662D91", "#9D4EDD", "#E384FF"
    ]
  },
  pastel: {
    name: "Pastel",
    description: "Soft pastel color palette",
    colors: [
      "#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF", "#E0BBE4", "#957DAD", "#D291BC",
      "#FEC8D8", "#FFDFD3", "#B5EAD7", "#C7CEEA", "#FF9AA2", "#FFB7B2", "#FFDAC1", "#E2F0CB"
    ]
  },
  earth: {
    name: "Earth Tones",
    description: "Natural earth tone palette",
    colors: [
      "#2C1810", "#4A2C2A", "#774936", "#A67B5B", "#C4A484", "#DCC9B6", "#F5E6D3", "#8B7355",
      "#6B8E4E", "#4A7023", "#2E5A1C", "#8B4513", "#A0522D", "#CD853F", "#DEB887", "#F4A460"
    ]
  },
  neon: {
    name: "Neon",
    description: "Bright neon colors",
    colors: [
      "#FF0099", "#FF6600", "#FFFF00", "#00FF00", "#00FFFF", "#0066FF", "#9900FF", "#FF0066",
      "#FF3300", "#FFCC00", "#99FF00", "#00FF99", "#00CCFF", "#3300FF", "#CC00FF", "#FF0033"
    ]
  },
  grayscale: {
    name: "Grayscale",
    description: "8-shade grayscale palette",
    colors: ["#000000", "#242424", "#484848", "#6D6D6D", "#919191", "#B6B6B6", "#DADADA", "#FFFFFF"]
  },
  pico8: {
    name: "PICO-8",
    description: "PICO-8 fantasy console palette",
    colors: [
      "#000000", "#1D2B53", "#7E2553", "#008751", "#AB5236", "#5F574F", "#C2C3C7", "#FFF1E8",
      "#FF004D", "#FFA300", "#FFEC27", "#00E436", "#29ADFF", "#83769C", "#FF77A8", "#FFCCAA"
    ]
  },
  endesga32: {
    name: "ENDESGA 32",
    description: "Popular 32-color pixel art palette",
    colors: [
      "#BE4A2F", "#D77643", "#EAD4AA", "#E4A672", "#B86F50", "#733E39", "#3E2731", "#A22633",
      "#E43B44", "#F77622", "#FEAE34", "#FEE761", "#63C74D", "#3E8948", "#265C42", "#193C3E",
      "#124E89", "#0099DB", "#2CE8F5", "#FFFFFF", "#C0CBDC", "#8B9BB4", "#5A6988", "#3A4466",
      "#262B44", "#181425", "#FF0044", "#68386C", "#B55088", "#F6757A", "#E8B796", "#C28569"
    ]
  }
};

export const STYLE_PROMPTS: Record<string, string> = {
  pixel_art: "pixel art style, crisp pixels, no anti-aliasing, retro game aesthetic",
  retro_8bit: "8-bit pixel art style, limited color palette, NES-era graphics, chunky pixels",
  retro_16bit: "16-bit pixel art style, SNES/Genesis era graphics, detailed sprites, vibrant colors",
  retro_32bit: "32-bit pixel art style, PlayStation 1 era, pre-rendered style, detailed shading",
  vector: "vector art style, clean lines, flat colors, scalable graphics, modern design",
  realistic: "photorealistic style, detailed textures, natural lighting, high definition",
  cartoon: "cartoon style, bold outlines, exaggerated features, vibrant colors, playful",
  anime: "anime style, large expressive eyes, dynamic poses, Japanese animation aesthetic",
  chibi: "chibi style, super-deformed proportions, cute, big head small body, kawaii",
  watercolor: "watercolor painting style, soft edges, color bleeding, artistic, painterly",
  flat_design: "flat design style, minimal shadows, solid colors, modern UI aesthetic",
  "3d_render": "3D rendered style, volumetric lighting, ambient occlusion, realistic materials",
  hand_drawn: "hand-drawn sketch style, pencil strokes, organic lines, artistic imperfections",
  minimalist: "minimalist style, simple shapes, limited colors, clean design, essential elements only",
  cyberpunk: "cyberpunk style, neon lights, dark atmosphere, futuristic technology, rain-soaked streets",
  fantasy: "fantasy art style, magical elements, epic lighting, detailed environments, mythical",
  sci_fi: "science fiction style, futuristic technology, space aesthetic, sleek designs, chrome"
};

export const PRESET_CONFIGS: Record<string, {
  defaultWidth: number;
  defaultHeight: number;
  promptSuffix: string;
  transparency: boolean;
}> = {
  sprite: {
    defaultWidth: 64,
    defaultHeight: 64,
    promptSuffix: "game sprite, single character or object, centered, clean edges, suitable for game engine import",
    transparency: true
  },
  sprite_sheet: {
    defaultWidth: 256,
    defaultHeight: 64,
    promptSuffix: "sprite sheet, animation frames, consistent style across all frames, game asset",
    transparency: true
  },
  icon: {
    defaultWidth: 64,
    defaultHeight: 64,
    promptSuffix: "icon design, simple recognizable shape, clear silhouette, UI element",
    transparency: true
  },
  background: {
    defaultWidth: 1920,
    defaultHeight: 1080,
    promptSuffix: "background image, environment art, atmospheric, no main subject blocking view",
    transparency: false
  },
  hero_section: {
    defaultWidth: 1920,
    defaultHeight: 800,
    promptSuffix: "website hero section background, professional, modern design, suitable for text overlay",
    transparency: false
  },
  testimonial: {
    defaultWidth: 256,
    defaultHeight: 256,
    promptSuffix: "professional portrait, friendly expression, suitable for testimonial section, clean background",
    transparency: false
  },
  ui_element: {
    defaultWidth: 128,
    defaultHeight: 128,
    promptSuffix: "UI element, game interface component, clean edges, suitable for game HUD",
    transparency: true
  },
  game_asset: {
    defaultWidth: 128,
    defaultHeight: 128,
    promptSuffix: "game asset, detailed, suitable for game engine, optimized for real-time rendering",
    transparency: true
  },
  illustration: {
    defaultWidth: 1024,
    defaultHeight: 1024,
    promptSuffix: "detailed illustration, artistic composition, high quality artwork",
    transparency: false
  },
  texture: {
    defaultWidth: 512,
    defaultHeight: 512,
    promptSuffix: "seamless tileable texture, pattern continues at edges, suitable for 3D or 2D tiling",
    transparency: false
  },
  pattern: {
    defaultWidth: 512,
    defaultHeight: 512,
    promptSuffix: "repeating pattern, decorative design, seamless tiling",
    transparency: false
  },
  character: {
    defaultWidth: 256,
    defaultHeight: 256,
    promptSuffix: "character design, full body visible, clear details, suitable for game or animation",
    transparency: true
  },
  tileset: {
    defaultWidth: 256,
    defaultHeight: 256,
    promptSuffix: "game tileset, multiple tile variations, grid layout, consistent style, suitable for level design",
    transparency: true
  }
};

export function getPaletteColors(paletteName: string): string[] | undefined {
  return COLOR_PALETTES[paletteName]?.colors;
}

export function getStylePrompt(style: string): string {
  return STYLE_PROMPTS[style] || "";
}

export function getPresetConfig(preset: string) {
  return PRESET_CONFIGS[preset];
}

export function buildEnhancedPrompt(
  basePrompt: string,
  options: {
    preset?: string;
    style?: string;
    colorPalette?: string[];
    paletteName?: string;
    transparency?: boolean;
    seamless?: boolean;
  }
): string {
  const parts: string[] = [basePrompt];

  if (options.style) {
    const stylePrompt = getStylePrompt(options.style);
    if (stylePrompt) {
      parts.push(stylePrompt);
    }
  }

  if (options.preset) {
    const presetConfig = getPresetConfig(options.preset);
    if (presetConfig) {
      parts.push(presetConfig.promptSuffix);
    }
  }

  if (options.paletteName) {
    const palette = COLOR_PALETTES[options.paletteName];
    if (palette) {
      parts.push(`using ${palette.name} color palette`);
    }
  } else if (options.colorPalette && options.colorPalette.length > 0) {
    parts.push(`using only these colors: ${options.colorPalette.join(", ")}`);
  }

  if (options.transparency) {
    parts.push("transparent background, PNG format with alpha channel");
  }

  if (options.seamless) {
    parts.push("seamless tileable pattern, edges connect perfectly when tiled");
  }

  return parts.join(". ");
}
