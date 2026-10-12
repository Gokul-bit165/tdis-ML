-- Enable PostGIS extension for spatial data types and functions
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable pgcrypto extension to allow UUID generation with gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;
