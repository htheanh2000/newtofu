# Deploy margiela-admin lên S3 và subdomain (admin.springsummer2026margiela.com)

**Admin chỉ dùng S3 (static website), không dùng ECS.**  
Admin là static site (Next.js `output: 'export'`), build ra thư mục `out/`. Host trên S3 (static website hoặc S3 + CloudFront) và trỏ subdomain **admin.springsummer2026margiela.com** về bucket.

## 1. Cấu hình env trước khi build

Admin dùng **Neon Data API + Neon Auth** (không gọi margiela-fe). Trong `margiela-admin/.env` (không commit):

```env
NEXT_PUBLIC_NEON_DATA_API_URL=https://your-ep.apirest.region.aws.neon.tech/neondb
NEXT_PUBLIC_NEON_AUTH_URL=https://your-ep.neonauth.region.aws.neon.tech/neondb/auth
```

Chi tiết bật Data API, Neon Auth và quyền RLS: **[neon-data-api-setup.md](./neon-data-api-setup.md)**.

## 2. Build

```bash
cd margiela-admin
npm install
npm run build
```

Sau khi build xong, toàn bộ file static nằm trong `out/`.

## 3. Tạo S3 bucket và upload

- **Bucket name**: ví dụ `admin-springsummer2026margiela` (globally unique).
- **Region**: ví dụ `ap-southeast-1`.
- **Block public access**: tắt (nếu dùng S3 static website) HOẶC giữ bật và chỉ cho CloudFront truy cập (khuyến nghị).

### Cách A: S3 Static Website (đơn giản)

1. Tạo bucket → Properties → Static website hosting: Enable, index document `index.html`, error document `404.html` (Next export thường có `404.html`).
2. Permissions → Bucket policy: cho phép `s3:GetObject` public (chỉ nếu bucket chỉ chứa admin và bạn chấp nhận truy cập qua URL S3).
3. Upload nội dung thư mục `out/` lên bucket (giữ cấu trúc thư mục):

```bash
aws s3 sync out/ s3://BUCKET_NAME/ --delete
```

4. S3 Static website URL sẽ dạng: `http://BUCKET_NAME.s3-website-REGION.amazonaws.com`. Có thể dùng URL này để test.

### Cách B: S3 + CloudFront (khuyến nghị, dùng HTTPS + subdomain)

1. Tạo bucket, **không** bật static website, **không** cần public bucket policy.
2. Upload:

```bash
aws s3 sync out/ s3://BUCKET_NAME/ --delete
```

3. Tạo **CloudFront distribution**:
   - Origin: S3 bucket (chọn bucket vừa tạo). Nếu dùng Origin Access Control (OAC), tạo OAC và gắn cho origin, sau đó copy policy gợi ý vào S3 bucket policy.
   - Default root object: `index.html`.
   - Error pages: thêm 403 → 200, response page path `/index.html` (để SPA routing hoạt động khi user vào `/users/` hoặc `/compositions/` trực tiếp).
   - Alternate domain names (CNAMEs): `admin.springsummer2026margiela.com`.
   - SSL certificate: Request hoặc import certificate cho `admin.springsummer2026margiela.com` (ACM, region us-east-1 cho CloudFront).

4. DNS (domain springsummer2026margiela.com): tạo CNAME:
   - Tên: `admin`.
   - Giá trị: domain CloudFront (vd `d1234abcd.cloudfront.net`).

Sau vài phút, truy cập `https://admin.springsummer2026margiela.com` sẽ load admin. Đăng nhập bằng **email + password** đã tạo trong Neon Auth (xem [neon-data-api-setup.md](./neon-data-api-setup.md)).

**Nối subdomain:**  
- **Cloudflare (khuyến nghị):** dùng script `scripts/cloudflare-admin-subdomain.sh` trong repo gốc, cần `CLOUDFLARE_API_TOKEN` + `ZONE_ID`. Xem **[cloudflare-subdomain.md](./cloudflare-subdomain.md)**.  
- **AWS CloudFront:** certificate ACM đã tạo; nếu tài khoản đã verify thì tạo distribution. Chi tiết: **[subdomain-dns-setup.md](./subdomain-dns-setup.md)**.

## 4. Bảo vệ thêm (tùy chọn)

- **Cloudflare** (nếu dùng cho claudelare): có thể bật WAF, chỉ cho IP văn phòng truy cập, hoặc dùng Cloudflare Access (login bằng email/SSO) trước khi tới S3/CloudFront.

## Tóm tắt

| Bước | Hành động |
|------|-----------|
| 1 | Set `NEXT_PUBLIC_API_URL` trong margiela-admin, build `npm run build` |
| 2 | Tạo S3 bucket, upload `out/` (sync với `--delete`) |
| 3 | Tạo CloudFront distribution trỏ origin tới bucket, cấu hình 403→200 cho SPA |
| 4 | Thêm CNAME `admin.springsummer2026margiela.com` → CloudFront, gắn SSL |
| 5 | Vào https://admin.springsummer2026margiela.com, đăng nhập bằng email/password (Neon Auth) |
