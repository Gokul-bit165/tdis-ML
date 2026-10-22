# Deploy the portal email backend (Express, port 8080) as a Container App.
# Reads tdis-portal-backend/.env on this machine and passes the values to Azure; nothing is printed.
# MAIL_PASSWORD is stored as a Container Apps secret, the rest as plain env vars.
#   .\deploy_backend.ps1 -Tag 1.0
param([string]$Tag = "1.0", [string]$EnvFile = "$PSScriptRoot\..\..\tdis-portal-backend\.env")
. "$PSScriptRoot\config.ps1"
if (-not (Test-Path $EnvFile)) { throw "Missing $EnvFile. Create it from the mail settings (MAIL_SERVER, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD, ...)." }

$vars = @{}
Get-Content $EnvFile | Where-Object { $_ -match '^\s*[A-Z_]+\s*=' } | ForEach-Object {
    $k, $v = $_ -split '=', 2
    $vars[$k.Trim()] = $v.Trim().Trim('"').Trim("'")
}
$vars.Remove("PORT"); $vars["NODE_ENV"] = "production"
$secrets = @("MAIL_PASSWORD")
$envArgs = $vars.GetEnumerator() | ForEach-Object {
    if ($secrets -contains $_.Key) { "$($_.Key)=secretref:mail-password" } else { "$($_.Key)=$($_.Value)" }
}

$rid = Az identity show -g $rg -n $identity --query id -o tsv
BuildImage "portal-backend" $Tag "$Root\tdis-portal-backend"

$exists = & $az containerapp show -g $rg -n tdis-portal-backend --query name -o tsv 2>$null
if ($exists) {
    if ($vars["MAIL_PASSWORD"]) { Az containerapp secret set -g $rg -n tdis-portal-backend --secrets "mail-password=$($vars['MAIL_PASSWORD'])" -o none }
    Az containerapp update -g $rg -n tdis-portal-backend --image "$acr.azurecr.io/portal-backend:$Tag" --set-env-vars $envArgs -o none
} else {
    Az containerapp create -g $rg -n tdis-portal-backend --environment $envName `
        --image "$acr.azurecr.io/portal-backend:$Tag" `
        --registry-server "$acr.azurecr.io" --registry-identity $rid --user-assigned $rid `
        --target-port 8080 --ingress external --min-replicas 0 --max-replicas 2 --cpu 0.5 --memory 1Gi `
        --secrets "mail-password=$($vars['MAIL_PASSWORD'])" --env-vars $envArgs -o none
}
$vars.Clear()
$fqdn = Az containerapp show -g $rg -n tdis-portal-backend --query properties.configuration.ingress.fqdn -o tsv
for ($i = 0; $i -lt 12; $i++) {
    try { Invoke-RestMethod "https://$fqdn/health" -TimeoutSec 60 | ConvertTo-Json -Compress; break }
    catch { Write-Output "  not ready ($($_.Exception.Message))"; Start-Sleep 15 }
}
Write-Output "Portal backend: https://$fqdn"
