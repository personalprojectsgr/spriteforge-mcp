import { z } from "zod";
import { jobQueue } from "../services/job-queue.js";
import type { Job } from "../types/index.js";

export const checkJobSchema = z.object({
  job_id: z.string().describe("Job ID returned from async generation request")
});

export const listJobsSchema = z.object({
  status: z.enum(["queued", "in_progress", "completed", "failed", "cancelled"]).optional().describe("Filter by job status"),
  type: z.enum(["image", "sprite_sheet", "tileset", "batch"]).optional().describe("Filter by job type"),
  limit: z.number().min(1).max(100).optional().describe("Maximum number of jobs to return (default: 20)")
});

export const cancelJobSchema = z.object({
  job_id: z.string().describe("Job ID to cancel")
});

export type CheckJobInput = z.infer<typeof checkJobSchema>;
export type ListJobsInput = z.infer<typeof listJobsSchema>;
export type CancelJobInput = z.infer<typeof cancelJobSchema>;

export function checkJob(params: CheckJobInput): {
  found: boolean;
  job?: {
    id: string;
    status: Job["status"];
    type: Job["type"];
    progress: number;
    result?: Job["result"];
    error?: string;
    created_at: string;
    updated_at: string;
    completed_at?: string;
  };
} {
  const job = jobQueue.getJob(params.job_id);
  
  if (!job) {
    return { found: false };
  }

  return {
    found: true,
    job: {
      id: job.id,
      status: job.status,
      type: job.type,
      progress: job.progress,
      result: job.result,
      error: job.error,
      created_at: job.created_at.toISOString(),
      updated_at: job.updated_at.toISOString(),
      completed_at: job.completed_at?.toISOString()
    }
  };
}

export function listJobs(params: ListJobsInput): {
  jobs: Array<{
    id: string;
    status: Job["status"];
    type: Job["type"];
    progress: number;
    prompt_preview: string;
    created_at: string;
  }>;
  stats: {
    total: number;
    queued: number;
    in_progress: number;
    completed: number;
    failed: number;
  };
} {
  const jobs = jobQueue.listJobs({
    status: params.status,
    type: params.type,
    limit: params.limit || 20
  });

  return {
    jobs: jobs.map(job => ({
      id: job.id,
      status: job.status,
      type: job.type,
      progress: job.progress,
      prompt_preview: getPromptPreview(job),
      created_at: job.created_at.toISOString()
    })),
    stats: jobQueue.getStats()
  };
}

export function cancelJob(params: CancelJobInput): {
  success: boolean;
  message: string;
} {
  const cancelled = jobQueue.cancelJob(params.job_id);
  
  if (cancelled) {
    return {
      success: true,
      message: `Job ${params.job_id} has been cancelled`
    };
  }

  const job = jobQueue.getJob(params.job_id);
  if (!job) {
    return {
      success: false,
      message: `Job ${params.job_id} not found`
    };
  }

  return {
    success: false,
    message: `Cannot cancel job in '${job.status}' status. Only 'queued' jobs can be cancelled.`
  };
}

function getPromptPreview(job: Job): string {
  const params = job.params as { prompt?: string };
  const prompt = params.prompt || "";
  return prompt.length > 50 ? prompt.substring(0, 47) + "..." : prompt;
}

export const checkJobToolDefinition = {
  name: "check_job",
  description: `Check the status and result of an async image generation job.

Use after calling generate_image, generate_sprite_sheet, etc. with async:true.

Returns:
- status: queued, in_progress, completed, failed, or cancelled
- progress: 0-100 percentage
- result: Generated images (when completed)
- error: Error message (when failed)`,
  inputSchema: checkJobSchema
};

export const listJobsToolDefinition = {
  name: "list_jobs",
  description: `List all image generation jobs with their status.

Can filter by:
- status: queued, in_progress, completed, failed, cancelled
- type: image, sprite_sheet, tileset, batch

Returns job list and queue statistics.`,
  inputSchema: listJobsSchema
};

export const cancelJobToolDefinition = {
  name: "cancel_job",
  description: `Cancel a queued job before it starts processing.

Only jobs with 'queued' status can be cancelled.
Jobs that are already 'in_progress' cannot be cancelled.`,
  inputSchema: cancelJobSchema
};
