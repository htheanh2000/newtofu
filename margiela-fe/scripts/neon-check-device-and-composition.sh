#!/usr/bin/env bash
# Check Device whitelist and Composition in Neon DB.
# Usage: ./scripts/neon-check-device-and-composition.sh [deviceId] [compositionId]
# Or from repo root: cd margiela-fe && ./scripts/neon-check-device-and-composition.sh

set -e
cd "$(dirname "$0")/.."
source .env 2>/dev/null || true

DEVICE_ID="${1:-e404d10b-c553-420e-9a6b-431ba5b74c11}"
COMPOSITION_ID="${2:-1773127527971-ecmc22s96}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "DATABASE_URL not set. Set it in .env or: export DATABASE_URL=\$(neon connection-string --pooled --prisma)"
  exit 1
fi

echo "=== Device whitelist (deviceId = $DEVICE_ID) ==="
psql "$DATABASE_URL" -t -c "SELECT \"deviceId\", name, \"registeredAt\" FROM \"Device\" WHERE \"deviceId\" = '$DEVICE_ID';" 2>/dev/null || {
  echo "psql failed. Install: brew install libpq && brew link --force libpq"
  echo "Or run in Neon Console SQL Editor: SELECT \"deviceId\", name, \"registeredAt\" FROM \"Device\" WHERE \"deviceId\" = '$DEVICE_ID';"
  exit 1
}

echo ""
echo "=== Composition (id = $COMPOSITION_ID) ==="
psql "$DATABASE_URL" -t -c "SELECT id, instrument, \"pdfUrl\" IS NOT NULL AS has_pdf, \"createdAt\" FROM \"Composition\" WHERE id = '$COMPOSITION_ID';" 2>/dev/null || {
  echo "Run in Neon Console: SELECT id, instrument, \"pdfUrl\" IS NOT NULL AS has_pdf, \"createdAt\" FROM \"Composition\" WHERE id = '$COMPOSITION_ID';"
  exit 1
}

echo ""
echo "=== All devices (last 5) ==="
psql "$DATABASE_URL" -t -c "SELECT \"deviceId\", name, \"registeredAt\" FROM \"Device\" ORDER BY \"registeredAt\" DESC LIMIT 5;"

echo ""
echo "=== Compositions with PDF (last 3) ==="
psql "$DATABASE_URL" -t -c "SELECT id, \"pdfUrl\" IS NOT NULL AS has_pdf FROM \"Composition\" WHERE \"pdfUrl\" IS NOT NULL ORDER BY \"createdAt\" DESC LIMIT 3;"
