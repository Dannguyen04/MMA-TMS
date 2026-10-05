# MMA-TMS — Luồng Nghiệp Vụ Chi Tiết

> Phân tích 8 luồng nghiệp vụ từ góc nhìn CLB võ thuật quản lý võ sĩ thi đấu

**Phiên bản**: 1.0
**Cập nhật**: 2026-10-04

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

> Phạm vi: mô tả backend hiện tại trong `nestjs-api/`, đối chiếu source ngày 2026-10-04, và yêu cầu bổ sung phase cho Training Plan. Phần phase bên dưới là yêu cầu cần triển khai, chưa phải hành vi backend hiện tại. Không xác nhận trạng thái triển khai hoặc migration trên database đích.

### Cấu trúc kế hoạch

```
Training Plan
├── fighterId, coachId, title
├── description, goals: nội dung text, có thể để trống
├── startDate: bắt buộc; endDate: có thể để trống
├── milestones: danh sách mốc mục tiêu
├── status: DRAFT | ACTIVE | COMPLETED | CANCELLED
├── isActive: cờ hoạt động riêng, độc lập với status
│
├── Plan Exercises
│   └── exerciseId, orderIndex, sets, reps, durationSeconds, targetRpe, coachNotes
│
└── Training Sessions (liên kết qua planId)
    ├── fighterId, coachId (có thể để trống), title
    ├── sessionType, scheduledAt, plannedDurationSec, roundCount, location
    ├── coachNotes, reportedRpe
    └── status, checkedInAt, completedAt, actualDurationSec và các mốc kết thúc
```

Backend chưa có `phase`, `weeklySessionTarget`, `focusAreas` trong contract và schema Training Plan. Bài tập ở cấp plan có API quản lý riêng; bảng `session_exercises` đã có trong database nhưng chưa có API/service đọc và ghi drills cho từng session. Backend chưa có `targetRpe` ở cấp session.

### Phase của kế hoạch — yêu cầu bổ sung

Yêu cầu ngày 2026-10-04: bổ sung trường `phase` cho Training Plan trong backend. Phase mô tả giai đoạn huấn luyện của kế hoạch, tách biệt với `status` mô tả vòng đời kế hoạch. Việc lưu phase cần migration mới, cập nhật schema và contract API; hiện chưa triển khai.

Bộ phase được chủ dự án xác nhận ngày 2026-10-04, dùng cùng giá trị lowercase trong API và database:

| Phase | Ý nghĩa |
|---|---|
| `base` | Xây dựng sức bền nền và kỹ thuật cơ bản |
| `build` | Phát triển sức mạnh, tốc độ và kỹ thuật nâng cao |
| `fight_camp` | Chuẩn bị chuyên sâu cho thi đấu |
| `taper` | Giảm khối lượng tập trước thi đấu |
| `rehab` | Huấn luyện phục hồi theo hướng dẫn bác sĩ |
| `maintenance` | Duy trì thể trạng và kỹ thuật giữa các đợt tập |

Contract triển khai đã chốt:

- Mỗi plan có một `phase`; khi tạo plan qua `POST /training-plans`, client bắt buộc gửi một trong sáu giá trị trên. Thiếu, `null` hoặc giá trị ngoài enum bị từ chối với `422 VALIDATION_ERROR` theo convention backend.
- `PATCH /training-plans/:id` cho phép sửa `phase` qua quyền sửa plan hiện hữu; không gửi `phase` thì giữ nguyên. Phase luôn phải hợp lệ và không được đặt `null`.
- Các API trả Training Plan phải trả `phase`, bao gồm tạo, danh sách, chi tiết, sửa thông tin và chuyển trạng thái.
- Chủ dự án xác nhận chưa có plan cũ. Migration mới thêm cột `phase` bắt buộc (`NOT NULL`), không gán mặc định và không backfill. Nếu database đích có plan trước khi nâng cấp, migration phải dừng thay vì tự suy ra phase.
- Phase là phân loại của plan, độc lập với `status`; không tự chuyển phase hoặc tự điều chỉnh bài tập, cường độ, clearance hay progress.

Sau khi triển khai, HLV chọn phase khi tạo plan và có thể sửa phase cùng thông tin kế hoạch qua API hiện hữu. Trước khi triển khai, quy trình hiện tại bên dưới vẫn chưa có trường này.

Phạm vi bổ sung hiện tại chỉ là phase của plan; các khoảng cách về weekly target, focus areas, session drills, adherence và medical warnings vẫn giữ trạng thái chưa triển khai như mô tả trong luồng này.

### Quy trình hiện tại

1. **HLV tạo plan** qua `POST /training-plans`: có permission tương ứng và Fighter thuộc phạm vi được phân công. Plan mới mặc định `DRAFT`; nếu có `endDate`, ngày này phải bằng hoặc sau `startDate`.
2. **HLV giao bài tập cấp plan** qua `/training-plans/:id/exercises`: thêm/sửa/xóa bài tập, thứ tự và prescription (sets, reps, thời lượng, target RPE, ghi chú). Backend chưa tự chuyển các bài tập này thành drills của session.
3. **HLV kích hoạt plan** qua `PATCH /training-plans/:id/status`: khi thực sự chuyển vào `ACTIVE`, backend phát thông báo cho Fighter.
4. **HLV lên lịch session** qua `POST /training-sessions`: session có thể thuộc plan hoặc độc lập (`planId` để trống). Khi gắn plan, backend kiểm tra plan tồn tại, `isActive = true` và cùng Fighter; chưa yêu cầu `status = ACTIVE`. Session mới mặc định `SCHEDULED`.
5. **HLV bắt đầu session** qua `PATCH /training-sessions/:id/status`, chuyển sang `IN_PROGRESS`: backend kiểm tra điều kiện y tế trước khi cho bắt đầu.
6. **HLV kết thúc session**: từ `IN_PROGRESS` chuyển sang `COMPLETED`, `ABANDONED` hoặc `CANCELLED`. Backend tính `actualDurationSec` từ `checkedInAt` tới thời điểm kết thúc; RPE thực tế (`reportedRpe`) được cập nhật qua API sửa session. Session còn `SCHEDULED` có thể chuyển sang `SKIPPED` hoặc `CANCELLED`; hủy buổi bắt buộc có lý do.
7. **HLV xem progress và cập nhật trạng thái plan**: tiến độ được trả trong API chi tiết plan; trạng thái plan được chuyển bằng lệnh riêng, không tự hoàn thành theo progress.

### Trạng thái kế hoạch

| Trạng thái hiện tại | Trạng thái tiếp theo backend cho phép |
|---|---|
| `DRAFT` | `ACTIVE`, `COMPLETED`, `CANCELLED` |
| `ACTIVE` | `DRAFT`, `COMPLETED`, `CANCELLED` |
| `COMPLETED` | `ACTIVE`, `CANCELLED` |
| `CANCELLED` | `ACTIVE`, `COMPLETED` |

Gửi lại cùng trạng thái được chấp nhận. Backend chỉ cấm `COMPLETED → DRAFT` và `CANCELLED → DRAFT`; enum hiện tại không có `ARCHIVED`. `isActive` là cờ riêng, không đồng nghĩa với trạng thái `ACTIVE`.

### Medical Clearance Gate

Theo quyết định D9 cập nhật ngày 2026-10-04 trong [Master Specification §05.10.1](./MMA-TMS-MASTER-SPECIFICATION-v3.md), tạo/sửa plan và lên lịch session không bị chặn bởi medical gate. Backend kiểm tra khi chuyển hoặc xác nhận lại `IN_PROGRESS`, và khi đổi loại session đang `IN_PROGRESS`.

- Fighter phải có khám BASELINE; Fighter đã có kết luận TRAINING thật trước migration 016 có thể thuộc diện miễn baseline một lần được ghi nhận trong database.
- Yêu cầu khám chưa xử lý hoặc kết luận TRAINING hiện hành `NOT_ELIGIBLE` chặn bắt đầu tập.
- Kết luận đạt cần clearance từ chính kết luận hiện hành. Clearance mới nhất quyết định hiệu lực; không lấy clearance cũ thay thế khi bản mới bị thu hồi hoặc chưa có hiệu lực.
- Clearance có hạn chế phải còn hiệu lực; loại session phải thuộc `allowedSessionTypes` khi danh sách này được đặt.
- Clearance TRAINING không hạn chế đã hết hạn không tự tạo nghĩa vụ tái khám định kỳ.
- Khi không đủ điều kiện, backend trả `409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED` kèm các lý do. Dừng/hủy buổi tập không bị medical gate chặn.

Training backend chưa triển khai kiểm tra `maxRpe`, cảnh báo theo kỹ thuật/vùng cơ thể, xác nhận cảnh báo của HLV hoặc thông báo BS khi chấp nhận cảnh báo.

### Progress (Tiến độ kế hoạch)

```
completionPercentage = round(completedSessions / totalSessions × 100)

- totalSessions: tất cả session thuộc plan có deletedAt = NULL
- completedSessions: các session trong tập trên có status = COMPLETED
- totalSessions = 0: completionPercentage = 0
```

Backend trả `progress` khi đọc `GET /training-plans/:id`. Buổi tập tương lai và buổi `CANCELLED`, `SKIPPED`, `ABANDONED` vẫn nằm trong mẫu số. Ví dụ 1 buổi completed, 1 buổi tương lai và 1 buổi cancelled trả `completionPercentage = 33%`.

Chỉ số hiện tại là tiến độ trên toàn bộ session của plan; backend chưa cung cấp adherence tính riêng các buổi đã đến hạn và loại cancelled.

### Nguồn đối chiếu backend

- `nestjs-api/src/training/training.model.ts`: request/response contract.
- `nestjs-api/src/training/plans/training-plan.service.ts`: thao tác plan và plan exercises.
- `nestjs-api/src/training/sessions/training-session.service.ts`: lên lịch, chuyển trạng thái và medical gate của session.
- `nestjs-api/src/training/training.constants.ts`: quy tắc chuyển trạng thái.
- `nestjs-api/src/training/training.repo.ts`: persistence và cách tính progress.
- `nestjs-api/src/medical/medical.service.ts`: điều kiện bắt đầu training.
- `nestjs-api/src/database/schema.ts`, migrations 003 và 005: cấu trúc plan/session/exercises.

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
