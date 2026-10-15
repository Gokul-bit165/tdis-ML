# tdis-damage-db

Database objects for the Damage Assessment feature: one migration, its rollback, and a local PostGIS for development.

| Path | What |
|---|---|
| `migrations/043_create_damage_assessment_tables.sql` | Five tables, one view, the zoom function and three vector-tile functions. Re-runnable |
| `rollback/043_rollback.sql` | Removes everything the migration created, including the data |
| `docs/DAMAGE_ASSESSMENT_SCHEMA.md` | What each object is for, how it is written and read, sizes |
| `docker-compose.yml`, `initdb.sh` | Local PostGIS 16 on port 5544 with the migration applied |

`tdis-damage-loader` writes to these tables. `tdis-damage-api` reads them and calls the tile functions.

## Local database

```powershell
docker compose up -d          # first start applies the migration
docker compose down -v        # stop and delete the data
```

Connection: `postgresql://damage:damage@localhost:5544/damage`

After editing the migration, re-apply it to a running local database:

```powershell
Get-Content migrations\043_create_damage_assessment_tables.sql | docker exec -i tdis-damage-db psql -U damage -d damage
```

## Applying to a real database

Requirements: PostgreSQL 14 or later, PostGIS 3.1 or later, and the `btree_gist` extension. On Azure Database for
PostgreSQL, add `POSTGIS` and `BTREE_GIST` to the server parameter `azure.extensions` first, or `CREATE EXTENSION` fails.

The file follows the portal's migration conventions (number 043, guarded statements, grants to `ed_app_admin` and
`ed_app_user`). To put it under the portal's runner, copy it into `tdis-portal-db/migrations/` and run `node migrate.js`.
It has not been copied there, so the portal runner does not apply it yet.

The wildfire database server (`pg-wildfire-tdis`) was created without PostGIS and on the smallest burstable size. If the
damage tables go there, enable the two extensions and raise the size before public use.
