-- Insert initial batch job for fire event processing
INSERT INTO batch_jobs (
    batch_job,
    lastrun_timestamp_start,
    lastrun_timestamp_end,
    lastrun_status
)
VALUES (
    'Fire Event Job',
    NULL,
    NULL,
    NULL
);