# Upload a prepared <date>.parquet to Azure and (optionally) score it right away.
#   .\upload_features.ps1 -File .\ready\2026-10-07.parquet            # wait for the 01:00 UTC run
#   .\upload_features.ps1 -File .\ready\2026-10-07.parquet -RunNow     # score immediately
param(
    [Parameter(Mandatory = $true)][string]$File,
    [switch]$RunNow
)
$ErrorActionPreference = "Stop"
$env:PYTHONIOENCODING = "utf-8"
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$name = Split-Path $File -Leaf
if ($name -notmatch '^\d{4}-\d{2}-\d{2}\.parquet$') { throw "file must be named <YYYY-MM-DD>.parquet (use prepare_features.py)" }

& $az storage blob upload --account-name datatexas -c wildfire-data -n "daily-features/$name" -f $File --auth-mode login --overwrite -o none
Write-Output "uploaded daily-features/$name to datatexas/wildfire-data"

if ($RunNow) {
    $exec = (& $az containerapp job start -g tdis-rg -n wildfire-ignition-job --query name -o tsv).Trim()
    Write-Output "started job $exec; check: az containerapp job execution show -g tdis-rg -n wildfire-ignition-job --job-execution-name $exec --query properties.status"
} else {
    Write-Output "the daily job (01:00 UTC) will score the newest file in daily-features/"
}
