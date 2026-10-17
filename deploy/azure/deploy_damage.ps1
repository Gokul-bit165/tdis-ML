# Deploy the Damage Assessment backend: blob container, PostGIS migration 043, API app and loader job.
# Reuses the existing wildfire Postgres server (damage_* tables sit beside the ignition ones).
#   az login
#   .\deploy_damage.ps1 -DbHost pg-xxxx.postgres.database.azure.com -Database tdis_portal_db -DbUser myuser -Tag 1.0
param(
    [Parameter(Mandatory = $true)][string]$DbHost,
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$DbUser,
    [string]$Tag = "1.0",
    [string]$DbResourceGroup = "tdis-rg",
    [string]$Cron = "*/5 * * * *",
    [string]$Cors = "http://localhost:5173,https://delightful-sky-065ac4610.6.azurestaticapps.net"
)
. "$PSScriptRoot\config.ps1"
$dbServer = $DbHost.Split(".")[0]
$rid = Az identity show -g $rg -n $identity --query id -o tsv
$cid = Az identity show -g $rg -n $identity --query clientId -o tsv

Write-Output "== 1. allow PostGIS + btree_gist on $dbServer (migration 043 runs CREATE EXTENSION)"
$ext = Az postgres flexible-server parameter show -g $DbResourceGroup --server-name $dbServer --name azure.extensions --query value -o tsv
$have = @($ext -split "," | Where-Object { $_ })
$want = @($have + "POSTGIS" + "BTREE_GIST" | Sort-Object -Unique)
if ($want.Count -ne $have.Count) {
    Az postgres flexible-server parameter set -g $DbResourceGroup --server-name $dbServer --name azure.extensions --value ($want -join ",") -o none
    Write-Output "  azure.extensions now: $($want -join ',')"
} else { Write-Output "  already allowed" }

Write-Output "== 2. blob container $damageContainer in $storageAccount (+ identity access)"
Az storage container create --account-name $storageAccount -n $damageContainer --auth-mode login -o none
$scope = Az storage account show -g $rg -n $storageAccount --query id -o tsv
$principal = Az identity show -g $rg -n $identity --query principalId -o tsv
Az role assignment create --assignee-object-id $principal --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" --scope $scope -o none

Write-Output "== 3. build images"
# The loader image copies sql/043 from the DB project; stage a build context that has it.
$stage = Join-Path $env:TEMP "damage-loader-ctx"
if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
Copy-Item "$Root\tdis-damage-loader" $stage -Recurse -Exclude "__pycache__", "_local", "tests", ".venv"
New-Item -ItemType Directory "$stage\sql" | Out-Null
Copy-Item "$Root\tdis-damage-db\migrations\043_create_damage_assessment_tables.sql" "$stage\sql\"
BuildImage "damage-loader" $Tag $stage
BuildImage "damage-api" $Tag "$Root\tdis-damage-api"

Write-Output "== 4. database URL"
$url = Read-DatabaseUrl $DbHost $Database $DbUser

Write-Output "== 5. loader job ($Cron)"
$jobExists = & $az containerapp job show -g $rg -n damage-loader-job --query name -o tsv 2>$null
if ($jobExists) { Az containerapp job delete -g $rg -n damage-loader-job --yes -o none }
Az containerapp job create -g $rg -n damage-loader-job --environment $envName `
    --trigger-type Schedule --cron-expression $Cron `
    --replica-timeout 1800 --replica-retry-limit 1 --replica-completion-count 1 --parallelism 1 `
    --image "$acr.azurecr.io/damage-loader:$Tag" `
    --registry-server "$acr.azurecr.io" --registry-identity $rid --mi-user-assigned $rid `
    --cpu 2 --memory 4Gi `
    --secrets "database-url=$url" `
    --env-vars "DATABASE_URL=secretref:database-url" "DAMAGE_URI=az://$storageAccount/$damageContainer" "AZURE_CLIENT_ID=$cid" `
    --query properties.provisioningState -o tsv

Write-Output "== 6. apply migration 043 (one-off run of the loader image)"
Az containerapp job start -g $rg -n damage-loader-job --image "$acr.azurecr.io/damage-loader:$Tag" `
    --command python --args "damage_job.py" "migrate" --query name -o tsv
Write-Output "  check it: az containerapp job execution list -g $rg -n damage-loader-job -o table"

Write-Output "== 7. damage API"
$appExists = & $az containerapp show -g $rg -n tdis-damage-api --query name -o tsv 2>$null
if ($appExists) {
    Az containerapp secret set -g $rg -n tdis-damage-api --secrets "database-url=$url" -o none
    Az containerapp update -g $rg -n tdis-damage-api --image "$acr.azurecr.io/damage-api:$Tag" --set-env-vars "CORS_ORIGINS=$Cors" -o none
} else {
    # min-replicas 1: map tiles are requested in bursts and a cold start would blank the map
    Az containerapp create -g $rg -n tdis-damage-api --environment $envName `
        --image "$acr.azurecr.io/damage-api:$Tag" `
        --registry-server "$acr.azurecr.io" --registry-identity $rid --user-assigned $rid `
        --target-port 8000 --ingress external --min-replicas 1 --max-replicas 3 --cpu 1 --memory 2Gi `
        --secrets "database-url=$url" `
        --env-vars "DATABASE_URL=secretref:database-url" "CORS_ORIGINS=$Cors" `
        --query properties.provisioningState -o tsv
}
$url = $null
$fqdn = Az containerapp show -g $rg -n tdis-damage-api --query properties.configuration.ingress.fqdn -o tsv

Write-Output "== 8. smoke test"
for ($i = 0; $i -lt 12; $i++) {
    try { Write-Output (Invoke-RestMethod "https://$fqdn/health" -TimeoutSec 60 | ConvertTo-Json -Compress); break }
    catch { Write-Output "  not ready ($($_.Exception.Message))"; Start-Sleep 15 }
}
Write-Output "Damage API: https://$fqdn"
Write-Output "Next: upload footprints/ and assessments/<run>/ (manifest last) to az://$storageAccount/$damageContainer"
