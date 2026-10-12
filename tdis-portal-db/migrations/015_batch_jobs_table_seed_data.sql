-- Update sequence to current max value
SELECT setval('batch_jobs_batch_job_id_seq', (SELECT MAX(batch_job_id) FROM batch_jobs), true);

-- Insert flood event job
INSERT INTO batch_jobs (
    batch_job,
    lastrun_timestamp_start,
    lastrun_timestamp_end,
    lastrun_status
)
VALUES (
    'Flood Event Job',
    NULL,
    NULL,
    NULL
); 