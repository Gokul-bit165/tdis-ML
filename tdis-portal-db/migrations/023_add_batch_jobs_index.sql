/*
 * Migration: Add index to batch_jobs table
 * Description: Creates an index on batch_job and lastrun_timestamp_end columns
 * to optimize the batch_jobs_latest view query performance.
 */
CREATE INDEX IF NOT EXISTS idx_batch_jobs_job_timestamp 
ON batch_jobs (batch_job, lastrun_timestamp_end DESC); 