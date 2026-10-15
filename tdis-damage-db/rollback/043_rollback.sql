-- Removes everything migration 043 created. All damage assessment data is deleted. Nothing else is touched.
-- The postgis and btree_gist extensions are left in place because other objects may use them.

DROP FUNCTION IF EXISTS damage_density_mvt(integer, integer, integer, bigint);
DROP FUNCTION IF EXISTS damage_buildings_mvt(integer, integer, integer, bigint);
DROP FUNCTION IF EXISTS damage_h3_mvt(integer, integer, integer, bigint);
DROP FUNCTION IF EXISTS damage_h3_res_for_zoom(integer);
DROP VIEW IF EXISTS damage_buildings;
DROP TABLE IF EXISTS damage_h3_cells;
DROP TABLE IF EXISTS damage_results;
DROP TABLE IF EXISTS damage_assessments;
DROP TABLE IF EXISTS damage_footprints;
DROP TABLE IF EXISTS damage_footprint_sets;

DO $$
BEGIN
    IF to_regclass('data_sources') IS NOT NULL THEN
        DELETE FROM data_sources WHERE data_source = 'Damage Assessment Model';
    END IF;
    IF to_regclass('batch_jobs') IS NOT NULL THEN
        DELETE FROM batch_jobs WHERE batch_job = 'Damage Assessment Loader Job';
    END IF;
    IF to_regclass('_migrations') IS NOT NULL THEN
        DELETE FROM _migrations WHERE name = '043_create_damage_assessment_tables.sql';
    END IF;
END
$$;
