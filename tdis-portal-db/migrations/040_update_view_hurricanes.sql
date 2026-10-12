DROP VIEW IF EXISTS view_hurricanes;

CREATE VIEW view_hurricanes AS
SELECT 
    es.event_store_id,
    et.event_type,
    es.event_date,
    es.created_at,
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