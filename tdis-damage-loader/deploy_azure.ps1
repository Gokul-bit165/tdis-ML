# Deploy Damage Assessment to Azure end to end (resource group tdis-rg):
#   database `damage` on pg-wildfire-tdis (PostGIS) -> images in ACR -> bootstrap (tables, roles) ->
#   blob container damage-data (+ the _local\in sample data) -> loader job -> read-only API -> smoke test.
# Requires `az login`. Passwords are generated here, sent only to Azure, never printed or saved.
# Re-running rotates the two database passwords and rebuilds; the data in the database is kept.
param(
    [string]$Tag = "1.0",
    [string]$Server = "pg-wildfire-tdis",
    [string]$Database = "damage",
    [string]$Cron = "*/5 * * * *",
    [switch]$SkipUpload
)
$ErrorActionPreference = "Continue"
$env:PYTHONIOENCODING = "utf-8"
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$rg = "tdis-rg"; $acr = "tdiswildfireacr2026"; $identity = "id-wildfire-job"; $envName = "managedEnvironment-tdisrg-b1be"
$storage = "datatexas"; $container = "damage-data"
$adminUser = "wfadmin"; $dbHost = "$Server.postgres.database.azure.com"
$root = Split-Path $PSScriptRoot -Parent
$cors = "http://localhost:5173,http://127.0.0.1:5173,https://delightful-sky-065ac4610.6.azurestaticapps.net,https://wonderful-moss-0963acc10.2.azurestaticapps.net"

function AzRun([string]$CliArgs, [int]$Times = 8) {
    for ($i = 1; $i -le $Times; $i++) {
        $out = (cmd /c "`"$az`" $CliArgs 2>&1" | Out-String)
        if ($out -notmatch "SSLError|SSLEOF|Max retries|Certificate verification|UNEXPECTED_EOF|NoNetwork|timed out") { return $out }
        Start-Sleep 10
    }
    return "NETWORK-FAILURE: $out"
}
function Last([string]$s) { ($s -split "`r?`n" | Where-Object { $_.Trim() -and $_ -notmatch "^WARNING" } | Select-Object -Last 1) }
function TagBuilt([string]$repo, [string]$t) {
    $x = AzRun "acr task list-runs -r $acr --top 30 --query `"[?status=='Succeeded'].outputImages[].tag`" -o tsv"
    return ($x -match "(?m)^$([regex]::Escape($t))\s*$")
}
function Build([string]$repo, [string]$dir) {
    Push-Location $dir
    AzRun "acr build -r $acr -t ${repo}:$Tag --no-logs . --query status -o tsv" | Out-Null
    Pop-Location
    for ($w = 0; $w -lt 60; $w++) {
        $runs = AzRun "acr task list-runs -r $acr --top 5 --query `"[].{s:status,t:outputImages[0].repository}`" -o tsv"
        $ok = AzRun "acr repository show-tags -n $acr --repository $repo -o tsv"
        if ($ok -match "(?m)^$([regex]::Escape($Tag))\s*$") { Write-Output "  $repo`:$Tag present"; return $true }
        Start-Sleep 15
    }
    return $false
}
function NewPw {
    $chars = [char[]]"abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    $rng = New-Object Security.Cryptography.RNGCryptoServiceProvider
    $bytes = New-Object byte[] 28; $rng.GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}
$jobPw = NewPw; $apiPw = NewPw

Write-Output "== 1. database $Database on $Server (PostGIS)"
$state = (Last (AzRun "postgres flexible-server show -g $rg -n $Server --query state -o tsv")).Trim()
if ($state -ne "Ready") { Write-Output "SERVER NOT READY ($state)"; Write-Output "DAMAGEDONE"; exit 1 }
$ext = (Last (AzRun "postgres flexible-server parameter show -g $rg -s $Server -n azure.extensions --query value -o tsv")).Trim()
if ($ext -notmatch "POSTGIS" -or $ext -notmatch "BTREE_GIST") {
    $merged = (($ext -split "," | Where-Object { $_ }) + "POSTGIS" + "BTREE_GIST" | Sort-Object -Unique) -join ","
    Write-Output ("  allow-listing extensions: " + (Last (AzRun "postgres flexible-server parameter set -g $rg -s $Server -n azure.extensions --value `"$merged`" --query value -o tsv")))
}
AzRun "postgres flexible-server db create -g $rg -s $Server -n $Database -o none" | Out-Null
Write-Output ("  databases: " + ((AzRun "postgres flexible-server db list -g $rg -s $Server --query `"[].name`" -o tsv") -split "`r?`n" | Where-Object { $_.Trim() }) -join ", ")

Write-Output "== 2. images ($Tag)"
$sql = Join-Path $PSScriptRoot "sql"
New-Item -ItemType Directory -Force $sql | Out-Null
Copy-Item "$root\tdis-damage-db\migrations\043_create_damage_assessment_tables.sql" $sql -Force
if (-not (Build "damage-loader" $PSScriptRoot)) { Write-Output "LOADER BUILD FAILED"; Write-Output "DAMAGEDONE"; exit 1 }
if (-not (Build "damage-api" "$root\tdis-damage-api")) { Write-Output "API BUILD FAILED"; Write-Output "DAMAGEDONE"; exit 1 }

Write-Output "== 3. bootstrap inside Azure (extensions, migration 043, roles)"
$rid = (Last (AzRun "identity show -g $rg -n $identity --query id -o tsv")).Trim()
$cid = (Last (AzRun "identity show -g $rg -n $identity --query clientId -o tsv")).Trim()
# The admin password is reset to a fresh random value used only for this bootstrap job, which is then deleted.
$adminPw = NewPw
$reset = AzRun "postgres flexible-server update -g $rg -n $Server --admin-password $adminPw -o none"
if ($reset -match "ERROR") { Write-Output ("  admin reset failed: " + ($reset -replace [regex]::Escape($adminPw), "***")); Write-Output "DAMAGEDONE"; exit 1 }
$adminUrl = "postgresql://${adminUser}:${adminPw}@${dbHost}:5432/${Database}?sslmode=require"
$image = "$acr.azurecr.io/damage-loader:$Tag"
AzRun "containerapp job delete -g $rg -n damage-db-bootstrap --yes -o none" | Out-Null
AzRun ("containerapp job create -g $rg -n damage-db-bootstrap --environment $envName --trigger-type Manual " +
       "--replica-timeout 600 --replica-retry-limit 0 --replica-completion-count 1 --parallelism 1 --image $image " +
       "--registry-server $acr.azurecr.io --registry-identity $rid --mi-user-assigned $rid --cpu 0.5 --memory 1Gi " +
       "--secrets `"admin-url=$adminUrl`" `"job-pw=$jobPw`" `"api-pw=$apiPw`" " +
       "--env-vars RUN_MODE=bootstrap DATABASE_ADMIN_URL=secretref:admin-url JOB_DB_PASSWORD=secretref:job-pw API_DB_PASSWORD=secretref:api-pw -o none") | Out-Null
$exec = (Last (AzRun "containerapp job start -g $rg -n damage-db-bootstrap --query name -o tsv")).Trim()
$st = ""
for ($i = 0; $i -lt 40; $i++) {
    $st = (Last (AzRun "containerapp job execution show -g $rg -n damage-db-bootstrap --job-execution-name $exec --query properties.status -o tsv")).Trim()
    Write-Output "  bootstrap: $st"
    if ($st -match "Succeeded|Failed|Stopped|Degraded") { break }
    Start-Sleep 15
}
$logs = AzRun "containerapp job logs show -g $rg -n damage-db-bootstrap --container damage-db-bootstrap --execution $exec --format text"
($logs -split "`r?`n" | Where-Object { $_ -match "connected|applied|roles|verified|bootstrap ok|VERIFY|Error|error" } | Select-Object -Last 10) | ForEach-Object { Write-Output "  log: $_" }
AzRun "containerapp job delete -g $rg -n damage-db-bootstrap --yes -o none" | Out-Null
Write-Output "  bootstrap job (and its admin secret) deleted"
if ($st -notmatch "Succeeded") { Write-Output "BOOTSTRAP FAILED"; Write-Output "DAMAGEDONE"; exit 1 }
$adminPw = $null; $adminUrl = $null

Write-Output "== 4. blob container $container and the sample upload"
AzRun "storage container create --account-name $storage -n $container --auth-mode login -o none" | Out-Null
if (-not $SkipUpload) {
    $in = Join-Path $PSScriptRoot "_local\in"
    $items = @(@("footprints/synthetic_houston.parquet", "$in\footprints\synthetic_houston.parquet"),
               @("assessments/synthetic_run_001/results.parquet", "$in\assessments\synthetic_run_001\results.parquet"),
               @("assessments/synthetic_run_001/manifest.json", "$in\assessments\synthetic_run_001\manifest.json"))   # manifest last
    foreach ($it in $items) {
        $o = AzRun "storage blob upload --account-name $storage -c $container -n $($it[0]) -f `"$($it[1])`" --auth-mode login --overwrite -o none"
        Write-Output ("  uploaded $($it[0])" + $(if ($o -match "ERROR") { "  FAILED: $($o.Trim())" }))
    }
}

Write-Output "== 5. loader job (polls $container with schedule '$Cron')"
$jobUrl = "postgresql://damage_job:${jobPw}@${dbHost}:5432/${Database}?sslmode=require"
AzRun "containerapp job delete -g $rg -n damage-loader-job --yes -o none" | Out-Null
$o = AzRun ("containerapp job create -g $rg -n damage-loader-job --environment $envName --trigger-type Schedule --cron-expression `"$Cron`" " +
       "--replica-timeout 1800 --replica-retry-limit 1 --replica-completion-count 1 --parallelism 1 --image $image " +
       "--registry-server $acr.azurecr.io --registry-identity $rid --mi-user-assigned $rid --cpu 2 --memory 4Gi " +
       "--secrets `"database-url=$jobUrl`" --env-vars DATABASE_URL=secretref:database-url DAMAGE_URI=az://$storage/$container AZURE_CLIENT_ID=$cid " +
       "--query properties.provisioningState -o tsv")
Write-Output ("  " + ($o -replace [regex]::Escape($jobPw), "***").Trim().Split("`n")[-1])

Write-Output "== 6. API container app damage-api"
$apiUrl = "postgresql://damage_api:${apiPw}@${dbHost}:5432/${Database}?sslmode=require"
$apiImage = "$acr.azurecr.io/damage-api:$Tag"
$have = AzRun "containerapp show -g $rg -n damage-api --query name -o tsv"
if ($have -match "damage-api") {
    AzRun "containerapp secret set -g $rg -n damage-api --secrets `"database-url=$apiUrl`" -o none" | Out-Null
    $o = AzRun "containerapp update -g $rg -n damage-api --image $apiImage --revision-suffix v$($Tag -replace '\.','')-$(Get-Date -Format HHmm) --set-env-vars DATABASE_URL=secretref:database-url `"CORS_ORIGINS=$cors`" --query properties.provisioningState -o tsv"
} else {
    $o = AzRun ("containerapp create -g $rg -n damage-api --environment $envName --image $apiImage " +
        "--registry-server $acr.azurecr.io --registry-identity $rid --user-assigned $rid " +
        "--target-port 8000 --ingress external --min-replicas 1 --max-replicas 3 --cpu 1 --memory 2Gi " +
        "--secrets `"database-url=$apiUrl`" --env-vars DATABASE_URL=secretref:database-url `"CORS_ORIGINS=$cors`" " +
        "--query properties.configuration.ingress.fqdn -o tsv")
}
Write-Output ("  " + ($o -replace [regex]::Escape($apiPw), "***").Trim().Split("`n")[-1])
$jobPw = $null; $apiPw = $null; $jobUrl = $null; $apiUrl = $null

Write-Output "== 7. load the sample data"
$exec = (Last (AzRun "containerapp job start -g $rg -n damage-loader-job --query name -o tsv")).Trim()
Write-Output "  execution: $exec"
for ($i = 0; $i -lt 60; $i++) {
    $st = (Last (AzRun "containerapp job execution show -g $rg -n damage-loader-job --job-execution-name $exec --query properties.status -o tsv")).Trim()
    Write-Output "  job: $st"
    if ($st -match "Succeeded|Failed|Stopped|Degraded") { break }
    Start-Sleep 20
}
AzRun "containerapp job logs show -g $rg -n damage-loader-job --container damage-loader-job --execution $exec --format text" | Select-Object -Last 6 | ForEach-Object { Write-Output "  log: $_" }

Write-Output "== 8. smoke test"
$fqdn = (Last (AzRun "containerapp show -g $rg -n damage-api --query properties.configuration.ingress.fqdn -o tsv")).Trim()
$u = "https://$fqdn"
Write-Output "  API: $u"
for ($i = 0; $i -lt 16; $i++) {
    try {
        $h = Invoke-RestMethod "$u/health" -TimeoutSec 60; Write-Output ("  health: " + ($h | ConvertTo-Json -Compress))
        $a = Invoke-RestMethod "$u/api/v1/damage/assessments" -TimeoutSec 60
        Write-Output "  RESULT assessments: $(@($a).Count); first: id $(@($a)[0].assessment_id), $(@($a)[0].n_buildings) buildings, source $(@($a)[0].data_source)"
        break
    } catch { Write-Output "  (not ready: $($_.Exception.Message))"; Start-Sleep 15 }
}
Write-Output "DAMAGEDONE"
