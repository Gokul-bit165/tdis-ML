/*
 * Migration: Reset and update event_types table
 * Description: This migration will truncate the event_types table, reset its identity sequence,
 * and insert new event types. This is a destructive operation that will permanently delete
 * all existing event types.
 * 
 * Impact: 
 * - All existing event types will be permanently deleted
 * - Identity sequence will be reset to 1
 * - New event types will be inserted
 */

-- Truncate the event_types table and reset its identity sequence
TRUNCATE TABLE event_types RESTART IDENTITY CASCADE;

-- Insert the new event types
INSERT INTO event_types (event_type)
VALUES
    ('Wildfire'),
    ('Hail'),
    ('Rainfall'),
    ('Earthquake'),
    ('Hurricane'),
    ('High Wind'); 