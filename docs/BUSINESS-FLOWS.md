# MMA-TMS — Luồng Nghiệp Vụ Chi Tiết

> Phân tích 8 luồng nghiệp vụ từ góc nhìn CLB võ thuật quản lý võ sĩ thi đấu

**Phiên bản**: 1.0
**Cập nhật**: 2026-09-29

---

## Điều Hướng Tài Liệu

- [Tổng quan dự án](./PROJECT-OVERVIEW.md) — điểm bắt đầu cho thành viên mới
- **Luồng nghiệp vụ** — tài liệu hiện tại
- [Phân tích thị trường Việt Nam](./VIETNAM-MARKET-ANALYSIS.md) — kiểm chứng các luồng với thực tế vận hành
- [Roadmap](./ROADMAP.md) — chuyển các khoảng cách nghiệp vụ thành task và checklist
- [Spec kỹ thuật v3](./MMA-TMS-MASTER-SPECIFICATION-v3.md) — hợp đồng kỹ thuật chi tiết

---

## Tổng Quan

Hệ thống MMA-TMS vận hành qua **8 luồng nghiệp vụ chính**, xoay quanh vòng đời của một võ sĩ thi đấu tại CLB:

```
Onboarding → Training Plan → Session → Video AI → Coach Review
     ↑                                                    ↓
     └── Goals ← Performance ← Medical ← Fight Camp ←────┘
```

### Vai Trò & Quyền Hạn

| Vai trò | Quyền chính | Quyền đặc biệt |
|---|---|---|
| **Coach** | Tạo/sửa training plan, review AI, giao drill | Accept/reject AI findings |
| **Fighter** | Xem lịch, upload video, đọc feedback | Read-only trên goals, medical |
| **Doctor** | Khám sức khỏe, ghi chấn thương | **Duy nhất** cấp/thu hồi clearance |
| **Admin** | Quản lý users, monitor AI jobs | Full system access, audit |

---

## Luồng 1: Tiếp Nhận Võ Sĩ (Onboarding)

### Quy trình

1. **Admin tạo tài khoản**: Thông tin cơ bản (tên, cân nặng, bộ môn, hạng cân) / Fighter nộp đơn (ktra đầu vào)
2. **Bác sĩ khám baseline**: Examination type `baseline` — tim mạch, thần kinh, cơ-xương, SCAT6
3. **BS cấp Medical Clearance**: `full` / `restricted` / `not_cleared`
4. **HLV được assign**: Giao coach phụ trách
5. **HLV tạo Training Plan**: Kế hoạch huấn luyện đầu tiên
6. **Võ sĩ upload video đầu tiên**: AI phân tích baseline kỹ thuật
7. **HLV đặt Goal đầu tiên**: Mục tiêu cụ thể (guard uptime, kick speed...)

### Trạng thái Fighter Dashboard

Võ sĩ mới thấy **Onboarding Checklist** (hiện ≤30 ngày, đến khi hoàn thành):
- ☐ Khám baseline (chờ BS)
- ☐ Video phân tích đầu tiên (upload bất kỳ video tập)
- ☐ Kế hoạch tập (chờ HLV)
- ☐ Mục tiêu đầu tiên (chờ HLV)

---

## Luồng 2: Lập Kế Hoạch Huấn Luyện (Training Plan)

### Cấu trúc kế hoạch

```
Training Plan (Macrocycle)
├── Phase: base | build | fight_camp | taper | rehab | maintenance
├── Duration: startDate → endDate (thường 6-12 tuần)
├── weeklySessionTarget: 1-14 buổi/tuần
├── focusAreas: [jab, cross, round_kick, ...]
├── Status: draft → active → completed → archived
│
└── Training Sessions (Microcycle)
    ├── Mỗi session có: type, scheduledAt, durationMin, targetRpe
    └── Mỗi session gồm nhiều drills:
        ├── Drill 1: Pad Work — 6 rounds × 3min
        ├── Drill 2: Heavy Bag — 4 rounds × 3min
        └── Drill 3: Clinch entries — 4 sets × 8 reps
```

### Training Phases (Các giai đoạn huấn luyện)

| Phase | Mục tiêu | RPE trung bình | Thời gian |
|---|---|---|---|
| `base` | Sức bền nền, kỹ thuật cơ bản, volume cao | 5-6 | 2-4 tuần |
| `build` | Sức mạnh bùng nổ, combos nâng cao | 6-8 | 2-4 tuần |
| `fight_camp` | Sparring chuyên sâu, game plan đối thủ | 7-9 | 2-4 tuần |
| `taper` | Giảm volume, giữ sharpness, quản lý cân | 4-6 | 1-2 tuần |
| `rehab` | Phục hồi chấn thương, theo hướng dẫn BS | 2-5 | Linh hoạt |
| `maintenance` | Active recovery giữa các camp | 4-6 | Linh hoạt |

### Medical Clearance Gate

Khi HLV tạo/sửa plan, hệ thống tự động kiểm tra clearance:
- **Block (chặn cứng)**: `not_cleared`, `expired`, training type bị cấm, RPE > maxRpe
- **Warn (cảnh báo)**: Kỹ thuật trong danh sách hạn chế, vùng cơ thể được bảo vệ → HLV tick xác nhận + thông báo BS

### Adherence (Tỷ lệ tuân thủ)

```
Adherence% = round(CompletedDueSessions / TotalDueSessions × 100)

- Due Session: scheduledAt ≤ now, trừ cancelled
- Buổi tập tương lai KHÔNG tính vào mẫu số (tránh phạt giả giữa tuần)
```

---

## Luồng 3: Thực Hiện Buổi Tập (Session Execution)

### 4 Giai đoạn

**Stage 1 — Lên lịch & Pre-flight**
- HLV tạo session: type, location, time, duration, targetRpe, drills
- Hệ thống chạy `checkTrainingAgainstClearance()` tự động
- Block → Không cho lưu | Warn → HLV tick xác nhận

**Stage 2 — Trong phòng tập**
- Võ sĩ xem danh sách drill trên app
- HLV đánh dấu drill completed / skipped
- Quay video nếu cần

**Stage 3 — Kết thúc buổi tập (RecordResult)**
- `actualDurationMin`: Thời gian thực tế
- `roundsCompleted`: Số hiệp hoàn thành
- `rpe` (1-10): Võ sĩ tự đánh giá cường độ
- `coachRating` (1-5 ⭐): HLV đánh giá
- `summary`: Nhận xét bằng text
- `completedExerciseIds`: Drill nào đã tập

**Stage 4 — Kiểm tra an toàn hậu tập**
- Nếu `actualRpe > clearance.maxRpe` → 🚨 Alert bác sĩ tự động

### Load Score

```
Load Score = actualDurationMin × actualRpe
Ví dụ: 85 min × RPE 7 = 595
```

---

## Luồng 4: Phân Tích Video AI & Coach Review

### AI Pipeline (10 giai đoạn)

```
1. OpenCV frame extraction
2. YOLOv8-Pose (17 COCO keypoints/frame)
3. Person tracking & identity lock
4. Action Pipeline (Punch FSM + Kick FSM, EMA α=0.35)
5. Quality Gate (PASS / DEGRADED / BLOCKED)
6. Temporal phase segmentation
7. Technique classification & rubric scoring
8. Finding engine (dedup + severity ranking)
9. Joint health tracking
10. Ghost alignment (so sánh với reference video)
```

### 6 Kỹ thuật MVP (Production-Ready)

| # | Technique | FSM |
|---|---|---|
| 1 | Jab | Punch FSM |
| 2 | Cross | Punch FSM |
| 3 | Lead Hook | Punch FSM |
| 4 | Rear Hook | Punch FSM |
| 5 | Round Kick | Kick FSM |
| 6 | Switch Kick | Kick FSM |

### Biomechanical Metrics

| Metric | Cách tính | Baseline (nam pro) |
|---|---|---|
| Striking velocity | Peak velocity wrist/ankle (m/s) | Jab ~7.3, Cross ~8.4, Kick ~11.8 |
| Punch extension | Góc duỗi khuỷu tay | 152°–175° |
| Kick chamber | Góc gập gối trước whip | 38°–80° |
| Hip rotation | Góc xoay hông vs stance | 8°–28° (jab), 40°–86° (cross/kick) |
| Guard uptime% | 100 × (1 - GuardDropMs/ActiveMs) | >80% target |
| Head movement | Slips + rolls per minute | Higher = better |

### Coach Review Flow

1. HLV mở Analysis Workspace
2. Xem video + skeleton overlay + AI findings panel
3. Với mỗi AI finding → **Confirm** ✅ / **Correct** ✏️ / **Reject** ❌ (bắt buộc ghi lý do)
4. Chấm overall rating (1-5 ⭐) + text feedback
5. Giao corrective drill → Gắn vào buổi tập tiếp theo
6. Submit → Thông báo đến võ sĩ

### AI Safety Rules (Quy tắc an toàn)

| ❌ CẤM | ✅ CHO PHÉP |
|---|---|
| "injury diagnosed", "tear identified" | "movement observation", "pattern detected" |
| Force tuyệt đối (Newton) | Proxy tương đối (px/frame) |
| Xác nhận góc chính xác | Góc ước lượng 2D ± 5-20° |
| Thay thế quyết định y tế | Cảnh báo cho BS review |

---

## Luồng 5: Y Tế & Medical Clearance

### Vòng đời Clearance

| Trạng thái | Ý nghĩa | Ảnh hưởng đến tập luyện |
|---|---|---|
| `none` | Chưa có hồ sơ y tế | Cảnh báo mềm, cần khám baseline |
| `full` (active) | Đủ sức khỏe | Tập không giới hạn |
| `restricted` (active) | Có điều kiện | Trong giới hạn BS quy định |
| `not_cleared` (active) | Cấm tập | Chặn cứng mọi session |
| `expired` | Hết hạn | Chặn cứng, cần khám gia hạn |
| `revoked` | Thu hồi khẩn cấp | Cấm tập đến khi BS khám lại |
| `superseded` | Đã thay thế | Lưu lịch sử audit |

### Examination Types

| Loại khám | Khi nào | Nội dung |
|---|---|---|
| `baseline` | Gia nhập CLB | Toàn diện: Tim, Phổi, Thần kinh, SCAT6, Cơ-xương |
| `routine` | Định kỳ | ROM, Strength, Weight, Hydration |
| `pre_fight` | ≤30 ngày trước thi đấu | Cardio, Neuro, Mắt, Chỉnh hình, Xét nghiệm máu |
| `post_injury` | Sau chấn thương | Inspection, Palpation, ROM, Strength, Neurovascular |
| `concussion_screen` | Nghi ngờ chấn động não | SCAT6: Red flags, 22 triệu chứng, SAC, mBESS |
| `return_to_play` | Trước khi trở lại | Triệu chứng, Exertional tolerance, Sport-specific |

### Recovery Templates

| Chấn thương | Số phase | Thời gian | Đặc điểm |
|---|---|---|---|
| Muscle strain | 5 phases | ~6 tuần | Protection → Early loading → Eccentric → Sport-specific → Full |
| Ligament sprain | 4 phases | ~6 tuần | Protection → ROM → Proprioception → Return |
| Fracture | 4 phases | ~10 tuần | Immobilise → Mobilise → Strengthen → Graded return |
| Concussion | 6 stages | ≥24h/stage | Rest → Aerobic → Non-contact → Non-contact drill → Contact → Competition |

### Recovery Progress

```
Recovery% = round((CompletedPhases + CurrentPhaseMilestonesDone/CurrentPhaseTotal) / TotalPhases × 100)
```

---

## Luồng 6: Chuẩn Bị Thi Đấu (Fight Camp)

### Timeline điển hình

| Tuần | Phase | Nội dung | RPE |
|---|---|---|---|
| 1-2 | Build | Tăng volume, kỹ thuật nền | 6-7 |
| 3-4 | Peak | Sparring + game plan đối thủ | 8-9 |
| 5 | Specifics | Chiến thuật chuyên sâu | 7-8 |
| 6 | Taper | Giảm volume, cắt cân, sharpness | 4-6 |

### Pre-fight Medical Requirements

- Khám toàn diện ≤30 ngày trước trận
- Xét nghiệm máu: HBsAg, Anti-HCV, HIV (dương tính = loại)
- Chụp CT/MRI não nếu từng bị KO trong 6 tháng
- Clearance phải còn hiệu lực đến ngày thi đấu
- Fighter Dashboard hiển thị đếm ngược + cảnh báo clearance sắp hết hạn

---

## Luồng 7: Performance & Goals

### 8 Chiều Kỹ Thuật (0-100)

| # | Dimension | Dữ liệu nguồn |
|---|---|---|
| 1 | Jab | AI video: velocity, extension, retraction |
| 2 | Cross | AI video: hip rotation, extension, velocity |
| 3 | Hook | AI video: arm angle, body rotation |
| 4 | Kick | AI video: chamber angle, hip rotation, velocity |
| 5 | Combination | AI video: transition speed, flow |
| 6 | Footwork | AI video: stance width, lateral movement, pivots |
| 7 | Guard | AI video: guard uptime%, hand position |
| 8 | Head movement | AI video: slips/rolls per minute, centerline exposure |

### Trend Tracking

- Rolling 12-week window (w11 → w0)
- 4-week moving average baseline
- Score delta ≤ 1.0 = noise → classified neutral
- Nếu tuần thiếu dữ liệu (medical restriction) → carry forward tuần trước

### Goal Types & Status

| Goal type | Ví dụ |
|---|---|
| `technique` | Nâng guard uptime lên 85% |
| `weight` | Giảm từ 68kg xuống 65.8kg |
| `volume` | 5 buổi tập/tuần trong 8 tuần |
| `consistency` | Adherence ≥ 90% trong fight camp |
| `conditioning` | Chạy 5km dưới 22 phút |

**Status flow**: `active` → `on_track` / `at_risk` → `achieved` / `missed` / `abandoned`

**Trajectory formula**:
```
Expected = (Today - Start) / (Due - Start) × (Target - Baseline)
If Actual ≥ 0.9 × Expected → on_track
If Actual < 0.9 × Expected → at_risk
If Actual ≥ Target → achieved
```

---

## Luồng 8: Quản Trị (Admin)

### Chức năng

| Module | Mô tả |
|---|---|
| User Management | CRUD users, assign roles, activate/deactivate |
| AI Jobs Monitor | Queue status, retry failed jobs, error tracking |
| AI Models Registry | Version management, confidence thresholds |
| Audit Logs | Bất biến (append-only), clinical data redacted cho non-medical |
| Notifications | Broadcast hệ thống |
| Settings | Clearance expiry warning days, storage config |

### Audit Trail Security

- **Append-only**: PostgreSQL triggers chặn UPDATE/DELETE
- **Clinical sanitization**: Admin/HLV xem audit → thông tin y tế bị redact
- **Immutable entities**: `audit_logs`, `coach_reviews`, `action_assessments`

---

## Tương Tác Giữa Các Vai Trò

| Luồng | Coach | Fighter | Doctor | Admin |
|---|---|---|---|---|
| Training Plan | ✅ Tạo, publish | 📖 Xem lịch | — | — |
| Session | ✅ Lên lịch, ghi kết quả | 📖 Xem drill, báo RPE | 🚦 Clearance gate | — |
| Video AI | ✅ Review findings | 📹 Upload, xem feedback | — | 🔧 Monitor |
| Medical | 📖 Xem clearance | 📖 Xem clearance & injuries | ✅ **Toàn quyền** | 📋 Audit |
| Performance | ✅ Đặt goals | 📖 Xem điểm & tiến độ | — | — |
| Fight Camp | ✅ Plan camp | 📖 Countdown, weight | ✅ Pre-fight exam | — |

---

## Đọc Tiếp

Đối chiếu các luồng trên với [thực tế thị trường Việt Nam](./VIETNAM-MARKET-ANALYSIS.md), sau đó chọn hạng mục triển khai trong [Roadmap](./ROADMAP.md). Nếu cần tra cứu cấu trúc dữ liệu hoặc API, xem [spec kỹ thuật v3](./MMA-TMS-MASTER-SPECIFICATION-v3.md).
