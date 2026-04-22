# Admin gọi trực tiếp Neon Data API

**Admin hiện dùng Neon Data API + Neon Auth** (đăng nhập email/password, gọi thẳng Neon). Setup: [neon-data-api-setup.md](./neon-data-api-setup.md).

---

Neon có **Data API** (REST, kiểu PostgREST): bật trong Neon Console → project → **Data API** → Enable. Sau khi bật bạn có một **API URL** dạng:

`https://<ep>.apirest.<region>.aws.neon.tech/<db>/rest/v1/<table>`

Ví dụ: `GET .../rest/v1/User?select=*`, `GET .../rest/v1/Composition?select=*`.

## Có thể “gọi API tới Neon” từ admin không?

**Có**, nhưng cần lưu ý:

1. **Mọi request đều phải có JWT**  
   Data API không dùng “API key” đơn giản; bắt buộc header `Authorization: Bearer <JWT>`. JWT có thể từ:
   - **Neon Auth** (Neon cung cấp sẵn): đăng ký/đăng nhập → lấy JWT → gọi Data API.
   - **Custom provider** (Auth0, Clerk, Firebase, hoặc backend tự ký JWT): cấu hình trong Data API → dùng JWT do provider đó cấp.

2. **RLS (Row-Level Security)**  
   Data API dùng role `authenticated` (và có thể custom role trong JWT). Bạn cần bật RLS và viết policy cho phép role đó (hoặc role “admin”) đọc bảng `User`, `Composition` (và `Device` nếu cần). Nếu không, authenticated user có thể không đọc được dữ liệu.

3. **Tên bảng**  
   Prisma mặc định dùng tên model làm tên bảng: `User`, `Composition`, `Device`. Trong Data API sẽ là:
   - `.../rest/v1/User`
   - `.../rest/v1/Composition`
   - `.../rest/v1/Device`

## Hai hướng dùng từ admin (S3)

### A. Giữ kiến trúc hiện tại (đơn giản)

- Admin (S3) gọi **margiela-fe** (`/api/admin/login`, `/api/admin/users`, `/api/admin/compositions`).
- Margiela-fe kết nối Neon (Prisma) và trả JSON.  
→ Không cần đổi gì, không cần bật Data API.

### B. Admin gọi thẳng Neon Data API (bỏ qua margiela-fe)

- Bật **Data API** trong Neon Console (theo branch của DB đang dùng).
- Cấu hình **Neon Auth** (hoặc custom provider) để admin đăng nhập và nhận JWT.
- Trong admin (S3): sau khi login lấy JWT, mọi request đọc Users/Compositions gửi tới **Neon Data API URL** với header `Authorization: Bearer <JWT>` (vd. `GET .../rest/v1/User?select=*`).
- Trong Neon: bật RLS và policy cho phép role tương ứng đọc `User`, `Composition`.

**Ưu điểm:** Admin không phụ thuộc margiela-fe; chỉ cần S3 + Neon Auth + Neon Data API.  
**Nhược điểm:** Phải cấu hình Neon Auth (hoặc custom JWT), RLS và quyền; logic filter/sort phải viết theo chuẩn PostgREST (query params) hoặc dùng SDK `@neondatabase/neon-js` / `@neondatabase/postgrest-js`.

## Tài liệu Neon

- [Data API – Get started](https://neon.tech/docs/data-api/get-started)
- [Data API – Custom authentication providers](https://neon.tech/docs/data-api/custom-authentication-providers)
- [Access control (RLS)](https://neon.tech/docs/data-api/access-control)

Tóm lại: **Neon có support API (Data API)** và bạn **có thể gọi API tới đó luôn** từ admin; điều kiện là có JWT (Neon Auth hoặc custom) và cấu hình RLS cho bảng cần đọc.
