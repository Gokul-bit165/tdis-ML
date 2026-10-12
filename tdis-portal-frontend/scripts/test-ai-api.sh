#!/usr/bin/env bash
# Test AI Assistant API in order: 1) Databricks direct, 2) Function App, 3) SWA proxy.
#
# Set env vars (or export from your shell):
#   DATABRICKS_API_URL  - e.g. https://adb-xxxx.xx.azuredatabricks.net/serving-endpoints/.../invocations
#   DATABRICKS_TOKEN    - dapi...
#   FUNCTION_APP_URL    - (optional) e.g. https://tdis-dev-portal-databricks-func.azurewebsites.net
#   SWA_BASE_URL       - (optional) e.g. https://portal-stage.dev.cloud.tdis.io
#
# Note: When the Function App is linked to SWA, calling the Function URL directly may return 401.
# Use step 1 to verify Databricks; use step 3 to verify the full chain (SWA -> Function -> Databricks).
# A 500 "Backend call failure" from step 3 usually means Databricks returned an error (run step 1 to confirm).
set -e

PAYLOAD='{"input":[{"role":"user","content":"Hello, say one word."}]}'

echo "=============================================="
echo "Payload: $PAYLOAD"
echo "=============================================="

# --- 1) Databricks direct ---
if [[ -z "$DATABRICKS_API_URL" || -z "$DATABRICKS_TOKEN" ]]; then
  echo "Skip step 1 (Databricks direct): set DATABRICKS_API_URL and DATABRICKS_TOKEN"
else
  echo ""
  echo ">>> Step 1: Databricks direct"
  AUTH=$(echo -n "token:$DATABRICKS_TOKEN" | base64 | tr -d '\n')
  curl -s --max-time 300 -w "\nHTTP_STATUS:%{http_code}" -X POST "$DATABRICKS_API_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Basic $AUTH" \
    -d "$PAYLOAD" | tee /tmp/databricks_resp.txt
  echo ""
  grep -q "HTTP_STATUS:2" /tmp/databricks_resp.txt && echo "Step 1 OK" || echo "Step 1 FAILED (check output above)"
fi

# --- 2) Function App ---
FUNCTION_APP_URL="${FUNCTION_APP_URL:-https://tdis-dev-portal-databricks-func.azurewebsites.net}"
echo ""
echo ">>> Step 2: Function App ($FUNCTION_APP_URL/api/databricks)"
curl -s --max-time 90 -w "\nHTTP_STATUS:%{http_code}" -X POST "$FUNCTION_APP_URL/api/databricks" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" | tee /tmp/func_resp.txt
echo ""
grep -q "HTTP_STATUS:2" /tmp/func_resp.txt && echo "Step 2 OK" || echo "Step 2 FAILED (check output above)"

# --- 3) SWA proxy (same payload) ---
SWA_BASE_URL="${SWA_BASE_URL:-https://portal-stage.dev.cloud.tdis.io}"
echo ""
echo ">>> Step 3: SWA proxy ($SWA_BASE_URL/api/databricks)"
curl -s --max-time 90 -w "\nHTTP_STATUS:%{http_code}" -X POST "$SWA_BASE_URL/api/databricks" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" | tee /tmp/swa_resp.txt
echo ""
grep -q "HTTP_STATUS:2" /tmp/swa_resp.txt && echo "Step 3 OK" || echo "Step 3 FAILED (check output above)"

echo ""
echo "Done. Fix the first failing step before relying on the next."
