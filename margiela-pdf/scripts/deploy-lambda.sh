#!/usr/bin/env bash
# Deploy margiela-pdf Lambda (zip → S3 → update-function-code)
# Usage: ./scripts/deploy-lambda.sh
# Cần: AWS CLI configured, quyền S3 upload + Lambda update

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PDF_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-margiela-pdf}"
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
export AWS_PROFILE="${AWS_PROFILE:-newtofu}"
S3_DEPLOY_BUCKET="${S3_DEPLOY_BUCKET:-margiela-pdf-deploy-aps1}"
S3_KEY="margiela-pdf-$(date +%Y%m%d-%H%M%S).zip"
ZIP_FILE="/tmp/$S3_KEY"

echo "=== Deploy Lambda: $FUNCTION_NAME ($AWS_REGION) ==="
echo "    S3: s3://$S3_DEPLOY_BUCKET/$S3_KEY"
echo ""

# 1. Build in temp dir (clean node_modules)
BUILD_DIR=$(mktemp -d)
echo "=== Copy source to $BUILD_DIR ==="
cp "$PDF_ROOT/package.json" "$PDF_ROOT/package-lock.json" "$BUILD_DIR/" 2>/dev/null || cp "$PDF_ROOT/package.json" "$BUILD_DIR/"
cp "$PDF_ROOT/index.js" "$PDF_ROOT/lambda.js" "$BUILD_DIR/"

echo "=== npm install --omit=dev ==="
cd "$BUILD_DIR"
npm install --omit=dev --silent

echo "=== Zip ==="
zip -rq "$ZIP_FILE" . -x "*.env*" "*.git*" "scripts/*" "docs/*" "pdfs/*" "docker-compose*" "Dockerfile*" ".dockerignore"
ZIP_SIZE=$(du -sh "$ZIP_FILE" | cut -f1)
echo "    $ZIP_FILE ($ZIP_SIZE)"

# 2. Upload to S3
echo "=== Upload to S3 ==="
aws s3 cp "$ZIP_FILE" "s3://$S3_DEPLOY_BUCKET/$S3_KEY" --region "$AWS_REGION"

# 3. Update Lambda function code
echo "=== Update Lambda code ==="
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --s3-bucket "$S3_DEPLOY_BUCKET" \
  --s3-key "$S3_KEY" \
  --region "$AWS_REGION" \
  --output json | jq '{FunctionName, LastUpdateStatus, CodeSize, LastModified}'

# 4. Wait for update
echo "=== Wait for function ready ==="
aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$AWS_REGION"
echo "Done."

# 5. Update env if .env exists
if [[ -f "$PDF_ROOT/.env" ]]; then
  source "$PDF_ROOT/.env" 2>/dev/null || true
  echo ""
  echo "=== Update Lambda env vars ==="
  ENV_VARS="APP_URL=${APP_URL:-https://springsummer2026margiela.com},ORIGIN_URL=${ORIGIN_URL:-http://margiela-alb-1999550789.ap-southeast-1.elb.amazonaws.com},PUBLIC_URL=${PUBLIC_URL:-https://v42svjp2rnfuvkhuaatp2z4oxm0ouluo.lambda-url.ap-southeast-1.on.aws},S3_BUCKET=margiela-pdfs,S3_DISABLE_CHECKSUM=1"
  [[ -n "${SLACK_WEBHOOK_URL:-}" ]] && ENV_VARS="${ENV_VARS},SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}"
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "Variables={${ENV_VARS}}" \
    --region "$AWS_REGION" \
    --output json | jq '{FunctionName, LastUpdateStatus}'
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$AWS_REGION"
  echo "Env vars updated."
fi

# Cleanup
rm -rf "$BUILD_DIR" "$ZIP_FILE"

echo ""
echo "=== Quick test ==="
FUNCTION_URL=$(aws lambda get-function-url-config --function-name "$FUNCTION_NAME" --region "$AWS_REGION" --query 'FunctionUrl' --output text 2>/dev/null || echo "")
if [[ -n "$FUNCTION_URL" ]]; then
  echo "Function URL: $FUNCTION_URL"
  curl -s "${FUNCTION_URL}health" | jq . 2>/dev/null || echo "(health check failed)"
else
  echo "No Function URL configured."
fi
