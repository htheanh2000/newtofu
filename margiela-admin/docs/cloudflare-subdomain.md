# Subdomain admin bằng Cloudflare (CLI/API)

## Cách 1: flarectl (CLI)

Nếu đã cài [flarectl](https://github.com/cloudflare/cloudflare-go/tree/master/cmd/flarectl):

```bash
export CF_API_TOKEN="your-token"
flarectl dns create --zone="springsummer2026margiela.com" \
  --name="admin" \
  --type="CNAME" \
  --content="admin-springsummer2026margiela.s3-website-ap-southeast-1.amazonaws.com" \
  --proxy
```

Token: [Create Token](https://dash.cloudflare.com/profile/api-tokens) → Edit zone DNS template (Zone - DNS - Edit).

---

## Cách 2: Script curl (repo)

Dùng script trong repo gốc để thêm/cập nhật CNAME qua Cloudflare API.

### Credential

Cùng credential với script WAF (`scripts/cloudflare-block-singapore.sh`):

- **CLOUDFLARE_API_TOKEN** (hoặc CF_API_TOKEN): token có quyền **Zone › DNS › Edit**
- **ZONE_ID**: zone của domain **springsummer2026margiela.com** (Dashboard → domain → Overview, bên phải)

Đặt trong env hoặc file **`.credentials-local`** ở thư mục gốc repo (không commit):

```bash
CLOUDFLARE_API_TOKEN=your-token
ZONE_ID=your-zone-id
```

## 2. Chạy script

Từ thư mục gốc repo margiela:

```bash
./scripts/cloudflare-admin-subdomain.sh
```

Script sẽ:

- Nếu chưa có: **tạo** CNAME `admin` → `admin-springsummer2026margiela.s3-website-ap-southeast-1.amazonaws.com`, **proxied = true**
- Nếu đã có: **cập nhật** bản ghi đó

## 3. SSL

Cloudflare **Flexible**: HTTPS giữa user ↔ Cloudflare, HTTP giữa Cloudflare ↔ S3. Không cần certificate trên S3.

Nếu muốn Full (strict): origin S3 website chỉ HTTP, nên giữ Flexible hoặc dùng CloudFront + ACM cho origin.

## 4. Fix 404: Origin Rule (Host header)

Khi proxy qua Cloudflare, S3 website nhận **Host: admin.springsummer2026margiela.com** nên trả 404. Cần ghi đè Host header gửi tới origin thành hostname S3 website.

**Cách làm (Dashboard):**

1. Vào [Cloudflare Dashboard](https://dash.cloudflare.com) → zone **springsummer2026margiela.com**.
2. **Rules** → **Origin Rules** → **Create rule**.
3. **When incoming requests match:** chọn **Custom filter** (Expression Editor), nhập:
   ```txt
   (http.host eq "admin.springsummer2026margiela.com")
   ```
4. **Then the settings are:** bật **Override Host header** → **Rewrite to:**
   ```txt
   admin-springsummer2026margiela.s3-website-ap-southeast-1.amazonaws.com
   ```
5. **Deploy**.

Sau vài giây, mở lại https://admin.springsummer2026margiela.com sẽ load đúng.

## 5. Kiểm tra

- Mở **https://admin.springsummer2026margiela.com**
- Đăng nhập bằng **email + password** đã tạo trong Neon Auth (xem [neon-data-api-setup.md](./neon-data-api-setup.md))
