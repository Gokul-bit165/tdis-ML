"""One-off database bootstrap for Azure. Runs inside Azure (port 5432 is not reachable from a dev PC) with the admin login.

  1. extensions postgis and btree_gist (the server must allow-list them in azure.extensions first)
  2. migration 043 (tables and tile functions), owned by the admin login
  3. two login roles: damage_job (reads and writes, used by the loader job) and damage_api (read-only, used by the API)

Env: DATABASE_ADMIN_URL, JOB_DB_PASSWORD, API_DB_PASSWORD, MIGRATION_FILE (default ./sql/043_...sql). Safe to run again.
"""
import os
import sys
from pathlib import Path

import psycopg
from psycopg import sql

MIGRATION = Path(os.environ.get("MIGRATION_FILE", Path(__file__).resolve().parent / "sql" / "043_create_damage_assessment_tables.sql"))
TABLES = ["damage_footprint_sets", "damage_footprints", "damage_assessments", "damage_results", "damage_h3_cells"]


def role_exists(conn, name: str) -> bool:
    return conn.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (name,)).fetchone() is not None


def main() -> int:
    conn = psycopg.connect(os.environ["DATABASE_ADMIN_URL"], autocommit=True)
    print(f"connected to database {conn.execute('SELECT current_database()').fetchone()[0]}")

    conn.execute(MIGRATION.read_text(encoding="utf-8"))
    print(f"applied {MIGRATION.name}")

    for login, env_var in (("damage_job", "JOB_DB_PASSWORD"), ("damage_api", "API_DB_PASSWORD")):
        verb = "ALTER" if role_exists(conn, login) else "CREATE"
        conn.execute(sql.SQL(f"{verb} ROLE {{}} LOGIN PASSWORD {{}}").format(sql.Identifier(login), sql.Literal(os.environ[env_var])))
    conn.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO damage_job")
    conn.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO damage_job")
    conn.execute("GRANT SELECT ON ALL TABLES IN SCHEMA public TO damage_api")
    # the loader runs ANALYZE, which needs ownership of the table
    conn.execute("GRANT damage_job TO CURRENT_USER")
    for table in TABLES:
        conn.execute(sql.SQL("ALTER TABLE {} OWNER TO damage_job").format(sql.Identifier(table)))
    print("roles ready: damage_job (read/write), damage_api (read-only)")

    found = sorted(r[0] for r in conn.execute("SELECT tablename FROM pg_tables WHERE tablename LIKE 'damage\\_%'"))
    funcs = sorted(r[0] for r in conn.execute("SELECT proname FROM pg_proc WHERE proname LIKE 'damage\\_%\\_mvt'"))
    if found != sorted(TABLES) or len(funcs) != 3:
        print(f"VERIFY FAILED: tables={found} functions={funcs}", file=sys.stderr)
        return 1
    print(f"verified: tables {found}, functions {funcs}")
    print("bootstrap ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
