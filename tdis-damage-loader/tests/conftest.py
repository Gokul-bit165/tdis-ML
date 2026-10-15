"""Shared fixtures. Database tests run against a throw-away database created on the server in
TEST_DATABASE_URL (default: the local PostGIS from tdis-damage-db/docker-compose.yml) and are skipped
when that server cannot be reached."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import db  # noqa: E402

SERVER_URL = os.environ.get("TEST_DATABASE_URL", "postgresql://damage:damage@localhost:5544/damage")


@pytest.fixture(scope="session")
def database_url():
    name = f"damage_test_{os.getpid()}"
    try:
        admin = psycopg.connect(SERVER_URL, autocommit=True, connect_timeout=3)
    except Exception as e:
        pytest.skip(f"no test database server at TEST_DATABASE_URL ({type(e).__name__})")
    admin.execute(f'DROP DATABASE IF EXISTS "{name}"')
    admin.execute(f'CREATE DATABASE "{name}"')
    url = SERVER_URL.rsplit("/", 1)[0] + f"/{name}"
    with psycopg.connect(url, autocommit=True) as conn:
        db.apply_migration(conn)
    yield url
    admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
    admin.close()


@pytest.fixture()
def conn(database_url):
    """A connection to an empty schema: every test starts with no footprint sets and no assessments."""
    with psycopg.connect(database_url, autocommit=True) as connection:
        connection.execute("TRUNCATE damage_h3_cells, damage_results, damage_assessments, damage_footprints, "
                           "damage_footprint_sets RESTART IDENTITY CASCADE")
        yield connection
