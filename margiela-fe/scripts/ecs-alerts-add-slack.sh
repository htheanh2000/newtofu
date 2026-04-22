#!/usr/bin/env bash
# Subscribe SNS topic (margiela-ecs-alerts) to a Lambda that posts to Slack.
# Usage: SLACK_WEBHOOK_URL=https://hooks.slack.com/services/... ./scripts/ecs-alerts-add-slack.sh
# Prerequisite: run ecs-alerts-setup.sh first (so SNS topic and alarm exist).

set -e

AWS_REGION="${AWS_REGION:-ap-southeast-1}"
AWS_PROFILE="${AWS_PROFILE:-newtofu}"
TOPIC_NAME="${SNS_TOPIC_NAME:-margiela-ecs-alerts}"
LAMBDA_NAME="${LAMBDA_NAME:-margiela-ecs-alerts-to-slack}"
LAMBDA_ROLE_NAME="${LAMBDA_ROLE_NAME:-margiela-sns-to-slack-role}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAMBDA_SRC="$SCRIPT_DIR/sns-to-slack"

export AWS_PROFILE AWS_REGION

if [[ -z "$SLACK_WEBHOOK_URL" ]]; then
  echo "Set SLACK_WEBHOOK_URL (Slack Incoming Webhook)."
  echo "  Slack: channel → Add apps → Incoming Webhooks → Add to Slack → copy Webhook URL"
  echo "Usage: SLACK_WEBHOOK_URL=https://hooks.slack.com/services/... $0"
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
TOPIC_ARN="arn:aws:sns:${AWS_REGION}:${ACCOUNT_ID}:${TOPIC_NAME}"

echo "=== 1. IAM role for Lambda (if not exists) ==="
ROLE_ARN=$(aws iam get-role --role-name "$LAMBDA_ROLE_NAME" --query 'Role.Arn' --output text 2>/dev/null || true)
if [[ -z "$ROLE_ARN" ]]; then
  aws iam create-role \
    --role-name "$LAMBDA_ROLE_NAME" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    --output text
  aws iam attach-role-policy --role-name "$LAMBDA_ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  echo "Waiting for role to be usable..."
  sleep 10
  ROLE_ARN=$(aws iam get-role --role-name "$LAMBDA_ROLE_NAME" --query 'Role.Arn' --output text)
fi
echo "Role: $ROLE_ARN"

echo "=== 2. Package and deploy Lambda ==="
ZIP_FILE=$(mktemp -t margiela-slack-lambda.XXXXXX.zip)
trap 'rm -f "$ZIP_FILE"' EXIT
cd "$LAMBDA_SRC"
zip -q -j "$ZIP_FILE" index.js

FUNC_ARN=$(aws lambda get-function --function-name "$LAMBDA_NAME" --query 'Configuration.FunctionArn' --output text 2>/dev/null || true)
if [[ -z "$FUNC_ARN" ]]; then
  FUNC_ARN=$(aws lambda create-function \
    --function-name "$LAMBDA_NAME" \
    --runtime nodejs20.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --zip-file "fileb://$ZIP_FILE" \
    --environment "Variables={SLACK_WEBHOOK_URL=$SLACK_WEBHOOK_URL}" \
    --timeout 10 \
    --region "$AWS_REGION" \
    --query 'FunctionArn' --output text)
  echo "Created Lambda: $FUNC_ARN"
else
  aws lambda update-function-code --function-name "$LAMBDA_NAME" --zip-file "fileb://$ZIP_FILE" --region "$AWS_REGION" --output text
  aws lambda update-function-configuration --function-name "$LAMBDA_NAME" --environment "Variables={SLACK_WEBHOOK_URL=$SLACK_WEBHOOK_URL}" --region "$AWS_REGION" --output text
  echo "Updated Lambda: $FUNC_ARN"
fi

echo "=== 3. Allow SNS to invoke Lambda ==="
aws lambda add-permission \
  --function-name "$LAMBDA_NAME" \
  --statement-id "sns-margiela-ecs-alerts" \
  --action lambda:InvokeFunction \
  --principal sns.amazonaws.com \
  --source-arn "$TOPIC_ARN" \
  --region "$AWS_REGION" 2>/dev/null || true

echo "=== 4. Subscribe Lambda to SNS topic ==="
EXISTING=$(aws sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" --region "$AWS_REGION" --query "Subscriptions[?Protocol=='lambda' && Endpoint=='$FUNC_ARN'].SubscriptionArn" --output text)
if [[ -z "$EXISTING" ]]; then
  aws sns subscribe \
    --topic-arn "$TOPIC_ARN" \
    --protocol lambda \
    --notification-endpoint "$FUNC_ARN" \
    --region "$AWS_REGION" \
    --output text
  echo "Subscribed Lambda to $TOPIC_NAME"
else
  echo "Lambda already subscribed to topic."
fi

echo ""
echo "Done. ECS down/up alerts will be posted to Slack. Test by triggering the alarm or wait for next event."
