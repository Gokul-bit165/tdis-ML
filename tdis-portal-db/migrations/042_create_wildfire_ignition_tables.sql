-- Wildfire ignition risk predictions (BIT V2 model).
-- Written by the Azure scoring job (tdis-ignition-api/score_job.py); read by tdis-ignition-api, which feeds the
-- "Wildfire Ignition" map tab. Adds two tables, one data source and one batch job. No existing table is altered.
-- See docs/WILDFIRE_IGNITION_SCHEMA.md for the design, retention and rollback.

-- One row per scoring run (one uploaded daily-features file) -------------------------------------------------
CREATE TABLE IF NOT EXISTS wildfire_ignition_runs (
    run_id            BIGSERIAL PRIMARY KEY,                     -- Unique identifier for each run, auto-incrementing
    for_date          DATE        NOT NULL,                      -- Day the prediction is for (the date column of the uploaded file)
    source_file       TEXT,                                      -- Name of the uploaded CSV/parquet that was scored
    uploaded_at       TIMESTAMPTZ,                               -- When that file was uploaded to storage
    generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),        -- When the run was scored and stored
    data_source_id    INTEGER REFERENCES data_sources (data_source_id), -- Reference to the 'Wildfire Ignition Model' data source
    data_source       TEXT        NOT NULL DEFAULT 'real',       -- Tag from the upload; anything other than 'real' marks test data and shows a banner
    model             TEXT,                                      -- Model that produced the scores (e.g., model_bit_v2_36feat)
    status            TEXT        NOT NULL CHECK (status IN ('ok', 'error')), -- 'error' rows record a rejected upload; they never hold cells
    error             TEXT,                                      -- Why an upload was rejected (status = 'error')
    n_cells           INTEGER,                                   -- Texas cells stored for this run
    n_input_cells     INTEGER,                                   -- Rows in the uploaded file
    n_observed_cells  INTEGER,                                   -- Texas cells that came from the upload
    n_filled_cells    INTEGER,                                   -- Texas cells estimated from the nearest uploaded cells
    n_skipped_far     INTEGER,                                   -- Texas cells left out because no uploaded cell was within the fill distance (150 km)
    fill_method       TEXT,                                      -- How missing cells were filled (e.g., knn_idw_k8)
    mean_probability  REAL,                                      -- Mean calibrated probability over all stored cells
    is_current        BOOLEAN     NOT NULL DEFAULT false         -- true for the single run the map shows
);

-- At most one run is current. The scoring job flips this in the same transaction that finishes loading the cells.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wildfire_ignition_runs_one_current
    ON wildfire_ignition_runs ((true)) WHERE is_current;

CREATE INDEX IF NOT EXISTS idx_wildfire_ignition_runs_date
    ON wildfire_ignition_runs (for_date, generated_at DESC);

-- One row per H3 resolution-8 Texas cell per run --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wildfire_ignition_cells (
    run_id           BIGINT   NOT NULL REFERENCES wildfire_ignition_runs (run_id) ON DELETE CASCADE, -- Run this score belongs to
    h3_cell          TEXT     NOT NULL,                          -- H3 cell id at resolution 8 (about 0.7 km2)
    h3_7             TEXT     NOT NULL,                          -- Parent cell at resolution 7, so the API can group without H3 functions
    h3_6             TEXT     NOT NULL,                          -- Parent cell at resolution 6
    h3_5             TEXT     NOT NULL,                          -- Parent cell at resolution 5
    h3_4             TEXT     NOT NULL,                          -- Parent cell at resolution 4
    lat              REAL     NOT NULL,                          -- Cell centre latitude (WGS84)
    lon              REAL     NOT NULL,                          -- Cell centre longitude (WGS84)
    probability      REAL     NOT NULL CHECK (probability >= 0 AND probability <= 1),     -- Calibrated ignition probability
    raw_probability  REAL     NOT NULL CHECK (raw_probability >= 0 AND raw_probability <= 1), -- Uncalibrated model score
    observed         BOOLEAN  NOT NULL,                          -- true = cell was in the upload, false = estimated from neighbours
    PRIMARY KEY (run_id, h3_cell)
);

-- Visible-area queries at the finest map zoom levels filter on a lat/lon window
CREATE INDEX IF NOT EXISTS idx_wildfire_ignition_cells_lat
    ON wildfire_ignition_cells (run_id, lat);

-- Register the data source and the batch job, following the existing pattern -----------------------------------
INSERT INTO data_sources (data_source, data_source_description, is_api_active)
SELECT 'Wildfire Ignition Model',
       'BIT V2 XGBoost model scoring daily ignition probability for Texas H3 resolution-8 cells',
       true
WHERE NOT EXISTS (SELECT 1 FROM data_sources WHERE data_source = 'Wildfire Ignition Model');

INSERT INTO batch_jobs (batch_job)
SELECT 'Wildfire Ignition Scoring Job'
WHERE NOT EXISTS (SELECT 1 FROM batch_jobs WHERE batch_job = 'Wildfire Ignition Scoring Job');

-- Access for the application roles created by migrate.js (skipped if a role does not exist) -------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ed_app_admin') THEN
        GRANT ALL ON wildfire_ignition_runs, wildfire_ignition_cells TO ed_app_admin;
        GRANT USAGE, SELECT ON SEQUENCE wildfire_ignition_runs_run_id_seq TO ed_app_admin;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ed_app_user') THEN
        GRANT SELECT ON wildfire_ignition_runs, wildfire_ignition_cells TO ed_app_user;
    END IF;
END
$$;
