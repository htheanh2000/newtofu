# AWS Lambda – margiela-pdf

## Function URL (đã tạo lại 2026-03-10)

- **URL:** `https://v42svjp2rnfuvkhuaatp2z4oxm0ouluo.lambda-url.ap-southeast-1.on.aws/`
- **Auth:** NONE (public)
- **CORS:** GET, POST; origins `*`
- **Function:** `margiela-pdf` (region `ap-southeast-1`, account newtofu)

## Health check

```bash
curl "https://v42svjp2rnfuvkhuaatp2z4oxm0ouluo.lambda-url.ap-southeast-1.on.aws/health"
# → {"status":"ok","service":"margiela-pdf"}
```

Nếu trả 403, đợi 1–2 phút cho policy propagate rồi thử lại.

## Generate PDF (FE → Lambda)

Frontend gọi `POST /api/generate-pdf/[id]` → Next.js route gọi Lambda:

- **Base URL (env):** `PDF_SERVICE_URL` (server-side) hoặc `NEXT_PUBLIC_PDF_SERVICE_URL`
- **Endpoint:** `POST {PDF_SERVICE_URL}/generate/{compositionId}` body `{ "locale": "en" | "zh" }`

Để FE dùng Lambda, set trên ECS (hoặc .env):

```bash
PDF_SERVICE_URL=https://v42svjp2rnfuvkhuaatp2z4oxm0ouluo.lambda-url.ap-southeast-1.on.aws
```

## Biến môi trường Lambda

**Nên set S3_BUCKET** để PDF không mất khi Lambda recycle (xem mục "Mất file PDF" bên dưới). FE nhận pdfUrl từ Lambda và cập nhật vào DB.

```bash
aws lambda update-function-configuration --function-name margiela-pdf \
  --environment "Variables={APP_URL=https://springsummer2026margiela.com,PUBLIC_URL=...,S3_BUCKET=margiela-pdfs,S3_PREFIX=pdfs/,S3_PRESIGNED_EXPIRY_SECONDS=604800}" \
  --region ap-southeast-1
```

- **S3_BUCKET** (khuyến nghị): bucket để upload PDF. Khi set, sau khi generate sẽ upload lên S3 và trả URL cho FE → FE cập nhật pdfUrl vào DB.
- **S3_PREFIX**: prefix key (mặc định `pdfs/`).
- **S3_PRESIGNED_EXPIRY_SECONDS**: thời hạn presigned URL (mặc định 604800 = 7 ngày). Chỉ dùng khi không set `S3_PUBLIC_BASE_URL`.
- **S3_PUBLIC_BASE_URL** (khuyến nghị nếu presigned lỗi): dùng URL công khai ngắn thay vì presigned. Ví dụ: `https://margiela-pdfs.s3.ap-southeast-1.amazonaws.com`. Cần set **bucket policy** cho phép public read trên `pdfs/*` (xem `scripts/s3-bucket-public-read-policy.json`). Link không hết hạn.
- **S3_DISABLE_CHECKSUM**: set `1` nếu presigned URL trả **AuthorizationQueryParametersError** (X-Amz-Algorithm...) khi mở trong browser.
- Role Lambda cần quyền **s3:PutObject**, **s3:GetObject** trên bucket đó.
- **Bật public read cho pdfs/ (khi dùng S3_PUBLIC_BASE_URL):** S3 → bucket **margiela-pdfs** → Permissions → Bucket policy → Edit, dán nội dung từ `margiela-pdf/scripts/s3-bucket-public-read-policy.json`. Sau đó set Lambda env `S3_PUBLIC_BASE_URL=https://margiela-pdfs.s3.ap-southeast-1.amazonaws.com` (không có trailing slash).
  - **Cách 1 (admin làm một lần):** Admin vào IAM → Roles → **LambdaS3ReadRole** → Permissions → Add permissions → Create inline policy → JSON, dán nội dung từ `margiela-pdf/scripts/lambda-s3-policy.json` → đặt tên (vd. MargielaPdfS3Access) → Create.
  - **Cách 2 (cấp quyền để user tự gắn):** Admin tạo custom policy cho user như mục [Cấp quyền PutRolePolicy cho user](#cấp-quyền-putrolepolicy-cho-user) bên dưới; sau đó user chạy: `aws iam put-role-policy --role-name LambdaS3ReadRole --policy-name MargielaPdfS3Access --policy-document file://margiela-pdf/scripts/lambda-s3-policy.json`

### Cấp quyền PutRolePolicy cho user (Cách 2)

Để user có thể tự gắn inline policy lên role `LambdaS3ReadRole`, admin làm:

1. **IAM** → **Policies** → **Create policy**.
2. Tab **JSON**: xóa nội dung mặc định, dán nội dung từ `margiela-pdf/scripts/allow-put-role-policy-for-user.json` (hoặc dán đoạn dưới).
3. **Next** → Đặt tên policy, ví dụ: `AllowPutRolePolicyLambdaS3ReadRole` → **Create policy**.
4. **IAM** → **Users** → chọn user cần cấp quyền → **Add permissions** → **Attach policies directly** → tìm và chọn `AllowPutRolePolicyLambdaS3ReadRole` → **Add permissions**.

JSON cho bước 2:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iam:PutRolePolicy",
      "Resource": "arn:aws:iam::427901343757:role/LambdaS3ReadRole"
    }
  ]
}
```

Sau khi admin gắn xong, user chạy (từ repo, profile newtofu):

```bash
aws iam put-role-policy --role-name LambdaS3ReadRole --policy-name MargielaPdfS3Access --policy-document file://margiela-pdf/scripts/lambda-s3-policy.json
```

**Deploy:** Dùng zip → S3 → Lambda (script `scripts/deploy-lambda.sh`). Không dùng ECR/container image.

---

## Mất file PDF (Lambda /tmp)

Trên Lambda, PDF từng được lưu vào `/tmp/pdfs`. Khi execution context bị recycle (scale down, idle), **/tmp bị xóa** → file mất → URL trỏ Lambda sẽ **404**.

**Đã xử lý (hướng 1 – S3):** Khi set **S3_BUCKET**, service sẽ upload PDF lên S3 sau khi generate và trả URL cho FE. FE cập nhật pdfUrl vào DB. Link tồn tại trong thời hạn presigned (mặc định 7 ngày), file không phụ thuộc Lambda instance.

- Nếu **không** set S3_BUCKET: hành vi cũ (ghi /tmp, URL trỏ Lambda /pdfs/) → link có thể 404 sau khi Lambda recycle.
- **Cách 2 (không lưu file):** Chỉ dùng GET `/pdf/:id` khi user tải: mỗi lần generate lại và trả buffer → link không chết nhưng chậm và tốn tài nguyên.

---

## Tạo lại Lambda (deploy zip – cách cũ)

1. **S3:** Bucket `margiela-pdf-deploy-aps1` (ap-southeast-1), upload zip từ `margiela-pdf` (npm install --omit=dev, zip index.js lambda.js package.json node_modules).
2. **create-function:** Runtime nodejs20.x, handler `lambda.handler`, role `LambdaS3ReadRole`, code từ S3, timeout 60, memory 512.
3. **create-function-url-config:** auth-type NONE, CORS tùy chọn.
4. **add-permission:** `lambda:InvokeFunctionUrl`, principal `*`, condition `function-url-auth-type NONE`.
5. Test: `curl "<FunctionUrl>/health"`.
