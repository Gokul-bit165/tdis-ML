#!/bin/sh
# Runs once, when the local database volume is first created: applies every migration in order.
set -e
for f in /docker-entrypoint-initdb.d/migrations/*.sql; do
    echo "applying $f"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done
