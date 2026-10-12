# Deploy the V2 ignition model to Azure end to end:
#   build image -> update scoring job -> (re)create API app -> upload features -> run job -> smoke test.
# Requires `az login`. Retries Azure CLI calls that die on transient network drops.
param(
    [string]$Tag = "1.3",
    [string]$TargetDate = "2026-10-06",
    [string]$FeaturesFile = ".\_local\features\2026-10-06.parquet"
)
$ErrorActionPreference = "Continue"
$env:PYTHONIOENCODING = "utf-8"
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$acr = "tdiswildfireacr2026"
Set-Location $PSScriptRoot

function Retry([scriptblock]$Block, [int]$Times = 6) {
    for ($i = 1; $i -le $Times; $i++) {
        $out = (& $Block 2>&1 | Out-String)
        if ($out -notmatch "SSLError|SSLEOF|Max retries exceeded|Connection aborted") { return $out }
        Write-Output "  (network drop, retry $i)"; Start-Sleep 8
    }
    return $out
}

Write-Output "== 1. build image $Tag"
Retry { & $az acr build -r $acr -t "wildfire-ignition:$Tag" --no-logs . --query status -o tsv } | Out-Null
for ($i = 0; $i -lt 60; $i++) {
    # wait for the tag itself: the newest run's status can still be the PREVIOUS build right after submitting
    $tags = Retry { & $az acr repository show-tags -n $acr --repository wildfire-ignition -o tsv }
    $st = (Retry { & $az acr task list-runs -r $acr --top 1 --query "[0].status" -o tsv }).Trim()
    Write-Output "  build: latest run $st, tag present: $($tags -match "(?m)^$Tag\s*$")"
    if ($tags -match "(?m)^$Tag\s*$") { break }
    if ($st -match "Failed|Canceled|Error") { Write-Output "BUILD FAILED"; exit 1 }
    Start-Sleep 15
}

Write-Output "== 2. update scoring job to $Tag"
Retry { & $az containerapp job update -g tdis-rg -n wildfire-ignition-job --image "$acr.azurecr.io/wildfire-ignition:$Tag" --query properties.provisioningState -o tsv } | Select-Object -Last 2

Write-Output "== 3. (re)create API app"
Retry { & $az containerapp delete -g tdis-rg -n wildfire-ignition-api --yes -o none } | Out-Null
$out = Retry { .\deploy_api.ps1 -Tag $Tag }
Write-Output ($out.Trim().Split("`n") | Select-Object -Last 3)

Write-Output "== 4. upload synthetic features for $TargetDate"
Retry { & $az storage blob upload --account-name datatexas -c wildfire-data -n "daily-features/$TargetDate.parquet" -f $FeaturesFile --auth-mode login --overwrite --metadata data_source=synthetic -o none } | Select-Object -Last 2

Write-Output "== 5. run scoring job"
$exec = (Retry { & $az containerapp job start -g tdis-rg -n wildfire-ignition-job --query name -o tsv }).Trim().Split("`n")[-1].Trim()
Write-Output "  execution: $exec"
for ($i = 0; $i -lt 40; $i++) {
    $st = (Retry { & $az containerapp job execution show -g tdis-rg -n wildfire-ignition-job --job-execution-name $exec --query properties.status -o tsv }).Trim().Split("`n")[-1].Trim()
    Write-Output "  job: $st"
    if ($st -match "Succeeded|Failed|Stopped|Degraded") { break }
    Start-Sleep 15
}
Retry { & $az storage blob download --account-name datatexas -c wildfire-data -n predictions/latest.json --auth-mode login --file "$env:TEMP\latest_az.json" --overwrite -o none } | Out-Null
Get-Content "$env:TEMP\latest_az.json" -ErrorAction SilentlyContinue

Write-Output "== 6. smoke test API"
$u = "https://wildfire-ignition-api.agreeablebay-b710af8a.centralus.azurecontainerapps.io"
for ($i = 0; $i -lt 12; $i++) {
    try { $h = Invoke-RestMethod "$u/health" -TimeoutSec 60; Write-Output ($h | ConvertTo-Json -Compress); break }
    catch { Write-Output "  health not ready ($($_.Exception.Message))"; Start-Sleep 15 }
}
try {
    $t = Measure-Command { $d = Invoke-RestMethod "$u/api/v1/ignition/coverage?res=5" -TimeoutSec 120 }
    Write-Output "RESULT coverage: $($d.count) hexes, for $($d.for_date), source $($d.data_source), generated $($d.generated_at) ($([int]$t.TotalSeconds)s)"
    $d.cells | Group-Object risk_level | ForEach-Object { Write-Output "  $($_.Name) $($_.Count)" }
    $r = Invoke-WebRequest "$u/api/v1/ignition/model-info" -Headers @{Origin = "http://localhost:5173"} -UseBasicParsing
    Write-Output ("CORS allow-origin: " + $r.Headers["access-control-allow-origin"])
} catch { Write-Output "RESULT coverage failed: $($_.Exception.Message)" }
Write-Output "DONE"
