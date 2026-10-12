/*
 * Migration: Make county_id nullable in events_store table
 * Description: This migration makes the county_id column nullable to handle hurricane events
 * that occur outside of Texas counties. Events outside Texas will have NULL county_id.
 */

-- Make county_id nullable
ALTER TABLE events_store 
ALTER COLUMN county_id DROP NOT NULL;
