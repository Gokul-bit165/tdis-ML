# Roll an ALREADY-BUILT image tag out to the scoring job and the API app, re-run the job on the
# newest uploaded features, and check the live API. Build first with:
#   az acr build -r tdiswildfireacr2026 -t wildfire-ignition:<tag> .
#   .\rollout.ps1 -Tag 1.5
param([Parameter(Mandatory = $true)][string]$Tag)
$ErrorActionPreference = "Continue"
$env:PYTHONIOENCODING = "utf-8"
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$rg = "tdis-rg"; $acr = "tdiswildfireacr2026"
$image = "$acr.azurecr.io/wildfire-ignition:$Tag"
$api = "https://wildfire-ignition-api.agreeablebay-b710af8a.centralus.azurecontainerapps.io"

function AzRun([string]$CliArgs, [int]$Times = 8) {
    for ($i = 1; $i -le $Times; $i++) {
        $out = (cmd /c "`"$az`" $CliArgs 2>&1" | Out-String)
        if ($out -notmatch "SSLError|SSLEOF|Max retries|Certificate verification|UNEXPECTED_EOF") { return $out }
        Start-Sleep 8
    }
    return "NETWORK-FAILURE: $out"
}
function Last([string]$s) { ($s -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 1) }

Write-Output "== image check"
$tags = AzRun "acr repository show-tags -n $acr --repository wildfire-ignition -o tsv"
if ($tags -notmatch "(?m)^$Tag\s*$") { Write-Output "IMAGE $Tag NOT FOUND"; Write-Output "DONE"; exit 1 }
Write-Output "  $Tag present"

Write-Output "== job -> $Tag"
Write-Output ("  " + (Last (AzRun "containerapp job update -g $rg -n wildfire-ignition-job --image $image --query properties.template.containers[0].image -o tsv")))
Write-Output "== api -> $Tag"
$suffix = "v" + ($Tag -replace "\.", "") + "-" + (Get-Date -Format "HHmm")
Write-Output ("  " + (Last (AzRun "containerapp update -g $rg -n wildfire-ignition-api --image $image --revision-suffix $suffix --query properties.latestRevisionName -o tsv")))

Write-Output "== run job"
$exec = (Last (AzRun "containerapp job start -g $rg -n wildfire-ignition-job --query name -o tsv")).Trim()
Write-Output "  execution: $exec"
for ($i = 0; $i -lt 40; $i++) {
    $st = (Last (AzRun "containerapp job execution show -g $rg -n wildfire-ignition-job --job-execution-name $exec --query properties.status -o tsv")).Trim()
    Write-Output "  job: $st"
    if ($st -match "Succeeded|Failed|Stopped|Degraded") { break }
    Start-Sleep 15
}
AzRun "storage blob download --account-name datatexas -c wildfire-data -n predictions/latest.json --auth-mode login --file $env:TEMP\latest_rollout.json --overwrite -o none" | Out-Null
Get-Content "$env:TEMP\latest_rollout.json" -ErrorAction SilentlyContinue

Write-Output "== live API"
$want = $null
try { $want = (Get-Content "$env:TEMP\latest_rollout.json" -Raw | ConvertFrom-Json).generated_at } catch {}
for ($i = 0; $i -lt 16; $i++) {
    try {
        $d = Invoke-RestMethod "$api/api/v1/ignition/coverage?res=5" -TimeoutSec 90
        Write-Output "  RESULT size-5 hexes: $($d.count), source $($d.data_source), updated $($d.generated_at)"
        if ($d.generated_at -eq $want) { break }
    } catch { Write-Output "  (api not ready: $($_.Exception.Message))" }
    Start-Sleep 15
}
Write-Output "DONE"
