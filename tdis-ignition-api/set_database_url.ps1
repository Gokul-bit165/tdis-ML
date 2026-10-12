# Store the Postgres connection as an Azure secret on the scoring job and the API. Run this yourself:
# the password is typed here and goes straight to Azure; it is never written to a file or printed.
#   .\set_database_url.ps1 -DbHost pg-xxxx.postgres.database.azure.com -Database tdis_portal_db -DbUser myuser
param(
    [Parameter(Mandatory = $true)][string]$DbHost,
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$DbUser,
    [int]$Port = 5432
)
$ErrorActionPreference = "Stop"
$env:PYTHONIOENCODING = "utf-8"
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$rg = "tdis-rg"

$secure = Read-Host -AsSecureString "Password for $DbUser@$DbHost"
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$url = "postgresql://" + [Uri]::EscapeDataString($DbUser) + ":" + [Uri]::EscapeDataString($plain) + "@${DbHost}:$Port/$Database?sslmode=require"

& $az containerapp job secret set -g $rg -n wildfire-ignition-job --secrets "database-url=$url" -o none
& $az containerapp secret set -g $rg -n wildfire-ignition-api --secrets "database-url=$url" -o none
$url = $null; $plain = $null
Write-Output "Secret 'database-url' set on wildfire-ignition-job and wildfire-ignition-api."
