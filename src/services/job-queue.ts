import { v4 as uuidv4 } from "uuid";
import type { Job, JobResult, GenerateImageParams, GenerateSpriteSheetParams, GenerateTilesetParams } from "../types/index.js";

const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || "5");
const JOB_TIMEOUT_MS = parseInt(process.env.JOB_TIMEOUT_MS || "120000");
const JOB_RETENTION_MS = 1000 * 60 * 60; // 1 hour

type JobParams = GenerateImageParams | GenerateSpriteSheetParams | GenerateTilesetParams;
type JobExecutor = (job: Job) => Promise<JobResult>;

export class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private activeJobs: Set<string> = new Set();
  private executor: JobExecutor | null = null;

  setExecutor(executor: JobExecutor): void {
    this.executor = executor;
  }

  createJob(
    type: Job["type"],
    params: JobParams,
    priority: "low" | "normal" | "high" = "normal"
  ): Job {
    const job: Job = {
      id: uuidv4(),
      status: "queued",
      type,
      params,
      progress: 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    this.jobs.set(job.id, job);
    
    if (priority === "high") {
      this.processNextJob();
    } else {
      setTimeout(() => this.processNextJob(), priority === "low" ? 100 : 0);
    }

    return job;
  }

  private async processNextJob(): Promise<void> {
    if (this.activeJobs.size >= MAX_CONCURRENT_JOBS) {
      return;
    }

    const queuedJob = Array.from(this.jobs.values()).find(
      job => job.status === "queued"
    );

    if (!queuedJob || !this.executor) {
      return;
    }

    this.activeJobs.add(queuedJob.id);
    queuedJob.status = "in_progress";
    queuedJob.updated_at = new Date();

    const timeoutId = setTimeout(() => {
      if (queuedJob.status === "in_progress") {
        queuedJob.status = "failed";
        queuedJob.error = "Job timed out";
        queuedJob.updated_at = new Date();
        this.activeJobs.delete(queuedJob.id);
      }
    }, JOB_TIMEOUT_MS);

    try {
      const result = await this.executor(queuedJob);
      
      clearTimeout(timeoutId);
      
      queuedJob.status = "completed";
      queuedJob.result = result;
      queuedJob.progress = 100;
      queuedJob.completed_at = new Date();
      queuedJob.updated_at = new Date();
    } catch (error) {
      clearTimeout(timeoutId);
      
      queuedJob.status = "failed";
      queuedJob.error = error instanceof Error ? error.message : "Unknown error";
      queuedJob.updated_at = new Date();
    } finally {
      this.activeJobs.delete(queuedJob.id);
      this.processNextJob();
    }
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  updateJobProgress(jobId: string, progress: number): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = Math.min(100, Math.max(0, progress));
      job.updated_at = new Date();
    }
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status === "queued") {
      job.status = "cancelled";
      job.updated_at = new Date();
      return true;
    }

    return false;
  }

  listJobs(options?: {
    status?: Job["status"];
    type?: Job["type"];
    limit?: number;
  }): Job[] {
    let jobs = Array.from(this.jobs.values());

    if (options?.status) {
      jobs = jobs.filter(job => job.status === options.status);
    }

    if (options?.type) {
      jobs = jobs.filter(job => job.type === options.type);
    }

    jobs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    if (options?.limit) {
      jobs = jobs.slice(0, options.limit);
    }

    return jobs;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (
        (job.status === "completed" || job.status === "failed" || job.status === "cancelled") &&
        now - job.updated_at.getTime() > JOB_RETENTION_MS
      ) {
        this.jobs.delete(id);
      }
    }
  }

  getStats(): {
    total: number;
    queued: number;
    in_progress: number;
    completed: number;
    failed: number;
  } {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      queued: jobs.filter(j => j.status === "queued").length,
      in_progress: jobs.filter(j => j.status === "in_progress").length,
      completed: jobs.filter(j => j.status === "completed").length,
      failed: jobs.filter(j => j.status === "failed").length
    };
  }
}

export const jobQueue = new JobQueue();

setInterval(() => jobQueue.cleanup(), 1000 * 60 * 5);
