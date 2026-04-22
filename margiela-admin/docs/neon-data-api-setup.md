# Setup Neon Data API + Neon Auth cho Admin

Admin dùng **Neon Data API** và **Neon Auth** (đăng nhập email/password, JWT tự động gửi kèm request). Không cần margiela-fe hay API riêng.

## 1. Bật Data API và Neon Auth

**Cách A – Script (Neon CLI + API, khuyến nghị)**

neonctl không có lệnh bật Data API; dùng script gọi Neon REST API:

1. Lấy **API key**: [Neon Console](https://console.neon.tech) → **Account** (góc dưới trái) → **API keys** → **Create API key**.
2. Trong terminal (từ repo margiela, đã cài neonctl và có project `margiela`):

```bash
cd margiela-admin
export NEON_API_KEY="your-api-key"
./scripts/enable-neon-data-api.sh
```

Script sẽ lấy project/branch qua `neonctl` (project `margiela`, branch `main`, database `neondb`), bật Data API với **Neon Auth** và **add_default_grants**. In ra Data API URL; bạn cần copy **Auth URL** từ Neon Console → project → **Auth**.

**Cách B – Neon Console**

1. Vào [Neon Console](https://console.neon.tech) → chọn project (cùng DB mà margiela-fe dùng).
2. **Data API**: Sidebar → **Data API** → **Enable Data API**. Copy **API URL** và đảm bảo có **`/rest/v1`** (vd. `https://ep-xxx.apirest.region.aws.neon.tech/neondb/rest/v1`). SDK cần path này để gọi đúng endpoint.
3. **Neon Auth**: Sidebar → **Auth** (hoặc **Integrations** → Neon Auth) → bật và cấu hình. Copy **Auth URL** (dạng `https://ep-xxx.neonauth.region.aws.neon.tech/neondb/auth`).
4. Trong Data API, bật **Use Neon Auth** nếu bạn dùng Neon Auth làm provider (khuyến nghị).
5. **Schema access**: Trong Data API, bật **Grant public schema access** để role `authenticated` đọc/ghi được bảng trong `public` (hoặc chạy SQL bên dưới).

## 2. Quyền cho bảng User, Composition (RLS hoặc GRANT)

Data API dùng role `authenticated` cho request có JWT. Cần cho phép role này SELECT trên bảng `User` và `Composition`.

**Cách đơn giản (không RLS):** Trong Data API settings bật **Grant public schema access** (Neon sẽ chạy các GRANT tương tự):

```sql
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```

**Nếu bảng có tên khác schema:** Đảm bảo `User`, `Composition` nằm trong schema `public`. Prisma mặc định tạo trong `public`.

**Nếu Data API trả 200 nhưng `[]` (empty):** Thường do **Row Level Security (RLS)** đang bật trên bảng nhưng không có policy cho phép role `authenticated` đọc. Trong Neon Console → **SQL Editor** chạy:

```sql
-- Kiểm tra RLS có bật không
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('User', 'Composition');

-- Nếu relrowsecurity = true, cho phép authenticated đọc toàn bộ (admin dashboard):
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_select_all_user" ON "User"
  FOR SELECT TO authenticated USING (true);

ALTER TABLE "Composition" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_select_all_composition" ON "Composition"
  FOR SELECT TO authenticated USING (true);
```

(Nếu bảng chưa bật RLS thì chỉ cần tạo policy; nếu đã có policy khác thì có thể cần chỉnh hoặc tắt RLS tạm cho admin.)

## 3. Tạo user admin (Neon Auth)

Sau khi bật Neon Auth:

- Dùng **Auth API reference** (Auth URL + `/reference`) hoặc gọi API để tạo user:
  - `POST /sign-up/email` với body `{ "email": "admin@yourdomain.com", "password": "your-secure-password", "name": "Admin" }`.
- Hoặc nếu Neon Auth có UI tạo user trong Console thì tạo một user làm admin.

Admin đăng nhập bằng **email** + **password** này trên trang admin.

## 4. Cấu hình env trong margiela-admin

Trong `margiela-admin/.env`:

```env
NEXT_PUBLIC_NEON_DATA_API_URL=https://your-ep.apirest.region.aws.neon.tech/neondb/rest/v1
NEXT_PUBLIC_NEON_AUTH_URL=https://your-ep.neonauth.region.aws.neon.tech/neondb/auth
```

Build lại và deploy (vd. S3):

```bash
cd margiela-admin
npm run build
aws s3 sync out/ s3://admin-springsummer2026margiela/ --delete
```

## 5. CORS khi deploy admin lên S3 (hoặc domain khác)

Khi admin chạy trên domain khác localhost (vd. S3 website), cần cho phép **hai chỗ**:

1. **Neon Auth – Domains** (để sign-in không bị `INVALID_ORIGIN`):
   - Console → **Auth** → **Configuration** → **Domains** → **Add domain**
   - Thêm đúng URL admin, có protocol, không dấu `/` cuối, vd:  
     `http://admin-springsummer2026margiela.s3-website-ap-southeast-1.amazonaws.com`

2. **Neon Data API – CORS allowed origins** (để request `User`/`Composition` từ browser không bị chặn CORS):
   - Console → **Data API** → **Settings** → **Advanced settings** → **CORS allowed origins**
   - Thêm cùng URL admin (vd. `http://admin-springsummer2026margiela.s3-website-ap-southeast-1.amazonaws.com`)
   - Nếu để trống thì mặc định cho phép mọi origin (`*`); nếu đã set danh sách cụ thể thì phải thêm URL admin vào.

Sau khi thêm, Save. Reload trang admin và đăng nhập lại.

## 6. Tên bảng (Prisma)

Prisma tạo bảng với tên model: `User`, `Composition`. Neon Data API (PostgREST) có thể expose với đúng tên hoặc lowercase tùy DB. Code admin dùng `User` và `Composition`. Nếu gặp lỗi "relation does not exist", thử đổi trong `lib/neon-client.ts` sang `"user"` và `"composition"` (chữ thường).

## Tóm tắt

| Bước | Hành động |
|------|-----------|
| 1 | Bật Data API + Neon Auth trong Neon Console, copy API URL và Auth URL |
| 2 | Bật Grant public schema access (hoặc chạy GRANT SQL) |
| 3 | Tạo một user admin qua Neon Auth (sign-up/email) |
| 4 | Điền `NEXT_PUBLIC_NEON_DATA_API_URL` và `NEXT_PUBLIC_NEON_AUTH_URL` trong .env, build và deploy admin |
| 5 | Nếu admin chạy trên S3/domain khác: thêm domain vào **Auth → Domains** và **Data API → CORS allowed origins** |

Sau đó mở admin (S3 hoặc subdomain), đăng nhập bằng email/password đã tạo, Users và Compositions sẽ load từ Neon Data API.
