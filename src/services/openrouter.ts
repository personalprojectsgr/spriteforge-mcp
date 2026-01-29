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
    id: "google/gemini-2.5-flash-preview-image-generation",
    name: "Gemini 2.5 Flash Image",
    description: "Google's fast image generation model with great quality and flexible aspect ratios",
    pricing: { prompt: 0.00015, completion: 0.0006, image: 0.0039 },
    context_length: 1048576,
    output_modalities: ["text", "image"]
  },
  {
    id: "google/gemini-2.5-pro-preview-image-generation",
    name: "Gemini 2.5 Pro Image",
    description: "Google's most advanced image generation with 2K/4K support and superior text rendering",
    pricing: { prompt: 0.00125, completion: 0.01, image: 0.039 },
    context_length: 1048576,
    output_modalities: ["text", "image"]
  },
  {
    id: "black-forest-labs/flux-1.1-pro",
    name: "FLUX 1.1 Pro",
    description: "Black Forest Labs' high-quality image generation model",
    pricing: { prompt: 0.04, completion: 0.04 },
    context_length: 4096,
    output_modalities: ["image"]
  },
  {
    id: "black-forest-labs/flux-schnell",
    name: "FLUX Schnell",
    description: "Fast, efficient image generation from Black Forest Labs",
    pricing: { prompt: 0.003, completion: 0.003 },
    context_length: 4096,
    output_modalities: ["image"]
  }
];

export class OpenRouterClient {
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel?: string) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel || "google/gemini-2.5-flash-preview-image-generation";
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
      return "black-forest-labs/flux-schnell";
    }

    if (params.resolution === "4K" || params.resolution === "2K") {
      return "google/gemini-2.5-pro-preview-image-generation";
    }

    if (params.style?.includes("pixel") || params.style?.includes("retro")) {
      return "google/gemini-2.5-flash-preview-image-generation";
    }

    if (params.preset === "hero_section" || params.preset === "background") {
      return "google/gemini-2.5-flash-preview-image-generation";
    }

    return this.defaultModel;
  }
}

export function createOpenRouterClient(apiKey: string): OpenRouterClient {
  return new OpenRouterClient(apiKey);
}
