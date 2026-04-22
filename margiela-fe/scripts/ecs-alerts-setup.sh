#!/usr/bin/env bash
# Set up CloudWatch alarm + SNS so you get email when ECS service is DOWN (0 tasks) or back UP.
# Usage: ./scripts/ecs-alerts-setup.sh [email]
#   Or:  ALERT_EMAIL=you@example.com ./scripts/ecs-alerts-setup.sh
# After first run: confirm the SNS subscription in the email, then alarms are active.

set -e

AWS_REGION="${AWS_REGION:-ap-southeast-1}"
AWS_PROFILE="${AWS_PROFILE:-newtofu}"
CLUSTER="${ECS_CLUSTER:-margiela-cluster}"
SERVICE="${ECS_SERVICE:-margiela-fe-service}"
TOPIC_NAME="${SNS_TOPIC_NAME:-margiela-ecs-alerts}"
ALARM_NAME="${CLOUDWATCH_ALARM_NAME:-margiela-fe-service-down}"

export AWS_PROFILE AWS_REGION

EMAIL="${1:-$ALERT_EMAIL}"
if [[ -z "$EMAIL" ]]; then
  echo "Usage: $0 <email>"
  echo "   Or: ALERT_EMAIL=you@example.com $0"
  echo "Email will receive alerts when service has 0 running tasks (DOWN) and when it recovers (UP)."
  exit 1
fi

echo "=== 1. Create SNS topic (if not exists) ==="
TOPIC_ARN=$(aws sns list-topics --region "$AWS_REGION" --query "Topics[?contains(TopicArn, \`$TOPIC_NAME\`)].TopicArn" --output text)
if [[ -z "$TOPIC_ARN" ]]; then
  TOPIC_ARN=$(aws sns create-topic --name "$TOPIC_NAME" --region "$AWS_REGION" --query 'TopicArn' --output text)
  echo "Created topic: $TOPIC_ARN"
else
  echo "Using topic: $TOPIC_ARN"
fi

echo "=== 2. Subscribe email to topic (confirm in inbox) ==="
SUBS=$(aws sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" --region "$AWS_REGION" --query "Subscriptions[?Protocol=='email' && Endpoint=='$EMAIL'].SubscriptionArn" --output text)
if [[ -z "$SUBS" || "$SUBS" == "PendingConfirmation" ]]; then
  aws sns subscribe \
    --topic-arn "$TOPIC_ARN" \
    --protocol email \
    --notification-endpoint "$EMAIL" \
    --region "$AWS_REGION" \
    --output text
  echo "Subscription sent. Check inbox for $EMAIL and click the confirmation link."
else
  echo "Email already subscribed (or pending confirmation)."
fi

echo "=== 3. Create CloudWatch alarm: service DOWN (0 running tasks) ==="
aws cloudwatch put-metric-alarm \
  --alarm-name "$ALARM_NAME" \
  --alarm-description "ECS service $SERVICE has no running tasks" \
  --namespace AWS/ECS \
  --metric-name RunningTaskCount \
  --dimensions Name=ClusterName,Value="$CLUSTER" Name=ServiceName,Value="$SERVICE" \
  --statistic Average \
  --period 60 \
  --evaluation-periods 2 \
  --threshold 1 \
  --comparison-operator LessThanThreshold \
  --alarm-actions "$TOPIC_ARN" \
  --ok-actions "$TOPIC_ARN" \
  --region "$AWS_REGION" \
  --output text

echo ""
echo "Done. You will get email when:"
echo "  - Service DOWN: RunningTaskCount < 1 for 2 minutes"
echo "  - Service UP:   when tasks are back (OK state)"
echo "Confirm SNS subscription in your email, then check:"
echo "  https://$AWS_REGION.console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#alarmsV2:alarm/$ALARM_NAME"
