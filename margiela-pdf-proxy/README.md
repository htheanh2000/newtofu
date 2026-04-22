# margiela-pdf-proxy (Cloudflare Worker)

Worker reverse proxy: user tải PDF qua domain của bạn, Worker lặng lẽ lấy file từ S3. Free plan 100,000 request/ngày.

## Deploy

```bash
cd margiela-pdf-proxy
npm install
```

1. **Cấu hình `wrangler.toml`** (hoặc env):
   - `S3_BUCKET`: bucket chứa PDF (trùng với margiela-pdf)
   - `S3_PREFIX`: prefix trong bucket (mặc định `pdfs/`, trùng margiela-pdf)
   - `AWS_REGION`: ví dụ `ap-southeast-1`

2. **Secrets (bucket private):**
   ```bash
   npx wrangler secret put AWS_ACCESS_KEY_ID
   npx wrangler secret put AWS_SECRET_ACCESS_KEY
   ```
   IAM user cần quyền `s3:GetObject` trên bucket (và prefix).

   Nếu bucket **public read** cho prefix PDF, không cần secrets.

3. **Deploy:**
   ```bash
   npx wrangler deploy
   ```

4. **Frontend (margiela-fe):** thêm env:
   ```env
   PDF_PROXY_BASE_URL=https://margiela-pdf-proxy.<your-subdomain>.workers.dev
   ```
   Hoặc custom domain (Cloudflare Dashboard → Workers → Add route / Custom domain).

## URL

- User nhận link dạng: `https://your-proxy/pdfs/{compositionId}_{timestamp}.pdf`
- Worker map thành S3 key: `{S3_PREFIX}{filename}` và stream PDF.
