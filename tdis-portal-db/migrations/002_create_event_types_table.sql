-- Create the event_types table to store different types of events that can be detected
CREATE TABLE IF NOT EXISTS event_types (
    event_type_id          SERIAL PRIMARY KEY,                  -- Unique identifier for each event type, auto-incrementing
    event_type             VARCHAR(30) NOT NULL UNIQUE,         -- Short name/code for the event type (e.g., 'Fire', 'Flood', 'Tornado')
    event_type_description TEXT                                 -- Description of the event type(Optional)
);