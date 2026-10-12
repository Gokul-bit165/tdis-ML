-- Create the cities table to store geographical boundaries of cities
CREATE TABLE IF NOT EXISTS cities (
    city_id   SERIAL PRIMARY KEY,                   -- Unique identifier for each city, auto-incrementing
    city      VARCHAR(50) NOT NULL UNIQUE,          -- Name of the city
    geom        GEOMETRY(MultiPolygon, 4326) NOT NULL -- Spatial geometry of the city boundary in WGS84 (EPSG:4326)
);

-- Add spatial index for faster geospatial queries
CREATE INDEX IF NOT EXISTS idx_cities_geom
ON cities
USING GIST (geom);