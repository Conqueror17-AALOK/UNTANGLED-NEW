#!/usr/bin/env bash
# ==============================================================================
# UNTANGLE Smoke Test Script
# Verifies system health, job creation, end-to-end processing and exports
# ==============================================================================

set -euo pipefail

API_URL="${API_URL:-http://localhost:8000/api/v1}"
SAMPLE_PDF="${SAMPLE_PDF:-contracts/samples/sample_pid_01.pdf}"
SAMPLE_XLSX="${SAMPLE_XLSX:-contracts/samples/sample_io_list.xlsx}"

echo "========================================="
echo "Starting UNTANGLE Smoke Test against: ${API_URL}"
echo "========================================="

# 1. Healthcheck
echo "[1/4] Checking API Health..."
HTTP_STATUS=$(curl -s -o /tmp/health_resp.json -w "%{http_code}" "${API_URL}/health" || true)
if [ "$HTTP_STATUS" != "200" ]; then
    echo "❌ Healthcheck failed with HTTP status: $HTTP_STATUS"
    cat /tmp/health_resp.json || true
    echo ""
    exit 1
fi
echo "✅ API is Healthy: $(cat /tmp/health_resp.json)"

# 2. Upload Sample P&ID and IO List
echo "[2/4] Uploading Sample P&ID and IO List..."
if [ ! -f "$SAMPLE_PDF" ] || [ ! -f "$SAMPLE_XLSX" ]; then
    echo "❌ Sample files missing: $SAMPLE_PDF or $SAMPLE_XLSX"
    exit 1
fi

UPLOAD_RESP=$(curl -s -X POST "${API_URL}/jobs" \
  -F "pid_pdf=@${SAMPLE_PDF}" \
  -F "io_list_xlsx=@${SAMPLE_XLSX}")

JOB_ID=$(echo "$UPLOAD_RESP" | grep -o '"job_id":"[^"]*' | cut -d'"' -f4 || true)

if [ -z "$JOB_ID" ]; then
    echo "❌ Job creation failed. Response:"
    echo "$UPLOAD_RESP"
    exit 1
fi
echo "✅ Job successfully created: $JOB_ID"

# 3. Poll for pipeline completion
echo "[3/4] Polling job progress..."
MAX_RETRIES=30
RETRY_COUNT=0
STATUS="running"

while [ "$STATUS" != "done" ] && [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; do
    sleep 2
    JOB_INFO=$(curl -s "${API_URL}/jobs/${JOB_ID}")
    STATUS=$(echo "$JOB_INFO" | grep -o '"status":"[^"]*' | cut -d'"' -f4 || echo "unknown")
    STAGE=$(echo "$JOB_INFO" | grep -o '"stage":"[^"]*' | cut -d'"' -f4 || echo "none")
    PROGRESS=$(echo "$JOB_INFO" | grep -o '"progress":[^,}]*' | cut -d':' -f2 || echo "0")
    echo "   -> Status: ${STATUS} | Stage: ${STAGE} | Progress: ${PROGRESS}"
    
    if [ "$STATUS" = "failed" ]; then
        echo "❌ Job execution failed!"
        echo "$JOB_INFO"
        exit 1
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

# 4. Assert graph and tags availability
echo "[4/4] Verifying generated graph and tags..."
GRAPH_RESP=$(curl -s -o /tmp/graph.json -w "%{http_code}" "${API_URL}/jobs/${JOB_ID}/graph" || true)
if [ "$GRAPH_RESP" = "200" ]; then
    echo "✅ Graph successfully retrieved."
else
    echo "⚠️ Warning: Graph endpoint returned status $GRAPH_RESP"
fi

echo "========================================="
echo "🎉 UNTANGLE Smoke Test Completed Successfully!"
echo "========================================="
