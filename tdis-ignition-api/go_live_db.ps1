# Switch the pipeline to Postgres: build the image, point the job and the API at the database secret,
# score the newest upload and verify the API serves it. Prerequisites:
#   1. tdis-portal-db migration 042 applied to the target database (node migrate.js)
#   2. .\set_database_url.ps1 run, so the secret 'database-url' exists on the job and the API
#   .\go_live_db.ps1 -Tag 1.9
param([Parameter(Mandatory = $true)][string]$Tag)
$ErrorActionPreference = "Continue"
$env:PYTHONIOENCODING = "utf-8"
Set-Location $PSScriptRoot
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$rg = "tdis-rg"; $acr = "tdiswildfireacr2026"
$image = "$acr.azurecr.io/wildfire-ignition:$Tag"
$api = "https://wildfire-ignition-api.agreeablebay-b710af8a.centralus.azurecontainerapps.io"

function AzRun([string]$CliArgs, [int]$Times = 8) {
    for ($i = 1; $i -le $Times; $i++) {
        $out = (cmd /c "`"$az`" $CliArgs 2>&1" | Out-String)
        if ($out -notmatch "SSLError|SSLEOF|Max retries|Certificate verification|UNEXPECTED_EOF|NoNetwork") { return $out }
        Start-Sleep 8
    }
    return "NETWORK-FAILURE: $out"
}
function TagBuilt([string]$t) {
    # ARM-based (build history); the registry's own tag listing is unreliable from some networks.
    $x = AzRun "acr task list-runs -r $acr --top 20 --query `"[?status=='Succeeded'].outputImages[].tag`" -o tsv"
    return ($x -match "(?m)^$([regex]::Escape($t))\s*$")
}
function Last([string]$s) { ($s -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 1) }

Write-Output "== build $Tag"
if (-not (TagBuilt $Tag)) {
    AzRun "acr build -r $acr -t wildfire-ignition:$Tag --no-logs . --query status -o tsv" | Out-Null
    for ($w = 0; $w -lt 48 -and -not (TagBuilt $Tag); $w++) { Start-Sleep 15 }
}
if (-not (TagBuilt $Tag)) { Write-Output "BUILD FAILED"; Write-Output "GOLIVEDONE"; exit 1 }
Write-Output "  $Tag present"

Write-Output "== job -> $Tag + database, polling for new uploads every 5 minutes"
Write-Output ("  " + (Last (AzRun "containerapp job update -g $rg -n wildfire-ignition-job --image $image --cron-expression `"*/5 * * * *`" --set-env-vars DATABASE_URL=secretref:database-url FEATURES_URI=az://datatexas/wildfire-data/daily-features STATUS_URI=az://datatexas/wildfire-data/predictions --remove-env-vars PREDICTIONS_URI --query properties.provisioningState -o tsv")))

Write-Output "== api -> $Tag + database"
$suffix = "v" + ($Tag -replace "\.", "") + "-" + (Get-Date -Format "HHmm")
Write-Output ("  " + (Last (AzRun "containerapp update -g $rg -n wildfire-ignition-api --image $image --revision-suffix $suffix --set-env-vars DATABASE_URL=secretref:database-url --remove-env-vars PREDICTIONS_URI BIT_DIR --query properties.latestRevisionName -o tsv")))

Write-Output "== score the newest upload"
$exec = (Last (AzRun "containerapp job start -g $rg -n wildfire-ignition-job --query name -o tsv")).Trim()
Write-Output "  execution: $exec"
for ($i = 0; $i -lt 40; $i++) {
    $st = (Last (AzRun "containerapp job execution show -g $rg -n wildfire-ignition-job --job-execution-name $exec --query properties.status -o tsv")).Trim()
    Write-Output "  job: $st"
    if ($st -match "Succeeded|Failed|Stopped|Degraded") { break }
    Start-Sleep 15
}
if ($st -notmatch "Succeeded") {
    Write-Output "  job did not succeed; recent log lines:"
    AzRun "containerapp job logs show -g $rg -n wildfire-ignition-job --execution $exec --container wildfire-ignition-job" | Select-Object -Last 8
}

Write-Output "== live API"
for ($i = 0; $i -lt 16; $i++) {
    try {
        $h = Invoke-RestMethod "$api/health" -TimeoutSec 90
        Write-Output ("  health: " + ($h | ConvertTo-Json -Compress))
        if ($h.database_ok) {
            $d = Invoke-RestMethod "$api/api/v1/ignition/coverage?res=5" -TimeoutSec 90
            Write-Output "  RESULT size-5 hexes: $($d.count), for_date $($d.for_date), run $($d.run_id), source $($d.data_source)"
            break
        }
    } catch { Write-Output "  (api not ready: $($_.Exception.Message))" }
    Start-Sleep 15
}
Write-Output "GOLIVEDONE"
