import { z } from "zod";
import { OpenRouterClient } from "../services/openrouter.js";
import type { ModelInfo } from "../types/index.js";

export const listModelsSchema = z.object({
  refresh: z.boolean().optional().describe("Force refresh from OpenRouter API (default: use cached list)")
});

export type ListModelsInput = z.infer<typeof listModelsSchema>;

let cachedModels: ModelInfo[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 1000 * 60 * 60;

export async function listModels(
  params: ListModelsInput,
  apiKey: string
): Promise<{
  models: Array<{
    id: string;
    name: string;
    description: string;
    pricing: {
      prompt_per_1k: number;
      completion_per_1k: number;
      image_per_generation?: number;
    };
    recommended_for: string[];
  }>;
}> {
  const now = Date.now();
  
  if (!params.refresh && cachedModels && (now - lastFetchTime) < CACHE_TTL_MS) {
    return { models: formatModels(cachedModels) };
  }

  const client = new OpenRouterClient(apiKey);
  const models = await client.listModels();
  
  cachedModels = models;
  lastFetchTime = now;

  return { models: formatModels(models) };
}

function formatModels(models: ModelInfo[]): Array<{
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt_per_1k: number;
    completion_per_1k: number;
    image_per_generation?: number;
  };
  recommended_for: string[];
}> {
  return models.map(model => ({
    id: model.id,
    name: model.name,
    description: model.description,
    pricing: {
      prompt_per_1k: model.pricing.prompt * 1000,
      completion_per_1k: model.pricing.completion * 1000,
      image_per_generation: model.pricing.image
    },
    recommended_for: getRecommendations(model)
  }));
}

function getRecommendations(model: ModelInfo): string[] {
  const recommendations: string[] = [];

  if (model.id.includes("flash")) {
    recommendations.push("fast generation", "sprites", "icons", "batch operations");
  }
  if (model.id.includes("pro")) {
    recommendations.push("high quality", "detailed illustrations", "hero sections", "4K output");
  }
  if (model.id.includes("flux")) {
    recommendations.push("realistic images", "photography style", "detailed textures");
  }
  if (model.id.includes("schnell")) {
    recommendations.push("quick prototypes", "low cost", "rapid iteration");
  }
  if (model.id.includes("gemini")) {
    recommendations.push("flexible aspect ratios", "text rendering", "game assets");
  }

  if (recommendations.length === 0) {
    recommendations.push("general purpose");
  }

  return recommendations;
}

export const listModelsToolDefinition = {
  name: "list_models",
  description: `List available OpenRouter image generation models.

Shows:
- Model ID (use in generate_image's 'model' parameter)
- Name and description
- Pricing (per 1K tokens and per image)
- Recommended use cases

Models include:
- Gemini 2.5 Flash/Pro (Google) - Fast, flexible, good text rendering
- FLUX 1.1 Pro/Schnell (Black Forest Labs) - High quality realistic images
- And more as OpenRouter adds them

Use 'refresh: true' to get latest models from API.`,
  inputSchema: listModelsSchema
};
