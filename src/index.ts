import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";

import { 
  generateImage, 
  generateImageSchema, 
  generateImageToolDefinition,
  type GenerateImageInput
} from "./tools/generate-image.js";
import { 
  generateSpriteSheet, 
  generateSpriteSheetSchema, 
  generateSpriteSheetToolDefinition,
  type GenerateSpriteSheetInput
} from "./tools/generate-sprite-sheet.js";
import {
  checkJob,
  listJobs,
  cancelJob,
  checkJobSchema,
  listJobsSchema,
  cancelJobSchema,
  checkJobToolDefinition,
  listJobsToolDefinition,
  cancelJobToolDefinition,
  type CheckJobInput,
  type ListJobsInput,
  type CancelJobInput
} from "./tools/job-management.js";
import {
  listModels,
  listModelsSchema,
  listModelsToolDefinition,
  type ListModelsInput
} from "./tools/list-models.js";
import { COLOR_PALETTES, STYLE_PROMPTS, PRESET_CONFIGS } from "./resources/palettes.js";
import { jobQueue } from "./services/job-queue.js";
import { generateImage as generateImageCore } from "./tools/generate-image.js";
import type { GenerateImageParams, GenerateSpriteSheetParams, Job, JobResult } from "./types/index.js";

const PORT = parseInt(process.env.PORT || "3000");
const OUTPUT_DIR = process.env.OUTPUT_DIR || "./generated";

function getApiKey(env?: Record<string, string>): string {
  return env?.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || "";
}

function zodToJsonSchema(zodSchema: z.ZodObject<z.ZodRawShape>) {
  const properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    items?: { type: string };
    minimum?: number;
    maximum?: number;
  }> = {};
  const required: string[] = [];

  const shape = zodSchema.shape;
  
  for (const [key, fieldSchema] of Object.entries(shape)) {
    const zodField = fieldSchema as z.ZodTypeAny;
    let prop: {
      type: string;
      description?: string;
      enum?: string[];
      items?: { type: string };
      minimum?: number;
      maximum?: number;
    } = { type: "string" };

    let isOptional = false;
    let innerSchema = zodField;

    if (zodField._def.typeName === "ZodOptional") {
      isOptional = true;
      innerSchema = zodField._def.innerType;
    }

    const typeName = innerSchema._def.typeName;

    if (typeName === "ZodString") {
      prop.type = "string";
    } else if (typeName === "ZodNumber") {
      prop.type = "number";
      const checks = innerSchema._def.checks || [];
      for (const check of checks) {
        if (check.kind === "min") prop.minimum = check.value;
        if (check.kind === "max") prop.maximum = check.value;
      }
    } else if (typeName === "ZodBoolean") {
      prop.type = "boolean";
    } else if (typeName === "ZodEnum") {
      prop.type = "string";
      prop.enum = innerSchema._def.values;
    } else if (typeName === "ZodArray") {
      prop.type = "array";
      prop.items = { type: "string" };
    } else if (typeName === "ZodUnion" || typeName === "ZodLiteral") {
      prop.type = "number";
    }

    if (zodField.description) {
      prop.description = zodField.description;
    }

    properties[key] = prop;

    if (!isOptional) {
      required.push(key);
    }
  }

  return {
    type: "object" as const,
    properties,
    required
  };
}

async function createMcpServer(env?: Record<string, string>) {
  const server = new Server(
    {
      name: "spriteforge",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: generateImageToolDefinition.name,
          description: generateImageToolDefinition.description,
          inputSchema: zodToJsonSchema(generateImageSchema)
        },
        {
          name: generateSpriteSheetToolDefinition.name,
          description: generateSpriteSheetToolDefinition.description,
          inputSchema: zodToJsonSchema(generateSpriteSheetSchema)
        },
        {
          name: checkJobToolDefinition.name,
          description: checkJobToolDefinition.description,
          inputSchema: zodToJsonSchema(checkJobSchema)
        },
        {
          name: listJobsToolDefinition.name,
          description: listJobsToolDefinition.description,
          inputSchema: zodToJsonSchema(listJobsSchema)
        },
        {
          name: cancelJobToolDefinition.name,
          description: cancelJobToolDefinition.description,
          inputSchema: zodToJsonSchema(cancelJobSchema)
        },
        {
          name: listModelsToolDefinition.name,
          description: listModelsToolDefinition.description,
          inputSchema: zodToJsonSchema(listModelsSchema)
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const apiKey = getApiKey(env);

    if (!apiKey && name !== "check_job" && name !== "list_jobs" && name !== "cancel_job") {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "OPENROUTER_API_KEY not configured" })
          }
        ]
      };
    }

    try {
      let result: unknown;

      switch (name) {
        case "generate_image": {
          const params = generateImageSchema.parse(args);
          result = await generateImage(params, apiKey, OUTPUT_DIR);
          break;
        }
        case "generate_sprite_sheet": {
          const params = generateSpriteSheetSchema.parse(args);
          result = await generateSpriteSheet(params, apiKey, OUTPUT_DIR);
          break;
        }
        case "check_job": {
          const params = checkJobSchema.parse(args);
          result = checkJob(params);
          break;
        }
        case "list_jobs": {
          const params = listJobsSchema.parse(args);
          result = listJobs(params);
          break;
        }
        case "cancel_job": {
          const params = cancelJobSchema.parse(args);
          result = cancelJob(params);
          break;
        }
        case "list_models": {
          const params = listModelsSchema.parse(args);
          result = await listModels(params, apiKey);
          break;
        }
        default:
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: `Unknown tool: ${name}` })
              }
            ]
          };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ 
              error: error instanceof Error ? error.message : "Unknown error"
            })
          }
        ]
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "spriteforge://palettes",
          name: "Color Palettes",
          description: "Pre-defined color palettes (NES, GameBoy, SNES, Cyberpunk, etc.)",
          mimeType: "application/json"
        },
        {
          uri: "spriteforge://styles",
          name: "Style Prompts",
          description: "Available art styles and their prompt enhancements",
          mimeType: "application/json"
        },
        {
          uri: "spriteforge://presets",
          name: "Image Presets",
          description: "Preset configurations for different image types (sprite, hero_section, etc.)",
          mimeType: "application/json"
        }
      ]
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    switch (uri) {
      case "spriteforge://palettes":
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(COLOR_PALETTES, null, 2)
            }
          ]
        };
      case "spriteforge://styles":
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(STYLE_PROMPTS, null, 2)
            }
          ]
        };
      case "spriteforge://presets":
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(PRESET_CONFIGS, null, 2)
            }
          ]
        };
      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  });

  return server;
}

async function setupJobExecutor(apiKey: string) {
  jobQueue.setExecutor(async (job: Job): Promise<JobResult> => {
    if (job.type === "image") {
      const params = job.params as GenerateImageParams;
      const result = await generateImageCore(
        params as GenerateImageInput,
        apiKey,
        OUTPUT_DIR
      );
      
      if (!result.success || !result.image) {
        throw new Error(result.error || "Image generation failed");
      }

      return {
        images: [result.image],
        metadata: result.metadata || {
          model: "unknown",
          generation_time_ms: 0,
          prompt_used: params.prompt
        }
      };
    }

    throw new Error(`Unsupported job type: ${job.type}`);
  });
}

async function runStdioServer() {
  const server = await createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  const apiKey = getApiKey();
  if (apiKey) {
    setupJobExecutor(apiKey);
  }
  
  console.error("SpriteForge MCP server running on stdio");
}

async function handleToolCall(
  name: string,
  args: unknown,
  env: Record<string, string>
): Promise<unknown> {
  const apiKey = getApiKey(env);

  if (!apiKey && name !== "check_job" && name !== "list_jobs" && name !== "cancel_job") {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }) }]
    };
  }

  let result: unknown;

  switch (name) {
    case "generate_image": {
      const params = generateImageSchema.parse(args);
      result = await generateImage(params, apiKey, OUTPUT_DIR);
      break;
    }
    case "generate_sprite_sheet": {
      const params = generateSpriteSheetSchema.parse(args);
      result = await generateSpriteSheet(params, apiKey, OUTPUT_DIR);
      break;
    }
    case "check_job": {
      const params = checkJobSchema.parse(args);
      result = checkJob(params);
      break;
    }
    case "list_jobs": {
      const params = listJobsSchema.parse(args);
      result = listJobs(params);
      break;
    }
    case "cancel_job": {
      const params = cancelJobSchema.parse(args);
      result = cancelJob(params);
      break;
    }
    case "list_models": {
      const params = listModelsSchema.parse(args);
      result = await listModels(params, apiKey);
      break;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
}

function getToolsList() {
  return {
    tools: [
      {
        name: generateImageToolDefinition.name,
        description: generateImageToolDefinition.description,
        inputSchema: zodToJsonSchema(generateImageSchema)
      },
      {
        name: generateSpriteSheetToolDefinition.name,
        description: generateSpriteSheetToolDefinition.description,
        inputSchema: zodToJsonSchema(generateSpriteSheetSchema)
      },
      {
        name: checkJobToolDefinition.name,
        description: checkJobToolDefinition.description,
        inputSchema: zodToJsonSchema(checkJobSchema)
      },
      {
        name: listJobsToolDefinition.name,
        description: listJobsToolDefinition.description,
        inputSchema: zodToJsonSchema(listJobsSchema)
      },
      {
        name: cancelJobToolDefinition.name,
        description: cancelJobToolDefinition.description,
        inputSchema: zodToJsonSchema(cancelJobSchema)
      },
      {
        name: listModelsToolDefinition.name,
        description: listModelsToolDefinition.description,
        inputSchema: zodToJsonSchema(listModelsSchema)
      }
    ]
  };
}

function getResourcesList() {
  return {
    resources: [
      {
        uri: "spriteforge://palettes",
        name: "Color Palettes",
        description: "Pre-defined color palettes (NES, GameBoy, SNES, Cyberpunk, etc.)",
        mimeType: "application/json"
      },
      {
        uri: "spriteforge://styles",
        name: "Style Prompts",
        description: "Available art styles and their prompt enhancements",
        mimeType: "application/json"
      },
      {
        uri: "spriteforge://presets",
        name: "Image Presets",
        description: "Preset configurations for different image types (sprite, hero_section, etc.)",
        mimeType: "application/json"
      }
    ]
  };
}

function readResource(uri: string) {
  switch (uri) {
    case "spriteforge://palettes":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(COLOR_PALETTES, null, 2) }]
      };
    case "spriteforge://styles":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(STYLE_PROMPTS, null, 2) }]
      };
    case "spriteforge://presets":
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(PRESET_CONFIGS, null, 2) }]
      };
    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
}

async function runHttpServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));

  interface McpSession {
    env: Record<string, string>;
    lastActivity: number;
  }
  const sessions: Map<string, McpSession> = new Map();

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", version: "1.0.0", tools: getToolsList().tools.length });
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = (req.headers["mcp-session-id"] as string) || randomUUID();
    const env = req.body?.env || {};
    
    let session = sessions.get(sessionId);
    
    if (!session) {
      session = { env, lastActivity: Date.now() };
      sessions.set(sessionId, session);
      
      const apiKey = getApiKey(env);
      if (apiKey) {
        setupJobExecutor(apiKey);
      }
    } else {
      Object.assign(session.env, env);
    }
    
    session.lastActivity = Date.now();
    
    res.setHeader("Mcp-Session-Id", sessionId);
    
    const { method, params, id } = req.body;
    
    try {
      let result: unknown;
      
      switch (method) {
        case "initialize":
          result = {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {}, resources: {} },
            serverInfo: { name: "spriteforge", version: "1.0.0" }
          };
          break;
          
        case "tools/list":
          result = getToolsList();
          break;
          
        case "tools/call":
          result = await handleToolCall(params.name, params.arguments, session.env);
          break;
          
        case "resources/list":
          result = getResourcesList();
          break;
          
        case "resources/read":
          result = readResource(params.uri);
          break;
          
        default:
          throw new Error(`Unknown method: ${method}`);
      }
      
      res.json({ jsonrpc: "2.0", id, result });
    } catch (error) {
      res.json({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : "Unknown error"
        }
      });
    }
  });

  setInterval(() => {
    const now = Date.now();
    const timeout = 1000 * 60 * 30;
    for (const [id, session] of sessions.entries()) {
      if (now - session.lastActivity > timeout) {
        sessions.delete(id);
      }
    }
  }, 1000 * 60 * 5);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SpriteForge MCP server running on http://0.0.0.0:${PORT}`);
    console.log("Endpoints:");
    console.log("  GET  /health - Health check");
    console.log("  POST /mcp    - MCP protocol endpoint");
  });
}

console.log("Starting SpriteForge MCP server...");
console.log(`PORT: ${process.env.PORT}, MCP_TRANSPORT: ${process.env.MCP_TRANSPORT}`);

const isHttp = process.env.MCP_TRANSPORT === "http" || process.env.PORT;

if (isHttp) {
  console.log("Running in HTTP mode...");
  runHttpServer().catch((err) => {
    console.error("Failed to start HTTP server:", err);
    process.exit(1);
  });
} else {
  console.log("Running in stdio mode...");
  runStdioServer().catch((err) => {
    console.error("Failed to start stdio server:", err);
    process.exit(1);
  });
}
