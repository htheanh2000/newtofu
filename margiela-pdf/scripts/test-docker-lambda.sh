#!/usr/bin/env bash
# Test Lambda PDF trong Docker: build → up → invoke → down
# Usage: ./scripts/test-docker-lambda.sh [compositionId]
# Cần: margiela-pdf/.env (copy từ .env.example)

set -e
COMPOSITION_ID="${1:-1773125212941-g6ha5mgrf}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PDF_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PDF_ROOT"

if [[ ! -f .env ]]; then
  echo "Error: .env not found. Copy .env.example."
  exit 1
fi

echo "=== Build Lambda image ==="
docker compose -f docker-compose.lambda.yml build

echo ""
echo "=== Start container (port 8080) ==="
docker compose -f docker-compose.lambda.yml up -d

echo ""
echo "=== Wait for Lambda init (~15s) ==="
sleep 15

echo ""
echo "=== Invoke POST /generate/${COMPOSITION_ID} ==="
if ./scripts/invoke-local-lambda.sh "$COMPOSITION_ID" en; then
  echo ""
  echo "=== Invoke done ==="
else
  echo ""
  echo "=== Invoke failed (check container logs: docker compose -f docker-compose.lambda.yml logs) ==="
fi

echo ""
echo "=== Stop container ==="
docker compose -f docker-compose.lambda.yml down

echo ""
echo "Done. Trên Mac Chromium trong container có thể lỗi (elf/rosetta); test chuẩn chạy Docker trên Linux hoặc deploy Lambda thật."
