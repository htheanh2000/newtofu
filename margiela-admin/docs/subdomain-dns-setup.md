# Nối subdomain admin.springsummer2026margiela.com

Certificate ACM đã được tạo. Cần: (1) xác minh tài khoản AWS nếu bị chặn CloudFront, (2) tạo CloudFront distribution, (3) thêm 2 bản ghi DNS.

---

## 1. Certificate ACM (đã tạo)

- **ARN:** `arn:aws:acm:us-east-1:767397883673:certificate/dac6606e-66c1-4d27-b964-522db9315568`
- **Region:** us-east-1 (bắt buộc cho CloudFront)

### DNS validation – thêm 1 bản ghi CNAME

Trong DNS của domain **springsummer2026margiela.com** (Cloudflare / Route 53 / nhà đăng ký khác), thêm:

| Type | Name | Value / Target |
|------|------|----------------|
| CNAME | `_831e78388618f431233b5b6d9c9a74b2.admin` | `_220c2115d7851aae6c455db0ebd3804b.jkddzztszm.acm-validations.aws.` |

- **Name:** có thể cần nhập đủ `_831e78388618f431233b5b6d9c9a74b2.admin.springsummer2026margiela.com` hoặc chỉ `_831e78388618f431233b5b6d9c9a74b2.admin` tùy nhà cung cấp DNS (một số tự thêm domain gốc).
- **Value:** `_220c2115d7851aae6c455db0ebd3804b.jkddzztszm.acm-validations.aws.` (có dấu chấm cuối hoặc không tùy hệ thống).

Sau 5–30 phút, certificate chuyển sang **Issued**. Giữ bản ghi này cho đến khi cert đã Issued.

---

## 2. Tạo CloudFront distribution (Console)

Nếu CLI báo *"Your account must be verified"* → dùng AWS Console.

1. Vào **CloudFront** (region bất kỳ): https://console.aws.amazon.com/cloudfront/
2. **Create distribution**
3. **Origin:**
   - **Origin domain:** chọn **S3 website endpoint** hoặc nhập:  
     `admin-springsummer2026margiela.s3-website-ap-southeast-1.amazonaws.com`  
     (không chọn bucket dạng `admin-springsummer2026margiela.s3.amazonaws.com`)
   - **Name:** để mặc định hoặc `S3-admin-springsummer2026margiela`
   - **Protocol:** HTTP only (S3 website chỉ HTTP)
4. **Default cache behavior:** giữ mặc định, **Viewer protocol policy:** Redirect HTTP to HTTPS.
5. **Settings:**
   - **Alternate domain names (CNAMEs):** `admin.springsummer2026margiela.com`
   - **Custom SSL certificate:** chọn certificate đã tạo ở us-east-1 (admin.springsummer2026margiela.com).
   - **Default root object:** `index.html`
6. **Error pages (Custom error responses):** thêm 2 mục:
   - **403:** Response page path `/index.html`, HTTP response code `200`
   - **404:** Response page path `/index.html`, HTTP response code `200`
7. **Create distribution** → đợi Status **Enabled**, copy **Distribution domain name** (vd `d1234xxxxx.cloudfront.net`).

---

## 3. DNS – trỏ subdomain vào CloudFront

Trong DNS của **springsummer2026margiela.com**, thêm:

| Type | Name | Value / Target |
|------|------|----------------|
| CNAME | `admin` | `<Distribution domain name>`, ví dụ `d1234xxxxx.cloudfront.net` |

- **Name:** `admin` (sẽ thành admin.springsummer2026margiela.com).
- **Target:** domain CloudFront vừa copy, không dùng `https://`, chỉ tên domain.

Nếu dùng **Cloudflare** cho springsummer2026margiela.com: thêm CNAME `admin` → `xxxx.cloudfront.net`, **Proxy status** nên để **DNS only** (màu xám) để CloudFront và certificate hoạt động ổn định.

---

## 4. Kiểm tra

- Đợi certificate **Issued** và distribution **Enabled**.
- Đợi DNS propagate (vài phút đến vài giờ).
- Mở: **https://admin.springsummer2026margiela.com**
- Đăng nhập: username `margiela`, password `springsummer2026margiela@`

---

## Tóm tắt bản ghi DNS cần thêm

| Mục đích | Type | Name | Target |
|----------|------|------|--------|
| Validate SSL (ACM) | CNAME | `_831e78388618f431233b5b6d9c9a74b2.admin` | `_220c2115d7851aae6c455db0ebd3804b.jkddzztszm.acm-validations.aws.` |
| Subdomain admin | CNAME | `admin` | `<CloudFront distribution domain>` |
