#!/usr/bin/env bash
# Deploy margiela-e2e-lambda: create/update Lambda + EventBridge schedule 8AM Hong Kong time daily.
# Usage: ./deploy.sh   (default ap-east-1 Hong Kong; set AWS_REGION=ap-southeast-1 to use Singapore)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

[ -f ".env" ] && set -a && source .env 2>/dev/null && set +a

if [ -z "$SLACK_WEBHOOK_URL_E2E" ]; then
  echo "Error: SLACK_WEBHOOK_URL_E2E is required. Set it in .env (see .env.example)."
  exit 1
fi

export AWS_PROFILE="${AWS_PROFILE:-newtofu}"

BASE_URL="${BASE_URL:-https://www.springsummer2026margiela.com}"

LAMBDA_NAME="${LAMBDA_NAME:-margiela-e2e-daily}"
SCHEDULE_NAME="${SCHEDULE_NAME:-margiela-e2e-daily-8am-hkt}"
REGION="${AWS_REGION:-ap-east-1}"
ROLE_NAME="${LAMBDA_ROLE_NAME:-margiela-e2e-lambda-role}"

# Zip handler (no node_modules needed)
rm -f lambda.zip
zip -q lambda.zip index.mjs package.json

# Resolve role ARN: use LAMBDA_ROLE_ARN if set, else create/find by ROLE_NAME
# If Lambda already exists, we only need to update code + EventBridge (no role change)
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
if [ -n "$LAMBDA_ROLE_ARN" ]; then
  ROLE_ARN="$LAMBDA_ROLE_ARN"
elif aws lambda get-function --function-name "$LAMBDA_NAME" --region "$REGION" 2>/dev/null; then
  ROLE_ARN="$(aws lambda get-function --function-name "$LAMBDA_NAME" --region "$REGION" --query 'Configuration.Role' --output text)"
  echo "Using existing Lambda role: $ROLE_ARN"
elif aws iam get-role --role-name "$ROLE_NAME" 2>/dev/null; then
  ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
else
  echo "Creating IAM role $ROLE_NAME for Lambda..."
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": { "Service": "lambda.amazonaws.com" },
        "Action": "sts:AssumeRole"
      }]
    }' \
    --description "Role for margiela E2E daily Lambda"
  aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  echo "Waiting 10s for IAM role to propagate..."
  sleep 10
  ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
fi

# Create or update Lambda
if aws lambda get-function --function-name "$LAMBDA_NAME" --region "$REGION" 2>/dev/null; then
  echo "Updating Lambda $LAMBDA_NAME..."
  aws lambda update-function-code \
    --function-name "$LAMBDA_NAME" \
    --zip-file "fileb://lambda.zip" \
    --region "$REGION"
  aws lambda wait function-updated --function-name "$LAMBDA_NAME" --region "$REGION"
  aws lambda update-function-configuration \
    --function-name "$LAMBDA_NAME" \
    --runtime "nodejs20.x" \
    --handler "index.handler" \
    --timeout 180 \
    --environment "Variables={BASE_URL=$BASE_URL,SLACK_WEBHOOK_URL_E2E=$SLACK_WEBHOOK_URL_E2E}" \
    --region "$REGION"
else
  echo "Creating Lambda $LAMBDA_NAME..."
  aws lambda create-function \
    --function-name "$LAMBDA_NAME" \
    --runtime "nodejs20.x" \
    --handler "index.handler" \
    --role "$ROLE_ARN" \
    --zip-file "fileb://lambda.zip" \
    --timeout 180 \
    --environment "Variables={BASE_URL=$BASE_URL,SLACK_WEBHOOK_URL_E2E=$SLACK_WEBHOOK_URL_E2E}" \
    --region "$REGION"
fi

# EventBridge Rules (CloudWatch Events)
LAMBDA_ARN="$(aws lambda get-function --function-name "$LAMBDA_NAME" --region "$REGION" --query 'Configuration.FunctionArn' --output text)"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
RULE_NAME="$SCHEDULE_NAME"
WARMUP_RULE_NAME="${WARMUP_RULE_NAME:-margiela-neon-warmup-755am-hkt}"

# Rule 1: Neon warmup at 7:55 HKT (23:55 UTC) - wake DB before E2E
# 7:55 HKT = 23:55 UTC (HKT = UTC+8)
echo "Creating EventBridge rule: $WARMUP_RULE_NAME (7:55 HKT)"
aws events put-rule \
  --name "$WARMUP_RULE_NAME" \
  --schedule-expression "cron(55 23 * * ? *)" \
  --state ENABLED \
  --description "Neon DB warmup 7:55 HKT (23:55 UTC) - wake before E2E" \
  --region "$REGION"

# Use cli-input-json to avoid shell escaping of Input JSON
WARMUP_JSON=$(mktemp)
jq -n --arg arn "$LAMBDA_ARN" --arg rule "$WARMUP_RULE_NAME" '{
  Rule: $rule,
  Targets: [{ Id: "1", Arn: $arn, Input: "{\"warmup\":true}" }]
}' > "$WARMUP_JSON"
aws events put-targets --cli-input-json "file://$WARMUP_JSON" --region "$REGION"
rm -f "$WARMUP_JSON"

if ! aws lambda add-permission \
  --function-name "$LAMBDA_NAME" \
  --statement-id "EventBridgeInvoke-$WARMUP_RULE_NAME" \
  --action "lambda:InvokeFunction" \
  --principal "events.amazonaws.com" \
  --source-arn "arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/$WARMUP_RULE_NAME" \
  --region "$REGION" 2>/dev/null; then
  echo "Note: lambda:AddPermission for warmup skipped (may already exist)."
fi

# Rule 2: E2E at 8:00 HKT (0:00 UTC) daily
echo "Creating EventBridge rule: $RULE_NAME (8:00 HKT)"
aws events put-rule \
  --name "$RULE_NAME" \
  --schedule-expression "cron(0 0 * * ? *)" \
  --state ENABLED \
  --description "Margiela E2E daily 8am HKT (0:00 UTC)" \
  --region "$REGION"

aws events put-targets \
  --rule "$RULE_NAME" \
  --targets "Id"="1","Arn"="$LAMBDA_ARN" \
  --region "$REGION"

if ! aws lambda add-permission \
  --function-name "$LAMBDA_NAME" \
  --statement-id "EventBridgeInvoke-$RULE_NAME" \
  --action "lambda:InvokeFunction" \
  --principal "events.amazonaws.com" \
  --source-arn "arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/$RULE_NAME" \
  --region "$REGION" 2>/dev/null; then
  echo "Note: lambda:AddPermission skipped (may already exist or need lambda permission)."
fi

rm -f lambda.zip
echo "Done. Lambda: $LAMBDA_NAME"
echo "  - $WARMUP_RULE_NAME: 7:55 HKT (Neon warmup)"
echo "  - $RULE_NAME: 8:00 HKT (E2E)"
echo "Slack messages will start with: [E2E-Margiela]; data prefix in DB: e2e-daily"
