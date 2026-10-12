-- Insert sample data for hurricanes, hail, and thunderstorms in Texas counties

-- Insert Hurricane event in Nueces County (Corpus Christi) (Category 3)
INSERT INTO events_store (
    event_type_id,
    data_source_id,
    created_at,
    geom,
    county_id,
    event_date,
    batch_job_id,
    is_active,
    description
)
VALUES 
    ((SELECT event_type_id FROM event_types WHERE event_type = 'Hurricane'), 1, NOW(), ST_SetSRID(ST_MakePoint(-97.3964, 27.8006), 4326), (SELECT county_id FROM counties WHERE county = 'Nueces'), CURRENT_DATE, 5, true, 'Category 3 (Test data)')
ON CONFLICT DO NOTHING;

-- Insert Hurricane event in Cameron County (Brownsville) (Category 2)
INSERT INTO events_store (
    event_type_id,
    data_source_id,
    created_at,
    geom,
    county_id,
    event_date,
    batch_job_id,
    is_active,
    description
)
VALUES 
    ((SELECT event_type_id FROM event_types WHERE event_type = 'Hurricane'), 1, NOW(), ST_SetSRID(ST_MakePoint(-97.4975, 25.9018), 4326), (SELECT county_id FROM counties WHERE county = 'Cameron'), CURRENT_DATE, 5, true, 'Category 2 (Test data)')
ON CONFLICT DO NOTHING;

-- Insert Hail event in Tarrant County (Fort Worth)
INSERT INTO events_store (
    event_type_id,
    data_source_id,
    created_at,
    geom,
    county_id,
    event_date,
    batch_job_id,
    is_active,
    description
)
VALUES 
    ((SELECT event_type_id FROM event_types WHERE event_type = 'Hail'), 1, NOW(), ST_SetSRID(ST_MakePoint(-97.3308, 32.7555), 4326), (SELECT county_id FROM counties WHERE county = 'Tarrant'), CURRENT_DATE, 6, true, 'Likely (Test data)')
ON CONFLICT DO NOTHING;

-- Insert Hail event in Bexar County (San Antonio)
INSERT INTO events_store (
    event_type_id,
    data_source_id,
    created_at,
    geom,
    county_id,
    event_date,
    batch_job_id,
    is_active,
    description
)
VALUES 
    ((SELECT event_type_id FROM event_types WHERE event_type = 'Hail'), 1, NOW(), ST_SetSRID(ST_MakePoint(-98.4936, 29.4241), 4326), (SELECT county_id FROM counties WHERE county = 'Bexar'), CURRENT_DATE, 6, true, 'Possible (Test data)')
ON CONFLICT DO NOTHING;

-- Insert Thunderstorm event in El Paso County
INSERT INTO events_store (
    event_type_id,
    data_source_id,
    created_at,
    geom,
    county_id,
    event_date,
    batch_job_id,
    is_active,
    description
)
VALUES 
    ((SELECT event_type_id FROM event_types WHERE event_type = 'Thunderstorm'), 1, NOW(), ST_SetSRID(ST_MakePoint(-106.4850, 31.7619), 4326), (SELECT county_id FROM counties WHERE county = 'El Paso'), CURRENT_DATE, 4, true, 'High Risk of Severe Storms (Test data)')
ON CONFLICT DO NOTHING;

-- Insert Thunderstorm event in Lubbock County
INSERT INTO events_store (
    event_type_id,
    data_source_id,
    created_at,
    geom,
    county_id,
    event_date,
    batch_job_id,
    is_active,
    description
)
VALUES 
    ((SELECT event_type_id FROM event_types WHERE event_type = 'Thunderstorm'), 1, NOW(), ST_SetSRID(ST_MakePoint(-101.8552, 33.5779), 4326), (SELECT county_id FROM counties WHERE county = 'Lubbock'), CURRENT_DATE, 4, true, 'High Risk of Severe Storms (Test data)')
ON CONFLICT DO NOTHING;

-- Insert Fire event in Randall County (Amarillo)
INSERT INTO events_store (
    event_type_id,
    data_source_id,
    created_at,
    geom,
    county_id,
    event_date,
    batch_job_id,
    is_active,
    description
)
VALUES (
    (SELECT event_type_id FROM event_types WHERE event_type = 'Fire'),
    1,
    NOW(),
    ST_SetSRID(ST_MakePoint(-101.8313, 35.2220), 4326),
    (SELECT county_id FROM counties WHERE county = 'Randall'),
    CURRENT_DATE,
    1,
    true,
    '(Test data)'
)
ON CONFLICT DO NOTHING;

-- Insert Fire event in Potter County (Amarillo)
INSERT INTO events_store (
    event_type_id,
    data_source_id,
    created_at,
    geom,
    county_id,
    event_date,
    batch_job_id,
    is_active,
    description
)
VALUES (
    (SELECT event_type_id FROM event_types WHERE event_type = 'Fire'),
    1,
    NOW(),
    ST_SetSRID(ST_MakePoint(-101.9000, 35.2000), 4326),
    (SELECT county_id FROM counties WHERE county = 'Potter'),
    CURRENT_DATE,
    1,
    true,
    '(Test data)'
)
ON CONFLICT DO NOTHING;

-- Insert Flood event in Harris County (Houston) (High)
INSERT INTO events_store (
    event_type_id,
    data_source_id,
    created_at,
    geom,
    county_id,
    event_date,
    batch_job_id,
    is_active,
    description
)
VALUES (
    (SELECT event_type_id FROM event_types WHERE event_type = 'Flood'),
    1,
    NOW(),
    ST_SetSRID(ST_MakePoint(-95.3698, 29.7604), 4326),
    (SELECT county_id FROM counties WHERE county = 'Harris'),
    CURRENT_DATE,
    2,
    true,
    'High (Test data)'
)
ON CONFLICT DO NOTHING;

-- Insert Flood event in Bexar County (San Antonio) (Very High)
INSERT INTO events_store (
    event_type_id,
    data_source_id,
    created_at,
    geom,
    county_id,
    event_date,
    batch_job_id,
    is_active,
    description
)
VALUES (
    (SELECT event_type_id FROM event_types WHERE event_type = 'Flood'),
    1,
    NOW(),
    ST_SetSRID(ST_MakePoint(-98.4936, 29.4241), 4326),
    (SELECT county_id FROM counties WHERE county = 'Bexar'),
    CURRENT_DATE,
    2,
    true,
    'Very High (Test data)'
)
ON CONFLICT DO NOTHING;

-- Insert High Wind event in Ector County (Odessa)
INSERT INTO events_store (
    event_type_id,
    data_source_id,
    created_at,
    geom,
    county_id,
    event_date,
    batch_job_id,
    is_active,
    description
)
VALUES (
    (SELECT event_type_id FROM event_types WHERE event_type = 'High Wind'),
    1,
    NOW(),
    ST_SetSRID(ST_MakePoint(-102.3676, 31.8457), 4326),
    (SELECT county_id FROM counties WHERE county = 'Ector'),
    CURRENT_DATE,
    3,
    true,
    '45mph (Test data)'
)
ON CONFLICT DO NOTHING;

-- Insert High Wind event in Midland County
INSERT INTO events_store (
    event_type_id,
    data_source_id,
    created_at,
    geom,
    county_id,
    event_date,
    batch_job_id,
    is_active,
    description
)
VALUES (
    (SELECT event_type_id FROM event_types WHERE event_type = 'High Wind'),
    1,
    NOW(),
    ST_SetSRID(ST_MakePoint(-102.0776, 31.9973), 4326),
    (SELECT county_id FROM counties WHERE county = 'Midland'),
    CURRENT_DATE,
    3,
    true,
    '45mph (Test data)'
)
ON CONFLICT DO NOTHING; 