---

version: 1.0-neo-chinese-canho
name: canho.com — Đẳng cấp tạo nên thương hiệu
description: |
  Unified design & business specification for canho.com ("Đẳng cấp tạo nên thương hiệu"),
  combining a Modern Neo-Chinese Luxury visual system (adapted from Booking.com's layout
  structure) with multi-building apartment leasing, deposit/contract lifecycles, monthly
  utility billing, QR/cash reconciliation, Manager commission rules, and MongoDB
  multi-tenant / building-isolated architecture.
brand:
  logoText: "canho.com"
  slogan: "Đẳng cấp tạo nên thương hiệu"
source:
  businessSpec: "Mo_Hinh_Nghiep_Vu_Va_Thiet_Ke_MongoDB_Quan_Ly_Can_Ho.docx (2026-11-26)"
  designBase: "mau.md (Booking.com layout structure adapted to Modern Neo-Chinese Luxury)"
updatedAt: "2026-11-26"
colors:
  primary: "#A6342E"
  primaryHover: "#872621"
  link: "#A6342E"
  canvas: "#F7F4EE"
  surface-alt: "#EFE9DE"
  on-primary: "#FFFFFF"
  ink: "#24120E"
  body: "#F7F4EE"
  muted: "#6E5A4F"
  hairline: "#E6DDD0"
  accent-1: "#3A251D"
  accent-2: "#C69C49"
  neutral-1: "#8C7769"
  neutral-2: "#24120E"
  status-available-paid: "#1F6E5A"
  status-occupied-unpaid: "#A6342E"
  status-maintenance-reserved: "#B45309"
typography:
  display:
    fontFamily: "Noto Serif"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.29
    letterSpacing: 0px
  heading-lg:
    fontFamily: "Noto Serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: 0px
  heading-md:
    fontFamily: "Noto Serif"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0px
  heading-sm:
    fontFamily: "Be Vietnam Pro"
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 0px
  heading-xs:
    fontFamily: "Be Vietnam Pro"
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.43
    letterSpacing: 0px
  body-lg:
    fontFamily: "Be Vietnam Pro"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
  body-md:
    fontFamily: "Be Vietnam Pro"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0px
  button-lg:
    fontFamily: "Be Vietnam Pro"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.43
    letterSpacing: 0px
  caption-xs:
    fontFamily: "Be Vietnam Pro"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
rounded:
  none: 0px
  xs: 6px
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  xxxl: 136px
  section: 152px
  band: 164px
borderWidths:
  thin: 1px
shadows:
  sm: "rgba(36, 18, 14, 0.14) 0px 2px 8px 0px"
elevationStrategy: single-tier
breakpoints:
  - width: 375
    containerWidth: 343
    gridColumns: 6
    sectionPaddingX: 16
  - width: 768
    containerWidth: 736
    gridColumns: 5
    sectionPaddingX: 16
  - width: 1024
    containerWidth: 992
    gridColumns: 6
    sectionPaddingX: 0
  - width: 1280
    containerWidth: 1108
    gridColumns: 6
    sectionPaddingX: 0
  - width: 1440
    containerWidth: 1108
    gridColumns: 6
    sectionPaddingX: 0

---

# canho.com — Đẳng cấp tạo nên thương hiệu
## Hệ thống Quản lý Cho thuê & Vận hành Căn hộ (Design & Business Spec)

### 1. Thương hiệu & Phong cách giao diện (Modern Neo-Chinese Luxury)
- **Logo:** `canho.com` kèm slogan ngay bên dưới: **"Đẳng cấp tạo nên thương hiệu"**.
- **Ngôn ngữ thiết kế:** Giữ cấu trúc bố cục rõ ràng, khoảng thở thoáng đạt và luồng tìm kiếm/đặt chỗ/quản lý mạch lạc kiểu Booking.com, nhưng chuyển đổi toàn bộ sang **Trung Hoa Hiện Đại Sang Trọng**:
  - Nền chính `#F7F4EE` (Giấy sáng ấm), bề mặt thẻ `#FFFFFF` và `#EFE9DE`, viền mảnh `1px` `#E6DDD0` và `#C69C49` (Ánh kim).
  - Màu nhấn chính `#A6342E` (Đỏ hiện đại, hover `#872621`) và tông gỗ `#3A251D` / `#24120E` (Gỗ tự nhiên / Gỗ trầm).
  - Typography: `Noto Serif` cho logo, tên tòa nhà và tiêu đề lớn; `Be Vietnam Pro` (`tabular-nums`) cho bảng biểu, chỉ số điện nước, tiền tệ và biểu mẫu.
  - Pill buttons (`rounded-full`) cho hành động chính/bộ lọc, bo góc `6px` (`rounded-xs`) cho ô nhập liệu/thẻ/panel, tối đa 1 lớp đổ bóng nhẹ `rgba(36, 18, 14, 0.14) 0px 2px 8px 0px` và focus ring `2px` `#C69C49`.

### 2. Phạm vi & Cô lập dữ liệu (Multi-Building & Account Isolation)
- Công ty (`Admin`) sở hữu toàn bộ quỹ căn hộ dài hạn theo chu kỳ tháng; `Manager` vận hành tòa nhà được phân công và nhận hoa hồng trên tiền phòng thực thu; `User` tìm phòng, đặt lịch xem, đặt cọc, ký hợp đồng, thanh toán hóa đơn và đặt dịch vụ đi kèm.
- **Cô lập theo tài khoản & tòa nhà:** Mỗi tài khoản mới đăng ký tạo không gian dữ liệu độc lập (`tenantId` / phạm vi sở hữu riêng, mặc định trống, không lẫn dữ liệu tài khoản khác). Trong cùng 1 tài khoản, mỗi tòa nhà (`building_id`) tách biệt dữ liệu (phòng, hợp đồng, cư dân, hóa đơn, công nợ, hoa hồng) và kiểm soát chặt ở Middleware/Controller (`403` khi truy cập ngoài phạm vi).
- **Kiểu tiền & giao dịch:** Dùng `Decimal128` cho tiền tệ, lưu snapshot đơn giá/tỷ lệ tại thời điểm giao dịch và dùng MongoDB Session Transactions cho các luồng cọc, hợp đồng, thanh toán và hoa hồng.

### 3. Vai trò, Vòng đời User & Phân quyền (RBAC + Sub-Admin + Audit Log)
- **3 vai trò:** `admin` (hỗ trợ tách quyền con: Vận hành, Kế toán, CSKH), `manager` (Manager chính / dự phòng theo tòa, quản lý hạn mức & thời hạn nộp tiền mặt 24h), `user`.
- **Vòng đời `User`:** `guest` (khách vãng lai) → `depositor` (người đặt cọc) → `resident` (cư dân hợp đồng hiệu lực) → `former` (cư dân cũ).
- **Thao tác nhạy cảm cần `Admin` duyệt & ghi `audit_logs`:** Hoàn cọc, hủy/sửa hóa đơn đã phát hành, giảm giá phòng vượt hạn mức Manager, sửa chỉ số điện/nước đã chốt, miễn giảm phí trễ hạn.

### 4. Địa bàn 34 Tỉnh/Thành, Tòa nhà & Phòng
- Phân cấp: `Tỉnh/Thành phố (chuẩn 34 đơn vị hành chính)` → `Phường/Xã` → `Tòa nhà` → `Tầng` → `Căn hộ/Phòng`.
- Hỗ trợ `admin_code`, `legacy_aliases` (ví dụ tìm "Bình Dương" vẫn ra khu vực mới thuộc TP. Hồ Chí Minh) và GeoJSON `2dsphere` tìm theo bán kính.
- Quy trình đưa phòng lên sàn: `Admin` tạo tòa & gán `Manager` → `Manager` nhập phòng/ảnh/tài sản/chìa khóa-thẻ từ & đề xuất giá → `Admin` duyệt → phòng chuyển sang `available` (`Trống`).
- Bàn giao khi đổi `Manager`: Lập biên bản điện tử gồm hợp đồng hiệu lực, công nợ chưa thu, tiền mặt đang giữ, chìa khóa/thẻ từ và phiếu dịch vụ/sự cố đang xử lý.

### 5. 6 Giai đoạn Nghiệp vụ Cốt lõi, Dòng tiền, Hoa hồng & Dịch vụ
1. **Tìm & xem phòng:** Lọc phòng trống, đặt lịch xem trực tiếp/video, ghi nhận kết quả (`interested` / `deposited` / `rejected` kèm lý do).
2. **Đặt cọc giữ chỗ:** Khóa phòng (`reserved`); thanh toán QR giữ 15 phút, tiền mặt/tại chỗ giữ 24 giờ (tạm khóa tự hủy khi đang chờ xác nhận giao dịch); hết hạn/hủy xử lý hoàn/mất cọc và mở lại phòng.
3. **Hợp đồng & bàn giao:** Liên kết tiền cọc, kiểm tra số người tối đa, ký điện tử/bản ký, lập biên bản bàn giao tài sản/chìa khóa/chỉ số điện nước ban đầu → kích hoạt hợp đồng (`active`), chuyển phòng sang `occupied`, nâng `user_status` thành `resident`.
4. **Hóa đơn hằng tháng & nhắc nợ:** Chốt chỉ số điện/nước kèm ảnh, tính tiền phòng + điện/nước + phí quản lý/xe + dịch vụ đã nghiệm thu + nợ cũ - giảm trừ; nhắc tự động mốc trước 3 ngày, đúng hạn, quá hạn (cộng phí trễ hạn). Hỗ trợ đổi nhân khẩu/xe, đổi phòng theo ngày thực tế, chuyển nhượng hợp đồng.
5. **Gia hạn, trả phòng & quyết toán cọc:** Nhắc trước 45 ngày (báo trả trước tối thiểu 30 ngày); công thức hoàn cọc: `Tiền cọc - Nợ cũ - (Điện, nước, phí kỳ cuối) - Bồi thường hư hỏng/mất mát` (nếu âm thì thu phần chênh lệch), sau đó chuyển phòng sang `maintenance` rồi `available`.
6. **Dòng tiền, hoa hồng, dịch vụ, bảo trì & nội quy:**
   - Thanh toán QR về tài khoản công ty; xử lý chuyển thiếu/thừa/sai mã; giới hạn & thời hạn 24h nộp tiền mặt của `Manager`.
   - Hoa hồng `Manager` tính trên `Tiền phòng thực thu × Tỷ lệ` (ưu tiên: đợt phân công → tòa nhà → hệ thống; phân bổ theo tỷ trọng khi trả một phần; chốt cuối tháng, chi ngày 10 tháng sau: `provisional` → `pending_approval` (3 ngày đối soát/khiếu nại) → `approved` → `paid`).
   - Dịch vụ đi kèm (đặt → báo giá/xác nhận nếu phát sinh → điều phối/nghiệm thu & chấm sao), bảo trì hạ tầng vs lỗi cư dân (khẩn cấp xử lý ngay, giải trình trong 24h), vi phạm nội quy lũy tiến 3 mức (`1_reminder` → `2_warning` → `3_fine`).

### 6. MongoDB Collections & Indexes Cốt lõi
- `users`, `admin_divisions`, `buildings`, `rooms`, `view_bookings`, `deposits`, `contracts`, `invoices`, `payments`, `commissions`, `service_tickets`, `violations`, `audit_logs`.
- Indexes: `buildings` (`2dsphere` + `province_code/ward_code`), `rooms` (`building_id, status, base_price`), `deposits` (`status, hold_expires_at`), `contracts` (`building_id, status, end_date`), `invoices` (`building_id, billing_month, status` & `contract_id, billing_month`), `commissions` (`manager_id, period, status`).