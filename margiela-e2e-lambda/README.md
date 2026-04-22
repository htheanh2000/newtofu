# Margiela E2E Lambda

Lambda chạy E2E kiểm tra luồng FE mỗi ngày lúc **8:00 giờ Hồng Kông** (region **ap-east-1** Hong Kong, schedule timezone Asia/Hong_Kong).

**Neon warmup:** Rule `margiela-neon-warmup-755am-hkt` chạy lúc **7:55 HKT** (23:55 UTC) để wake Neon DB trước E2E, tránh lỗi 500 do DB suspend.

## Prefix để nhận diện

- **Slack:** Mọi tin nhắn bắt đầu bằng `[E2E-Margiela]` (có thể filter trong Slack).
- **Dữ liệu:** Composition ID và email dùng prefix `e2e-daily`:
  - Composition ID: `e2e-daily-{timestamp}-{random}`
  - Email: `e2e-daily+{date}@margiela.e2e.local`

Trong DB bạn có thể lọc theo prefix `e2e-daily` để phân biệt với data thật.

## Luồng E2E (full)

1. `POST /api/submit` – gửi composition + userInfo (đúng format FE).
2. `GET /api/device/register` – lấy deviceId (nếu có whitelist).
3. `GET /api/composition/[id]` – kiểm tra sheet đã lưu.
4. `GET /en/scan/[id]` – kiểm tra trang scan trả 200.
5. `POST /api/generate-pdf/[id]` – generate PDF (Lambda → S3), DB cập nhật pdfUrl (timeout 2.5 phút).
6. `GET /api/view-sheet/[id]` – lấy link PDF (device-gated), kiểm tra có pdfUrl.
7. `GET PDF (proxy)` – gọi URL proxy PDF, kiểm tra 200 và Content-Type application/pdf.

Nếu bước nào lỗi → Slack báo FAILED; đủ 7 bước OK → Slack báo OK. Lambda timeout 180s để đủ thời gian generate PDF.

## Deploy

**ap-east-1 (Hong Kong)** là opt-in region. Lần đầu bật: `aws account enable-region --region-name ap-east-1`. Kiểm tra ENABLED: `aws account get-region-opt-status --region-name ap-east-1` (có thể mất vài phút–vài giờ).

```bash
cd margiela-e2e-lambda
./deploy.sh
```

Mặc định: **AWS_PROFILE=newtofu** (account newtofu), `BASE_URL=...`, webhook Slack đã set. Ghi đè bằng env nếu cần: `AWS_PROFILE=... BASE_URL=... ./deploy.sh`. Có thể tạo `.env` trong thư mục này để set env.

Script sẽ: đóng gói zip, tạo/update Lambda (runtime Node 20, timeout 180s), tạo **EventBridge Rule** (CloudWatch Events) chạy 0:00 UTC = **8:00 Asia/Hong_Kong** mỗi ngày. Không cần IAM role cho schedule — chỉ cần quyền EventBridge (PutRule, PutTargets); nếu có thêm `lambda:AddPermission` thì script tự gắn quyền cho EventBridge gọi Lambda.

- **Lambda role:** Nếu user không có quyền tạo IAM role → trong `.env` set `LAMBDA_ROLE_ARN=arn:aws:iam::ACCOUNT_ID:role/LambdaS3ReadRole` (role có sẵn).

## Chạy tay (test)

```bash
aws lambda invoke --function-name margiela-e2e-daily --region ap-east-1 --payload '{}' out.json && cat out.json
```

## Debug E2E failed (CloudWatch / EventBridge)

Khi E2E fail (vd. POST /api/submit 500), chạy script kiểm tra logs:

```bash
./scripts/check-e2e-logs.sh --since 48
```

Script sẽ:
- Lấy logs E2E Lambda (ap-east-1)
- Lấy logs ECS/FE (ap-southeast-1) – tìm lỗi submit, Neon, database
- Hiển thị EventBridge rule

**Nguyên nhân thường gặp:** Neon DB suspend (5 phút idle). E2E chạy 8am HKT = request đầu tiên sau đêm → DB đang suspend → 500. User dùng app ban ngày → DB đã wake → OK.

## Tạo Slack Incoming Webhook

1. Slack → App / Integrations → Incoming Webhooks → Add to Slack.
2. Chọn channel nhận thông báo E2E.
3. Copy Webhook URL → set `SLACK_WEBHOOK_URL_E2E`.
