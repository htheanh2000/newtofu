# Test Lambda PDF local với Docker

Có **Docker Lambda** sẵn để test: image dùng base `public.ecr.aws/lambda/nodejs:20`, expose port 8080 (Runtime Interface). Chạy Lambda container (giống production) trên máy để test generate PDF.

**Test một lệnh:** `./scripts/test-docker-lambda.sh [compositionId]` — build, up, invoke, down.

## 1. Tạo `.env` trong `margiela-pdf/`

```bash
cd margiela-pdf
cp .env.example .env
# Chỉnh .env:
# APP_URL=https://springsummer2026margiela.com
# (Hoặc FE local: APP_URL=http://host.docker.internal:3000)
```

## 2. Build và chạy container

```bash
docker compose -f docker-compose.lambda.yml build
docker compose -f docker-compose.lambda.yml up
```

Container listen **port 8080** (Lambda Runtime Interface). Đợi log kiểu "Lambda Runtime listening...".

## 3. Gọi generate (terminal khác)

```bash
# Script (cần jq)
chmod +x scripts/invoke-local-lambda.sh
./scripts/invoke-local-lambda.sh 1773125212941-g6ha5mgrf en
```

Hoặc curl trực tiếp (payload format 2.0):

```bash
curl -s -X POST http://localhost:8080/2015-03-31/functions/function/invocations \
  -H "Content-Type: application/json" \
  -d '{"version":"2.0","rawPath":"/generate/1773125212941-g6ha5mgrf","requestContext":{"http":{"method":"POST","path":"/generate/1773125212941-g6ha5mgrf"}},"body":"{\"locale\":\"en\"}","isBase64Encoded":false}' \
  --max-time 120
```

Response qua RIC: `{"statusCode":200,"body":"...",...}`. Lỗi thì `statusCode` 500, `body` có message.

## 4. Dừng

```bash
docker compose -f docker-compose.lambda.yml down
```
