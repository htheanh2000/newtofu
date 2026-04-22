#!/usr/bin/env bash
# Gọi API FE (generate-pdf) rồi xem CloudWatch log Lambda
# Usage: ./scripts/call-fe-and-logs.sh [compositionId] [FE_BASE_URL]

set -e
COMPOSITION_ID="${1:-1773125212941-g6ha5mgrf}"
FE_BASE="${2:-https://www.springsummer2026margiela.com}"
FE_URL="${FE_BASE%/}/api/generate-pdf/${COMPOSITION_ID}"
LOG_GROUP="/aws/lambda/margiela-pdf"
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
export AWS_PROFILE="${AWS_PROFILE:-newtofu}"

echo "=== Call FE API: POST $FE_URL ==="
START_TS=$(date +%s)
HTTP_CODE=$(curl -s -o /tmp/fe-resp.json -w "%{http_code}" -X POST "$FE_URL" \
  -H "Content-Type: application/json" \
  -d '{"locale":"en"}' \
  --max-time 300) || true
END_TS=$(date +%s)
HTTP_BODY=$(cat /tmp/fe-resp.json 2>/dev/null || echo "")

echo "HTTP $HTTP_CODE (${END_TS}-${START_TS}s)"
echo "$HTTP_BODY" | jq . 2>/dev/null || echo "$HTTP_BODY"

echo ""
echo "=== CloudWatch logs (last 15 min) ==="
aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time $(( $(date +%s) - 900 ))000 \
  --region "$AWS_REGION" \
  --query 'events[*].message' \
  --output text 2>/dev/null | tr '\t' '\n' | grep -v '^$' || echo "(No events or aws logs not configured)"
