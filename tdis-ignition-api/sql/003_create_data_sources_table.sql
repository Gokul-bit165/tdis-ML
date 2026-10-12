-- Create the data_sources table to store information about external data sources
-- This table maintains metadata about various data sources used for event detection
CREATE TABLE IF NOT EXISTS data_sources (
    data_source_id          SERIAL PRIMARY KEY,                  -- Unique identifier for each data source, auto-incrementing
    data_source             VARCHAR(100) UNIQUE NOT NULL,        -- Name or identifier of the data source service
    data_source_description TEXT,                                -- Detailed description of the data source and its capabilities
    api_base_url            VARCHAR(100),                        -- Base URL endpoint for accessing the data source's API
    api_version             VARCHAR(10),                         -- Version number of the API being used (e.g., 'v1', '2.0')
    api_type                VARCHAR(30),                         -- Type of API interface (e.g., 'REST', 'GraphQL', 'SOAP')
    is_api_active           BOOLEAN                              -- Current operational status of the data source (true = active, false = inactive)
);