-- Create ENUM type for batch job status to ensure consistent status values
-- This enum defines the possible states a batch job can be in
CREATE TYPE batch_job_status AS ENUM (
    'COMPLETED',    -- Job has finished successfully
    'FAILED',       -- Job encountered an error and did not complete
    'STARTED'       -- Job is currently running
);

-- Create the batch_jobs table to track the execution of batch processing jobs

CREATE TABLE IF NOT EXISTS batch_jobs (
    batch_job_id            SERIAL PRIMARY KEY,                  -- Unique identifier for batch job, auto-incrementing
    batch_job               VARCHAR(100) UNIQUE NOT NULL,        -- Descriptive name or identifier of the batch job
    lastrun_timestamp_start TIMESTAMP,                           -- Timestamp when the batch job started execution
    lastrun_timestamp_end   TIMESTAMP,                           -- Timestamp when the batch job completed or failed
    lastrun_duration        INTERVAL,                            -- Time taken to complete the batch job (end - start)
    lastrun_status          batch_job_status                     -- Current status of the batch job (COMPLETED, FAILED, STARTED)
);