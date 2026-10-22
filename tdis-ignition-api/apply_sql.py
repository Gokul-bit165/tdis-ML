"""One-off: run a .sql file from ./sql against DATABASE_ADMIN_URL (the admin login). Runs inside Azure because
this PC cannot reach Postgres. Usage: python apply_sql.py sql/043_create_wildfire_ignition_hexes.sql"""
import os
import sys
from pathlib import Path

import psycopg

path = Path(sys.argv[1])
conn = psycopg.connect(os.environ["DATABASE_ADMIN_URL"], autocommit=True)
print(f"connected to {conn.execute('SELECT current_database()').fetchone()[0]}")
conn.execute(path.read_text(encoding="utf-8"))
print(f"applied {path.name}")
for res, n in conn.execute("SELECT res, count(*) FROM wildfire_ignition_hexes GROUP BY res ORDER BY res"):
    print(f"  res {res}: {n} hexagons")
