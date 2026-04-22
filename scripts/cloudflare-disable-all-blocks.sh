#!/usr/bin/env bash
# Tắt mọi block và bot detection trên Cloudflare cho zone:
# - Security Level = essentially_off (không challenge theo mức độ)
# - Xóa toàn bộ WAF Custom rules (không còn rule block/challenge theo country, v.v.)
#
# Cần: ZONE_ID, CLOUDFLARE_API_TOKEN (hoặc CF_API_TOKEN).
# Token cần quyền: Zone Settings Write, Zone WAF Read + Write.
#
# Usage: ./scripts/cloudflare-disable-all-blocks.sh

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
TOKEN=$(echo "$TOKEN" | tr -d '\n\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
ZONE_ID="${ZONE_ID:-${CF_ZONE_ID:-${CLOUDFLARE_ZONE_ID:-}}}"
CF_EMAIL="${CF_ACCOUNT_EMAIL:-${CLOUDFLARE_EMAIL:-}}"

if [[ -z "$TOKEN" ]]; then
  echo "Error: CLOUDFLARE_API_TOKEN hoặc CF_API_TOKEN chưa set."
  exit 1
fi
if [[ -z "$ZONE_ID" ]]; then
  echo "Error: ZONE_ID chưa set."
  exit 1
fi

# Dùng API Token (Bearer) hoặc Global API Key (X-Auth-Key + X-Auth-Email)
if [[ -n "$CF_EMAIL" ]] && [[ ${#TOKEN} -lt 50 ]]; then
  AUTH_HEADERS=(-H "X-Auth-Email: ${CF_EMAIL}" -H "X-Auth-Key: ${TOKEN}")
else
  AUTH_HEADERS=(-H "Authorization: Bearer ${TOKEN}")
fi

BASE="https://api.cloudflare.com/client/v4/zones/${ZONE_ID}"

echo "=== 1. Đặt Security Level = essentially_off (không challenge) ==="
RES=$(curl -sS "${BASE}/settings/security_level" \
  -X PATCH \
  "${AUTH_HEADERS[@]}" \
  -H "Content-Type: application/json" \
  --data '{"value":"essentially_off"}')
if echo "$RES" | grep -q '"success":true'; then
  echo "OK. Security Level = essentially_off"
else
  echo "Lỗi hoặc token không có quyền Zone Settings Write:"
  echo "$RES" | head -5
fi

echo ""
echo "=== 2. Xóa toàn bộ WAF Custom rules (không còn block/challenge) ==="
ENTRYPOINT=$(curl -sS "${BASE}/rulesets/phases/http_request_firewall_custom/entrypoint" \
  "${AUTH_HEADERS[@]}")

if ! echo "$ENTRYPOINT" | grep -q '"success":true'; then
  echo "Không lấy được WAF ruleset (cần quyền Zone WAF Read). Bỏ qua bước 2."
  echo "$ENTRYPOINT" | head -3
else
  # PUT ruleset với rules rỗng = xóa hết custom rules
  PUT_RES=$(curl -sS "${BASE}/rulesets/phases/http_request_firewall_custom/entrypoint" \
    -X PUT \
    "${AUTH_HEADERS[@]}" \
    -H "Content-Type: application/json" \
    --data '{"rules":[]}')
  if echo "$PUT_RES" | grep -q '"success":true'; then
    echo "OK. Đã xóa toàn bộ WAF Custom rules. Mọi nơi gọi site sẽ không bị block bởi custom rule."
  else
    echo "Lỗi khi cập nhật WAF (cần quyền Zone WAF Write):"
    echo "$PUT_RES" | head -5
  fi
fi

echo ""
echo "Done. Security level đã tắt; WAF custom rules đã xóa. Site không còn block/bot detection từ Cloudflare (cho zone này)."
