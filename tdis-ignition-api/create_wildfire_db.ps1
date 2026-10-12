# Create the Azure Postgres that stores the wildfire predictions, and wire the job and the API to it.
#   build image -> create server + database -> one-off bootstrap job in Azure (tables, roles, migration 042)
#   -> store DATABASE_URL secrets (job: read/write role, API: read-only role) -> go_live_db.ps1
# Passwords are generated here, sent only to Azure, and never printed or saved. To get admin access later:
#   az postgres flexible-server update -g tdis-rg -n pg-wildfire-tdis --admin-password <new>
param([string]$Tag = "1.9", [string]$Server = "pg-wildfire-tdis", [string]$Database = "wildfire")
$ErrorActionPreference = "Continue"
$env:PYTHONIOENCODING = "utf-8"
Set-Location $PSScriptRoot
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$rg = "tdis-rg"; $acr = "tdiswildfireacr2026"; $identity = "id-wildfire-job"
$image = "$acr.azurecr.io/wildfire-ignition:$Tag"
$adminUser = "wfadmin"
$dbHost = "$Server.postgres.database.azure.com"

function AzRun([string]$CliArgs, [int]$Times = 8) {
    for ($i = 1; $i -le $Times; $i++) {
        $out = (cmd /c "`"$az`" $CliArgs 2>&1" | Out-String)
        if ($out -notmatch "SSLError|SSLEOF|Max retries|Certificate verification|UNEXPECTED_EOF|NoNetwork|timed out") { return $out }
        Start-Sleep 10
    }
    return "NETWORK-FAILURE"
}
function Last([string]$s) { ($s -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 1) }
function TagBuilt([string]$t) {
    # ARM-based (build history); the registry's own tag listing is unreliable from some networks.
    $x = AzRun "acr task list-runs -r $acr --top 20 --query `"[?status=='Succeeded'].outputImages[].tag`" -o tsv"
    return ($x -match "(?m)^$([regex]::Escape($t))\s*$")
}
function NewPw {
    $chars = [char[]]"abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    $rng = New-Object Security.Cryptography.RNGCryptoServiceProvider
    $bytes = New-Object byte[] 28; $rng.GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}
$adminPw = NewPw; $jobPw = NewPw; $apiPw = NewPw

Write-Output "== 1. image $Tag"
if (-not (TagBuilt $Tag)) {
    AzRun "acr build -r $acr -t wildfire-ignition:$Tag --no-logs . --query status -o tsv" | Out-Null
    for ($w = 0; $w -lt 48 -and -not (TagBuilt $Tag); $w++) { Start-Sleep 15 }   # build runs asynchronously
}
if (-not (TagBuilt $Tag)) { Write-Output "IMAGE BUILD FAILED"; Write-Output "DBDONE"; exit 1 }
Write-Output "  $Tag present"

Write-Output "== 2. Postgres server $Server (Burstable B1ms, 32 GB, Central US)"
$state = (Last (AzRun "postgres flexible-server show -g $rg -n $Server --query state -o tsv")).Trim()
if ($state -match "ResourceNotFound|not found") {
    $created = AzRun "postgres flexible-server create -g $rg -n $Server -l centralus --tier Burstable --sku-name Standard_B1ms --version 15 --storage-size 32 --admin-user $adminUser --admin-password $adminPw --public-access 0.0.0.0 --backup-retention 7 --yes -o none"
    $shown = ($created -replace [regex]::Escape($adminPw), "***").Trim()
    if ($shown) { Write-Output ("  create output: " + $shown.Substring(0, [Math]::Min(600, $shown.Length))) }
} else {
    Write-Output "  server exists (state: $state); waiting for Ready, then resetting the admin password"
    for ($i = 0; $i -lt 40 -and $state -ne "Ready"; $i++) {
        Start-Sleep 20
        $state = (Last (AzRun "postgres flexible-server show -g $rg -n $Server --query state -o tsv")).Trim()
    }
    $reset = AzRun "postgres flexible-server update -g $rg -n $Server --admin-password $adminPw -o none"
    $shownReset = ($reset -replace [regex]::Escape($adminPw), "***").Trim()
    if ($shownReset) { Write-Output ("  password reset: " + $shownReset.Substring(0, [Math]::Min(300, $shownReset.Length))) }
    AzRun "postgres flexible-server db create -g $rg -s $Server -n $Database -o none" | Out-Null
}
for ($i = 0; $i -lt 40; $i++) {
    $state = (Last (AzRun "postgres flexible-server show -g $rg -n $Server --query state -o tsv")).Trim()
    Write-Output "  server state: $state"
    if ($state -eq "Ready") { break }
    Start-Sleep 20
}
if ($state -ne "Ready") { Write-Output "SERVER NOT READY"; Write-Output "DBDONE"; exit 1 }
$dbOut = AzRun "postgres flexible-server db create -g $rg -s $Server -n $Database -o none"
if ($dbOut.Trim()) { Write-Output ("  db create: " + $dbOut.Trim().Substring(0, [Math]::Min(300, $dbOut.Trim().Length))) }
Write-Output ("  databases: " + ((AzRun "postgres flexible-server db list -g $rg -s $Server --query `"[].name`" -o tsv") -split "`r?`n" | Where-Object { $_.Trim() }) -join ", ")
$rules = AzRun "postgres flexible-server firewall-rule list -g $rg -s $Server --query `"[].name`" -o tsv"
if ($rules -notmatch "AllowAllAzureServices") {
    AzRun "postgres flexible-server firewall-rule create -g $rg -s $Server -n AllowAllAzureServicesAndResourcesWithinAzureIps --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o none" | Out-Null
    $rules = AzRun "postgres flexible-server firewall-rule list -g $rg -s $Server --query `"[].name`" -o tsv"
}
Write-Output ("  firewall rules: " + (($rules -split "`r?`n" | Where-Object { $_.Trim() }) -join ", "))

Write-Output "== 2b. database secrets (set and verified first, so a failure costs nothing)"
$jobUrl = "postgresql://wildfire_job:${jobPw}@${dbHost}:5432/${Database}?sslmode=require"
$apiUrl = "postgresql://wildfire_api:${apiPw}@${dbHost}:5432/${Database}?sslmode=require"
function Redact([string]$t) { foreach ($v in @($jobUrl, $apiUrl, $jobPw, $apiPw, $adminPw)) { if ($v) { $t = $t -replace [regex]::Escape($v), "***" } }; $t.Trim() }
function SetSecretVerified([string]$Label, [string]$SetArgs, [string]$ListArgs) {
    # Azure's management API sometimes answers "does not exist" for an app that does exist; retry and verify by listing.
    for ($n = 1; $n -le 12; $n++) {
        $res = Redact (AzRun $SetArgs)
        if ((AzRun $ListArgs) -match "database-url") { Write-Output "  secret database-url set on the $Label"; return $true }
        Write-Output "  ($Label secret attempt $n not confirmed: $($res.Substring(0, [Math]::Min(100, $res.Length))))"
        Start-Sleep 10
    }
    return $false
}
$okJob = SetSecretVerified "job (read/write role)" "containerapp job secret set -g $rg -n wildfire-ignition-job --secrets `"database-url=$jobUrl`" -o none" "containerapp job secret list -g $rg -n wildfire-ignition-job --query `"[].name`" -o tsv"
$okApi = SetSecretVerified "API (read-only role)" "containerapp secret set -g $rg -n wildfire-ignition-api --secrets `"database-url=$apiUrl`" -o none" "containerapp secret list -g $rg -n wildfire-ignition-api --query `"[].name`" -o tsv"
if (-not ($okJob -and $okApi)) { Write-Output "SECRETS FAILED"; Write-Output "DBDONE"; exit 1 }

Write-Output "== 3. bootstrap inside Azure (tables, roles, migration 042)"
$rid = (Last (AzRun "identity show -g $rg -n $identity --query id -o tsv")).Trim()
$adminUrl = "postgresql://${adminUser}:${adminPw}@${dbHost}:5432/${Database}?sslmode=require"
AzRun "containerapp job delete -g $rg -n wildfire-db-bootstrap --yes -o none" | Out-Null
AzRun ("containerapp job create -g $rg -n wildfire-db-bootstrap --environment managedEnvironment-tdisrg-b1be --trigger-type Manual " +
       "--replica-timeout 600 --replica-retry-limit 0 --replica-completion-count 1 --parallelism 1 --image $image " +
       "--registry-server $acr.azurecr.io --registry-identity $rid --mi-user-assigned $rid --cpu 0.5 --memory 1Gi " +
       "--secrets `"admin-url=$adminUrl`" `"job-pw=$jobPw`" `"api-pw=$apiPw`" " +
       "--env-vars RUN_MODE=bootstrap DATABASE_ADMIN_URL=secretref:admin-url JOB_DB_PASSWORD=secretref:job-pw API_DB_PASSWORD=secretref:api-pw -o none") | Out-Null
$exec = (Last (AzRun "containerapp job start -g $rg -n wildfire-db-bootstrap --query name -o tsv")).Trim()
Write-Output "  execution: $exec"
$st = ""
for ($i = 0; $i -lt 40; $i++) {
    $st = (Last (AzRun "containerapp job execution show -g $rg -n wildfire-db-bootstrap --job-execution-name $exec --query properties.status -o tsv")).Trim()
    Write-Output "  bootstrap: $st"
    if ($st -match "Succeeded|Failed|Stopped|Degraded") { break }
    Start-Sleep 15
}
$logs = AzRun "containerapp job logs show -g $rg -n wildfire-db-bootstrap --container wildfire-db-bootstrap --execution $exec --format text"
($logs -split "`r?`n" | Where-Object { $_ -match "connected|roles|created|already|migration|verified|bootstrap ok|VERIFY|Error|error" } | Select-Object -Last 10) | ForEach-Object { Write-Output "  log: $_" }
AzRun "containerapp job delete -g $rg -n wildfire-db-bootstrap --yes -o none" | Out-Null
Write-Output "  bootstrap job (and its admin secret) deleted"
if ($st -notmatch "Succeeded") { Write-Output "BOOTSTRAP FAILED"; Write-Output "DBDONE"; exit 1 }

$adminPw = $null; $jobPw = $null; $apiPw = $null; $adminUrl = $null; $jobUrl = $null; $apiUrl = $null
Write-Output "== 5. switch the pipeline to the database"
& "$PSScriptRoot\go_live_db.ps1" -Tag $Tag
Write-Output "DBDONE"


