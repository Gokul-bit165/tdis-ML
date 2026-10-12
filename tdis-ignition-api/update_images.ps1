# Build a new image tag and roll it out to the scoring job and the API app in place (no recreate).
#   .\update_images.ps1 -Tag 1.4
param([Parameter(Mandatory = $true)][string]$Tag)
$ErrorActionPreference = "Continue"
$env:PYTHONIOENCODING = "utf-8"
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$acr = "tdiswildfireacr2026"; $rg = "tdis-rg"
Set-Location $PSScriptRoot

function Retry([scriptblock]$Block, [int]$Times = 6) {
    for ($i = 1; $i -le $Times; $i++) {
        $out = (& $Block 2>&1 | Out-String)
        if ($out -notmatch "SSLError|SSLEOF|Max retries exceeded|Connection aborted") { return $out }
        Write-Output "  (network drop, retry $i)"; Start-Sleep 8
    }
    return $out
}

Write-Output "== build $Tag"
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

Write-Output "== job -> $Tag"
Retry { & $az containerapp job update -g $rg -n wildfire-ignition-job --image "$acr.azurecr.io/wildfire-ignition:$Tag" --query properties.provisioningState -o tsv } | Select-Object -Last 1
Write-Output "== api app -> $Tag"
Retry { & $az containerapp update -g $rg -n wildfire-ignition-api --image "$acr.azurecr.io/wildfire-ignition:$Tag" --query properties.provisioningState -o tsv } | Select-Object -Last 1

Write-Output "== smoke test"
$u = "https://wildfire-ignition-api.agreeablebay-b710af8a.centralus.azurecontainerapps.io/api/v1/ignition/coverage"
foreach ($t in @(@(4, ""), @(5, ""), @(6, "&bbox=-99,30,-96,32"), @(7, "&bbox=-98,30,-97,31"), @(8, "&bbox=-98,30,-97.5,30.5"))) {
    for ($k = 0; $k -lt 8; $k++) {
        try {
            $sw = [Diagnostics.Stopwatch]::StartNew()
            $d = Invoke-RestMethod "$u`?res=$($t[0])$($t[1])" -TimeoutSec 90
            Write-Output "RESULT res $($t[0]) $($t[1]): $($d.count) hexes, $([int]$sw.ElapsedMilliseconds) ms"; break
        } catch { Start-Sleep 10 }
    }
}
Write-Output "DONE"
