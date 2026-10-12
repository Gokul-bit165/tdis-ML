-- Create the counties table to store geographical boundaries of counties
CREATE TABLE IF NOT EXISTS counties (
    county_id   SERIAL PRIMARY KEY,                   -- Unique identifier for each county, auto-incrementing
    county      VARCHAR(50) NOT NULL UNIQUE,          -- Name of the county
    geom        GEOMETRY(MultiPolygon, 4326) NOT NULL -- Spatial geometry of the county boundary in WGS84 (EPSG:4326)
);

-- Add spatial index for faster geospatial queries
-- CREATE INDEX IF NOT EXISTS idx_counties_geom
-- ON counties
-- USING GIST (geom);