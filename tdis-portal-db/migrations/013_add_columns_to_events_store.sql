-- Add is_active and description columns to events_store table
ALTER TABLE events_store
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true, -- Event active status
ADD COLUMN description TEXT; -- Event description 