-- Damage assessment results (building damage classes from the HASTE + DamageTriageFormer pipeline).
-- Written by tdis-damage-loader; read by tdis-damage-api, which feeds the "Damage Assessment" map tab.
-- Adds five tables, one view and four functions. No existing table is altered.
-- See docs/DAMAGE_ASSESSMENT_SCHEMA.md for the design, retention and rollback.

CREATE EXTENSION IF NOT EXISTS postgis;
-- btree_gist lets one GiST index cover (id, geometry), so a tile query never scans another set's rows.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- One row per uploaded set of building footprints (the area a model run can cover) ----------------------------
CREATE TABLE IF NOT EXISTS damage_footprint_sets (
    footprint_set_id  BIGSERIAL PRIMARY KEY,                     -- Unique identifier, auto-incrementing
    name              TEXT        NOT NULL UNIQUE,               -- Name the results manifest refers to (footprint_set)
    source            TEXT,                                      -- Where the footprints came from (free text)
    source_file       TEXT,                                      -- File the set was loaded from
    n_buildings       INTEGER     NOT NULL,                      -- Footprints in the set
    bbox              geometry(Polygon, 4326) NOT NULL,          -- Envelope of all footprints
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()         -- When the set was loaded
);

-- One row per building footprint. Stored once and reused by every model run on the set ------------------------
CREATE TABLE IF NOT EXISTS damage_footprints (
    footprint_set_id  BIGINT NOT NULL REFERENCES damage_footprint_sets (footprint_set_id) ON DELETE CASCADE,
    building_id       TEXT   NOT NULL,                           -- Stable id shared with the model output
    geom              geometry(MultiPolygon, 4326) NOT NULL,     -- Building outline
    pt                geometry(Point, 4326) NOT NULL,            -- A point guaranteed inside the outline; decides the H3 cell
    PRIMARY KEY (footprint_set_id, building_id)
);

CREATE INDEX IF NOT EXISTS idx_damage_footprints_geom
    ON damage_footprints USING gist (footprint_set_id, geom);

-- One row per model run (an immutable snapshot), plus one row for each rejected upload ------------------------
CREATE TABLE IF NOT EXISTS damage_assessments (
    assessment_id     BIGSERIAL PRIMARY KEY,                     -- Unique identifier; part of every tile URL
    footprint_set_id  BIGINT REFERENCES damage_footprint_sets (footprint_set_id), -- NULL only on error rows
    event_name        TEXT,                                      -- Disaster event the run belongs to
    aoi_name          TEXT,                                      -- Area name shown in the selector
    imagery_date      DATE,                                      -- Date of the imagery that was assessed
    model             TEXT,                                      -- Model that produced the classes
    source_file       TEXT,                                      -- Results file that was loaded
    uploaded_at       TIMESTAMPTZ,                               -- When that file was uploaded to storage
    data_source       TEXT        NOT NULL DEFAULT 'real',       -- Anything other than 'real' marks test data and shows a banner
    status            TEXT        NOT NULL CHECK (status IN ('published', 'error')), -- 'error' rows hold no results
    error             TEXT,                                      -- Why an upload was rejected (status = 'error')
    n_buildings       INTEGER,                                   -- Footprints in the set
    n_assessed        INTEGER,                                   -- Buildings with a damage class in this run
    c0                INTEGER,                                   -- Undamaged
    c1                INTEGER,                                   -- Partial Roof Damage
    c2                INTEGER,                                   -- Total Roof Damage
    c3                INTEGER,                                   -- Partial Structural Collapse
    c4                INTEGER,                                   -- Total Structural Collapse
    bbox              geometry(Polygon, 4326),                   -- Envelope the map flies to
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),        -- When the row was written
    published_at      TIMESTAMPTZ                                -- When the run became visible to the API
);

CREATE INDEX IF NOT EXISTS idx_damage_assessments_published
    ON damage_assessments (published_at DESC) WHERE status = 'published';

-- One row per assessed building per run. Small: no geometry ---------------------------------------------------
CREATE TABLE IF NOT EXISTS damage_results (
    assessment_id     BIGINT   NOT NULL REFERENCES damage_assessments (assessment_id) ON DELETE CASCADE,
    building_id       TEXT     NOT NULL,                         -- Must exist in the run's footprint set
    damage_class      SMALLINT NOT NULL CHECK (damage_class BETWEEN 0 AND 4), -- 0 Undamaged .. 4 Total Structural Collapse
    damage_pct        REAL     CHECK (damage_pct >= 0 AND damage_pct <= 100), -- Optional; NULL unless supplied
    confidence        REAL     CHECK (confidence >= 0 AND confidence <= 1),   -- Optional; NULL unless supplied
    imagery_ref       TEXT,                                      -- Optional pointer to supporting imagery
    assessed_at       TIMESTAMPTZ,                               -- Optional per-building timestamp
    PRIMARY KEY (assessment_id, building_id)
);

-- One row per non-empty H3 cell per resolution (4 to 10) per run. Counts only, never percentages --------------
CREATE TABLE IF NOT EXISTS damage_h3_cells (
    assessment_id     BIGINT   NOT NULL REFERENCES damage_assessments (assessment_id) ON DELETE CASCADE,
    res               SMALLINT NOT NULL CHECK (res BETWEEN 4 AND 10), -- H3 resolution
    h3                TEXT     NOT NULL,                         -- H3 cell id
    n                 INTEGER  NOT NULL CHECK (n > 0),           -- Buildings whose point falls in the cell
    na                INTEGER  NOT NULL CHECK (na >= 0),         -- Of those, buildings with a damage class
    c0                INTEGER  NOT NULL,                         -- Undamaged
    c1                INTEGER  NOT NULL,                         -- Partial Roof Damage
    c2                INTEGER  NOT NULL,                         -- Total Roof Damage
    c3                INTEGER  NOT NULL,                         -- Partial Structural Collapse
    c4                INTEGER  NOT NULL,                         -- Total Structural Collapse
    dom               SMALLINT CHECK (dom BETWEEN 0 AND 4),      -- Most frequent class, ties to the more severe; NULL if na = 0
    geom              geometry(Polygon, 4326) NOT NULL,          -- The hexagon
    pt                geometry(Point, 4326) NOT NULL,            -- Centre of mass of the cell's buildings (density view)
    PRIMARY KEY (assessment_id, res, h3),
    CHECK (c0 + c1 + c2 + c3 + c4 = na AND na <= n)
);

CREATE INDEX IF NOT EXISTS idx_damage_h3_cells_geom
    ON damage_h3_cells USING gist (assessment_id, res, geom);

-- Every footprint of a run's set with its result, if any. damage_class IS NULL means "not assessed" -----------
CREATE OR REPLACE VIEW damage_buildings AS
SELECT a.assessment_id,
       f.building_id,
       r.damage_class,
       r.damage_pct,
       r.confidence,
       r.imagery_ref,
       r.assessed_at,
       f.geom,
       f.pt
FROM damage_assessments a
JOIN damage_footprints f ON f.footprint_set_id = a.footprint_set_id
LEFT JOIN damage_results r ON r.assessment_id = a.assessment_id AND r.building_id = f.building_id;

-- H3 resolution drawn at a tile zoom. One resolution lasts about 1.4 zoom levels (sqrt(7) per step) -----------
CREATE OR REPLACE FUNCTION damage_h3_res_for_zoom(z integer) RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT CASE WHEN z <= 5 THEN 4
                WHEN z = 6 THEN 5
                WHEN z <= 8 THEN 6
                WHEN z = 9 THEN 7
                WHEN z <= 11 THEN 8
                WHEN z = 12 THEN 9
                ELSE 10 END
$$;

-- Vector tile functions. The argument names z, x, y are what pg_tileserv expects of a function layer, so the
-- same functions can be served by tdis-damage-api or by pg_tileserv. The assessment argument is named aid, not
-- assessment_id: inside an SQL function a column name wins over a parameter of the same name.

-- Layer "h3": hexagons with their counts
CREATE OR REPLACE FUNCTION damage_h3_mvt(z integer, x integer, y integer, aid bigint) RETURNS bytea
LANGUAGE sql STABLE PARALLEL SAFE AS $$
    WITH b AS (
        SELECT ST_TileEnvelope(z, x, y) AS env,
               ST_Transform(ST_TileEnvelope(z, x, y, margin => 64.0 / 4096), 4326) AS box
    ), q AS (
        SELECT c.h3, c.n, c.na, c.c0, c.c1, c.c2, c.c3, c.c4, COALESCE(c.dom, -1)::integer AS dom,
               ST_AsMVTGeom(ST_Transform(c.geom, 3857), b.env, 4096, 64, true) AS geom
        FROM damage_h3_cells c, b
        WHERE c.assessment_id = aid
          AND c.res = damage_h3_res_for_zoom(z)::smallint
          AND c.geom && b.box
    )
    SELECT ST_AsMVT(q, 'h3', 4096, 'geom') FROM q WHERE geom IS NOT NULL
$$;

-- Layer "buildings": footprints with building_id and dc (-1 = not assessed). Empty below zoom 14
CREATE OR REPLACE FUNCTION damage_buildings_mvt(z integer, x integer, y integer, aid bigint) RETURNS bytea
LANGUAGE sql STABLE PARALLEL SAFE AS $$
    WITH a AS (
        SELECT footprint_set_id FROM damage_assessments WHERE assessment_id = aid AND status = 'published'
    ), b AS (
        SELECT ST_TileEnvelope(z, x, y) AS env,
               ST_Transform(ST_TileEnvelope(z, x, y, margin => 64.0 / 4096), 4326) AS box
    ), q AS (
        SELECT f.building_id, COALESCE(r.damage_class, -1)::integer AS dc,
               ST_AsMVTGeom(ST_Transform(f.geom, 3857), b.env, 4096, 64, true) AS geom
        FROM a
        CROSS JOIN b
        JOIN damage_footprints f ON f.footprint_set_id = a.footprint_set_id AND f.geom && b.box
        LEFT JOIN damage_results r ON r.assessment_id = aid AND r.building_id = f.building_id
        WHERE z >= 14
    )
    SELECT ST_AsMVT(q, 'buildings', 4096, 'geom') FROM q WHERE geom IS NOT NULL
$$;

-- Layer "density": points with weight w. Below zoom 13 one point per H3 cell one resolution finer than the
-- hexagons, weighted by its building count; from zoom 13 one point per building. A heatmap adds up every
-- point it is given, so each point must be in exactly one tile: membership is tested on a half-open
-- interval (a point on a shared edge belongs to one side only) and the tile clip is switched off, because
-- clipping keeps an edge point in both neighbours.
CREATE OR REPLACE FUNCTION damage_density_mvt(z integer, x integer, y integer, aid bigint) RETURNS bytea
LANGUAGE sql STABLE PARALLEL SAFE AS $$
    WITH a AS (
        SELECT footprint_set_id FROM damage_assessments WHERE assessment_id = aid AND status = 'published'
    ), b AS (
        SELECT ST_TileEnvelope(z, x, y) AS env,
               ST_Transform(ST_TileEnvelope(z, x, y), 4326) AS box
    ), candidates AS (
        SELECT c.n AS w, ST_Transform(c.pt, 3857) AS p
        FROM damage_h3_cells c, b
        WHERE z < 13
          AND c.assessment_id = aid
          AND c.res = LEAST(damage_h3_res_for_zoom(z) + 1, 10)::smallint
          AND c.geom && b.box
        UNION ALL
        SELECT 1 AS w, ST_Transform(f.pt, 3857) AS p
        FROM a
        CROSS JOIN b
        JOIN damage_footprints f ON f.footprint_set_id = a.footprint_set_id AND f.geom && b.box
        WHERE z >= 13
    ), q AS (
        SELECT k.w, ST_AsMVTGeom(k.p, b.env, 4096, 0, false) AS geom
        FROM candidates k, b
        WHERE ST_X(k.p) >= ST_XMin(b.env) AND ST_X(k.p) < ST_XMax(b.env)
          AND ST_Y(k.p) >= ST_YMin(b.env) AND ST_Y(k.p) < ST_YMax(b.env)
    )
    SELECT ST_AsMVT(q, 'density', 4096, 'geom') FROM q WHERE geom IS NOT NULL
$$;

-- Register the data source and the batch job, following the existing pattern (skipped where the portal tables
-- are absent, for example in a stand-alone test database) -----------------------------------------------------
DO $$
BEGIN
    IF to_regclass('data_sources') IS NOT NULL THEN
        INSERT INTO data_sources (data_source, data_source_description, is_api_active)
        SELECT 'Damage Assessment Model',
               'Building damage classes from satellite imagery (HASTE + DamageTriageFormer)',
               true
        WHERE NOT EXISTS (SELECT 1 FROM data_sources WHERE data_source = 'Damage Assessment Model');
    END IF;
    IF to_regclass('batch_jobs') IS NOT NULL THEN
        INSERT INTO batch_jobs (batch_job)
        SELECT 'Damage Assessment Loader Job'
        WHERE NOT EXISTS (SELECT 1 FROM batch_jobs WHERE batch_job = 'Damage Assessment Loader Job');
    END IF;
END
$$;

-- Access for the application roles created by migrate.js (skipped if a role does not exist) -------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ed_app_admin') THEN
        GRANT ALL ON damage_footprint_sets, damage_footprints, damage_assessments, damage_results, damage_h3_cells
            TO ed_app_admin;
        GRANT SELECT ON damage_buildings TO ed_app_admin;
        GRANT USAGE, SELECT ON SEQUENCE damage_footprint_sets_footprint_set_id_seq,
                                        damage_assessments_assessment_id_seq TO ed_app_admin;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ed_app_user') THEN
        GRANT SELECT ON damage_footprint_sets, damage_footprints, damage_assessments, damage_results,
                        damage_h3_cells, damage_buildings TO ed_app_user;
    END IF;
END
$$;
