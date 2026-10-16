-- Pre-aggregated wildfire ignition hexagons (H3 resolutions 4-7), so the map API reads ready-made rows instead of
-- running GROUP BY over every Texas cell on each request. Written by the scoring job in the same transaction as the
-- run's cells (tdis-ignition-api/db.py publish_run). Resolution 8 is the cell itself and is read from
-- wildfire_ignition_cells. Adds one table and one index; nothing existing is altered.

CREATE TABLE IF NOT EXISTS wildfire_ignition_hexes (
    run_id           BIGINT   NOT NULL REFERENCES wildfire_ignition_runs (run_id) ON DELETE CASCADE, -- Run these hexagons belong to
    res              SMALLINT NOT NULL CHECK (res BETWEEN 4 AND 7),  -- H3 resolution of hex_id
    hex_id           TEXT     NOT NULL,                              -- H3 cell id at that resolution
    lat              REAL     NOT NULL,                              -- Mean latitude of the hexagon's cells (used for window queries)
    lon              REAL     NOT NULL,                              -- Mean longitude of the hexagon's cells
    probability      REAL     NOT NULL,                              -- Mean calibrated probability of the cells
    max_probability  REAL     NOT NULL,                              -- Highest cell probability in the hexagon
    n_cells          INTEGER  NOT NULL,                              -- Resolution-8 cells in the hexagon
    n_observed       INTEGER  NOT NULL,                              -- Of those, cells that came from the upload
    PRIMARY KEY (run_id, res, hex_id)
);

-- Visible-area queries filter on one run and resolution and a latitude window
CREATE INDEX IF NOT EXISTS idx_wildfire_ignition_hexes_lat
    ON wildfire_ignition_hexes (run_id, res, lat);

-- Backfill the run the map is showing now (older runs fall back to live aggregation in the API)
INSERT INTO wildfire_ignition_hexes (run_id, res, hex_id, lat, lon, probability, max_probability, n_cells, n_observed)
SELECT c.run_id, v.res, v.hex_id, avg(c.lat), avg(c.lon), avg(c.probability), max(c.probability),
       count(*), sum(c.observed::int)
FROM wildfire_ignition_cells c
JOIN wildfire_ignition_runs r ON r.run_id = c.run_id AND r.is_current
CROSS JOIN LATERAL (VALUES (4, c.h3_4), (5, c.h3_5), (6, c.h3_6), (7, c.h3_7)) AS v(res, hex_id)
GROUP BY c.run_id, v.res, v.hex_id
ON CONFLICT DO NOTHING;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ed_app_admin') THEN
        GRANT ALL ON wildfire_ignition_hexes TO ed_app_admin;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ed_app_user') THEN
        GRANT SELECT ON wildfire_ignition_hexes TO ed_app_user;
    END IF;
END
$$;
