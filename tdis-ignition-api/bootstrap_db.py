"""One-off database bootstrap. Runs inside Azure (this PC cannot reach Postgres port 5432) with the admin login.

Builds a portal-compatible database for the wildfire predictions:
  1. roles ed_app_admin / ed_app_user (as tdis-portal-db/migrate.js creates them) and two login roles,
     wildfire_job (member of ed_app_admin, used by the scoring job) and wildfire_api (member of ed_app_user,
     read-only, used by the map API)
  2. the portal tables that migration 042 references: data_sources (003) and batch_jobs (005), only if absent
  3. migration 042 (wildfire_ignition_runs / wildfire_ignition_cells, plus the data source and batch job rows)
  4. the extra grants the scoring job needs on those two portal tables

Env: DATABASE_ADMIN_URL, JOB_DB_PASSWORD, API_DB_PASSWORD, SQL_DIR (default ./sql). Safe to run again.
"""
import os
import sys
from pathlib import Path

import psycopg
from psycopg import sql

SQL_DIR = Path(os.environ.get("SQL_DIR", Path(__file__).resolve().parent / "sql"))


def role_exists(conn, name: str) -> bool:
    return conn.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (name,)).fetchone() is not None


def table_exists(conn, name: str) -> bool:
    return conn.execute("SELECT to_regclass(%s)", (name,)).fetchone()[0] is not None


def main() -> int:
    conn = psycopg.connect(os.environ["DATABASE_ADMIN_URL"], autocommit=True)
    db_name = conn.execute("SELECT current_database()").fetchone()[0]
    print(f"connected to database {db_name}")

    for role in ("ed_app_admin", "ed_app_user"):
        if not role_exists(conn, role):
            conn.execute(sql.SQL("CREATE ROLE {}").format(sql.Identifier(role)))
    for login, parent, env_var in (("wildfire_job", "ed_app_admin", "JOB_DB_PASSWORD"),
                                   ("wildfire_api", "ed_app_user", "API_DB_PASSWORD")):
        pw = os.environ[env_var]
        verb = "ALTER" if role_exists(conn, login) else "CREATE"
        conn.execute(sql.SQL(f"{verb} ROLE {{}} LOGIN PASSWORD {{}}").format(sql.Identifier(login), sql.Literal(pw)))
        conn.execute(sql.SQL("GRANT {} TO {}").format(sql.Identifier(parent), sql.Identifier(login)))
    print("roles ready: ed_app_admin, ed_app_user, wildfire_job, wildfire_api")

    for table, filename in (("data_sources", "003_create_data_sources_table.sql"),
                            ("batch_jobs", "005_create_batch_jobs_table.sql")):
        if table_exists(conn, table):
            print(f"{table} already exists")
        else:
            conn.execute((SQL_DIR / filename).read_text(encoding="utf-8"))
            print(f"created {table} from {filename}")

    conn.execute((SQL_DIR / "042_create_wildfire_ignition_tables.sql").read_text(encoding="utf-8"))
    print("migration 042 applied")
    conn.execute((SQL_DIR / "043_create_wildfire_ignition_hexes.sql").read_text(encoding="utf-8"))
    print("migration 043 applied")

    # The job reads data_sources and updates its own batch_jobs row.
    conn.execute("GRANT SELECT ON data_sources TO ed_app_admin")
    conn.execute("GRANT SELECT, UPDATE ON batch_jobs TO ed_app_admin")

    tables = [r[0] for r in conn.execute(
        "SELECT tablename FROM pg_tables WHERE tablename LIKE 'wildfire_ignition%' ORDER BY 1")]
    source = conn.execute("SELECT count(*) FROM data_sources WHERE data_source = 'Wildfire Ignition Model'").fetchone()[0]
    job = conn.execute("SELECT count(*) FROM batch_jobs WHERE batch_job = 'Wildfire Ignition Scoring Job'").fetchone()[0]
    if tables != ["wildfire_ignition_cells", "wildfire_ignition_hexes", "wildfire_ignition_runs"] or source != 1 or job != 1:
        print(f"VERIFY FAILED: tables={tables} data_source_rows={source} batch_job_rows={job}", file=sys.stderr)
        return 1
    print(f"verified: tables {tables}, 1 data source row, 1 batch job row")
    print("bootstrap ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
