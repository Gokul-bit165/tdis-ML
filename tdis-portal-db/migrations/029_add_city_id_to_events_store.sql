-- Add city_id column to events_store table
ALTER TABLE events_store
ADD COLUMN city_id INTEGER,
ADD FOREIGN KEY (city_id)
    REFERENCES cities(city_id);

-- Add index for city_id to optimize city-based queries
CREATE INDEX IF NOT EXISTS idx_events_store_city_id
ON events_store(city_id);
