# MMA-TMS — Phân Tích Thị Trường Việt Nam

> Đánh giá hệ thống MMA-TMS đối chiếu với thực tế thị trường võ thuật Việt Nam 2024–2026

**Phiên bản**: 1.0
**Cập nhật**: 2026-09-29
**Phương pháp**: Nghiên cứu thị trường + đối chiếu mã nguồn + phân tích gap

---

## 1. Bối Cảnh Thị Trường

### 1.1 Quy mô & Tăng trưởng

| Chỉ số | Số liệu |
|---|---|
| Giá trị ngành Fitness VN | $500M+ (2024) → dự kiến $3.78B (2030), CAGR ~19% |
| Số phòng tập võ thuật | **1,200+** CLB toàn quốc |
| Phân bố | HCMC (~45%), Hà Nội (~30%), tỉnh khác (~25%) |
| Tăng trưởng BJJ/MMA | >35% YoY tại tier-1 cities |
| Doanh thu nữ giới (Kickfit) | >40% doanh thu gym combat đô thị |

### 1.2 Các Liên Đoàn & Giải Đấu Chính

| Tổ chức | Bộ môn | Giải đấu tiêu biểu |
|---|---|---|
| **VMMAF** (Liên đoàn MMA VN) | MMA | LION Championship (20+ events/năm), Cúp CLB QG |
| **VBF** (Liên đoàn Quyền Anh VN) | Boxing | VĐ Quyền Anh QG, Pro boxing (WBO/IBF Oriental) |
| **LĐ Muay TP.HCM** | Muay Thai | VĐ Muay QG, WBC Muay Thai events |
| **VVF** (Liên đoàn Vovinam) | Vovinam | VĐ Vovinam QG, World Cup Vovinam |
| **VTF** (Liên đoàn Taekwondo) | Taekwondo | VĐ CLB QG, CJ Vietnam Open |
| **ONE Championship** | MMA/Muay | Road to ONE VN, ONE Friday Fights |

### 1.3 Gym / CLB Hàng Đầu

**TP. Hồ Chí Minh:**
| Gym | Quy mô | Đặc điểm |
|---|---|---|
| **Saigon Sports Club (SSC)** | 7,000m², 20-35 VĐV, 1,500+ hội viên | Mega-complex, đa bộ môn |
| **Cocky Buffalo** | 10-15 VĐV chuyên nghiệp | Full scholarship, ký túc xá, Pro Boxing |
| **Võ Đường Liên Phong** | 8-15 VĐV | Sáng lập: Johnny Trí Nguyễn, pioneer MMA VN |
| **No.1 Muay Club** | Fight team + phong trào | Sáng lập: Nguyễn Trần Duy Nhất |
| **MMA Saigon** | Fight team mạnh | HLV Ngô Xuân Hải, LION Championship fighters |

**Hà Nội:**
| Gym | Quy mô | Đặc điểm |
|---|---|---|
| **Vietnam Top Team (VTT)** | 15-25 VĐV thi đấu | Dominant team Bắc VN, LION Championship |
| **AGOGE** | 10-18 VĐV | Wrestling, BJJ, sports science |
| **MMA Hà Đông** | Grassroots | Sản xuất VĐV bền bỉ |

### 1.4 VĐV Tiêu Biểu

| Tên | Bộ môn | Thành tích |
|---|---|---|
| **Nguyễn Trần Duy Nhất** | Muay Thai | 7x VĐ thế giới, ONE Championship |
| **Trương Cao Minh Phát** | Muay Thai → MMA | WBC Super Featherweight World Champion |
| **Huỳnh Hà Hữu Hiếu** | Muay Thai | Cựu World No.1 WBC, IFMA World Champion |
| **Trương Đình Hoàng** | Boxing | WBA Asia Super Middleweight Champion |
| **Nguyễn Thị Tâm** | Boxing | ASBC Asian Champion, Paris 2024 Olympian |
| **Việt Anh Đỗ** | MMA | ONE Championship contract ($100,000) |
| **Nghiêm Văn Ý** | MMA/Wushu | LION Championship 65kg Champion |
| **Trần Quang Lộc** _(In Memoriam)_ | MMA | Pioneer MMA VN, ONE Warrior Series veteran |

---

## 2. Thực Trạng Vận Hành CLB Tại Việt Nam

### 2.1 Lịch Tập Điển Hình (Fight Team)

```
📅 Lịch ngày của đội tuyển (5-6 ngày/tuần):
├── 06:30 - 08:30  Chạy bộ (5-8km), nhảy dây, core
├── 09:00 - 10:30  S&C (plyometrics, tạ, grip/neck)
├── 10:30 - 14:30  Ăn, ngủ trưa, recovery
├── 15:00 - 17:30  Kỹ thuật chuyên sâu:
│   ├── Ngày đánh: Pad work, Dutch drilling, heavy bag
│   ├── Ngày vật: Wall wrestling, positional sparring
│   └── T3/T6: Sparring (5-8 hiệp live)
└── 18:00 - 18:30  Cool-down, ice bath, cân nặng
```

### 2.2 Công Nghệ HLV Đang Dùng

| Công cụ | Tỷ lệ dùng | Mục đích |
|---|---|---|
| **Zalo group** | ~80% | Lịch tập, thông báo, chia sẻ video, weight check-in |
| **Google Sheets / Excel** | ~15% | Tracking cân nặng, fight record, điểm danh |
| **Bảng trắng (whiteboard)** | ~5% | Lịch tuần treo tường, chiến thuật |
| **iPhone slow-mo** | ~90% | Quay sparring, tua chậm xem lỗi |
| **CapCut / VN Editor** | ~20% (HLV trẻ) | Phóng to, tua 0.3x, annotate |
| **Kinovea / Dartfish** | <5% | Chỉ cấp viện nghiên cứu / ĐH TDTT |
| **AMS chuyên nghiệp** | **~0%** | Không gym nào dùng TeamBuildr, Kinduct... |

### 2.3 Mô Hình Tài Chính CLB

```
Mô hình "Lấy ngắn nuôi dài":

  💰 DOANH THU                           💸 CHI PHÍ
  ┌─────────────────────┐                ┌─────────────────────┐
  │ Hội viên phong trào  │ ──────────── │ Mặt bằng thuê       │
  │ (Kickfit, PT)        │              │ Lương HLV            │
  │ = 80-90% doanh thu   │              │ Điện nước, thiết bị  │
  ├─────────────────────┤              ├─────────────────────┤
  │ Đội tuyển thi đấu   │ ──────────── │ Giải đấu (đăng ký,  │
  │ = 0-10% doanh thu   │              │ di chuyển, ăn ở)     │
  │ (thường = chi phí)  │              │ = "đầu tư danh tiếng"│
  └─────────────────────┘              └─────────────────────┘
```

> **Insight quan trọng**: Fight team gần như KHÔNG tạo doanh thu trực tiếp. HLV phải dạy 6-9 giờ PT/ngày để nuôi CLB. Thời gian rảnh rất ít → Mọi tool phải cực kỳ nhanh gọn.

---

## 3. Giám Sát Y Tế — Thực Trạng vs. Hệ Thống

### 3.1 Tại Phòng Tập (Hàng Ngày)

| Thực tế | Chi tiết |
|---|---|
| **Có bác sĩ thể thao?** | ❌ **99% gym KHÔNG CÓ** |
| **Xử lý chấn thương** | HLV tự chườm đá, dán tape Kinesio, massage dầu nóng |
| **Concussion tracking** | ❌ Hầu như không tồn tại. Võ sĩ bị "flash KO" trong sparring → trở lại tập sau 48h |
| **Nơi khám chấn thương nặng** | BV Thể thao VN (Hà Nội), BV Chấn thương Chỉnh hình (HCMC), STARSMEC, ACC |

### 3.2 Trước Giải Đấu (Bắt buộc)

| Yêu cầu | LION Championship / VBF |
|---|---|
| **Giấy khám sức khỏe** | Có, từ BV quận/huyện trở lên (3-6 tháng) |
| **Xét nghiệm máu** | HBsAg (Viêm gan B), Anti-HCV (Viêm gan C), HIV → Dương tính = loại |
| **Chụp não CT/MRI** | Bắt buộc cho tranh đai, hoặc nếu từng bị KO trong 6 tháng |
| **Khám tại weigh-in** | Huyết áp, nhịp tim, đồng tử, khớp, tình trạng mất nước |
| **Đình chỉ sau KO** | KO: 60-90 ngày, TKO: 30-45 ngày + cần CT não bình thường |

### 3.3 Khung Pháp Lý

| Quy định | Nội dung |
|---|---|
| **Luật TDTT (sửa đổi 2018)** | Bắt buộc khám sức khỏe định kỳ cho VĐV cấp tỉnh/QG |
| **Thông tư 13/2018/TT-BVHTTDL** | Yêu cầu cơ sở vật chất, trang thiết bị, nhân viên chuyên môn Boxing |
| **Quy chế Pro Boxing VBF (01/2026)** | 8 chương, 53 điều — quy định toàn diện Boxing chuyên nghiệp VN |
| **Yêu cầu y tế tại gym** | Chỉ bắt buộc có túi sơ cứu. **KHÔNG bắt buộc có bác sĩ** |
| **Tổ chức giải đấu** | Bắt buộc: xe cứu thương, BS ringside, bảo hiểm, kiểm tra doping |

---

## 4. Đối Chiếu: MMA-TMS vs. Thực Tế Việt Nam

### 4.1 Bảng Chấm Điểm Từng Luồng

| # | Luồng | Đúng quy trình | Nhanh gọn | Phù hợp VN | Tổng /15 |
|---|---|:---:|:---:|:---:|:---:|
| 1 | Onboarding | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | 9 |
| 2 | Training Plan | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 11 |
| 3 | Session Execution | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | 8 |
| 4 | **Video AI** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | **12** |
| 5 | Medical | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | 11 |
| 6 | Fight Camp | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | 9 |
| 7 | **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **13** |
| 8 | Admin | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 11 |
| | **TỔNG** | | | | **84/120 (70%)** |

### 4.2 Điểm Mạnh Vượt Trội

| # | Điểm mạnh | Lợi thế vs thị trường |
|---|---|---|
| 1 | **AI Video Analysis (YOLOv8-Pose)** | 0% gym VN đang có → First-mover advantage |
| 2 | **Performance Scoring tự động** | HLV VN đánh giá bằng "cảm giác" → AI score 0-100 là cách mạng |
| 3 | **Medical Clearance engine** | Đúng chuẩn VMMAF/VBF → Giá trị cho Ban tổ chức giải |
| 4 | **Conflict Engine real-time** | Tự động chặn buổi tập vi phạm clearance → An toàn sức khỏe |
| 5 | **Append-only audit trail** | Minh bạch, truy vết được → Compliance với Luật TDTT |
| 6 | **Closed-loop coaching** | AI finding → Coach review → Corrective drill → Session → Re-evaluate |
| 7 | **Structured database (46 tables)** | Tiệm cận Smartabase (UFC PI Shanghai) |

### 4.3 Phân Tích Gap — 9 Khoảng Cách Thực Tế

#### 🔴 NGHIÊM TRỌNG (Must Fix)

**Gap #1: Doctor Role không khả dụng tại gym**
- *Thực tế*: 99% gym VN không có BS thể thao
- *Hệ thống*: Module y tế yêu cầu role `DOCTOR` đăng nhập → Bỏ trống vĩnh viễn
- *Đề xuất*: Thêm "Gym Mode" cho HLV kiêm medical cơ bản, hoặc BS ngoại đăng nhập từ xa

**Gap #2: Desktop-first UX**
- *Thực tế*: HLV/Võ sĩ VN chỉ dùng điện thoại (iPhone, Android)
- *Hệ thống*: Web dashboard 57 trang tối ưu cho màn hình lớn
- *Đề xuất*: Mobile PWA — upload video, xem kết quả AI, quick log trực tiếp trên điện thoại

**Gap #3: Nhập liệu buổi tập quá nặng**
- *Thực tế*: HLV dạy 6-9h/ngày, kiệt sức → Không có thời gian ngồi web nhập data
- *Hệ thống*: RecordResult yêu cầu RPE + rounds + rating + summary + exercise checklist (~10 phút)
- *Đề xuất*: Quick Log (1-tap RPE + emoji + voice note = 15 giây), batch log cho nhóm

#### 🟡 QUAN TRỌNG (Should Fix)

**Gap #4: Thiếu Weight Management**
- *Thực tế*: Ép cân là pain point #1 — võ sĩ ép 6-10kg/5-7 ngày, nguy hiểm sức khỏe
- *Hệ thống*: Chỉ có trường `targetWeightKg` trên fighter profile, không có tracking hàng ngày
- *Đề xuất*: Daily weigh-in, đường cong ép cân an toàn, hydration alerts, rehydration plan

**Gap #5: Thiếu Zalo Integration**
- *Thực tế*: Zalo = hệ thống giao tiếp #1 của HLV VN. Email gần như không ai đọc
- *Hệ thống*: In-app notifications, không có Zalo/push notification
- *Đề xuất*: Zalo OA Bot hoặc Webhook → Thông báo video AI xong, nhắc lịch tập, cảnh báo cân

**Gap #6: Thiếu Fight Camp Templates**
- *Thực tế*: HLV muốn chọn template "Fight Camp Boxing 6 tuần" → Tùy chỉnh nhẹ
- *Hệ thống*: HLV phải tạo plan từ đầu, drill by drill
- *Đề xuất*: Pre-built templates (Boxing 6w, MMA 8w, Muay Thai 6w...) → 1-click apply

**Gap #7: Hạng cân hiển thị tiếng Anh**
- *Thực tế*: VN dùng "Hạng 60kg" chứ không dùng "Bantamweight"
- *Hệ thống*: `weightClassEnum` chỉ có tên tiếng Anh (FLYWEIGHT, BANTAMWEIGHT...)
- *Đề xuất*: Thêm `weight_kg_limit` + hiển thị song ngữ (ví dụ: "60kg — Bantamweight")

#### 🟢 NÊN CÓ (Nice to Have)

**Gap #8: Thiếu quản lý tài chính cơ bản**
- Gym VN cần tracking: gói PT, hoa hồng HLV, thu chi đội tuyển
- Hiện không có module tài chính

**Gap #9: Thiếu Fighter Record database**
- VN chưa có BoxRec nội địa — không ai track W-L-D thống nhất
- Có thể trở thành platform data cho liên đoàn

---

## 5. Đối Thủ Cạnh Tranh

### 5.1 Trong Nước (Việt Nam)

| Phần mềm | Loại | Có tính năng võ thuật? |
|---|---|---|
| GymMaster / TimeSoft | Quản lý phòng tập (POS/CRM) | ❌ Không |
| PosApp / KiotViet | POS bán lẻ áp dụng cho gym | ❌ Không |
| GYMO.VN / Sapo Gym | SaaS quản lý hội viên | ❌ Không |
| **Startup combat sports** | — | **KHÔNG TỒN TẠI (0 đối thủ)** |

### 5.2 Quốc Tế

| Phần mềm | Giá | Ngôn ngữ | Phù hợp VN? |
|---|---|---|---|
| Smartabase (Fusion Sport) | $$$$ | EN | ❌ Quá đắt, enterprise-only (UFC PI) |
| TeamBuildr | $$$ | EN | ❌ Chung, không chuyên võ thuật |
| Kinduct | $$$ | EN | ❌ Không có AI video |
| TrainHeroic | $$ | EN | ❌ S&C only, không martial arts |
| Kinovea (free) | Free | EN | ⚠️ Manual, không AI, desktop |

> **Kết luận**: MMA-TMS ở vị thế **first-mover** tại VN — 0 đối thủ trực tiếp trong combat sports tech.

---

## 6. So Sánh Khu Vực

| Tiêu chí | VN hiện tại | Thái Lan (Tiger Muay Thai) | Singapore (Evolve MMA) | TQ (UFC PI Shanghai) |
|---|---|---|---|---|
| **AMS Software** | Zalo + Excel | Mindbody, Gymdesk | PWA tự phát triển | Smartabase (full) |
| **Video Analysis** | iPhone slow-mo | iPhone slow-mo | HLV QT phân tích | Camera đa góc, Motion capture 3D |
| **Y tế** | Không có BS ở gym | Massage Thái, khám BV khi cần | Physio liên kết | Đội BS thể thao, cryo, hypoxic |
| **Wearables** | Garmin/Apple Watch cá nhân | Polar, GPS Catapult (pro) | HR monitor trong lớp | Cảm biến lực, Senaptec |
| **MMA-TMS** | ✅ AI Video, Medical, Performance | — | — | Tương đương Smartabase |

---

## 7. Kết Luận Chiến Lược

### Vị trí MMA-TMS trên thị trường

```
Thị trường VN           MMA-TMS              Chuẩn quốc tế
(Zalo + iPhone)         (Web + AI)           (UFC PI / Smartabase)
────●─────────────────────●────────────────────●────
    │     AHEAD 3-5 năm   │   TO GO 1-2 năm   │
```

### 3 Khách hàng tiềm năng

| Segment | Ví dụ | Willingness to pay | Fit hiện tại |
|---|---|---|---|
| **A. CLB chuyên nghiệp** | SSC, Cocky Buffalo, VTT | Cao | 70% — cần mobile UX |
| **B. Ban tổ chức giải** | VMMAF/LION, VBF, Shadow Ent. | Cao | 85% — Medical module rất phù hợp |
| **C. 1,200+ gym phong trào** | Gym nhỏ, lớp Kickfit | Thấp | 40% — cần đơn giản hóa triệt để |

### Đề xuất ưu tiên target
1. **Phase 1**: CLB chuyên nghiệp (10-20 CLB) + Ban tổ chức giải — validate product
2. **Phase 2**: Mở rộng freemium cho gym phong trào — scale user base
3. **Phase 3**: Fighter Passport platform — trở thành data infrastructure cho ngành
