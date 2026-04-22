#!/usr/bin/env bash
# Register ECS task definition margiela-fe with env from .env
# Usage: ./scripts/ecs-register-task-def-with-env.sh [path-to-.env]
# Default .env: margiela-fe/.env

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${1:-$FE_ROOT/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env not found at $ENV_FILE"
  echo "Copy .env.example to .env"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

AWS_PROFILE="${AWS_PROFILE:-newtofu}"
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
export AWS_PROFILE AWS_REGION

echo "Fetching current task definition margiela-fe..."
CURRENT=$(aws ecs describe-task-definition --task-definition margiela-fe --region "$AWS_REGION" --query 'taskDefinition')

TMP_JSON=$(mktemp)
trap 'rm -f "$TMP_JSON"' EXIT

echo "Adding PDF_SERVICE_URL + device whitelist + DATABASE_URL + ADMIN_* + SLACK_WEBHOOK_URL_API_ERROR and registering new revision..."
# Optional: PDF_SERVICE_URL, ADMIN_* (login + CORS), SLACK_WEBHOOK_URL_API_ERROR (API error notifications).
PDF_URL="${PDF_SERVICE_URL:-}"
DB_URL="${DATABASE_URL:-}"
WHITELIST="${MARGIELA_DEVICE_WHITELIST_ENABLED:-1}"
ADMIN_USER="${ADMIN_USERNAME:-}"
ADMIN_PASS="${ADMIN_PASSWORD:-}"
ADMIN_SEC="${ADMIN_SECRET:-}"
ADMIN_CORS="${ADMIN_CORS_ORIGIN:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL_API_ERROR:-}"
echo "$CURRENT" | jq --arg pdf_url "$PDF_URL" \
  --arg db_url "$DB_URL" \
  --arg whitelist "$WHITELIST" \
  --arg admin_user "$ADMIN_USER" \
  --arg admin_pass "$ADMIN_PASS" \
  --arg admin_sec "$ADMIN_SEC" \
  --arg admin_cors "$ADMIN_CORS" \
  --arg slack_webhook "$SLACK_WEBHOOK" '
  del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy) |
  .containerDefinitions[0].environment += [
    {"name":"MARGIELA_DEVICE_WHITELIST_ENABLED","value":$whitelist}
  ] |
  (if $db_url != "" then .containerDefinitions[0].environment += [{"name":"DATABASE_URL","value":$db_url}] else . end) |
  (if $pdf_url != "" then .containerDefinitions[0].environment += [{"name":"PDF_SERVICE_URL","value":$pdf_url}] else . end) |
  (if $admin_user != "" then .containerDefinitions[0].environment += [{"name":"ADMIN_USERNAME","value":$admin_user}] else . end) |
  (if $admin_pass != "" then .containerDefinitions[0].environment += [{"name":"ADMIN_PASSWORD","value":$admin_pass}] else . end) |
  (if $admin_sec != "" then .containerDefinitions[0].environment += [{"name":"ADMIN_SECRET","value":$admin_sec}] else . end) |
  (if $admin_cors != "" then .containerDefinitions[0].environment += [{"name":"ADMIN_CORS_ORIGIN","value":$admin_cors}] else . end) |
  (if $slack_webhook != "" then .containerDefinitions[0].environment += [{"name":"SLACK_WEBHOOK_URL_API_ERROR","value":$slack_webhook}] else . end)
' > "$TMP_JSON"

aws ecs register-task-definition \
  --cli-input-json "file://$TMP_JSON" \
  --region "$AWS_REGION" \
  --output json \
  --query 'taskDefinition.{family:family,revision:revision}' \
  --no-cli-pager

echo "Updating service to use new task definition..."
aws ecs update-service \
  --cluster margiela-cluster \
  --service margiela-fe-service \
  --task-definition margiela-fe \
  --force-new-deployment \
  --region "$AWS_REGION" \
  --query 'service.{serviceName:serviceName,desiredCount:desiredCount,runningCount:runningCount}' \
  --output table

echo "Done. Ensure .env has PDF_SERVICE_URL (Lambda), DATABASE_URL (Neon/Postgres for device whitelist), MARGIELA_DEVICE_WHITELIST_ENABLED=1, SLACK_WEBHOOK_URL_API_ERROR (optional, for API error Slack alerts). Check: aws ecs describe-services --cluster margiela-cluster --services margiela-fe-service --region $AWS_REGION"
