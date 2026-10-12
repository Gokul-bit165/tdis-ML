# Build image 1.2 in ACR, replace the failed API app, and smoke-test it. Retries on network drops.
$ErrorActionPreference = "Continue"
$env:PYTHONIOENCODING = "utf-8"
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
Set-Location $PSScriptRoot

function Retry([scriptblock]$Block, [int]$Times = 5) {
    for ($i = 1; $i -le $Times; $i++) {
        $out = (& $Block 2>&1 | Out-String)
        if ($out -notmatch "SSLError|SSLEOF|Max retries exceeded") { return $out }
        Write-Output "  (network drop, retry $i)"; Start-Sleep 8
    }
    return $out
}

Write-Output "== build 1.2"
Retry { & $az acr build -r tdiswildfireacr2026 -t wildfire-ignition:1.2 --no-logs . --query status -o tsv } | Out-Null
for ($i = 0; $i -lt 40; $i++) {
    $st = (Retry { & $az acr task list-runs -r tdiswildfireacr2026 --top 1 --query "[0].status" -o tsv }).Trim()
    Write-Output "  build: $st"
    if ($st -match "Succeeded") { break }
    if ($st -match "Failed|Canceled|Error") { Write-Output "BUILD FAILED"; exit 1 }
    Start-Sleep 15
}

Write-Output "== replace failed app"
Retry { & $az containerapp delete -g tdis-rg -n wildfire-ignition-api --yes -o none } | Out-Null
$out = Retry { .\deploy_api.ps1 }
Write-Output ($out.Trim().Split("`n") | Select-Object -Last 3)

Write-Output "== smoke test"
$u = "https://wildfire-ignition-api.agreeablebay-b710af8a.centralus.azurecontainerapps.io"
for ($i = 0; $i -lt 12; $i++) {
    try { $h = Invoke-RestMethod "$u/health" -TimeoutSec 60; Write-Output ($h | ConvertTo-Json -Compress); break }
    catch { Write-Output "  health not ready ($($_.Exception.Message))"; Start-Sleep 15 }
}
try {
    $t = Measure-Command { $d = Invoke-RestMethod "$u/api/v1/ignition/coverage?res=5" -TimeoutSec 120 }
    Write-Output "coverage: $($d.count) hexes, for $($d.for_date), source $($d.data_source), generated $($d.generated_at) ($([int]$t.TotalSeconds)s)"
    $d.cells | Group-Object risk_level | ForEach-Object { Write-Output "  $($_.Name) $($_.Count)" }
    $r = Invoke-WebRequest "$u/api/v1/ignition/model-info" -Headers @{Origin = "http://localhost:5173"} -UseBasicParsing
    Write-Output ("CORS allow-origin: " + $r.Headers["access-control-allow-origin"])
} catch { Write-Output "coverage failed: $($_.Exception.Message)" }
