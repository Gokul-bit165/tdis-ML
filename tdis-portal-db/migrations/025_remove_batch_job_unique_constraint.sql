-- Remove UNIQUE constraint from batch_job column in batch_jobs table
ALTER TABLE batch_jobs
DROP CONSTRAINT IF EXISTS batch_jobs_batch_job_key; 