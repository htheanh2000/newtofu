# Điều tra E2E API failed mỗi ngày (EventBridge)

## Tóm tắt

- **Triệu chứng:** Slack báo `[E2E-Margiela] ❌ E2E FAILED` mỗi ngày, bước `POST /api/submit: 500`
- **Nguyên nhân:** Neon DB suspend (5 phút idle) → ECS không kết nối được → 500
- **Vì sao user vẫn dùng bình thường:** User dùng ban ngày → DB đã wake. E2E chạy 8am HKT = request đầu tiên sau đêm → DB đang suspend.

---

## 1. Luồng EventBridge → Lambda → FE → Neon

```
EventBridge (cron 0 0 * * ? *)  →  0:00 UTC = 8:00 HKT mỗi ngày
        ↓
Lambda margiela-e2e-daily (ap-east-1)
        ↓
POST /api/submit → FE (ECS ap-southeast-1)
        ↓
saveSessionToDb() → Prisma → Neon PostgreSQL
        ↓
Neon suspend (5 phút không dùng) → "Can't reach database server"
```

---

## 2. Bằng chứng từ CloudWatch

### ECS logs (/ecs/margiela-fe, ap-southeast-1)

```
prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }

Invalid `prisma.composition.create()` invocation:
Can't reach database server at `ep-round-smoke-a139gnlb-pooler.ap-southeast-1.aws.neon.tech:5432`
Please make sure your database server is running at ...

Failed to save to Neon DB: Error [PrismaClientKnownRequestError]
code: 'P1001'
```

### Lambda metrics (ap-east-1)

- **Invocations:** 1–2/ngày (đúng schedule)
- **Errors:** 0 (Lambda không crash; nó nhận 500 từ API và báo Slack)

### EventBridge rule

- **Name:** `margiela-e2e-daily-8am-hkt`
- **Schedule:** `cron(0 0 * * ? *)` = 0:00 UTC = 8:00 HKT
- **State:** ENABLED

### Lambda log group

- `/aws/lambda/margiela-e2e-daily` **không tồn tại** trong ap-east-1 (có thể chưa tạo hoặc khác cấu hình)

---

## 3. Thời điểm lỗi

| Thời điểm | Neon DB | Kết quả |
|-----------|---------|---------|
| 8:00 HKT (0:00 UTC) | Thường đang suspend | POST /api/submit → 500 |
| Ban ngày (user dùng) | Đã wake | OK |
| Gọi Lambda thủ công (khi DB active) | Đang chạy | Tất cả 7 bước pass |

---

## 4. Giải pháp đề xuất

### Option A: Warm Neon trước E2E (khuyến nghị)

Thêm EventBridge rule chạy **7:55 HKT** (23:55 UTC ngày trước) để gọi API “đánh thức” Neon trước khi E2E chạy lúc 8:00.

1. **Tạo endpoint warm:** `GET /api/health` hoặc dùng sẵn `GET /api/device/register` (có truy vấn DB).
2. **EventBridge rule mới:** `cron(55 23 * * ? *)` = 23:55 UTC = 7:55 HKT.
3. **Target:** Lambda nhỏ gọi `GET https://www.springsummer2026margiela.com/api/device/register` với header `X-E2E-Cron: margiela-daily`.

### Option B: Cron ping Neon mỗi 3–4 phút

EventBridge rule gọi Lambda mỗi 3–4 phút để ping API (chạm DB). Tốn tài nguyên hơn Option A.

### Option C: Upgrade Neon plan

Neon paid plan cho phép tắt scale-to-zero → DB luôn chạy, không cần warm.

---

## 5. Lệnh kiểm tra nhanh

```bash
# Gọi E2E Lambda thủ công (khi DB active → thường pass)
aws lambda invoke --function-name margiela-e2e-daily --region ap-east-1 --payload '{}' out.json && cat out.json | jq .

# Xem ECS logs lỗi Neon
aws logs filter-log-events \
  --log-group-name /ecs/margiela-fe \
  --start-time $(($(date +%s) - 86400))000 \
  --filter-pattern "database" \
  --region ap-southeast-1

# Lambda metrics 7 ngày
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=margiela-e2e-daily \
  --start-time $(date -u -v-7d +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 --statistics Sum \
  --region ap-east-1
```
