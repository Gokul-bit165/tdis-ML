-- Create view_events_store view to provide a simplified interface for querying events
-- This view joins the events_store table with related tables to provide human-readable information
CREATE VIEW view_events_store AS
SELECT 
    es.event_store_id,    -- Unique identifier of the event
    et.event_type,        -- Type of event (e.g., Fire, Flood)
    ds.data_source,       -- Source that detected the event
    es.geom,              -- Geographic location of the event
    c.county,             -- County where the event occurred
    es.event_date         -- Date when the event occurred
FROM events_store es 
INNER JOIN event_types et 
    ON es.event_type_id = et.event_type_id
INNER JOIN counties c
    ON es.county_id = c.county_id
INNER JOIN data_sources ds
    ON es.data_source_id = ds.data_source_id
INNER JOIN batch_jobs bj
    ON es.batch_job_id = bj.batch_job_id;