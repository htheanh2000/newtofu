# Margiela — tài liệu dự án (bàn giao)

**Trạng thái:** dự án đã kết thúc (handoff / archive).  
**Mã nguồn:** monorepo tại thư mục gốc, các thành phần triển khai độc lập theo package.

## Mục đích

Hệ thống trải nghiệm âm nhạc tương tác (Maison Margiela / music sheet): người dùng chọn nhạc cụ, tạo / xem tác phẩm, tải PDF; có luồng kiosk, quản trị, và tích hợp PDF (service + proxy).

## Cấu trúc thư mục (các thành phần chính)

| Thư mục | Vai trò | Stack (tóm tắt) |
|--------|--------|-------------------|
| `margiela-fe/` | Ứng dụng web chính (PWA/Next.js) | Next.js 16, React 19, Tailwind, Prisma, `next-intl` (i18n), Vexflow/Tone, E2E Playwright |
| `margiela-admin/` | Bảng điều khiển admin (users, compositions) | Next.js 16, Neon Data API, Tailwind, deploy tùy chọn S3 |
| `margiela-admin-proxy/` | Proxy nhẹ (Cloudflare Worker) cho admin | `wrangler`, Node |
| `margiela-pdf/` | Dịch vụ tạo PDF (Chromium + Puppeteer, có biến thể Lambda) | Node, Express, AWS SDK (S3) |
| `margiela-pdf-proxy/` | PDF qua edge (URL rewrite / proxy) | Cloudflare Workers, Wrangler |
| `margiela-e2e-lambda/` | Job kiểm thử E2E định kỳ + thông báo (Slack) | AWS Lambda, tài liệu trong package |
| `scripts/` | Kịch bản vận hành (Cloudflare WAF, subdomain, S3, v.v.) | Bash |
| `docs/` | Ghi chép vận hành & điều tra (E2E, Cloudflare) | Markdown |

Các tài liệu chi tiết từng mảng nằm rải rác under `*/docs` và `docs/` (ví dụ: Neon, ECS, Cloudflare).

## Thiết lập môi trường (local, mức tối thiểu)

- **Yêu cầu chung:** Node 20+ (hoặc version project đang dùng), `npm` hoặc `pnpm` tùy convention từng package (repo này dùng `package-lock` ở một số nơi).

1. **Frontend** (`margiela-fe/`)

   ```bash
   cd margiela-fe
   cp .env.example .env.local   # điền theo bí mật môi trường
   npm install
   npm run db:generate
   npx prisma migrate dev       # nếu cần database local/Neon
   npm run dev
   ```

2. **Admin** (`margiela-admin/`)

   ```bash
   cd margiela-admin
   cp .env.example .env.local
   npm install
   npm run dev
   ```

3. **PDF service** (`margiela-pdf/`)

   ```bash
   cd margiela-pdf
   cp .env.example .env
   npm install
   npm run dev
   ```

4. **Workers (proxy):** mỗi thư mục có `wrangler.toml` / `README` riêng; xem `margiela-pdf-proxy/README.md` và `margiela-admin-proxy/`.

Các tham số API token, DSN, bucket S3, v.v. **chỉ lưu trong tệp môi trường**; không lưu trong tài liệu này.

## Tài sản tài liệu đã có sẵn (trong repo)

- `docs/e2e-api-failure-investigation.md` — ghi chép sự cố/điều tra E2E API.  
- `docs/cloudflare-block-singapore-dashboard.md` / `docs/cloudflare-block-singapore-pdf-only.md` — quy ước/điều tra Cloudflare theo từng tầng.  
- Từng package: `*/README.md`, `*/docs/*.md` (deploy, Neon, Lambda, v.v.).

## GitHub

- Repo: **https://github.com/htheanh2000/newtofu** (nhánh `main`).

`margiela-e2e-lambda/deploy.sh` **bắt buộc** `SLACK_WEBHOOK_URL_E2E` trong file `.env` (không hardcode webhook trong script).

- GitHub có cảnh báo font lớn (`margiela-fe/public/fonts/Songti.ttc` ~64MB): có thể giữ nguyên, hoặc chuyển qua [Git LFS](https://git-lfs.github.com) nếu cần.

Có thể bật **Settings → General → Archive this repository** khi không còn bảo trì tích cực.

## Ghi chú bảo mật khi bàn giao

- **Không commit:** `.env`, `.credentials-local`, token Cloudflare, khóa AWS, PDF build zip (`deploy.zip` đã loại khỏi cây mã).  
- Xóa/rotate secrets trên máy cá nhân nếu dự án dừng hẳn.  
- Thư mục `agent/` được ignore (chỉ phục vụ AI, không cần trong mã sản xuất).

## Điểm kết dự án (checklist)

- [x] Tài liệu tổng quan (file này)  
- [x] Dọn tệp build/zip không cần thiết, làm sạch git  
- [x] Một lần commit sạch + push lên GitHub  

*Cập nhật: tháng 4/2026 — handoff theo yêu cầu “đóng project”.*
