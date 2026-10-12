-- Reset the sequence to the current maximum value
SELECT setval('data_sources_data_source_id_seq', (SELECT MAX(data_source_id) FROM data_sources), true);

INSERT INTO data_sources (data_source, is_api_active)
VALUES
    ('NIFC', true),
    ('USGS', true);