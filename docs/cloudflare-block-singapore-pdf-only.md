# Block Singapore chỉ cho link xem PDF

Thay vì chặn cả Singapore, chỉ chặn **trang/view PDF** (và API phục vụ PDF) khi truy cập từ Singapore. Các trang khác (compose, submit, result, scan...) vẫn dùng bình thường từ SG.

## Trong Cloudflare: Edit custom rule "Block Singapore"

1. Vào **Security** → **WAF** → **Custom rules** → mở rule **Block Singapore** → **Edit**.
2. Ở mục **When incoming requests match...** bấm **Edit expression** (link màu xanh).
3. Xóa expression cũ `(ip.src.country eq "SG")` và dán expression sau:

```txt
(ip.src.country eq "SG" and (starts_with(http.request.uri.path, "/en/view") or starts_with(http.request.uri.path, "/zh/view") or starts_with(http.request.uri.path, "/api/view-sheet") or starts_with(http.request.uri.path, "/api/pdf-proxy")))
```

4. **Then take action:** giữ **Block**.
5. **Deploy** (hoặc Save).

## Kết quả

- **Từ Singapore:** Chỉ **trang xem PDF** (`/en/view/...`, `/zh/view/...`) và **API PDF** (`/api/view-sheet/...`, `/api/pdf-proxy/...`) bị block. Các đường dẫn khác (/, /en, /en/compose, /api/submit, /en/scan/..., v.v.) vẫn truy cập được.
- **Từ nước khác:** Mọi thứ hoạt động như cũ.

## Path đang bị block (chỉ các path này khi từ SG)

| Path | Mô tả |
|------|--------|
| `/en/view/*` | Trang xem sheet (tiếng Anh) |
| `/zh/view/*` | Trang xem sheet (tiếng Trung) |
| `/api/view-sheet/*` | API trả link PDF (có device check) |
| `/api/pdf-proxy/*` | Proxy file PDF từ S3 |
