/**
 * ProcessingJob Model — media-service
 * Database operations for processing_jobs table
 */

import { getDatabase } from '../config/database';
import { ProcessingJob, JobType, JobStatus } from '../types';
import { InternalError } from '../types';

export class ProcessingJobModel {
  private readonly table = 'processing_jobs';

  async create(data: {
    media_id: string;
    job_type: JobType;
    status?: JobStatus;
  }): Promise<ProcessingJob> {
    const db = getDatabase();
    const [job] = await db(this.table)
      .insert({
        media_id: data.media_id,
        job_type: data.job_type,
        status: data.status ?? 'QUEUED',
        created_at: new Date(),
      })
      .returning('*');
    if (!job) throw new InternalError('Failed to create processing job record');
    return job;
  }

  async findById(id: string): Promise<ProcessingJob | null> {
    const db = getDatabase();
    const job = await db(this.table).where({ id }).first();
    return job ?? null;
  }

  async findByMediaId(mediaId: string): Promise<ProcessingJob[]> {
    const db = getDatabase();
    return db(this.table)
      .where({ media_id: mediaId })
      .orderBy('created_at', 'asc');
  }

  async updateStatus(
    id: string,
    status: JobStatus,
    errorMessage?: string,
  ): Promise<ProcessingJob> {
    const db = getDatabase();
    const [job] = await db(this.table)
      .where({ id })
      .update({
        status,
        ...(errorMessage ? { error_message: errorMessage } : {}),
        ...(status === 'DONE' || status === 'FAILED'
          ? { completed_at: new Date() }
          : {}),
      })
      .returning('*');
    if (!job)
      throw new InternalError(`ProcessingJob ${id} not found`);
    return job;
  }

  async getPendingJobs(limit = 10): Promise<ProcessingJob[]> {
    const db = getDatabase();
    return db(this.table)
      .whereIn('status', ['QUEUED'])
      .orderBy('created_at', 'asc')
      .limit(limit);
  }
}
