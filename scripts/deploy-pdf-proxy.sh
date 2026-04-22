#!/usr/bin/env bash
# Deploy Cloudflare Worker (margiela-pdf-proxy) + tạo CNAME dns record pdf.springsummer2026margiela.com
#
# Usage:
#   export CLOUDFLARE_API_TOKEN="your-token"   # Workers deploy + DNS edit permission
#   export ZONE_ID="your-zone-id"
#   ./scripts/deploy-pdf-proxy.sh
#
# Hoặc đặt trong .credentials-local:
#   CLOUDFLARE_API_TOKEN=...
#   ZONE_ID=...

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKER_DIR="$REPO_ROOT/margiela-pdf-proxy"
CRED_FILE="${CRED_FILE:-$REPO_ROOT/.credentials-local}"

# Load credentials
if [[ -f "$CRED_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$CRED_FILE"
  set +a
fi

TOKEN="${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN:-}}"
ZONE="${ZONE_ID:-}"

SUBDOMAIN="pdf"
FULL_DOMAIN="${SUBDOMAIN}.springsummer2026margiela.com"

# ──────────────────────────────────────────────
# Step 1: Install deps & deploy Worker
# ──────────────────────────────────────────────
echo "=== Step 1: Deploy Cloudflare Worker ==="
cd "$WORKER_DIR"

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Deploying worker..."
npx wrangler deploy

WORKER_URL=$(npx wrangler deployments list 2>/dev/null | grep -oE 'https://[^ ]+\.workers\.dev' | head -1 || true)
if [[ -z "$WORKER_URL" ]]; then
  WORKER_URL="https://margiela-pdf-proxy.<your-subdomain>.workers.dev"
fi
echo "Worker deployed: $WORKER_URL"

# ──────────────────────────────────────────────
# Step 2: Add CNAME record pdf → Worker (via Cloudflare DNS)
# ──────────────────────────────────────────────
if [[ -z "$TOKEN" || -z "$ZONE" ]]; then
  echo ""
  echo "=== Skipping DNS: CLOUDFLARE_API_TOKEN or ZONE_ID not set ==="
  echo "Manually add a CNAME record:"
  echo "  Name: ${SUBDOMAIN}"
  echo "  Target: margiela-pdf-proxy.<your-subdomain>.workers.dev"
  echo "  Proxied: ON"
  echo ""
  echo "Then add a Worker Route in Cloudflare Dashboard:"
  echo "  Route: ${FULL_DOMAIN}/*"
  echo "  Worker: margiela-pdf-proxy"
else
  echo ""
  echo "=== Step 2: DNS record ${FULL_DOMAIN} ==="

  # Lấy worker hostname (dùng cho CNAME target)
  WORKER_HOST="margiela-pdf-proxy.${TOKEN%%.*}.workers.dev"

  EXISTING=$(curl -sS "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records?type=CNAME&name=${FULL_DOMAIN}" \
    -H "Authorization: Bearer ${TOKEN}")
  RECORD_ID=$(echo "$EXISTING" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  # Dùng dummy target 100::, Cloudflare sẽ route qua Worker route
  AAAA_TARGET="100::"

  if [[ -n "$RECORD_ID" ]]; then
    echo "Updating existing record (id: $RECORD_ID)..."
    curl -sS -X PUT "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records/${RECORD_ID}" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      --data "{\"type\":\"AAAA\",\"name\":\"${SUBDOMAIN}\",\"content\":\"${AAAA_TARGET}\",\"ttl\":1,\"proxied\":true}" > /dev/null
  else
    echo "Creating AAAA record: ${SUBDOMAIN} -> ${AAAA_TARGET} (proxied)..."
    curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      --data "{\"type\":\"AAAA\",\"name\":\"${SUBDOMAIN}\",\"content\":\"${AAAA_TARGET}\",\"ttl\":1,\"proxied\":true}" > /dev/null
  fi
  echo "DNS record created/updated: ${FULL_DOMAIN}"

  # ──────────────────────────────────────────────
  # Step 3: Add Worker Route
  # ──────────────────────────────────────────────
  echo ""
  echo "=== Step 3: Worker Route ${FULL_DOMAIN}/* ==="
  ROUTE_PATTERN="${FULL_DOMAIN}/*"
  WORKER_NAME="margiela-pdf-proxy"

  ROUTES=$(curl -sS "https://api.cloudflare.com/client/v4/zones/${ZONE}/workers/routes" \
    -H "Authorization: Bearer ${TOKEN}")
  ROUTE_EXISTS=$(echo "$ROUTES" | grep -o "\"${ROUTE_PATTERN}\"" || true)

  if [[ -n "$ROUTE_EXISTS" ]]; then
    echo "Route already exists: ${ROUTE_PATTERN}"
  else
    echo "Creating Worker Route: ${ROUTE_PATTERN} → ${WORKER_NAME}"
    ROUTE_RESULT=$(curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE}/workers/routes" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      --data "{\"pattern\":\"${ROUTE_PATTERN}\",\"script\":\"${WORKER_NAME}\"}")
    echo "$ROUTE_RESULT" | head -5
  fi
fi

echo ""
echo "=========================================="
echo "  PDF Proxy Worker deployed!"
echo "  URL: https://${FULL_DOMAIN}/pdfs/<filename>.pdf"
echo "  Health: https://${FULL_DOMAIN}/health"
echo "=========================================="
echo ""
echo "Next: add to margiela-fe .env:"
echo "  PDF_PROXY_BASE_URL=https://${FULL_DOMAIN}"
