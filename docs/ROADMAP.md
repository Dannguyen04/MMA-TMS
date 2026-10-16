# MMA-TMS — Lộ Trình Phát Triển (Roadmap)

> Kế hoạch ưu tiên dựa trên phân tích gap với thị trường Việt Nam

**Phiên bản**: 1.0
**Cập nhật**: 2026-09-29
**Trạng thái**: Draft — chờ team review

> **Đã được thay thế ngày 2026-10-11.** Lộ trình đang áp dụng nằm ở [SCOPE-FIGHT-CAMP.md](./SCOPE-FIGHT-CAMP.md#kế-hoạch-triển-khai). Các hạng mục dưới đây chỉ còn giá trị tham khảo; một số (Quick Session Log, hạng cân theo kg, Fight Camp Templates, Weight Management) đã được đưa vào phạm vi mới.

---

## Điều Hướng Tài Liệu

- [Tổng quan dự án](./PROJECT-OVERVIEW.md) — đọc trước khi nhận task
- [Luồng nghiệp vụ](./BUSINESS-FLOWS.md) — bối cảnh và quy tắc nghiệp vụ
- [Phân tích thị trường Việt Nam](./VIETNAM-MARKET-ANALYSIS.md) — nguồn gốc các ưu tiên
- **Roadmap** — tài liệu hiện tại, dùng checklist trong từng task
- [Spec kỹ thuật v3](./MMA-TMS-MASTER-SPECIFICATION-v3.md) — tham chiếu khi thiết kế và triển khai

---

## Tổng Quan Ưu Tiên

### Nguyên tắc ưu tiên
1. **Impact × Effort**: Ưu tiên impact cao + effort thấp trước
2. **User pain**: Giải quyết pain point thực tế của HLV/Võ sĩ VN trước
3. **Revenue potential**: Tính năng nào giúp bán được sản phẩm sớm nhất

### Bảng tổng hợp

| Gap | Mức độ | Impact | Effort | Ưu tiên |
|---|---|---|---|---|
| Mobile PWA / Responsive | 🔴 Must | ⭐⭐⭐⭐⭐ | Medium | **Phase 1** |
| Quick Session Log | 🔴 Must | ⭐⭐⭐⭐⭐ | Low | **Phase 1** |
| Hạng cân VN (kg display) | 🟡 Should | ⭐⭐⭐ | Low | **Phase 1** |
| Fight Camp Templates | 🟡 Should | ⭐⭐⭐⭐ | Low-Med | **Phase 1** |
| Flexible Medical Mode | 🔴 Must | ⭐⭐⭐⭐⭐ | Medium | **Phase 2** |
| Weight Management | 🟡 Should | ⭐⭐⭐⭐⭐ | Medium | **Phase 2** |
| Zalo Integration | 🟡 Should | ⭐⭐⭐⭐ | Medium | **Phase 2** |
| Localization (Vietnamese) | 🟡 Should | ⭐⭐⭐ | Medium | **Phase 2** |
| Financial Module | 🟢 Nice | ⭐⭐⭐ | High | **Phase 3** |
| Fighter Passport / Record DB | 🟢 Nice | ⭐⭐⭐⭐ | High | **Phase 3** |
| Tournament Dashboard | 🟢 Nice | ⭐⭐⭐⭐ | High | **Phase 3** |

---

## Phase 1: Quick Wins (2-4 Tuần)

> **Mục tiêu**: Làm cho sản phẩm hiện tại dùng được trên điện thoại và bớt nặng thao tác

### 1.1 Mobile Responsive / PWA

**Vấn đề**: HLV/Võ sĩ VN chỉ dùng điện thoại, UI hiện tại tối ưu cho desktop

**Scope**:
- [ ] Responsive breakpoints cho tất cả 57 trang (Tailwind `sm:`, `md:`, `lg:`)
- [ ] Upload video từ camera điện thoại trực tiếp
- [ ] Xem kết quả AI analysis trên mobile (skeleton overlay, findings list)
- [ ] PWA manifest + service worker (install as app)
- [ ] Bottom navigation bar cho mobile (thay sidebar)

**Acceptance criteria**:
- Tất cả trang hiển thị đúng trên iPhone 12 Mini (390px) trở lên
- Upload video từ camera roll ≤ 3 tap
- Xem AI findings trên mobile không cần scroll ngang

### 1.2 Quick Session Log

**Vấn đề**: RecordResult form hiện tại yêu cầu 6+ fields, mất 10-15 phút

**Scope**:
- [ ] "Quick Log" component: 1-tap RPE slider (1-10) + emoji rating (👍😐👎) + optional voice note
- [ ] Batch log: HLV log kết quả cho 5-8 võ sĩ cùng 1 buổi tập
- [ ] Auto-complete: Session tự chuyển `completed` sau 2h nếu không log → HLV chỉ log khi đặc biệt
- [ ] Giữ nguyên RecordResult đầy đủ như option "Chi tiết" cho ai muốn dùng

**Acceptance criteria**:
- Quick Log hoàn thành trong ≤ 15 giây
- Batch log 8 võ sĩ hoàn thành trong ≤ 2 phút

### 1.3 Hạng Cân Hiển Thị Việt Nam

**Vấn đề**: `weightClassEnum` chỉ có tên tiếng Anh (FLYWEIGHT, BANTAMWEIGHT)

**Scope**:
- [ ] Thêm trường `weightLimitKg` vào fighter profile (hoặc mapping table)
- [ ] Hiển thị song ngữ: "60kg — Bantamweight"
- [ ] Hỗ trợ hạng cân LION Championship (56, 60, 65, 70, 77, 84 kg)
- [ ] Hỗ trợ hạng cân Boxing VBF (48, 51, 54, 57, 60, 63.5, 67, 71, 75, 80, 86, 92, +92 kg)

**Acceptance criteria**:
- Tất cả nơi hiển thị weight class đều show kg + tên English
- Dropdown chọn hạng cân theo bộ môn (MMA / Boxing / Muay Thai)

### 1.4 Fight Camp Templates

**Vấn đề**: HLV phải tạo plan + sessions từ đầu, mất 30-60 phút

**Scope**:
- [ ] 4 templates dựng sẵn:
  - Boxing Fight Camp (6 tuần)
  - MMA Fight Camp (8 tuần)
  - Muay Thai Fight Camp (6 tuần)
  - Base Conditioning (4 tuần)
- [ ] HLV chọn template → Auto-fill sessions → Chỉnh sửa nhanh
- [ ] Mỗi template có: phases, daily drills, RPE targets, focus areas
- [ ] HLV có thể save plan đã chỉnh sửa thành template mới

**Acceptance criteria**:
- Tạo plan từ template ≤ 5 phút (vs 30-60 phút hiện tại)
- Template có cấu trúc tuần-buổi tập-drill rõ ràng

---

## Phase 2: Core Adjustments (1-2 Tháng)

> **Mục tiêu**: Điều chỉnh business logic cho phù hợp thực tế VN

### 2.1 Flexible Medical Mode

**Vấn đề**: 99% gym VN không có BS → Module Medical bỏ trống

**Scope**:
- [ ] **Gym Mode** (mặc định cho CLB nhỏ):
  - HLV trưởng có thể ghi nhận chấn thương cơ bản (injury record)
  - HLV có thể đánh dấu "cần nghỉ" / "đã hồi phục"
  - Clearance tự động = `full` nếu không có chấn thương active
  - Medical alerts từ AI → hiển thị cho HLV (không yêu cầu Doctor review)
  - Khi cần thi đấu → prompt "Liên hệ phòng khám đối tác để khám pre-fight"
- [ ] **Tournament Mode** (cho Ban tổ chức / CLB lớn):
  - Giữ nguyên full Doctor role hiện tại
  - BS từ phòng khám bên ngoài đăng nhập = "Affiliated Doctor"
  - BS ringside cấp clearance thi đấu
  - Medical Suspension tracking (KO: 60-90 ngày, TKO: 30-45 ngày)
- [ ] Setting chuyển đổi giữa 2 mode ở cấp tổ chức

**Acceptance criteria**:
- Gym Mode: HLV có thể tự quản lý chấn thương cơ bản mà KHÔNG cần tạo Doctor account
- Tournament Mode: BS ngoại có thể đăng nhập và cấp clearance từ xa

### 2.2 Weight Management Module

**Vấn đề**: Ép cân là pain point #1, gây nguy hiểm sức khỏe

**Scope**:
- [ ] Daily weigh-in: Võ sĩ/HLV nhập cân nặng mỗi sáng (quick input trên mobile)
- [ ] Weight chart: Đường cong cân nặng vs target vs fight day
- [ ] Safe cut calculator: Tốc độ giảm cân an toàn (max 1-1.5% body weight/tuần)
- [ ] Danger alerts:
  - 🟡 Giảm >1.5% BW/tuần
  - 🔴 Giảm >3% BW/tuần → Alert HLV + BS
  - 🚨 >5% BW trong 7 ngày → Khuyến cáo hủy ép cân
- [ ] Hydration tracking (optional): Urine color chart (1-8 scale), USG input
- [ ] Rehydration plan: Checklist nạp lại sau weigh-in (nước, electrolyte, carbs)
- [ ] Fight Week widget: Dashboard countdown + weight status

**Acceptance criteria**:
- Nhập cân nặng ≤ 5 giây (quick input trên mobile)
- Biểu đồ weight trend hiển thị rõ ràng trên mobile
- Alert tự động khi tốc độ giảm cân nguy hiểm

### 2.3 Zalo Notification Integration

**Vấn đề**: Zalo = OS giao tiếp #1 của HLV VN, email/in-app notification không hiệu quả

**Scope**:
- [ ] Zalo OA (Official Account) setup
- [ ] Webhook notifications cho:
  - Video AI analysis hoàn tất → "Video X đã phân tích xong, xem kết quả"
  - Lịch tập sắp tới → "Buổi tập Pad Work lúc 15:00 hôm nay"
  - Medical alert → "Cảnh báo: RPE vượt ngưỡng cho fighter X"
  - Goal update → "Minh Trần: Guard uptime đạt 78% (+5%)"
  - Weight alert → "Cân nặng X: 68.2kg, cần giảm 2.4kg trong 12 ngày"
- [ ] Zalo Mini App (optional): Xem lịch tập, quick log, weight input
- [ ] Fallback: Push notification (Firebase FCM) cho ai không dùng Zalo

**Acceptance criteria**:
- HLV nhận được tin nhắn Zalo khi video AI xong, trong vòng 30 giây
- Tỷ lệ open rate Zalo notification > 70% (vs ~10% email)

### 2.4 Localization (Vietnamese UI)

**Scope**:
- [ ] i18n framework (next-intl hoặc react-intl)
- [ ] Dịch toàn bộ UI labels, tooltips, error messages sang tiếng Việt
- [ ] Giữ option chuyển về tiếng Anh
- [ ] Dịch hạng cân, training types, body regions, injury types
- [ ] Format ngày giờ: dd/MM/yyyy, 24h format

---

## Phase 3: Market Expansion (3-6 Tháng)

> **Mục tiêu**: Mở rộng giá trị cho các segment khách hàng mới

### 3.1 Tournament Dashboard

**Khách hàng**: VMMAF/LION Championship, VBF, Ban tổ chức giải

**Scope**:
- [ ] Event management: Tạo/quản lý giải đấu
- [ ] Fighter registration: Võ sĩ đăng ký thi đấu
- [ ] Medical clearance portal: BS ringside khám + cấp clearance hàng loạt
- [ ] Weigh-in management: Cân ký + xác nhận hạng cân
- [ ] Bracket/matchmaking: Bốc thăm, sắp xếp trận đấu
- [ ] Medical suspension tracking: KO/TKO → auto-ban + countdown
- [ ] Post-event reports: Kết quả, thống kê, medical incidents

### 3.2 Fighter Passport

**Vấn đề**: VN chưa có database thống nhất W-L-D, record, medical history

**Scope**:
- [ ] Fighter profile công khai: Tên, record W-L-D, hạng cân, CLB
- [ ] Fight history: Danh sách trận đấu + kết quả
- [ ] Medical passport: Clearance history, suspension history (chỉ BS xem chi tiết)
- [ ] Cross-gym recognition: Fighter chuyển CLB vẫn giữ được data
- [ ] API cho liên đoàn (VMMAF, VBF) tra cứu

### 3.3 Financial Module (Cơ bản)

**Scope**:
- [ ] PT package tracking: Gói tập, số buổi còn lại, hết hạn
- [ ] Coach commission: Tính hoa hồng HLV tự động
- [ ] Fight team expenses: Chi phí giải đấu, di chuyển, ăn ở
- [ ] Basic revenue dashboard: Thu/chi tháng, top dịch vụ

---

## Tầm Nhìn Dài Hạn (6-12 Tháng)

| Tính năng | Mô tả |
|---|---|
| **Multi-camera AI** | Phân tích từ 2-3 góc camera đồng thời |
| **Sparring AI** | Theo dõi 2 người cùng lúc trong sparring |
| **Opponent scouting** | Upload video đối thủ → AI phân tích pattern |
| **Wearable integration** | Garmin/Apple Watch sync HR, sleep, recovery |
| **Community platform** | Xếp hạng gym, chia sẻ training tips |
| **Mobile native app** | React Native app chính thức (iOS + Android) |

---

## Metrics Theo Dõi

| Metric | Target Phase 1 | Target Phase 2 |
|---|---|---|
| Daily Active Users (CLB pilot) | 10+ HLV/Võ sĩ | 50+ |
| Videos analyzed / week | 20+ | 100+ |
| Quick Log adoption rate | 60%+ | 80%+ |
| Session log completion rate | 40%+ | 70%+ |
| Zalo notification open rate | — | 70%+ |
| Weight check-in frequency | — | 5+/tuần/fighter |

---

## Target Khách Hàng Pilot

### Phase 1-2 Pilot Partners (đề xuất)

| CLB / Tổ chức | Segment | Lý do |
|---|---|---|
| **Saigon Sports Club** | CLB lớn HCMC | 20-35 VĐV, trang bị tốt, sẵn sàng thử nghiệm |
| **Vietnam Top Team** | CLB lớn Hà Nội | 15-25 VĐV, dominant fight team |
| **Cocky Buffalo** | Pro Boxing camp | 10-15 VĐV, mô hình chuyên nghiệp |
| **LION Championship** | Ban tổ chức giải | Medical module fit cao, 20+ events/năm |

---

## Phụ Lục: Tài Liệu Liên Quan

- [PROJECT-OVERVIEW.md](./PROJECT-OVERVIEW.md) — Tổng quan dự án & tech stack
- [VIETNAM-MARKET-ANALYSIS.md](./VIETNAM-MARKET-ANALYSIS.md) — Phân tích thị trường chi tiết
- [BUSINESS-FLOWS.md](./BUSINESS-FLOWS.md) — 8 luồng nghiệp vụ chi tiết
- [MMA-TMS-MASTER-SPECIFICATION-v3.md](./MMA-TMS-MASTER-SPECIFICATION-v3.md) — Spec kỹ thuật
