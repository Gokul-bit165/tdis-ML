-- Insert sample flood event data into events_store table for Texas regions
-- Note: Replace the county_id, data_source_id, and batch_job_id with actual values from your database

INSERT INTO events_store (
    event_type_id,
    data_source_id,
    created_at,
    geom,
    county_id,
    event_date,
    batch_job_id,
    description
) VALUES
    -- Houston Metro Area
    (
        3, -- event_type_id for 'Flood'
        1, -- data_source_id (replace with actual value)
        CURRENT_TIMESTAMP,
        ST_SetSRID(ST_MakePoint(-95.3698, 29.7604), 4326), -- Houston downtown
        149, -- county_id for Harris County
        CURRENT_DATE,
        2, -- batch_job_id
        'Very High' -- description
    ),
    (
        3,
        1,
        CURRENT_TIMESTAMP,
        ST_SetSRID(ST_MakePoint(-95.4572, 29.6804), 4326), -- Houston southwest
        149,
        CURRENT_DATE,
        2,
        'High'
    ),
    -- Dallas-Fort Worth Metroplex
    (
        3,
        1,
        CURRENT_TIMESTAMP,
        ST_SetSRID(ST_MakePoint(-96.7970, 32.7767), 4326), -- Dallas
        79, -- county_id for Dallas County
        CURRENT_DATE,
        2,
        'Very High'
    ),
    -- Austin Area
    (
        3,
        1,
        CURRENT_TIMESTAMP,
        ST_SetSRID(ST_MakePoint(-97.7431, 30.2672), 4326), -- Austin
        204, -- county_id for Travis County
        CURRENT_DATE,
        2,
        'High'
    ),
    -- El Paso Area
    (
        3,
        1,
        CURRENT_TIMESTAMP,
        ST_SetSRID(ST_MakePoint(-106.4850, 31.7619), 4326), -- El Paso
        132, -- county_id for El Paso County
        CURRENT_DATE,
        2,
        'Elevated'
    ),
    -- Lubbock Area
    (
        3,
        1,
        CURRENT_TIMESTAMP,
        ST_SetSRID(ST_MakePoint(-101.8552, 33.5779), 4326), -- Lubbock
        50, -- county_id for Lubbock County
        CURRENT_DATE,
        2,
        'High'
    ),
    -- Galveston Area
    (
        3,
        1,
        CURRENT_TIMESTAMP,
        ST_SetSRID(ST_MakePoint(-94.7977, 29.3013), 4326), -- Galveston
        220, -- county_id for Galveston County
        CURRENT_DATE,
        2,
        'Very High'
    ),
    -- Waco Area
    (
        3,
        1,
        CURRENT_TIMESTAMP,
        ST_SetSRID(ST_MakePoint(-97.1467, 31.5493), 4326), -- Waco
        136, -- county_id for McLennan County
        CURRENT_DATE,
        2,
        'Elevated'
    ),
    -- College Station Area
    (
        3,
        1,
        CURRENT_TIMESTAMP,
        ST_SetSRID(ST_MakePoint(-96.3344, 30.6280), 4326), -- College Station
        173, -- county_id for Brazos County
        CURRENT_DATE,
        2,
        'High'
    ),
    -- Tyler Area
    (
        3,
        1,
        CURRENT_TIMESTAMP,
        ST_SetSRID(ST_MakePoint(-95.3011, 32.3513), 4326), -- Tyler
        95, -- county_id for Smith County
        CURRENT_DATE,
        2,
        'Elevated'
    ),
    -- Laredo Area
    (
        3,
        1,
        CURRENT_TIMESTAMP,
        ST_SetSRID(ST_MakePoint(-99.5075, 27.5306), 4326), -- Laredo
        241, -- county_id for Webb County
        CURRENT_DATE,
        2,
        'High'
    ),
    -- Brownsville Area
    (
        3,
        1,
        CURRENT_TIMESTAMP,
        ST_SetSRID(ST_MakePoint(-97.4975, 25.9018), 4326), -- Brownsville
        254, -- county_id for Cameron County
        CURRENT_DATE,
        2,
        'Very High'
    ),
    -- Midland Area
    (
        3,
        1,
        CURRENT_TIMESTAMP,
        ST_SetSRID(ST_MakePoint(-102.0776, 31.9973), 4326), -- Midland
        120, -- county_id for Midland County
        CURRENT_DATE,
        2,
        'Elevated'
    ),
    -- Odessa Area
    (
        3,
        1,
        CURRENT_TIMESTAMP,
        ST_SetSRID(ST_MakePoint(-102.3676, 31.8457), 4326), -- Odessa
        121, -- county_id for Ector County
        CURRENT_DATE,
        2,
        'High'
    ),
    -- Abilene Area
    (
        3,
        1,
        CURRENT_TIMESTAMP,
        ST_SetSRID(ST_MakePoint(-99.7331, 32.4487), 4326), -- Abilene
        105, -- county_id for Taylor County
        CURRENT_DATE,
        2,
        'Elevated'
    )
ON CONFLICT (event_type_id, geom, event_date) DO NOTHING;

-- Note: Before running this script, ensure that:
-- 1. The event_type_id 3 exists in the event_types table
-- 2. The data_source_id exists in the data_sources table
-- 3. The county_ids exist in the counties table
-- 4. The batch_job_id exists in the batch_jobs table 