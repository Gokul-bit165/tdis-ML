"""
Database queries for tdis-damage-api.
All SQL queries are parameterized. One function per query.
"""
from typing import Any, Dict, List, Optional, Set


def get_published_assessment_ids(conn) -> Set[int]:
    """Return the set of all published assessment IDs."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT assessment_id
            FROM damage_assessments
            WHERE status = 'published'
            """
        )
        rows = cur.fetchall()
        return {r[0] for r in rows}


def get_assessments(conn) -> List[Dict[str, Any]]:
    """Return list of published assessments, newest first."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                assessment_id,
                event_name,
                aoi_name,
                imagery_date,
                model,
                source_file,
                data_source,
                status,
                n_buildings,
                n_assessed,
                c0, c1, c2, c3, c4,
                CASE
                    WHEN bbox IS NOT NULL THEN
                        ARRAY[ST_XMin(bbox), ST_YMin(bbox), ST_XMax(bbox), ST_YMax(bbox)]
                    ELSE NULL
                END AS bbox,
                created_at,
                published_at
            FROM damage_assessments
            WHERE status = 'published'
            ORDER BY published_at DESC NULLS LAST, created_at DESC
            """
        )
        columns = [desc[0] for desc in cur.description]
        results = []
        for row in cur.fetchall():
            item = dict(zip(columns, row))
            # Format bbox as float list if present
            if item.get("bbox") is not None:
                item["bbox"] = [float(coord) for coord in item["bbox"]]
            if item.get("imagery_date") is not None:
                item["imagery_date"] = str(item["imagery_date"])
            if item.get("created_at") is not None and hasattr(item["created_at"], "isoformat"):
                item["created_at"] = item["created_at"].isoformat()
            if item.get("published_at") is not None and hasattr(item["published_at"], "isoformat"):
                item["published_at"] = item["published_at"].isoformat()
            results.append(item)
        return results


def get_building_detail(conn, aid: int, building_id: str) -> Optional[Dict[str, Any]]:
    """Return stored fields for one building in a published assessment."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                b.assessment_id,
                b.building_id,
                b.damage_class,
                b.damage_pct,
                b.confidence,
                b.assessed_at,
                b.imagery_ref,
                CASE
                    WHEN b.pt IS NOT NULL THEN
                        ARRAY[ST_X(b.pt), ST_Y(b.pt)]
                    ELSE NULL
                END AS centroid,
                a.event_name,
                a.imagery_date,
                a.model
            FROM damage_buildings b
            JOIN damage_assessments a ON a.assessment_id = b.assessment_id
            WHERE b.assessment_id = %s
              AND b.building_id = %s
              AND a.status = 'published'
            """,
            (aid, building_id),
        )
        row = cur.fetchone()
        if not row:
            return None

        columns = [desc[0] for desc in cur.description]
        item = dict(zip(columns, row))
        if item.get("centroid") is not None:
            item["centroid"] = [float(c) for c in item["centroid"]]
        if item.get("assessed_at") is not None and hasattr(item["assessed_at"], "isoformat"):
            item["assessed_at"] = item["assessed_at"].isoformat()
        if item.get("imagery_date") is not None:
            item["imagery_date"] = str(item["imagery_date"])
        return item


def get_h3_mvt(conn, aid: int, z: int, x: int, y: int) -> Optional[bytes]:
    """Execute damage_h3_mvt and return raw MVT bytes or None."""
    with conn.cursor() as cur:
        cur.execute("SELECT damage_h3_mvt(%s, %s, %s, %s)", (z, x, y, aid))
        row = cur.fetchone()
        if not row or row[0] is None:
            return None
        val = row[0]
        # In psycopg 3, bytea can be returned as memoryview or bytes
        if isinstance(val, memoryview):
            return val.tobytes()
        return bytes(val)


def get_buildings_mvt(conn, aid: int, z: int, x: int, y: int) -> Optional[bytes]:
    """Execute damage_buildings_mvt and return raw MVT bytes or None."""
    with conn.cursor() as cur:
        cur.execute("SELECT damage_buildings_mvt(%s, %s, %s, %s)", (z, x, y, aid))
        row = cur.fetchone()
        if not row or row[0] is None:
            return None
        val = row[0]
        if isinstance(val, memoryview):
            return val.tobytes()
        return bytes(val)


def get_density_mvt(conn, aid: int, z: int, x: int, y: int) -> Optional[bytes]:
    """Execute damage_density_mvt and return raw MVT bytes or None."""
    with conn.cursor() as cur:
        cur.execute("SELECT damage_density_mvt(%s, %s, %s, %s)", (z, x, y, aid))
        row = cur.fetchone()
        if not row or row[0] is None:
            return None
        val = row[0]
        if isinstance(val, memoryview):
            return val.tobytes()
        return bytes(val)


def check_health(conn) -> bool:
    """Check database connectivity."""
    with conn.cursor() as cur:
        cur.execute("SELECT 1")
        row = cur.fetchone()
        return row is not None and row[0] == 1
