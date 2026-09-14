import type { Job } from '../types/workflow.js'

const jobs = new Map<string, Job>()

export function saveJob(job: Job): Job {
  jobs.set(job.id, job)
  return job
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId)
}

export function updateJob(
  jobId: string,
  updater: (job: Job) => Job,
): Job {
  const existing = jobs.get(jobId)

  if (!existing) {
    throw new Error(`Job not found: ${jobId}`)
  }

  const updated = updater(existing)

  jobs.set(jobId, updated)

  return updated
}

export function listJobs(): Job[] {
  return Array.from(jobs.values())
}
