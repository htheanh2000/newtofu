# Neon PostgreSQL setup (Margiela)

Compositions and users are saved to Neon (PostgreSQL).

## 1. Create project on Neon

- [Neon Console](https://console.neon.tech) → Create project (e.g. `margiela`), region `aws-ap-southeast-1`.

## 2. Lấy DATABASE_URL (Neon CLI hoặc Console)

**Cách 1 – Neon CLI (recommended):**

```bash
# Cài CLI (nếu chưa có): npm i -g neonctl
# Login (một lần): neon auth
# In connection string (pooled, dùng cho Prisma/ECS):
neon connection-string --pooled --prisma
```

Copy output vào `.env` dưới dạng `DATABASE_URL=<chuỗi>`.

**Cách 2 – Neon Console:**  
Dashboard → project → **Connection string** → chọn **Pooled** → copy.

## 3. Configure env

In `margiela-fe/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
```

## 4. Run migrations

```bash
cd margiela-fe
npx prisma migrate deploy
```

This applies the initial migration (tables `Composition`, `User`).

## 5. Optional: Prisma Studio

```bash
npm run db:studio
```

Opens a UI to browse and edit data at `http://localhost:5555`.

## Behavior

- **POST /api/submit**: Saves to Neon when `DATABASE_URL` is set. Response includes `savedToDb`.
- **GET /api/composition/[id]**: Reads from Neon. Requires `DATABASE_URL`.
