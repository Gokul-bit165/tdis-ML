# (Re)create the daily scoring job. Default schedule: 01:00 UTC every day (06:30 IST).
# Container Apps can't change a job's trigger type in place, so this deletes and recreates it.
param(
    [string]$Tag = "1.3",
    [string]$Cron = "0 1 * * *"
)
$ErrorActionPreference = "Continue"
$env:PYTHONIOENCODING = "utf-8"
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$rg = "tdis-rg"; $acr = "tdiswildfireacr2026"; $identity = "id-wildfire-job"

function Retry([scriptblock]$Block, [int]$Times = 6) {
    for ($i = 1; $i -le $Times; $i++) {
        $out = (& $Block 2>&1 | Out-String)
        if ($out -notmatch "SSLError|SSLEOF|Max retries exceeded|Connection aborted") { return $out }
        Write-Output "  (network drop, retry $i)"; Start-Sleep 8
    }
    return $out
}

$rid = (Retry { & $az identity show -g $rg -n $identity --query id -o tsv }).Trim()
$cid = (Retry { & $az identity show -g $rg -n $identity --query clientId -o tsv }).Trim()

Retry { & $az containerapp job delete -g $rg -n wildfire-ignition-job --yes -o none } | Out-Null
Retry {
    & $az containerapp job create -g $rg -n wildfire-ignition-job `
        --environment managedEnvironment-tdisrg-b1be `
        --trigger-type Schedule --cron-expression $Cron `
        --replica-timeout 1800 --replica-retry-limit 1 --replica-completion-count 1 --parallelism 1 `
        --image "$acr.azurecr.io/wildfire-ignition:$Tag" `
        --registry-server "$acr.azurecr.io" --registry-identity $rid --mi-user-assigned $rid `
        --cpu 2 --memory 4Gi `
        --env-vars "FEATURES_URI=az://datatexas/wildfire-data/daily-features" "PREDICTIONS_URI=az://datatexas/wildfire-data/predictions" "AZURE_CLIENT_ID=$cid" `
        --query "{name:name,trigger:properties.configuration.triggerType,cron:properties.configuration.scheduleTriggerConfig.cronExpression,state:properties.provisioningState}" -o json
} | Select-Object -Last 8
