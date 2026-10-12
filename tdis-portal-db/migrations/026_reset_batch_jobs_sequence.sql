-- Reset the batch_jobs sequence to match the maximum batch_job_id
SELECT setval('batch_jobs_batch_job_id_seq', (SELECT MAX(batch_job_id) FROM batch_jobs), true); 