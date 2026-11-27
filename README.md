# canho.com — Đẳng cấp tạo nên thương hiệu

Hệ thống Web Quản lý Cho thuê & Vận hành Căn hộ theo đặc tả [DESIGN_AND_SPEC.md](./DESIGN_AND_SPEC.md) và [DESIGN.md](./DESIGN.md): **Modern Neo-Chinese Luxury** (kế thừa bố cục Booking.com), **Lưu trữ ảnh phòng trực tiếp trong MongoDB (`RoomPhoto`)**, **Đăng ký công khai chỉ dành cho Người dùng & xác nhận Email qua liên kết**, **Multi-Tenant + Building Isolation**, **RBAC + Sub-Admin**, **MongoDB `Decimal128` + ACID Transactions**, **đầy đủ 34 Tỉnh/Thành & 3.321 Phường/Xã/Đặc khu + `legacy_aliases`** và **Scheduler tự động**.

---

## 1. Cấu trúc Monorepo

- `/server`: Node.js + Express + Mongoose (`14` models: `users`, `admin_divisions`, `buildings`, `rooms`, `room_photos`, `view_bookings`, `deposits`, `contracts`, `invoices`, `payments`, `commissions`, `service_tickets`, `violations`, `audit_logs`) + JWT/Email Verification Auth + RBAC + Audit Log + Scheduler.
- `/client`: Vue 3 (`<script setup>`) + Vite + Pinia (`authStore`, `workspaceStore`, `bookingBillingStore`, `toastStore`) + Vue Router + Axios + Tailwind CSS + Lucide Vue Next.
  - Các màn hình & component chính: `/explore`, `/portal`, `/login`, `/register`, `/verify-email`, `/reports`, `/rooms` (`RoomCard`, `RoomDetailModal`, `RoomPhotoPicker`), `/deposits`, `/contracts`, `/invoices`, `/services`, `/violations`, `/commissions`, `/admin/governance`.

---

## 2. Biến môi trường & Cài đặt

1. Cấu hình `server/.env` (mẫu tại `server/.env.example`):
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/canho_com
   JWT_SECRET=canho_com_neo_chinese_luxury_dev_secret_key_2026
   JWT_EXPIRES_IN=7d
   CLIENT_URL=http://localhost:5173
   ENABLE_SCHEDULER=true
   SCHEDULER_INTERVAL_MS=60000
   SEED_ROOM_PHOTOS_DIR=./assets/room-photos
   EMAIL_VERIFY_TTL_MINUTES=30
   ```
   *(Thư mục `server/assets/room-photos` chứa sẵn 6 bức ảnh phòng mẫu; script `db:seed` đọc trực tiếp Buffer ảnh lưu vào collection `room_photos` trong MongoDB và phục vụ qua `GET /api/v1/rooms/photos/:photoId`).*
2. Cấu hình `client/.env` (mẫu tại `client/.env.example`):
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api/v1
   ```
3. Cài đặt dependencies & seed 34 Tỉnh/Thành + 6 ảnh phòng MongoDB + dữ liệu mẫu:
   ```bash
   npm run install:all
   npm run db:seed
   ```
   *(Hoặc `npm run db:init` để chỉ tạo 14 bảng + 34 tỉnh/thành không chèn dữ liệu mẫu).*

---

## 3. Tài khoản mẫu & Quy chế Đăng ký

| Vai trò | Email | Mật khẩu | Ghi chú |
|---|---|---|---|
| **Admin (Super Admin)** | `admin@canho.com` | `Admin@123456` | Toàn quyền Tòa nhà, Duyệt phòng, Sub-Admin, Audit Log |
| **Manager chính** | `manager@canho.com` | `Manager@123456` | Phụ trách `canho.com Signature — Thủ Dầu Một` |
| **Cư dân (`resident`)** | `cudan@canho.com` | `Cudan@123456` | Thuê phòng `P101`, có hợp đồng & hóa đơn mẫu |

- **Đăng ký công khai (`/register`):** Chỉ tạo tài khoản Người dùng (`role: 'user'`, `userStatus: 'guest'`) kèm **link xác thực Email SHA-256** (hiệu lực 30 phút, gửi lại cooldown 60 giây, không sử dụng OTP). Backend chặn cứng `403` nếu client gửi kèm `role`, `subRole`, `tenantId`, hoặc `assigned_building_ids`.
- **Tài khoản Quản lý (`manager`) & Sub-Admin:** Chỉ do `admin` tạo nội bộ tại `/admin/governance`.

---

## 4. Khởi chạy & Kiểm thử

- **Chạy Backend:** `npm --prefix server run dev` (`http://localhost:5000/api/v1`)
- **Chạy Frontend:** `npm --prefix client run dev` (`http://localhost:5173`)
- **Chạy Test tích hợp Multi-Tenant, Email Auth, RoomPhoto MongoDB, RBAC & ACID:** `npm --prefix server test`
- **Build Production Frontend:** `npm --prefix client run build`
