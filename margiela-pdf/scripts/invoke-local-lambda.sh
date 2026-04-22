#!/usr/bin/env bash
# Gọi Lambda container chạy local (port 8080)
# Usage: ./scripts/invoke-local-lambda.sh <compositionId> [locale]
# Example: ./scripts/invoke-local-lambda.sh 1773125212941-g6ha5mgrf en

set -e
COMPOSITION_ID="${1:?Usage: $0 <compositionId> [locale]}"
LOCALE="${2:-en}"
ENDPOINT="${INVOKE_URL:-http://localhost:8080/2015-03-31/functions/function/invocations}"

# Payload format 2.0 (Lambda Function URL) – serverless-http cần rawPath + requestContext.http
PAYLOAD=$(cat <<EOF
{
  "version": "2.0",
  "routeKey": "\$default",
  "rawPath": "/generate/${COMPOSITION_ID}",
  "requestContext": {
    "http": {
      "method": "POST",
      "path": "/generate/${COMPOSITION_ID}"
    }
  },
  "body": "{\"locale\":\"${LOCALE}\"}",
  "isBase64Encoded": false
}
EOF
)

echo "Invoking local Lambda: POST /generate/${COMPOSITION_ID} (locale=${LOCALE})"
echo "Endpoint: $ENDPOINT"
echo ""

curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  --max-time 120 \
  | jq . 2>/dev/null || cat
