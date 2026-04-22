#!/usr/bin/env bash
# Add CNAME record for admin.springsummer2026margiela.com → S3 website (margiela-admin).
# Dùng Cloudflare API (cùng credential như cloudflare-block-singapore.sh).
#
# Usage:
#   export CLOUDFLARE_API_TOKEN="your-token"
#   export ZONE_ID="your-zone-id"
#   ./scripts/cloudflare-admin-subdomain.sh
#
# Hoặc đặt trong .credentials-local (không commit):
#   CLOUDFLARE_API_TOKEN=...
#   ZONE_ID=...

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CRED_FILE="${CRED_FILE:-$REPO_ROOT/.credentials-local}"

if [[ -f "$CRED_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$CRED_FILE"
  set +a
fi

TOKEN="${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN:-}}"
ZONE_ID="${ZONE_ID:-}"

# Admin subdomain → S3 static website
ADMIN_NAME="admin"
S3_WEBSITE_HOST="admin-springsummer2026margiela.s3-website-ap-southeast-1.amazonaws.com"

if [[ -z "$TOKEN" ]]; then
  echo "Error: CLOUDFLARE_API_TOKEN (hoặc CF_API_TOKEN) chưa set."
  echo "Export env hoặc đặt trong $CRED_FILE"
  exit 1
fi

if [[ -z "$ZONE_ID" ]]; then
  echo "Error: ZONE_ID chưa set."
  echo "Lấy Zone ID: Cloudflare Dashboard → domain springsummer2026margiela.com → Overview."
  exit 1
fi

echo "Checking existing DNS record for ${ADMIN_NAME}..."
EXISTING=$(curl -sS "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=CNAME&name=${ADMIN_NAME}.springsummer2026margiela.com" \
  -H "Authorization: Bearer ${TOKEN}")

RECORD_ID=$(echo "$EXISTING" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -n "$RECORD_ID" ]]; then
  echo "Updating existing CNAME record (id: $RECORD_ID)..."
  RESULT=$(curl -sS -X PUT "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${RECORD_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"CNAME\",\"name\":\"${ADMIN_NAME}\",\"content\":\"${S3_WEBSITE_HOST}\",\"ttl\":1,\"proxied\":true}")
else
  echo "Creating CNAME record: ${ADMIN_NAME} -> ${S3_WEBSITE_HOST} (proxied)..."
  RESULT=$(curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"CNAME\",\"name\":\"${ADMIN_NAME}\",\"content\":\"${S3_WEBSITE_HOST}\",\"ttl\":1,\"proxied\":true}")
fi

SUCCESS=$(echo "$RESULT" | grep -o '"success":true"' || true)
if [[ -z "$SUCCESS" ]]; then
  echo "Error: Cloudflare API response:"
  echo "$RESULT" | head -20
  exit 1
fi

echo "OK. admin.springsummer2026margiela.com -> ${S3_WEBSITE_HOST} (Cloudflare proxy ON)."
echo "SSL: Cloudflare Flexible (HTTPS user -> CF, HTTP CF -> S3)."

# --- Origin Rule: override Host header so S3 website does not return 404 ---
echo ""
echo "Setting Origin Rule (Host header override) for admin subdomain..."
LIST_RULESETS=$(curl -sS "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets" \
  -H "Authorization: Bearer ${TOKEN}")
ORIGIN_RULESET_ID=$(echo "$LIST_RULESETS" | grep -o '"id":"[^"]*"[^}]*"phase":"http_request_origin"' | head -1 | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [[ -z "$ORIGIN_RULESET_ID" ]]; then
  # Create zone ruleset for http_request_origin if missing
  CREATE_RESULT=$(curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"name\":\"Origin Rules\",\"kind\":\"zone\",\"phase\":\"http_request_origin\",\"description\":\"Origin rules for zone\"}")
  ORIGIN_RULESET_ID=$(echo "$CREATE_RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [[ -z "$ORIGIN_RULESET_ID" ]]; then
    echo "Warning: Could not create Origin Rules ruleset. Create rule manually in Dashboard:"
    echo "  Rules → Origin Rules → override Host to: ${S3_WEBSITE_HOST}"
    echo "  When: http.host eq \"admin.springsummer2026margiela.com\""
  fi
fi

if [[ -n "$ORIGIN_RULESET_ID" ]]; then
  # Get existing rules so we don't wipe other rules
  GET_RULESET=$(curl -sS "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/${ORIGIN_RULESET_ID}" \
    -H "Authorization: Bearer ${TOKEN}")
  EXISTING_RULES=$(echo "$GET_RULESET" | grep -o '"rules":\[.*\]' | sed 's/"rules"://')
  # Build new rule for admin host override
  ADMIN_ORIGIN_RULE="{\"ref\":\"admin_s3_host_header\",\"expression\":\"http.host eq \\\"admin.springsummer2026margiela.com\\\"\",\"description\":\"Admin S3 website Host override\",\"action\":\"route\",\"action_parameters\":{\"host_header\":\"${S3_WEBSITE_HOST}\",\"origin\":{\"host\":\"${S3_WEBSITE_HOST}\"}}}"
  # If we have other rules, we need to merge. For simplicity: put only our rule (overwrites ruleset). Safer: use jq to merge.
  if command -v jq &>/dev/null; then
    EXISTING_ARR=$(echo "$GET_RULESET" | jq -c '.result.rules // []')
    OTHER_RULES=$(echo "$EXISTING_ARR" | jq -c --argjson new "$ADMIN_ORIGIN_RULE" 'map(select(.ref != "admin_s3_host_header")) + [$new]')
    RULES_JSON=$(echo "$OTHER_RULES" | jq -c '.')
  else
    RULES_JSON="[${ADMIN_ORIGIN_RULE}]"
  fi
  UPDATE_RESULT=$(curl -sS -X PUT "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/${ORIGIN_RULESET_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"rules\":${RULES_JSON}}")
  if echo "$UPDATE_RESULT" | grep -q '"success":true'; then
    echo "OK. Origin Rule set: Host (and origin) -> ${S3_WEBSITE_HOST} when host is admin.springsummer2026margiela.com"
  else
    echo "Warning: Origin Rule update failed. Set manually in Dashboard (Rules → Origin Rules):"
    echo "  Host header override: ${S3_WEBSITE_HOST}"
    echo "  When: http.host eq \"admin.springsummer2026margiela.com\""
    echo "Response: $(echo "$UPDATE_RESULT" | head -5)"
  fi
fi

echo ""
echo "Test: https://admin.springsummer2026margiela.com"
