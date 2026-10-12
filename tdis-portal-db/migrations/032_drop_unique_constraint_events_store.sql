/*
 * Migration: Drop unique constraint from events_store table
 * Description: This migration removes the unique constraint that prevents duplicate events
 * of the same type at the same location on the same date.
 * 
 * Impact: 
 * - Removes the constraint 'unique_event_type_id_geom_date' from events_store table
 * - After this change, multiple events of the same type can exist at the same location
 *   on the same date
 */

-- Drop the unique constraint if it exists
ALTER TABLE events_store 
DROP CONSTRAINT IF EXISTS unique_event_type_id_geom_date; 