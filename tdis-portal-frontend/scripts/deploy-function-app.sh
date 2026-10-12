#!/usr/bin/env bash
# Deploy the api/ folder as a standalone Azure Function App, then optionally link to Static Web App.
# Prerequisites: az login, Azure CLI.
#
# --- SET THESE (or export as env) ---
SUBSCRIPTION="${SUBSCRIPTION:-tamug-idrt-tdis-dev-001}"
RESOURCE_GROUP="${RESOURCE_GROUP:-tdis-dev-portal-rg}"
LOCATION="${LOCATION:-}"                       # leave empty to use resource group location
FUNCTION_APP_NAME="${FUNCTION_APP_NAME:-tdis-dev-portal-databricks-func}"
STORAGE_ACCOUNT_NAME="${STORAGE_ACCOUNT_NAME:-tdisdevportalfunc}"  # lowercase alphanumeric, 3-24 chars
DATABRICKS_API_URL="${DATABRICKS_API_URL:-https://adb-3300405005568038.18.azuredatabricks.net/serving-endpoints/agents_tdis_dev_data_catalog-tdir-tdis-ai-backend-dev/invocations}"
DATABRICKS_TOKEN="${DATABRICKS_TOKEN:-dapi6b6b01d73721f087cb6eb23901c319f0}"
SWA_NAME="${SWA_NAME:-tdis-dev-portal-new-client-swa}"
# Set SKIP_SWA_LINK=1 when using VITE_AI_FUNCTION_URL (UI calls Function directly; avoids SWA 45s timeout)
SKIP_SWA_LINK="${SKIP_SWA_LINK:-0}"
# --- END ---

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$REPO_ROOT/api"

# Use subscription
if [[ -n "$SUBSCRIPTION" ]]; then
  az account set --subscription "$SUBSCRIPTION" 2>/dev/null || true
fi

# Use resource group location if LOCATION not set
if [[ -z "$LOCATION" ]] && [[ -n "$RESOURCE_GROUP" ]]; then
  LOCATION=$(az group show --name "$RESOURCE_GROUP" --query location -o tsv 2>/dev/null) || LOCATION="eastus"
fi

echo "Checking required variables..."
MISSING=""
for var in RESOURCE_GROUP LOCATION FUNCTION_APP_NAME STORAGE_ACCOUNT_NAME DATABRICKS_API_URL DATABRICKS_TOKEN; do
  if [[ -z "${!var}" ]]; then
    MISSING="${MISSING} ${var}"
  fi
done
if [[ -n "$MISSING" ]]; then
  echo "Missing required variables:${MISSING}"
  echo "Set them in this script (top) or export before running, e.g.:"
  echo "  export RESOURCE_GROUP=myRg"
  echo "  export LOCATION=eastus"
  echo "  export FUNCTION_APP_NAME=my-unique-func-name"
  echo "  export STORAGE_ACCOUNT_NAME=myfuncstore"
  echo "  export DATABRICKS_API_URL=https://..../invocations"
  echo "  export DATABRICKS_TOKEN=dapi..."
  exit 1
fi

echo "Using:"
echo "  RESOURCE_GROUP=$RESOURCE_GROUP"
echo "  LOCATION=$LOCATION"
echo "  FUNCTION_APP_NAME=$FUNCTION_APP_NAME"
echo "  STORAGE_ACCOUNT_NAME=$STORAGE_ACCOUNT_NAME"
echo "  SWA_NAME=${SWA_NAME:-<not set, skip link>}"

# Install API dependencies and create zip
echo "Installing API dependencies..."
cd "$API_DIR"
npm install --production
cd "$REPO_ROOT"
ZIP_FILE="$REPO_ROOT/api-deploy.zip"
echo "Creating $ZIP_FILE from api/..."
rm -f "$ZIP_FILE"
(cd "$API_DIR" && zip -r "$ZIP_FILE" . -x "*.git*" -x "local.settings.json" -x "test/*" -x "*.md")

# Create resource group if not exists
az group show --name "$RESOURCE_GROUP" 2>/dev/null || az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

# Create storage account if not exists (required for Function App)
az storage account show --name "$STORAGE_ACCOUNT_NAME" --resource-group "$RESOURCE_GROUP" 2>/dev/null || \
  az storage account create --name "$STORAGE_ACCOUNT_NAME" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --sku Standard_LRS

# Create Function App (Node 18, Linux, Consumption)
az functionapp show --name "$FUNCTION_APP_NAME" --resource-group "$RESOURCE_GROUP" 2>/dev/null || \
  az functionapp create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$FUNCTION_APP_NAME" \
    --storage-account "$STORAGE_ACCOUNT_NAME" \
    --consumption-plan-location "$LOCATION" \
    --runtime node \
    --runtime-version 20 \
    --functions-version 4 \
    --os-type Linux

# App settings for Databricks
az functionapp config appsettings set \
  --name "$FUNCTION_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --settings "DATABRICKS_API_URL=$DATABRICKS_API_URL" "DATABRICKS_TOKEN=$DATABRICKS_TOKEN" \
  --output none

# Deploy zip
echo "Deploying zip to Function App..."
az functionapp deployment source config-zip \
  --resource-group "$RESOURCE_GROUP" \
  --name "$FUNCTION_APP_NAME" \
  --src "$ZIP_FILE"

rm -f "$ZIP_FILE"
echo "Function App URL: https://${FUNCTION_APP_NAME}.azurewebsites.net"
echo "Test endpoint:    https://${FUNCTION_APP_NAME}.azurewebsites.net/api/databricks (POST)"

# Optional: link to Static Web App (requires SWA Standard plan). Skip if using VITE_AI_FUNCTION_URL (direct call).
if [[ "$SKIP_SWA_LINK" == "1" ]]; then
  echo "Skipping SWA link (SKIP_SWA_LINK=1). Set portal_ai_function_url in variable group and VITE_AI_FUNCTION_URL in pipeline so UI calls Function directly."
  echo "If Function was previously linked, unlink: az staticwebapp functions unlink --name $SWA_NAME --resource-group $RESOURCE_GROUP"
elif [[ -n "$SWA_NAME" ]]; then
  echo "Linking Function App to Static Web App: $SWA_NAME"
  FUNC_ID=$(az functionapp show --name "$FUNCTION_APP_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)
  az staticwebapp functions link \
    --name "$SWA_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --function-resource-id "$FUNC_ID"
  echo "Linked. SWA /api/* will now proxy to this Function App."
else
  echo "To link to SWA later, run:"
  echo "  az staticwebapp functions link --name <SWA_NAME> --resource-group $RESOURCE_GROUP --function-resource-id \$(az functionapp show -n $FUNCTION_APP_NAME -g $RESOURCE_GROUP --query id -o tsv)"
fi

echo "Done."
