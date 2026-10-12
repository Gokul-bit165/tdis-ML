# Create/update the ignition API Container App (reads predictions from Azure Blob).
# Requires: az login, image already pushed to the registry, id-wildfire-job identity with roles.
param([string]$Tag = "1.2")

$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$rg = "tdis-rg"
$acr = "tdiswildfireacr2026"
$identity = "id-wildfire-job"
$cors = "http://localhost:5173,http://127.0.0.1:5173,https://delightful-sky-065ac4610.6.azurestaticapps.net"

$rid = & $az identity show -g $rg -n $identity --query id -o tsv
$cid = & $az identity show -g $rg -n $identity --query clientId -o tsv

& $az containerapp create -g $rg -n wildfire-ignition-api `
    --environment managedEnvironment-tdisrg-b1be `
    --image "$acr.azurecr.io/wildfire-ignition:$Tag" `
    --registry-server "$acr.azurecr.io" --registry-identity $rid --user-assigned $rid `
    --target-port 8000 --ingress external --min-replicas 0 --max-replicas 2 --cpu 1 --memory 2Gi `
    --env-vars "RUN_MODE=api" "PREDICTIONS_URI=az://datatexas/wildfire-data/predictions" "AZURE_CLIENT_ID=$cid" "MODEL_DIR=/app/model" "BIT_DIR=/nonexistent" "CORS_ORIGINS=$cors" `
    --query "properties.configuration.ingress.fqdn" -o tsv


