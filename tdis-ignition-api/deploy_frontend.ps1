# Build the portal frontend and publish it to its own Azure Static Web App (not the GitHub-linked one),
# then allow its address in the ignition API's CORS list.
#   .\deploy_frontend.ps1              # build + create (if needed) + deploy + CORS
param(
    [string]$AppName = "tdis-wildfire-map",
    [string]$Frontend = "$PSScriptRoot\..\tdis-portal-frontend"
)
$ErrorActionPreference = "Continue"
$env:PYTHONIOENCODING = "utf-8"
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$env:PATH = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin;$env:PATH"
$rg = "tdis-rg"; $sub = "6d5c4b1e-a3e6-45c1-a781-674f7765a808"

function Retry([scriptblock]$Block, [int]$Times = 6) {
    for ($i = 1; $i -le $Times; $i++) {
        $out = (& $Block 2>&1 | Out-String)
        if ($out -notmatch "SSLError|SSLEOF|Max retries exceeded|Connection aborted") { return $out }
        Write-Output "  (network drop, retry $i)"; Start-Sleep 8
    }
    return $out
}

Write-Output "== 1. build frontend (reads its .env: VITE_IGNITION_API_URL etc.)"
Push-Location $Frontend; npm run build 2>&1 | Select-Object -Last 3; Pop-Location

# Publish from a scratch copy: the SWA CLI writes files into the current directory, and the
# frontend folder's .env must stay untouched.
$stage = Join-Path $env:TEMP "swa-stage-$AppName"
if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item "$Frontend\dist" "$stage\dist" -Recurse
Set-Content "$stage\dist\staticwebapp.config.json" -Encoding ascii -Value '{"navigationFallback":{"rewrite":"/index.html","exclude":["/assets/*","/*.png","/*.svg","/*.webp","/*.mp4","/*.ico","/*.geojson","/*.js"]}}'

Write-Output "== 2. create Static Web App $AppName (no GitHub link)"
$exists = Retry { & $az staticwebapp show -g $rg -n $AppName --query defaultHostname -o tsv }
if ($exists -match "ResourceNotFound|not found|could not be found") {
    Retry { & $az staticwebapp create -g $rg -n $AppName -l centralus --sku Free --query defaultHostname -o tsv } | Out-Null
}
$host_ = (Retry { & $az staticwebapp show -g $rg -n $AppName --query defaultHostname -o tsv }).Trim().Split("`n")[-1].Trim()
Write-Output "  host: $host_"

Write-Output "== 3. deploy"
Push-Location $stage
npx --yes @azure/static-web-apps-cli deploy ./dist --app-name $AppName --resource-group $rg --subscription-id $sub --env production 2>&1 | Select-Object -Last 8
Pop-Location

Write-Output "== 4. allow the new origin in the API's CORS list"
$cors = "http://localhost:5173,http://127.0.0.1:5173,https://delightful-sky-065ac4610.6.azurestaticapps.net,https://$host_"
Retry { & $az containerapp update -g $rg -n wildfire-ignition-api --set-env-vars "CORS_ORIGINS=$cors" --query properties.provisioningState -o tsv } | Select-Object -Last 2

Write-Output "== 5. check"
try { $r = Invoke-WebRequest "https://$host_" -UseBasicParsing -TimeoutSec 60; Write-Output "site: $($r.StatusCode), $($r.Content.Length) bytes" } catch { Write-Output "site check failed: $($_.Exception.Message)" }
try {
    $r = Invoke-WebRequest "https://wildfire-ignition-api.agreeablebay-b710af8a.centralus.azurecontainerapps.io/api/v1/ignition/model-info" -Headers @{Origin = "https://$host_"} -UseBasicParsing -TimeoutSec 90
    Write-Output ("API CORS for new site: " + $r.Headers["access-control-allow-origin"])
} catch { Write-Output "CORS check failed: $($_.Exception.Message)" }
Write-Output "URL: https://$host_/?tab=wildfire-ignition"
Write-Output "DONE"
