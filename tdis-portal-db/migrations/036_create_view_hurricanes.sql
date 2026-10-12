/*
 * Migration: Create separate hurricane view
 * Description: This migration creates a dedicated view for hurricane events to handle
 * the special case of hurricanes outside Texas boundaries and simplify the main view.
 */

-- Create dedicated hurricane view
DROP VIEW IF EXISTS view_hurricanes;
CREATE VIEW view_hurricanes AS
SELECT 
    es.event_store_id,
    et.event_type,
    es.event_date,
    es.is_active,
    es.description,
    es.geom,
    c.county
FROM events_store es
INNER JOIN event_types et 
    ON es.event_type_id = et.event_type_id
LEFT JOIN counties c 
    ON es.county_id = c.county_id
WHERE es.is_active = true
AND et.event_type = 'Hurricane'; 