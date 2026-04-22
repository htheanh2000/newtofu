#!/usr/bin/env bash
# Cloudflare WAF: kiểm tra rules hiện tại và thêm rule cho phép request E2E Lambda
# (request tới /api/* có header X-E2E-Cron: margiela-daily) để không bị block (vd block Singapore).
#
# Cần: ZONE_ID, CLOUDFLARE_API_TOKEN (hoặc CF_API_TOKEN). Có thể đặt trong .credentials-local.
#
# Usage: ./scripts/cloudflare-waf-allow-e2e.sh

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
ZONE_ID="${ZONE_ID:-${CF_ZONE_ID:-${CLOUDFLARE_ZONE_ID:-}}}"

if [[ -z "$TOKEN" ]]; then
  echo "Error: CLOUDFLARE_API_TOKEN (hoặc CF_API_TOKEN) chưa set."
  exit 1
fi
if [[ -z "$ZONE_ID" ]]; then
  echo "Error: ZONE_ID (hoặc CF_ZONE_ID, CLOUDFLARE_ZONE_ID) chưa set trong $CRED_FILE"
  exit 1
fi

PHASE="http_request_firewall_custom"
BASE_URL="https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/phases/${PHASE}/entrypoint"

echo "=== 1. Lấy ruleset hiện tại (WAF Custom rules) ==="
ENTRYPOINT=$(curl -sS "$BASE_URL" -H "Authorization: Bearer ${TOKEN}")

if ! echo "$ENTRYPOINT" | grep -q '"success":true'; then
  echo "Error: Không lấy được ruleset."
  echo "$ENTRYPOINT" | head -30
  exit 1
fi

# In ra danh sách rules hiện có
echo ""
echo "Rules hiện tại:"
echo "$ENTRYPOINT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    r = d.get('result', {})
    rules = r.get('rules', [])
    for i, rule in enumerate(rules):
        action = rule.get('action', '?')
        desc = rule.get('description', '') or '(no description)'
        expr = rule.get('expression', '')[:80]
        print(f\"  [{i}] action={action}  description={desc!r}\")
        print(f\"      expression: {expr}...\")
except Exception as e:
    print('  (parse error)', e)
" 2>/dev/null || echo "  (could not parse JSON)"

# Rule mới: allow khi (path /api/* hoặc /en/scan/*) và có header X-E2E-Cron = margiela-daily
ALLOW_E2E_DESC="Allow E2E Lambda (X-E2E-Cron header)"
ALLOW_E2E_EXPR='(starts_with(http.request.uri.path, "/api") or starts_with(http.request.uri.path, "/en/scan")) and http.request.headers["x-e2e-cron"][0] eq "margiela-daily"'

echo ""
echo "=== 2. Thêm rule Allow E2E (đặt đầu danh sách) ==="
echo "Rule: $ALLOW_E2E_DESC"
echo "Expression: $ALLOW_E2E_EXPR"

# Trích xuất rules hiện tại; thêm rule Allow E2E ở đầu; PUT lại (giữ nguyên cấu trúc rule cũ).
RULES_JSON=$(echo "$ENTRYPOINT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
result = d.get('result', {})
rules = list(result.get('rules', []))

# Rule mới (allow) - đặt đầu. Không gửi id (Cloudflare tự sinh).
new_rule = {
    'description': 'Allow E2E Lambda (X-E2E-Cron header)',
    'expression': '(starts_with(http.request.uri.path, \"/api\") or starts_with(http.request.uri.path, \"/en/scan\")) and http.request.headers[\"x-e2e-cron\"][0] eq \"margiela-daily\"',
    'action': 'allow',
    'enabled': True
}

# Bỏ qua nếu đã có rule cùng description (tránh thêm trùng)
existing_descs = [r.get('description') or '' for r in rules]
if new_rule['description'] not in existing_descs:
    out = [new_rule] + rules
else:
    print('Rule Allow E2E đã tồn tại, bỏ qua thêm mới.', file=sys.stderr)
    out = rules
print(json.dumps({'rules': out}))
" 2>/dev/null)

if [[ -z "$RULES_JSON" ]]; then
  echo "Error: Không parse được rules. Cần python3."
  exit 1
fi

RESULT=$(curl -sS "$BASE_URL" \
  -X PUT \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$RULES_JSON")

if echo "$RESULT" | grep -q '"success":true'; then
  echo "Done. Đã thêm rule Allow E2E ở đầu WAF Custom rules."
  echo "Lambda E2E cần gửi header: X-E2E-Cron: margiela-daily khi gọi /api/*"
else
  echo "Error: Cập nhật ruleset thất bại."
  echo "$RESULT" | head -40
  exit 1
fi
