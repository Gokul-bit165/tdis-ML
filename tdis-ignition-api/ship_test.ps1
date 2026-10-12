# Build + roll out a tag, then prove the Azure-only flow: raw CSV uploaded straight to daily-features/,
# validated and scored by the job in Azure, served by the API.
param([string]$Tag = "1.6", [string]$Csv = ".\_local\test_upload.csv", [string]$BlobName = "test_upload_2026-10-07.csv")
$ErrorActionPreference = "Continue"
$env:PYTHONIOENCODING = "utf-8"
Set-Location $PSScriptRoot
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
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

Write-Output "== build $Tag"
for ($k = 1; $k -le 3; $k++) {
    AzRun "acr build -r tdiswildfireacr2026 -t wildfire-ignition:$Tag --no-logs . --query status -o tsv" | Out-Null
    $tags = AzRun "acr repository show-tags -n tdiswildfireacr2026 --repository wildfire-ignition -o tsv"
    if ($tags -match "(?m)^$Tag\s*$") { Write-Output "  $Tag built"; break }
    Write-Output "  tag not present after attempt $k"
}
if ($tags -notmatch "(?m)^$Tag\s*$") { Write-Output "BUILD FAILED"; Write-Output "DONE"; exit 1 }

Write-Output "== roll out"
& "$PSScriptRoot\rollout.ps1" -Tag $Tag | Where-Object { $_ -match "^==|job:|RESULT|FOUND|execution" }

Write-Output "== upload raw CSV straight to Azure: $BlobName"
Write-Output (Last (AzRun "storage blob upload --account-name datatexas -c wildfire-data -n daily-features/$BlobName -f $Csv --auth-mode login --overwrite -o none"))

Write-Output "== run job on that upload"
$exec = (Last (AzRun "containerapp job start -g tdis-rg -n wildfire-ignition-job --query name -o tsv")).Trim()
Write-Output "  execution: $exec"
for ($i = 0; $i -lt 40; $i++) {
    $st = (Last (AzRun "containerapp job execution show -g tdis-rg -n wildfire-ignition-job --job-execution-name $exec --query properties.status -o tsv")).Trim()
    Write-Output "  job: $st"
    if ($st -match "Succeeded|Failed|Stopped|Degraded") { break }
    Start-Sleep 15
}
foreach ($f in "latest.json", "status.json") {
    AzRun "storage blob download --account-name datatexas -c wildfire-data -n predictions/$f --auth-mode login --file $env:TEMP\ship_$f --overwrite -o none" | Out-Null
    Write-Output "-- $f"; Get-Content "$env:TEMP\ship_$f" -ErrorAction SilentlyContinue
}

Write-Output "== live API"
$want = $null
try { $want = (Get-Content "$env:TEMP\ship_latest.json" -Raw | ConvertFrom-Json).generated_at } catch {}
for ($i = 0; $i -lt 16; $i++) {
    try {
        $d = Invoke-RestMethod "$api/api/v1/ignition/coverage?res=5" -TimeoutSec 90
        Write-Output "  RESULT hexes: $($d.count), for_date $($d.for_date), uploaded $($d.uploaded_at), source $($d.data_source)"
        if ($d.generated_at -eq $want) { Write-Output ("  sample hexagon metadata: " + ($d.cells[0] | ConvertTo-Json -Compress)); break }
    } catch { Write-Output "  (api not ready: $($_.Exception.Message))" }
    Start-Sleep 15
}
Write-Output "DONE"
