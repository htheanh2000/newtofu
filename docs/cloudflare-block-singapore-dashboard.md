# Chặn IP từ Singapore qua Cloudflare Dashboard

Hướng dẫn tạo Custom Rule trên Cloudflare để **block** traffic từ Singapore (mã quốc gia **SG**). Có thể chặn **toàn site** hoặc **chỉ một vài trang** (vd: `/scan`).

---

## Chặn chỉ một vài trang (vd: /scan)

Nếu bạn chỉ muốn chặn Singapore trên một số path (ví dụ `/scan`, `/admin`), dùng expression kết hợp **country** và **URI path** như bên dưới.

---

## Bước 1: Vào WAF Custom rules

1. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Chọn **account** và **domain** (ví dụ: `springsummer2026margiela.com`).
3. Vào **Security** → **WAF** → **Custom rules**  
   - *(Dashboard mới có thể là:* **Security** → **Security rules** *rồi chọn Custom rules.)*

---

## Bước 2: Tạo rule mới

1. Bấm **Create rule** (hoặc **Create rule** → **Custom rules** nếu có menu con).
2. **Rule name:** đặt tên dễ nhớ, ví dụ `Block Singapore`.

---

## Bước 3: Điều kiện (When incoming requests match)

Chọn **Edit expression** (hoặc dùng builder):

- **Chặn SG chỉ trên một vài trang (vd: `/scan`):**
  - Chọn **Edit expression**.
  - Chặn **chỉ** path `/scan` (và mọi path bắt đầu bằng `/scan/`):
    ```txt
    (ip.src.country eq "SG" and (http.request.uri.path eq "/scan" or http.request.uri.path wildcard "/scan/*"))
    ```
  - Chặn **nhiều path** (vd: `/scan` và `/admin`):
    ```txt
    (ip.src.country eq "SG" and (http.request.uri.path eq "/scan" or http.request.uri.path wildcard "/scan/*" or http.request.uri.path eq "/admin" or http.request.uri.path wildcard "/admin/*"))
    ```
  - Các trang khác (không match path trên) vẫn truy cập bình thường.

- **Chặn SG trên toàn site:**
  - Chọn **Edit expression**.
  - Nhập:
    ```txt
    (ip.src.country eq "SG")
    ```
  - Singapore có mã ISO 3166-1 là **SG**.

- **Builder (nếu có):** thêm hai nhóm điều kiện (Country equals SG **and** URI Path matches /scan hoặc /scan/*). Expression thường linh hoạt hơn.

---

## Bước 4: Hành động (Then take action)

1. Ở **Choose action** chọn **Block**.
2. (Tùy chọn) Gói Pro trở lên có thể cấu hình **Custom response** (mã HTTP 403, nội dung text/HTML).

---

## Bước 5: Lưu và bật rule

1. Bấm **Deploy** để lưu và bật rule.
2. Nếu chưa muốn bật ngay: **Save as Draft**, sau đó vào lại và **Deploy** khi cần.

---

## Kiểm tra

- **Chặn theo path:** Từ IP Singapore: vào `/scan` (hoặc path bạn cấu hình) → **403**; vào trang khác (vd: `/`, `/about`) → bình thường.
- **Chặn toàn site:** Từ IP Singapore: mọi request → **403**.
- Traffic từ nước khác luôn bình thường.

---

## Gỡ rule

1. Vào **Security** → **WAF** → **Custom rules**.
2. Tìm rule (ví dụ **Block Singapore**).
3. Bấm **⋮** (ba chấm) → **Delete** (hoặc tắt rule nếu chỉ muốn disable tạm thời).

---

## Lưu ý

- **Free plan:** thường giới hạn số Custom rules (ví dụ 5 rule/zone). Xem **Usage** trong WAF nếu cần.
- **Thứ tự rule:** các rule chạy theo thứ tự trong list; rule match trước sẽ áp dụng trước.
