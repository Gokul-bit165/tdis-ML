/*
 * Migration: Truncate batch_jobs and events_store tables
 * Description: This migration will truncate both batch_jobs and events_store tables
 * and reset their identity sequences. This is a destructive operation that will
 * permanently delete all data from these tables.
 * 
 * Impact: 
 * - All data in batch_jobs and events_store tables will be permanently deleted
 * - Identity sequences (serial columns) will be reset to 1
 * - Any tables with foreign key references to these tables will also be truncated
 *   due to the CASCADE option
 */

-- Truncate both tables and reset their identity sequences
TRUNCATE TABLE batch_jobs, events_store RESTART IDENTITY CASCADE; 