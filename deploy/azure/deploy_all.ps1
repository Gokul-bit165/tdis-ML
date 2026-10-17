# Deploy everything that is not already live, in dependency order. Run each step on its own if you prefer.
#   az login
#   .\deploy_all.ps1 -DbHost pg-xxxx.postgres.database.azure.com -Database tdis_portal_db -DbUser myuser
param(
    [Parameter(Mandatory = $true)][string]$DbHost,
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$DbUser,
    [string]$Tag = "1.0"
)
$ErrorActionPreference = "Stop"
& "$PSScriptRoot\deploy_damage.ps1" -DbHost $DbHost -Database $Database -DbUser $DbUser -Tag $Tag
& "$PSScriptRoot\deploy_backend.ps1" -Tag $Tag
& "$PSScriptRoot\deploy_frontend.ps1"
# The ignition API and job are already deployed: use tdis-ignition-api\rollout.ps1 only when that code changes.
