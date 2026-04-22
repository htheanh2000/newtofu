#!/usr/bin/env bash
# Enable Neon Data API + Neon Auth for the margiela project via Neon API.
# neonctl không có lệnh bật Data API; phải gọi Neon REST API.
#
# Cần: NEON_API_KEY (lấy từ Neon Console → Account → API keys).
# Optional: NEON_PROJECT_ID, NEON_BRANCH_ID, NEON_DATABASE_NAME (mặc định: project margiela, branch main, db neondb).
#
# Usage: ./scripts/enable-neon-data-api.sh

set -e

NEON_API_KEY="${NEON_API_KEY:-}"
if [[ -z "$NEON_API_KEY" ]]; then
  echo "Error: NEON_API_KEY is required. Get it from Neon Console → Account → API keys."
  exit 1
fi

PROJECT_ID="${NEON_PROJECT_ID:-}"
BRANCH_ID="${NEON_BRANCH_ID:-}"
DATABASE_NAME="${NEON_DATABASE_NAME:-neondb}"

if [[ -z "$PROJECT_ID" || -z "$BRANCH_ID" ]]; then
  echo "Resolving project and branch via neonctl (project margiela, branch main)..."
  if ! command -v neonctl &>/dev/null; then
    echo "Error: neonctl not found. Set NEON_PROJECT_ID and NEON_BRANCH_ID manually, or install neonctl (npm i -g neonctl)."
    exit 1
  fi
  PROJECT_JSON=$(neonctl projects list -o json 2>/dev/null | jq -r '.projects[] | select(.name=="margiela") | .id')
  if [[ -z "$PROJECT_JSON" ]]; then
    echo "Error: Project 'margiela' not found. Set NEON_PROJECT_ID and NEON_BRANCH_ID."
    exit 1
  fi
  PROJECT_ID="$PROJECT_JSON"
  BRANCH_JSON=$(neonctl branches list --project-id "$PROJECT_ID" -o json 2>/dev/null | jq -r '.[] | select(.name=="main") | .id')
  if [[ -z "$BRANCH_JSON" ]]; then
    echo "Error: Branch 'main' not found. Set NEON_BRANCH_ID."
    exit 1
  fi
  BRANCH_ID="$BRANCH_JSON"
  echo "  project_id=$PROJECT_ID branch_id=$BRANCH_ID database=$DATABASE_NAME"
fi

BASE_URL="https://console.neon.tech/api/v2"
ENDPOINT="${BASE_URL}/projects/${PROJECT_ID}/branches/${BRANCH_ID}/data-api/${DATABASE_NAME}"

echo "Enabling Data API with Neon Auth and default grants..."
TMP_RESP=$(mktemp)
trap 'rm -f "$TMP_RESP"' EXIT
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$TMP_RESP" -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"auth_provider": "neon_auth", "add_default_grants": true}')
HTTP_BODY=$(cat "$TMP_RESP")

if [[ "$HTTP_CODE" != "201" ]]; then
  echo "Error: API returned HTTP $HTTP_CODE"
  echo "$HTTP_BODY" | jq . 2>/dev/null || echo "$HTTP_BODY"
  exit 1
fi

DATA_API_URL=$(echo "$HTTP_BODY" | jq -r '.url')
if [[ -z "$DATA_API_URL" || "$DATA_API_URL" == "null" ]]; then
  echo "Error: No url in response."
  echo "$HTTP_BODY"
  exit 1
fi

# Data API URL is like https://ep-xxx.apirest.region.aws.neon.tech/neondb/rest/v1
# Auth URL is typically same host but neonauth and path /neondb/auth - need to derive or get from API
# The docs say "Auth URL on the Auth page" - the enable response might not include it. We'll print what we have.
echo ""
echo "Data API enabled."
echo "  Data API URL (REST base): $DATA_API_URL"
echo ""
echo "Next steps:"
echo "  1. In Neon Console → project margiela → Auth: copy the Auth URL (e.g. https://ep-xxx.neonauth.region.aws.neon.tech/neondb/auth)."
echo "  2. Create an admin user: POST <Auth URL>/sign-up/email with body {\"email\":\"...\",\"password\":\"...\",\"name\":\"Admin\"}."
echo "  3. In margiela-admin/.env set:"
echo "     NEXT_PUBLIC_NEON_DATA_API_URL=$DATA_API_URL"
echo "     NEXT_PUBLIC_NEON_AUTH_URL=<Auth URL from step 1>"
echo "  4. Build and deploy admin."
echo ""
