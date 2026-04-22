#!/usr/bin/env bash
# Block traffic from Singapore (SG) via Cloudflare WAF Custom Rule (API).
# Có thể chặn toàn site hoặc chỉ một vài path (vd: /scan).
# Cần: ZONE_ID và CLOUDFLARE_API_TOKEN (hoặc CF_API_TOKEN).
#
# Usage:
#   export CLOUDFLARE_API_TOKEN="your-token"
#   export ZONE_ID="your-zone-id"
#
#   # Chặn SG chỉ trên các path (vd: /scan và /admin):
#   export BLOCK_PATHS="/scan,/admin"
#   ./scripts/cloudflare-block-singapore.sh
#
#   # Hoặc truyền path qua tham số:
#   ./scripts/cloudflare-block-singapore.sh /scan
#   ./scripts/cloudflare-block-singapore.sh /scan,/admin
#
#   # Chặn SG trên toàn site (không chỉ định path):
#   ./scripts/cloudflare-block-singapore.sh
#
# Hoặc đặt token/zone trong file .credentials-local (không commit):
#   CLOUDFLARE_API_TOKEN=...
#   ZONE_ID=...
#   BLOCK_PATHS=/scan,/admin

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
# Paths cần chặn SG (comma-separated), ví dụ: /scan,/admin. Để trống = chặn toàn site.
BLOCK_PATHS="${BLOCK_PATHS:-$1}"

if [[ -z "$TOKEN" ]]; then
  echo "Error: CLOUDFLARE_API_TOKEN (hoặc CF_API_TOKEN) chưa set."
  echo "Export env hoặc đặt trong $CRED_FILE"
  exit 1
fi

if [[ -z "$ZONE_ID" ]]; then
  echo "Error: ZONE_ID chưa set."
  echo "Lấy Zone ID: Cloudflare Dashboard → domain → Overview (bên phải)."
  echo "Hoặc export ZONE_ID / đặt trong $CRED_FILE"
  exit 1
fi

# Lấy ruleset ID của phase http_request_firewall_custom
echo "Fetching ruleset id for http_request_firewall_custom..."
ENTRYPOINT=$(curl -sS "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint" \
  -H "Authorization: Bearer ${TOKEN}")

if ! echo "$ENTRYPOINT" | grep -q '"success":true'; then
  echo "Error: Could not get entrypoint ruleset."
  echo "$ENTRYPOINT" | head -20
  exit 1
fi

RULESET_ID=$(echo "$ENTRYPOINT" | sed -n 's/.*"id":"\([^"]*\)".*"phase":"http_request_firewall_custom".*/\1/p')
if [[ -z "$RULESET_ID" ]]; then
  RULESET_ID=$(echo "$ENTRYPOINT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [[ -z "$RULESET_ID" ]]; then
  echo "Error: Could not parse ruleset id from response."
  echo "$ENTRYPOINT"
  exit 1
fi

echo "Ruleset ID: $RULESET_ID"

# Build expression: SG + (optional) chỉ các path
if [[ -n "$BLOCK_PATHS" ]]; then
  # Normalize: bỏ khoảng trắng, đảm bảo mỗi path bắt đầu bằng /
  PATHS_OR=""
  IFS=',' read -ra PARTS <<< "$BLOCK_PATHS"
  for p in "${PARTS[@]}"; do
    p=$(echo "$p" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [[ -z "$p" ]] && continue
    [[ "$p" != /* ]] && p="/$p"
    if [[ -n "$PATHS_OR" ]]; then PATHS_OR="$PATHS_OR or "; fi
    # Match exact path hoặc path con (vd: /scan và /scan/xxx)
    PATHS_OR="${PATHS_OR}(http.request.uri.path eq \"$p\" or http.request.uri.path wildcard \"$p/*\")"
  done
  if [[ -z "$PATHS_OR" ]]; then
    EXPRESSION='ip.src.country eq "SG"'
    DESC="Block Singapore (all paths)"
  else
    EXPRESSION="(ip.src.country eq \"SG\" and ($PATHS_OR))"
    DESC="Block Singapore on paths: $BLOCK_PATHS"
  fi
else
  EXPRESSION='ip.src.country eq "SG"'
  DESC="Block Singapore (all paths)"
fi

echo "Expression: $EXPRESSION"
echo "Adding rule: $DESC..."
# Escape dấu " trong expression cho JSON
EXPRESSION_JSON="${EXPRESSION//\"/\\\"}"
RESULT=$(curl -sS "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/${RULESET_ID}/rules" \
  -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"description\":\"Block Singapore\",\"expression\":\"$EXPRESSION_JSON\",\"action\":\"block\"}")

if echo "$RESULT" | grep -q '"success":true'; then
  echo "Done. $DESC"
else
  echo "Error: Failed to create rule."
  echo "$RESULT"
  exit 1
fi
