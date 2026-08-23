# Love Letter

Web đơn giản để mọi người vào viết note chung và tâm sự trong "Góc tâm sự".
Frontend là React + Vite, backend là Node/Express, dữ liệu lưu vào file JSON
trong thư mục `data/`.

## Chạy dev (cần Node 18+)

Mở 2 terminal:

```bash
npm install
npm run server   # backend, port 3000, lưu vào ./data/*.json
```

```bash
npm run dev       # frontend dev server, port 5173, proxy /api sang :3000
```

Mở `http://localhost:5173`.
