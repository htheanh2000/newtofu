# Deploy margiela-admin lên S3

## 1. Chuẩn bị

- Cài [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) và chạy `aws configure`.
- Tạo S3 bucket (ví dụ: `margiela-admin-prod`).

## 2. Cấu hình bucket (Static website hosting)

1. Vào **S3** → chọn bucket → **Properties**.
2. **Static website hosting** → Edit → Enable.
3. **Index document**: `index.html`  
   **Error document** (optional): `404.html` hoặc `index.html` (SPA fallback).

## 3. Cho phép public đọc (nếu dùng S3 website URL)

- **Permissions** → **Bucket policy** (hoặc dùng CloudFront thì không cần public bucket).

Ví dụ bucket policy (thay `BUCKET_NAME`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::BUCKET_NAME/*"
    }
  ]
}
```

Hoặc dùng **CloudFront** trỏ origin tới bucket (khuyên dùng cho HTTPS và cache).

## 4. Deploy

```bash
cd margiela-admin
export S3_BUCKET=your-bucket-name
export AWS_REGION=us-east-1
# Optional: export CLOUDFRONT_DISTRIBUTION_ID=E1234ABCD
npm run deploy:s3
```

Hoặc một dòng:

```bash
S3_BUCKET=your-bucket-name npm run deploy:s3
```

## 5. Sau khi deploy

- **S3 website URL**: `http://BUCKET.s3-website.REGION.amazonaws.com`
- Nếu dùng CloudFront: dùng URL của distribution (HTTPS).

Lưu ý: biến môi trường Neon (`NEXT_PUBLIC_NEON_*`) đã được bake vào build khi chạy `npm run build`, nên cần build trên máy hoặc CI đã có `.env` đúng.
