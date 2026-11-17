# One-time setup for Drainage Monitoring (files only): a public-read container in datatexas that the portal reads
# directly, plus a CORS rule so the browser may fetch from it. No database, server or job; cost is a few cents a month.
#   az login
#   .\setup_drainage_storage.ps1                     # container + CORS
#   .\setup_drainage_storage.ps1 -Upload <folder>    # also upload a folder made by tdis-drainage/prepare_drainage.py
# Normally new surveys are uploaded in the Azure portal instead (see docs/DRAINAGE_MONITORING.md).
param(
    [string]$Container = "drainage-data",
    [string]$Folder = "current",
    [string]$Upload,
    [string]$Origins = "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,https://wonderful-moss-0963acc10.2.azurestaticapps.net,https://delightful-sky-065ac4610.6.azurestaticapps.net"
)
. "$PSScriptRoot\config.ps1"

Write-Output "== 1. container $storageAccount/$Container (anonymous read of files; listing stays private)"
$allow = Az storage account show -g $rg -n $storageAccount --query allowBlobPublicAccess -o tsv
if ($allow -ne "true") { throw "$storageAccount does not allow public blob access; enable it or use another account." }
Az storage container create --account-name $storageAccount -n $Container --public-access blob --auth-mode login -o none
# Also covers a container that already existed as private (management API: no account key needed).
Az storage container-rm update -g $rg --storage-account $storageAccount -n $Container --public-access blob -o none

Write-Output "== 2. CORS (GET from the portal origins)"
$have = (Az storage account blob-service-properties show -g $rg -n $storageAccount --query "cors.corsRules[].allowedOrigins[]" -o tsv) -split "\s+"
$missing = @($Origins -split "," | Where-Object { $_ -and ($have -notcontains $_) })
if ($missing.Count -gt 0) {
    Az storage account blob-service-properties cors-rule add -g $rg -n $storageAccount `
        --allowed-origins @missing --allowed-methods GET HEAD OPTIONS --allowed-headers "*" `
        --exposed-headers "*" --max-age 3600 -o none
    Write-Output "  added: $($missing -join ', ')"
} else { Write-Output "  already allowed" }

if ($Upload) {
    Write-Output "== 3. upload $Upload -> $Container/$Folder (manifest.json last, so the portal never sees half an upload)"
    $common = @("--account-name", $storageAccount, "--auth-mode", "login", "-o", "none")
    Az storage blob upload-batch @common -d $Container --destination-path $Folder -s $Upload --overwrite true `
        --pattern "*.geojson" --content-type "application/geo+json"
    Az storage blob upload @common -c $Container -n "$Folder/manifest.json" -f (Join-Path $Upload "manifest.json") `
        --overwrite true --content-type "application/json" --content-cache-control "no-cache"
}

Write-Output ""
Write-Output "Portal build setting: VITE_DRAINAGE_DATA_URL=https://$storageAccount.blob.core.windows.net/$Container/$Folder"
Write-Output "Check:                node tdis-drainage\verify_drainage.mjs https://$storageAccount.blob.core.windows.net/$Container/$Folder"
