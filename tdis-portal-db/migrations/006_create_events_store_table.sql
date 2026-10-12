-- Create the events_store table to store detected events from various data sources
-- This is the main table that stores all event data with their spatial information
CREATE TABLE IF NOT EXISTS events_store (
    event_store_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Unique identifier for each event record
    event_type_id       INTEGER NOT NULL,                           -- Reference to the type of event (e.g., Fire, Flood)
    data_source_id      INTEGER NOT NULL,                           -- Reference to the data source that detected the event
    created_at          TIMESTAMP NOT NULL,                         -- Timestamp when the event was detected/recorded
    geom                GEOMETRY(Point, 4326) NOT NULL,             -- Geographic location of the event in WGS84 (EPSG:4326)
    county_id           INTEGER NOT NULL,                           -- Reference to the county where the event occurred
    event_date          DATE NOT NULL,                              -- Date when the event occurred (without time component)
    batch_job_id        INTEGER NOT NULL,                           -- Reference to the batch job that processed this event
    
    -- Ensure no duplicate events of the same type at the same location on the same date
    CONSTRAINT unique_event_type_id_geom_date UNIQUE (event_type_id, geom, event_date),

    -- Foreign key constraints to maintain referential integrity
    FOREIGN KEY (event_type_id) REFERENCES event_types(event_type_id),
    FOREIGN KEY (data_source_id) REFERENCES data_sources(data_source_id),
    FOREIGN KEY (county_id) REFERENCES counties(county_id),
    FOREIGN KEY (batch_job_id) REFERENCES batch_jobs(batch_job_id)
);

-- Add index for created_at to speed up time-based queries, if it doesn't exist
-- CREATE INDEX IF NOT EXISTS idx_created_at ON events_store(created_at);

-- Add index for event_date to optimize date range filtering
CREATE INDEX IF NOT EXISTS idx_event_date ON events_store(event_date);

-- Add spatial index for geom to optimize geospatial queries, if it doesn't exist
-- CREATE INDEX IF NOT EXISTS idx_geom ON events_store USING GIST (geom);

