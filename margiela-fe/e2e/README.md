# E2E tests (API)

E2E tests for the Margiela API: create sheet, persist to DB, and verify composition URL.

## Prerequisites

- App running (e.g. `npm run dev` in `margiela-fe`).
- `DATABASE_URL` in `.env` (required for submit and composition read).
- If `MARGIELA_DEVICE_WHITELIST_ENABLED=true`, tests register a device and send `X-Device-ID` for GET composition.

## Run

From repo root (`margiela-fe`):

```bash
# Start app first (in another terminal)
npm run dev

# Run e2e tests
npm run test:e2e
```

With custom base URL:

```bash
BASE_URL=http://localhost:3000 npm run test:e2e
```

## Test cases

| Test | Target |
|------|--------|
| POST /api/submit creates sheet and returns success | User gọi API tạo sheet nhạc, response success và savedToDb |
| GET /api/composition/[id] returns the created sheet | Sheet được lưu (đọc lại được từ API) |
| Sheet saved to database when DATABASE_URL is set | Sheet được lưu vào database (Neon) |
| Scan page returns 200 | Link URL work (trang scan mở được) |
