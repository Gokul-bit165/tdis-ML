#!/usr/bin/env bash
# Test Databricks serving endpoint directly from your machine (no Function/SWA).
# The endpoint may take 2+ minutes to respond (cold start / model inference).
#
# From repo root, either:
#   export DATABRICKS_API_URL="https://adb-....azuredatabricks.net/serving-endpoints/.../invocations"
#   export DATABRICKS_TOKEN="dapi..."
#   bash scripts/test-databricks-direct.sh
#
# Or use the same values as in scripts/deploy-function-app.sh (top of file).
set -e

DATABRICKS_API_URL="${DATABRICKS_API_URL:-}"
DATABRICKS_TOKEN="${DATABRICKS_TOKEN:-}"

if [[ -z "$DATABRICKS_API_URL" || -z "$DATABRICKS_TOKEN" ]]; then
  echo "Set DATABRICKS_API_URL and DATABRICKS_TOKEN (or copy from scripts/deploy-function-app.sh)"
  echo "Example:"
  echo '  export DATABRICKS_API_URL="https://adb-XXXX.18.azuredatabricks.net/serving-endpoints/YOUR_ENDPOINT/invocations"'
  echo '  export DATABRICKS_TOKEN="dapi..."'
  exit 1
fi

PAYLOAD='{"input":[{"role":"user","content":"Hello, say one word."}]}'
AUTH=$(echo -n "token:$DATABRICKS_TOKEN" | base64 | tr -d '\n')
TIMEOUT=300

echo "Calling Databricks (timeout ${TIMEOUT}s)..."
echo "URL: $DATABRICKS_API_URL"
echo ""

curl -s --max-time "$TIMEOUT" -w "\n\n--- HTTP %{http_code} ---\n" -X POST "$DATABRICKS_API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $AUTH" \
  -d "$PAYLOAD"
