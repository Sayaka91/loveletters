# Love Letter

Web đơn giản để mọi người vào viết note chung. Không dùng dịch vụ cloud nào —
frontend (React + Vite) và backend (Node/Express) chạy trong 1 container Docker
duy nhất trên server của bạn, note lưu vào file `data/notes.json` được mount
ra ngoài host qua Docker volume nên restart/rebuild không mất dữ liệu.

## Chạy bằng Docker

```bash
docker compose up --build -d
```

Mở `http://<địa-chỉ-server>:8080`.

Note được lưu tại `./data/notes.json` trên host (thư mục `data/` tự sinh ra cạnh
`docker-compose.yml`, đã được gitignore). Backup/định kỳ chỉ cần copy file này.

## Chạy dev (không dùng Docker, cần Node 18+)

Mở 2 terminal:

```bash
npm install
npm run server   # backend, port 3000, lưu vào ./data/notes.json
```

```bash
npm run dev       # frontend dev server, port 5173, proxy /api sang :3000
```

## Chạy trên Vercel

Vercel không chạy được `server/index.js` (Express `app.listen`) hay ghi file
vào `data/notes.json` — filesystem trên Vercel là read-only và mỗi request có
thể chạy trên instance khác nhau. Vì vậy khi deploy lên Vercel, API dùng
serverless function riêng ở `api/notes.js`, lưu note vào Redis (Upstash) thay
vì file JSON.

1. Trong Vercel dashboard của project → **Storage** → **Marketplace Database
   Providers** → thêm **Upstash for Redis** (free tier đủ dùng) và connect
   vào project. Việc này tự inject env var `UPSTASH_REDIS_REST_URL` /
   `UPSTASH_REDIS_REST_TOKEN` (hoặc `KV_REST_API_URL` / `KV_REST_API_TOKEN`
   tùy cách kết nối — `api/notes.js` đã hỗ trợ cả hai).
2. Redeploy lại project sau khi thêm database để env var có hiệu lực.
3. `vite build` (đã cấu hình sẵn trong `package.json`) build ra `dist/`,
   Vercel tự serve như static site; `api/notes.js` được tự nhận diện là
   serverless function cho route `/api/notes`.

Cách chạy Docker/dev ở trên (dùng file `data/notes.json`) không đổi — chỉ áp
dụng riêng cho khi tự host, không dùng khi deploy lên Vercel.

## Kiến trúc

- `server/index.js` — Express server: `GET /api/notes`, `POST /api/notes`,
  đồng thời serve luôn static build của React (`dist/`).
- `src/App.jsx` — UI viết & hiển thị note, poll `GET /api/notes` mỗi 5s để
  mọi người thấy note mới của nhau (không dùng WebSocket cho đơn giản).
- Dữ liệu lưu dạng file JSON đơn giản (không dùng DB) — đủ cho quy mô nhỏ
  (sổ lưu bút, vài trăm note). Nếu lượng note lớn/nhiều người viết đồng thời,
  nên chuyển sang SQLite hoặc Postgres.

## Lưu ý bảo mật

- Không có xác thực/kiểm duyệt — ai có URL cũng viết được note công khai.
  Nếu expose ra internet, nên đặt sau reverse proxy (nginx/Caddy) có rate-limit,
  hoặc thêm HTTP Basic Auth ở tầng proxy.
- Nội dung note được giới hạn 1000 ký tự, tên tối đa 50 ký tự (chặn ở cả FE và
  BE trong `server/index.js`).
