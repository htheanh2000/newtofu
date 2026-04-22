# ECS service alerts (down / up)

Nhận thông báo khi ECS service **không còn task nào chạy** (DOWN) và khi **trở lại bình thường** (UP). Hỗ trợ **email** (SNS) và **Slack** (webhook hoặc AWS Chatbot).

## Cách chạy

Từ thư mục `margiela-fe`:

```bash
./scripts/ecs-alerts-setup.sh your-email@example.com
```

Hoặc dùng biến môi trường:

```bash
ALERT_EMAIL=your-email@example.com ./scripts/ecs-alerts-setup.sh
```

## Sau khi chạy

1. **Xác nhận subscription:** Kiểm tra hộp thư (và spam), bấm link xác nhận trong email từ AWS SNS. Chỉ sau bước này alarm mới gửi được mail.
2. **Alarm đã tạo:** CloudWatch alarm `margiela-fe-service-down`:
   - **DOWN:** Số task chạy &lt; 1 trong 2 phút liên tục → gửi email (trạng thái ALARM).
   - **UP:** Số task ≥ 1 trở lại → gửi email (trạng thái OK).

## Gửi alert sang Slack

Hai cách (có thể dùng cùng lúc với email):

### Cách 1: Slack Incoming Webhook (Lambda)

1. Tạo webhook trong Slack: vào channel → **Add apps** → **Incoming Webhooks** → **Add to Slack** → copy **Webhook URL**.
2. Chạy (sau khi đã chạy `ecs-alerts-setup.sh`):

   ```bash
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00/B00/xxx ./scripts/ecs-alerts-add-slack.sh
   ```

Script sẽ tạo Lambda `margiela-ecs-alerts-to-slack`, subscribe vào SNS topic; mỗi khi alarm đổi trạng thái (DOWN/UP) Lambda nhận SNS và gửi message vào Slack (🔴 ALARM / 🟢 OK).

### Cách 2: AWS Chatbot (không cần code)

1. AWS Console → **AWS Chatbot** → **Configure Slack** (hoặc Configure new client).
2. Kết nối Slack workspace (authorize), chọn channel (ví dụ `#alerts`).
3. Trong channel config → **Add notification** → chọn **SNS** → chọn topic `margiela-ecs-alerts`.
4. Save. Mọi thông báo từ topic (email + alarm) sẽ xuất hiện trong channel đó.

## Tùy chọn

- **Region / cluster / service:** Mặc định `ap-southeast-1`, `margiela-cluster`, `margiela-fe-service`. Ghi đè bằng `AWS_REGION`, `ECS_CLUSTER`, `ECS_SERVICE`.
- **Tên topic / alarm:** `SNS_TOPIC_NAME=margiela-ecs-alerts`, `CLOUDWATCH_ALARM_NAME=margiela-fe-service-down`.

## Thêm cảnh báo ALB (target group unhealthy)

Nếu muốn cảnh báo khi ALB đánh dấu target group unhealthy (ví dụ health check fail):

1. Lấy ARN target group:
   ```bash
   aws elbv2 describe-target-groups --names margiela-fe-tg --region ap-southeast-1 --query 'TargetGroups[0].TargetGroupArn' --output text
   ```
2. Trong CloudWatch → Create alarm:
   - Metric: **ApplicationELB** → **UnHealthyHostCount**
   - Dimensions: chọn Load Balancer và Target Group tương ứng
   - Threshold: GreaterThan 0 trong 2–3 period (mỗi period 60s)
   - Action: chọn cùng SNS topic `margiela-ecs-alerts`

## Xem alarm

- Console: CloudWatch → Alarms → `margiela-fe-service-down`
- CLI: `aws cloudwatch describe-alarms --alarm-names margiela-fe-service-down --region ap-southeast-1`
