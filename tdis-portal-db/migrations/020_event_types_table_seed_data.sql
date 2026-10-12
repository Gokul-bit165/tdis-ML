-- Update sequence to current max value
SELECT setval('event_types_event_type_id_seq', (SELECT MAX(event_type_id) FROM event_types), true);
INSERT INTO event_types (event_type)
VALUES
    ('Hurricane'),
    ('Hail');