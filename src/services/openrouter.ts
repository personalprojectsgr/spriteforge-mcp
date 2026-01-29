import type { 
  OpenRouterImageResponse, 
  ImageConfig, 
  ModelInfo,
  GeneratedImage 
} from "../types/index.js";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

const IMAGE_MODELS: ModelInfo[] = [
  {
    id: "google/gemini-2.5-flash-image",
    name: "Gemini 2.5 Flash Image (Nano Banana)",
    description: "Google's fast image generation model with great quality and flexible aspect ratios. Best for sprites, icons, and quick generations.",
    pricing: { prompt: 0.0003, completion: 0.0025, image: 0.0000003 },
    context_length: 1048576,
    output_modalities: ["text", "image"]
  },
  {
    id: "google/gemini-3-pro-image-preview",
    name: "Gemini 3 Pro Image (Nano Banana Pro)",
    description: "Google's most advanced image generation with 2K/4K support, superior text rendering, and multi-image blending. Best for hero sections and professional graphics.",
    pricing: { prompt: 0.002, completion: 0.012, image: 0.000002 },
    context_length: 1048576,
    output_modalities: ["text", "image"]
  },
  {
    id: "openai/gpt-5-image-mini",
    name: "GPT-5 Image Mini",
    description: "OpenAI's efficient image generation with superior instruction following and text rendering. Good balance of speed and quality.",
    pricing: { prompt: 0.0025, completion: 0.002 },
    context_length: 128000,
    output_modalities: ["text", "image"]
  },
  {
    id: "openai/gpt-5-image",
    name: "GPT-5 Image",
    description: "OpenAI's flagship image generation model with state-of-the-art quality and reasoning capabilities.",
    pricing: { prompt: 0.01, completion: 0.01 },
    context_length: 128000,
    output_modalities: ["text", "image"]
  }
];

export class OpenRouterClient {
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel?: string) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel || "google/gemini-2.5-flash-image";
  }

  async generateImage(
    prompt: string,
    options: {
      model?: string;
      negativePrompt?: string;
      imageConfig?: ImageConfig;
      seed?: number;
    } = {}
  ): Promise<GeneratedImage[]> {
    const model = options.model || this.defaultModel;
    
    let enhancedPrompt = prompt;
    if (options.negativePrompt) {
      enhancedPrompt += `\n\nAvoid: ${options.negativePrompt}`;
    }

    const payload: Record<string, unknown> = {
      model,
      messages: [
        {
          role: "user",
          content: enhancedPrompt
        }
      ],
      modalities: ["image", "text"],
      stream: false
    };

    if (options.imageConfig) {
      payload.image_config = options.imageConfig;
    }

    if (options.seed !== undefined) {
      payload.seed = options.seed;
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/spriteforge-mcp",
        "X-Title": "SpriteForge MCP"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as OpenRouterImageResponse;
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response from OpenRouter");
    }

    const message = data.choices[0].message;
    const images: GeneratedImage[] = [];

    if (message.images && message.images.length > 0) {
      for (const image of message.images) {
        const dataUrl = image.image_url.url;
        const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        
        if (matches) {
          const format = matches[1];
          const base64 = matches[2];
          
          images.push({
            base64,
            format,
            width: 0,
            height: 0
          });
        }
      }
    }

    if (images.length === 0) {
      throw new Error("No images in response. The model may not support image generation or the prompt was rejected.");
    }

    return images;
  }

  async generateImageStream(
    prompt: string,
    options: {
      model?: string;
      negativePrompt?: string;
      imageConfig?: ImageConfig;
      seed?: number;
    } = {},
    onProgress?: (percent: number) => void
  ): Promise<GeneratedImage[]> {
    const model = options.model || this.defaultModel;
    
    let enhancedPrompt = prompt;
    if (options.negativePrompt) {
      enhancedPrompt += `\n\nAvoid: ${options.negativePrompt}`;
    }

    const payload: Record<string, unknown> = {
      model,
      messages: [
        {
          role: "user",
          content: enhancedPrompt
        }
      ],
      modalities: ["image", "text"],
      stream: true
    };

    if (options.imageConfig) {
      payload.image_config = options.imageConfig;
    }

    if (options.seed !== undefined) {
      payload.seed = options.seed;
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/spriteforge-mcp",
        "X-Title": "SpriteForge MCP"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    const images: GeneratedImage[] = [];
    let buffer = "";
    let progressEstimate = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const chunk = JSON.parse(data);
            
            progressEstimate = Math.min(progressEstimate + 5, 95);
            onProgress?.(progressEstimate);

            if (chunk.choices?.[0]?.delta?.images) {
              for (const image of chunk.choices[0].delta.images) {
                const dataUrl = image.image_url.url;
                const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
                
                if (matches) {
                  images.push({
                    base64: matches[2],
                    format: matches[1],
                    width: 0,
                    height: 0
                  });
                }
              }
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    onProgress?.(100);

    if (images.length === 0) {
      throw new Error("No images in streaming response");
    }

    return images;
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(OPENROUTER_MODELS_URL, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        return IMAGE_MODELS;
      }

      const data = await response.json() as { data: Array<{
        id: string;
        name: string;
        description: string;
        pricing: { prompt: string; completion: string; image?: string };
        context_length: number;
        architecture: { modality: string; output_modality?: string[] };
      }> };
      
      const imageModels = data.data.filter(model => 
        model.architecture?.output_modality?.includes("image") ||
        model.id.includes("image") ||
        model.id.includes("flux")
      );

      if (imageModels.length === 0) {
        return IMAGE_MODELS;
      }

      return imageModels.map(model => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description || "",
        pricing: {
          prompt: parseFloat(model.pricing?.prompt || "0"),
          completion: parseFloat(model.pricing?.completion || "0"),
          image: model.pricing?.image ? parseFloat(model.pricing.image) : undefined
        },
        context_length: model.context_length || 4096,
        output_modalities: model.architecture?.output_modality || ["image"]
      }));
    } catch {
      return IMAGE_MODELS;
    }
  }

  selectBestModel(params: {
    preset?: string;
    style?: string;
    resolution?: string;
    requiresSpeed?: boolean;
  }): string {
    if (params.requiresSpeed) {
      return "google/gemini-2.5-flash-image";
    }

    if (params.resolution === "4K" || params.resolution === "2K") {
      return "google/gemini-3-pro-image-preview";
    }

    if (params.style?.includes("pixel") || params.style?.includes("retro")) {
      return "google/gemini-2.5-flash-image";
    }

    if (params.preset === "hero_section" || params.preset === "background") {
      return "google/gemini-2.5-flash-image";
    }

    return this.defaultModel;
  }
}

export function createOpenRouterClient(apiKey: string): OpenRouterClient {
  return new OpenRouterClient(apiKey);
}
