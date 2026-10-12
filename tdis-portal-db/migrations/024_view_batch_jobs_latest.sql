/*
 * View: view_batch_jobs_latest
 * Description: This view provides the most recent execution timestamp for each batch job.
 * It aggregates the batch_jobs table to show only the latest run timestamp (lastrun_timestamp_end)
 * for each unique batch_job.
 */
CREATE OR REPLACE VIEW view_batch_jobs_latest AS 
SELECT batch_job, MAX(lastrun_timestamp_end) AS lastrun_timestamp_end
FROM batch_jobs 
GROUP BY batch_job;