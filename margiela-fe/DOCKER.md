# Docker – Margiela (độc lập)

Build và chạy chỉ từ thư mục Margiela. Khi tách thành **repo riêng**, dùng thư mục gốc repo làm context.

## Lỗi I/O / containerdmeta.db / read-only file system

1. **Từ repo contabo:** chạy `./scripts/margiela-fe-ecs-build-push.sh` — script tự dọn cache và thử legacy builder nếu BuildKit lỗi.

2. **Chỉ build local:** `docker builder prune -af && docker system prune -f && docker build -t margiela-fe:latest .`

3. **Nếu vẫn lỗi** – lỗi nằm ở Docker Desktop / ổ đĩa:
   - **Restart Docker Desktop:** Quit hoàn toàn (menu Docker → Quit) rồi mở lại.
   - **Tăng dung lượng disk:** Docker Desktop → Settings → Resources → Disk image size (ví dụ 64GB).
   - **Reset (nếu cần):** Settings → Troubleshoot → Reset to factory defaults (sẽ xóa images/containers).
   - Kiểm tra ổ đĩa còn trống (ít nhất vài GB).

## Build

```bash
# Từ thư mục Margiela (srv/margiela hoặc root repo margiela)
docker build -t margiela-fe:latest .
```

## Chạy local

```bash
docker run -p 3000:3000 margiela-fe:latest
```

Hoặc với docker-compose:

```bash
docker compose up --build
```

Mở http://localhost:3000

## Push lên ECR (khi trong contabo)

Từ **repo contabo** (root):

```bash
./scripts/margiela-fe-ecs-build-push.sh
```

Script sẽ `cd` vào `srv/margiela` rồi build (context chỉ Margiela), sau đó tag và push lên ECR.

## Khi Margiela là repo riêng

1. Clone repo margiela.
2. Build: `docker build -t margiela-fe:latest .`
3. Push ECR: login ECR, tag image `427901343757.dkr.ecr.ap-southeast-1.amazonaws.com/margiela-fe:latest`, `docker push ...`
