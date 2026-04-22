#!/usr/bin/env bash
# Kiểm tra CloudWatch / EventBridge logs để debug E2E failed (POST /api/submit 500).
# Usage: ./scripts/check-e2e-logs.sh [--since 1h]
#
# Luồng: EventBridge (0:00 UTC = 8am HKT) → Lambda margiela-e2e-daily → gọi FE API
# FE (ECS) → saveSessionToDb → Neon. Lỗi 500 thường do: Neon suspend, DB connection fail.

set -e

SINCE_HOURS="${1:-24}"
if [[ "$1" == "--since" ]]; then
  SINCE_HOURS="${2:-24}"
fi

E2E_REGION="${AWS_REGION:-ap-east-1}"
FE_REGION="${AWS_REGION_FE:-ap-southeast-1}"
export AWS_PROFILE="${AWS_PROFILE:-newtofu}"

# 8am HKT = 0:00 UTC. Tính start time (ms) từ X giờ trước
START_MS=$(( $(date +%s) - (SINCE_HOURS * 3600) ))000

echo "=== 1. E2E Lambda logs (ap-east-1) - margiela-e2e-daily ==="
echo "   Log group: /aws/lambda/margiela-e2e-daily"
echo "   Start: ${SINCE_HOURS}h ago"
echo ""

aws logs filter-log-events \
  --log-group-name "/aws/lambda/margiela-e2e-daily" \
  --start-time "$START_MS" \
  --region "$E2E_REGION" \
  --query 'events[*].message' \
  --output text 2>/dev/null | tr '\t' '\n' | grep -v '^$' | tail -80 || echo "(No logs or aws not configured)"

echo ""
echo "=== 2. Tìm log group của ECS (margiela-fe) ==="
LOG_GROUP=$(aws ecs describe-task-definition \
  --task-definition margiela-fe \
  --region "$FE_REGION" \
  --query 'taskDefinition.containerDefinitions[0].logConfiguration.options."awslogs-group"' \
  --output text 2>/dev/null) || true

if [[ -n "$LOG_GROUP" && "$LOG_GROUP" != "None" ]]; then
  echo "   Log group: $LOG_GROUP"
  echo ""
  echo "=== 3. ECS/FE API logs (ap-southeast-1) - tìm submit/Neon/500 ==="
  aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time "$START_MS" \
    --filter-pattern "?submit ?Neon ?500 ?Failed ?database ?Can't" \
    --region "$FE_REGION" \
    --query 'events[*].message' \
    --output text 2>/dev/null | tr '\t' '\n' | grep -v '^$' | tail -50 || echo "(No matching events)"
  echo ""
  echo "=== 3b. ECS logs gần đây (không filter) - 50 dòng cuối ==="
  aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time "$START_MS" \
    --region "$FE_REGION" \
    --query 'events[*].message' \
    --output text 2>/dev/null | tr '\t' '\n' | grep -v '^$' | tail -50 || echo "(No events)"
else
  echo "   (Không lấy được từ task definition. Chạy thủ công để tìm log group:)"
  echo "   aws ecs describe-task-definition --task-definition margiela-fe --region $FE_REGION --query 'taskDefinition.containerDefinitions[0].logConfiguration'"
  echo "   aws logs describe-log-groups --region $FE_REGION --log-group-name-prefix /ecs --output table"
fi

echo ""
echo "=== 4. EventBridge rule (schedule) ==="
aws events describe-rule \
  --name "margiela-e2e-daily-8am-hkt" \
  --region "$E2E_REGION" 2>/dev/null | jq -r '.ScheduleExpression, .State' || echo "(Rule not found)"

echo ""
echo "=== Gợi ý ==="
echo "- POST /api/submit 500 thường do: Neon DB suspend (5 phút idle) hoặc connection timeout."
echo "- E2E chạy 8am HKT = có thể là request đầu tiên sau đêm → Neon đang suspend."
echo "- User dùng app ban ngày → DB đã wake → OK."
echo "- Giải pháp: cron ping Neon mỗi 3–4 phút, hoặc upgrade Neon plan."
