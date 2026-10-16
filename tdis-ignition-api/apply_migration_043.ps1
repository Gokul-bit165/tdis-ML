# Apply migration 043 (wildfire_ignition_hexes + backfill of the current run) as the database admin.
# Prompts for the admin password; it goes straight to psql and is never written to a file.
#   .\apply_migration_043.ps1            (admin user defaults to wfadmin, database to the one the API uses)
param(
    [string]$DbHost = "pg-wildfire-tdis.postgres.database.azure.com",
    [string]$DbUser = "wfadmin",
    [Parameter(Mandatory = $true)][string]$Database
)
$ErrorActionPreference = "Stop"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$secure = Read-Host -AsSecureString "Admin password for $DbUser@$DbHost"
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$env:PGSSLMODE = "require"
try {
    & $psql -h $DbHost -U $DbUser -d $Database -v ON_ERROR_STOP=1 -f "$PSScriptRoot\sql\043_create_wildfire_ignition_hexes.sql"
    & $psql -h $DbHost -U $DbUser -d $Database -c "SELECT res, count(*) FROM wildfire_ignition_hexes GROUP BY res ORDER BY res"
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
