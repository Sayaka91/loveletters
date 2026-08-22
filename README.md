# Love Letter

Web đơn giản để mọi người vào viết note chung — chỉ có frontend (React + Vite),
dùng Firebase Firestore làm nơi lưu note chung (không cần tự viết code backend).

## 1. Tạo Firebase project (tự làm, ~5 phút)

1. Vào https://console.firebase.google.com → **Add project** → đặt tên (ví dụ `loveletter`).
2. Trong project, vào **Build → Firestore Database → Create database** → chọn **Start in test mode** (cho demo; xem cảnh báo bảo mật ở dưới).
3. Vào **Project settings → General → Your apps → Add app → Web (</>)**. Đặt tên app, không cần Firebase Hosting.
4. Firebase sẽ hiện đoạn `firebaseConfig` với các giá trị `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`. Copy các giá trị này.

## 2. Cấu hình

```bash
cp .env.example .env
```

Mở `.env` và điền các giá trị lấy từ Firebase vào (`VITE_FIREBASE_API_KEY=...`, v.v).

## 3. Chạy bằng Docker

```bash
docker compose up --build
```

Mở http://localhost:8080

> Vite bake các biến `VITE_*` vào bundle **lúc build**, nên nếu bạn sửa `.env` phải chạy lại `docker compose up --build` để áp dụng.

## 4. Chạy dev (không dùng Docker, cần Node 18+)

```bash
npm install
npm run dev
```

## Bảo mật / lưu ý quan trọng

"Test mode" của Firestore cho phép **ai cũng đọc/viết không cần đăng nhập** — đủ cho demo/sổ lưu bút nội bộ,
nhưng phù hợp cho công khai lâu dài. Trước khi public rộng, nên:

- Đổi rule Firestore sang giới hạn field/độ dài, ví dụ (Firestore Rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /notes/{noteId} {
      allow read: if true;
      allow create: if request.resource.data.content is string
                    && request.resource.data.content.size() <= 1000
                    && request.resource.data.author is string
                    && request.resource.data.author.size() <= 50;
      allow update, delete: if false;
    }
  }
}
```

- Test mode Firestore tự hết hạn sau 30 ngày và sẽ khoá toàn bộ read/write — nhớ áp rule thật trước đó.
- Vì không có backend nên không có kiểm duyệt nội dung/spam — cân nhắc thêm rate-limit hoặc App Check nếu public rộng.

## Cấu trúc

- `src/App.jsx` — UI viết & hiển thị note (realtime qua `onSnapshot`)
- `src/firebase.js` — khởi tạo Firebase từ biến môi trường
- `Dockerfile` — build multi-stage: Node build → serve bằng Nginx
