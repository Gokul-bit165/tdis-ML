# Build the portal frontend pointed at the deployed APIs and publish it to the Static Web App,
# then add the site's address to the CORS list of the damage and ignition APIs.
# Vite lets shell variables override .env, so the local .env is left untouched.
#   .\deploy_frontend.ps1
. "$PSScriptRoot\config.ps1"

function Fqdn([string]$App) { "https://" + (Az containerapp show -g $rg -n $App --query properties.configuration.ingress.fqdn -o tsv) }

$env:VITE_DAMAGE_API_URL = Fqdn "tdis-damage-api"
$env:VITE_IGNITION_API_URL = Fqdn "wildfire-ignition-api"
$env:VITE_EMAIL_API_URL = Fqdn "tdis-portal-backend"   # check the path the frontend appends; see the note in the deploy guide
$env:VITE_ENABLE_DAMAGE_ASSESSMENT = "true"
Write-Output "damage:   $env:VITE_DAMAGE_API_URL"
Write-Output "ignition: $env:VITE_IGNITION_API_URL"
Write-Output "email:    $env:VITE_EMAIL_API_URL"

# The existing script builds, creates the Static Web App if needed, deploys, and updates ignition CORS.
& "$Root\tdis-ignition-api\deploy_frontend.ps1" -AppName $swaName -Frontend "$Root\tdis-portal-frontend"

$swaHost = Az staticwebapp show -g $rg -n $swaName --query defaultHostname -o tsv
$origins = "http://localhost:5173,https://delightful-sky-065ac4610.6.azurestaticapps.net,https://$swaHost"
Az containerapp update -g $rg -n tdis-damage-api --set-env-vars "CORS_ORIGINS=$origins" -o none
Write-Output "Site: https://$swaHost/  (Damage tab is on because VITE_ENABLE_DAMAGE_ASSESSMENT=true)"
