# Shared settings for the deploy scripts in this folder. Dot-source it: . "$PSScriptRoot\config.ps1"
# Reuses the resources the ignition service already created in Azure (see docs/ARCHITECTURE.md).
$ErrorActionPreference = "Stop"
$env:PYTHONIOENCODING = "utf-8"

$Root = (Resolve-Path "$PSScriptRoot\..\..").Path
$rg = "tdis-rg"
$acr = "tdiswildfireacr2026"
$identity = "id-wildfire-job"                    # user-assigned identity: pulls from ACR, reads blob storage
$envName = "managedEnvironment-tdisrg-b1be"      # Container Apps environment
$storageAccount = "datatexas"
$damageContainer = "damage-data"                 # footprints/ and assessments/ live here
$swaName = "tdis-wildfire-map"

$az = (Get-Command az -ErrorAction SilentlyContinue).Source
if (-not $az) { $az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" }
if (-not (Test-Path $az)) { throw "Azure CLI not found. Install it (winget install Microsoft.AzureCLI), then run 'az login'." }

# Run az and fail loudly on a non-zero exit; returns trimmed stdout.
function Az {
    $out = & $az @args
    if ($LASTEXITCODE -ne 0) { throw "az $($args -join ' ') failed (exit $LASTEXITCODE)" }
    ($out | Out-String).Trim()
}

# Build an image in ACR from a folder (or a staged copy of one).
function BuildImage([string]$Name, [string]$Tag, [string]$Context) {
    Write-Output "  building ${Name}:$Tag"
    # Stream no logs: the CLI crashes printing Unicode build output on a cp1252 console. Poll the run instead.
    $runId = Az acr build -r $acr -t "${Name}:$Tag" $Context --no-logs --query runId -o tsv
    while ($true) {
        $status = Az acr task show-run -r $acr --run-id $runId --query status -o tsv
        if ($status -eq "Succeeded") { break }
        if ($status -in "Failed", "Canceled", "Error", "Timeout") {
            throw "ACR build $runId of ${Name}:$Tag ended $status (az acr task logs -r $acr --run-id $runId)"
        }
        Start-Sleep 10
    }
}

# Prompt for the Postgres password and return a connection URL. The password is never written to disk.
function Read-DatabaseUrl([string]$DbHost, [string]$Database, [string]$DbUser, [int]$Port = 5432) {
    $secure = Read-Host -AsSecureString "Password for $DbUser@$DbHost"
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
    "postgresql://" + [Uri]::EscapeDataString($DbUser) + ":" + [Uri]::EscapeDataString($plain) + "@${DbHost}:$Port/$Database?sslmode=require"
}
