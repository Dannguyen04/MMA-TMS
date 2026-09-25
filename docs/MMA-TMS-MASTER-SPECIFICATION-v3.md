# MMA-TMS — MASTER PRODUCT & SYSTEM SPECIFICATION

> **Single Source of Truth** cho sản phẩm, requirements, domain, AI, UX/UI và technical architecture của MMA-TMS.

**Version:** 3.2\
**Status:** Active Specification — Academic Hardening  
**Project:** MMA-TMS — MMA Training & Movement Analysis System  
**Supersedes:** v3.1, v3.0, v2.0 (Active Specification)\
**Changes from v3.1:** Chính sách Medical/measurements chỉ dành cho assigned Doctor — đã duyệt ngày 2026-09-25, chưa triển khai; xem §05.10.1 và Section 27.\
**Changes from v3.0:** Fighter Admissions policy (GUEST role, admission workflow, activation qua password recovery) — xem Section 27 (Change Log)  
**Changes from v2.0:** Xem Section 27 (Change Log)

---

## 00. DOCUMENT CONTROL

### 00.1 Purpose

Tài liệu này định nghĩa hệ thống MMA-TMS từ góc nhìn sản phẩm đến triển khai kỹ thuật.

Tất cả thành viên dự án và AI coding agents phải xem tài liệu này là **Source of Truth**.

### 00.2 Core Principles

1. User-centric
2. Insight-first
3. Evidence-based
4. Human-in-the-loop
5. AI-assistive
6. Medical-safe
7. Traceable AI results
8. Requirements before implementation
9. Domain-first architecture
10. Documentation must evolve with the system

### 00.3 Change Policy

Không tự ý biến một ý tưởng hoặc implementation detail thành requirement chính thức.

`Proposal → Review → Approve → Update Master Specification → Implement`

### 00.4 How to Read This Document

- **Section 01–06:** Product & Persona (đọc trước nếu bạn là PM/Designer)
- **Section 07–11:** Domain & AI Architecture (đọc trước nếu bạn là Backend/AI Engineer)
- **Section 12–14:** UX/UI + API (đọc trước nếu bạn là Frontend Engineer)
- **Section 15–17:** Infrastructure & Non-functional (đọc trước nếu bạn là DevOps)
- **Section 18–21:** Quality & Process (đọc trước nếu bạn là QA/Tech Lead)
- **Section 22:** Roadmap & MVP (đọc nếu bạn muốn biết priorities)

---

# 01. PRODUCT DEFINITION

## 01.1 Product Name

**MMA-TMS — MMA Training & Movement Analysis System**

## 01.2 Product Definition

MMA-TMS là nền tảng hỗ trợ huấn luyện và phân tích chuyển động võ sĩ MMA bằng video, computer vision và các đặc trưng chuyển động có thể quan sát được.

Hệ thống biến:

`Video / Motion Data → Metrics → Findings → Insights → Actions`

thay vì chỉ trả về raw pose coordinates hoặc các con số rời rạc.

## 01.3 Product Vision

> Giúp võ sĩ hiểu rõ chuyển động của mình, giúp huấn luyện viên có bằng chứng trực quan để sửa kỹ thuật, và giúp chuyên gia y tế theo dõi các chỉ số vận động theo thời gian.

## 01.4 Product Value

### Fighter

- Feedback nhanh
- Hiểu lỗi kỹ thuật
- Theo dõi tiến bộ
- So sánh với chính mình hoặc reference movement
- Tăng động lực luyện tập

### Coach

- Evidence trực quan
- Frame-by-frame analysis
- Timeline và slow motion
- Theo dõi nhiều võ sĩ
- So sánh session
- Review/correct AI findings

### Sports Doctor / Physiotherapist

- ROM (Range of Motion)
- Left/right asymmetry
- Movement trends
- Threshold alerts
- Rehabilitation tracking

### Admin

- Quản lý account và role
- Quản lý hệ thống
- Audit
- AI model/version
- Job monitoring

---

# 02. USER PERSONAS

## 02.1 Fighter / Student

**Goal:** "Tôi muốn đá nhanh hơn, mạnh hơn và đúng kỹ thuật."

### Problems

- Khó tự nhận biết lỗi kỹ thuật
- Không biết mình có tiến bộ hay không
- Raw metrics khó hiểu
- Cần feedback nhanh trong quá trình luyện tập

### Needs

- Simple feedback bằng ngôn ngữ tự nhiên
- Score (0–100) dễ hiểu
- Improvement % so với session trước
- Speed trend (faster/slower)
- Form score
- Ghost Mode để so sánh với reference
- Realtime feedback khi tập

### Main Actions

- Upload training video
- Bật realtime analysis qua camera
- Xem analysis result
- Xem progress chart theo thời gian
- So sánh với session trước
- So sánh với reference movement (Ghost Mode)

## 02.2 Coach

**Goal:** "Tôi muốn có bằng chứng trực quan để sửa lỗi cho học trò và quản lý tiến độ của cả võ đường."

### Problems

- Khó chỉ ra chính xác thời điểm lỗi
- Khó theo dõi nhiều võ sĩ đồng thời
- Khó so sánh session của cùng một võ sĩ
- AI có thể nhận định sai — cần override

### Needs

- Frame-by-frame navigation đến evidence frame
- Timeline visualization với phase markers
- Slow motion playback
- Exact impact frame highlight
- Highlight body part liên quan
- Evidence metrics (số đo cụ thể)
- Athlete history overview
- Khả năng review/correct AI findings

### Main Actions

- Manage fighters (thêm, xem, assign)
- Manage training plans
- Review sessions của từng fighter
- Inspect và correct AI findings
- Compare sessions (A vs B)
- Add coach feedback / annotation
- Track progress theo thời gian

## 02.3 Sports Doctor / Physiotherapist

**Goal:** "Tôi muốn dữ liệu sinh cơ học đáng tin cậy để theo dõi nguy cơ vận động và quá trình phục hồi."

### Problems

- Khó theo dõi ROM theo thời gian một cách định lượng
- Khó phát hiện asymmetry bằng quan sát đơn thuần
- Cần dữ liệu định lượng có thể so sánh
- Video-based metrics có giới hạn độ chính xác (xem Section 10.4)

### Needs

- ROM measurements theo session
- Left/right comparison với số liệu cụ thể
- Asymmetry % với trend
- Configurable monitoring thresholds
- Historical trends chart
- Rehabilitation progress measurements

### Main Actions

- Review athlete movement data
- Review medical information
- Monitor ROM theo thời gian
- Review asymmetry alerts
- Review monitoring alerts
- Track rehabilitation progress

## 02.4 System Administrator

- Account management (create, deactivate, reset)
- Role assignment
- System health monitoring
- Job monitoring (pending, processing, failed)
- Data management (retention, deletion)
- Audit log review
- AI model version management

## 02.5 AI Module

AI không phải human actor. AI là **supporting system capability**.

### Responsibilities

- Pose estimation (2D keypoints từ video)
- Person tracking (chọn athlete chính)
- Action detection (kick, punch, other)
- Phase detection (chamber, extension, impact, retract, guard)
- Biomechanical metric calculation
- Technique analysis và scoring
- Asymmetry calculation
- Comparison với reference motion
- Finding generation
- Insight generation (by persona)

### Hard Constraints

- AI **không được** tự nhận là Coach, Doctor hoặc Medical Diagnostician.
- AI **không được** dùng từ "chẩn đoán" (diagnose) hoặc "kết luận y khoa" (medical conclusion).
- AI output phải luôn kèm `confidence` và `data_quality`.
- Low-confidence results phải được flag và không được present như certain facts.

---

# 03. PRODUCT PRINCIPLES

## 03.1 Insight-First

Mọi metric quan trọng phải có mục đích sử dụng cho ít nhất một persona. Không xây metric chỉ vì model có thể tính được.

## 03.2 Metric ≠ Finding ≠ Insight ≠ Recommendation

**Metric:** Giá trị định lượng đo được từ video.  
Ví dụ: `knee_angle_at_impact = 147°`

**Finding:** AI phát hiện một hiện tượng, có evidence.  
Ví dụ: `Knee extension 13° below reference baseline at frame 247`

**Insight:** Giải thích có ý nghĩa đối với persona cụ thể.  
Ví dụ (Fighter): `"Chân chưa duỗi đủ ở pha impact — giảm lực đá"`

**Recommendation:** Hành động đề xuất cụ thể.  
Ví dụ: `"Thử giữ đá cao hơn 0.3s ở pha extension để tăng góc duỗi"`

## 03.3 Evidence-First Trust Model

Mọi Finding phải traceble đến:

- Analysis ID
- Action ID
- Frame range (start_frame, end_frame)
- Timestamp (ms)
- Metric name + value
- Model version + scoring version
- Confidence score
- Data quality indicator

## 03.4 Human-in-the-Loop

Coach và Doctor phải có khả năng review, correct hoặc override AI findings. AI là assistant, không phải authority.

## 03.5 Technique Correctness Is Operational, Not Universal

MMA-TMS **không tuyên bố xác định một kỹ thuật MMA "đúng" theo nghĩa tuyệt đối**.

Trong phạm vi hệ thống, technique quality được định nghĩa theo:
1. **Expert-defined technique criteria** — các tiêu chí quan sát được do domain expert xác định;
2. **Observable kinematic features** — các đặc trưng có thể trích xuất từ video/pose;
3. **Reference Motion** — mẫu chuyển động tham chiếu phù hợp với technique và context;
4. **Scoring configuration** — trọng số và ngưỡng được version hóa;
5. **Expert validation** — kết quả được so sánh với expert annotation.

Reference Motion là một baseline tham chiếu, không phải "Golden Pose" áp dụng cho mọi athlete.

---

# 04. PRODUCT SCOPE

## 04.1 Identity & Access

- Authentication (email/password, social login)
- Authorization (JWT)
- RBAC (Guest, Fighter, Coach, Doctor, Admin)
- Profile management
- Password recovery / reset (dùng chung cho mọi role)
- Fighter admissions: Guest nộp hồ sơ → Admin phân công Coach → Coach đánh giá đầu vào (PASS/FAIL) → Admin phê duyệt → kích hoạt Fighter sau khi đặt lại mật khẩu

## 04.2 Fighter Management

- Fighter profile được tạo khi một hồ sơ gia nhập đã duyệt được kích hoạt (không tạo lúc đăng ký)
- Fighter profile (name, DOB, weight class, training level, height, weight)
- Body statistics history
- Coach assignment
- Training history
- Medical record link

## 04.3 Training Management

- Training plan (goal, schedule, exercises)
- Training session (date, type, duration, notes)
- Exercise library
- Session history
- Goals & milestones
- Progress tracking

## 04.4 Video Management

- Upload video (supported formats, size limits — xem Section 10.1)
- Video metadata (duration, fps, resolution, format)
- Video storage (Supabase Storage)
- Processing status (PENDING → PROCESSING → DONE | FAILED)
- Video playback (in-browser)
- Evidence frame navigation (seek to specific frame)

## 04.5 AI Motion Analysis

- Pose estimation (17 COCO keypoints per frame)
- Person tracking (main athlete selection)
- Action detection (kick, punch, grapple — xem supported list)
- Technique phase detection
- Motion metrics calculation
- Technique findings với confidence
- Data quality indicators
- Model version tracking

## 04.6 Performance Analytics

- Speed metrics (relative, pixel-based)
- Form score (0–100)
- Consistency score
- Timing metrics (phase duration)
- Trajectory analysis
- Progress chart (score over time)
- Session comparison

## 04.7 Ghost Mode

- Reference video selection
- Reference motion analysis
- Pose normalization (body-proportion-invariant)
- Temporal alignment (DTW-based)
- Side-by-side video playback
- Skeleton overlay comparison
- Difference visualization (spatial + timing)

## 04.8 Coach Platform

- Athlete management (list, assign, view)
- Training plan management
- Analysis review interface
- AI evidence navigation (jump to frame)
- Coach feedback & annotation
- AI finding correction/override
- Session comparison view

## 04.9 Medical / Rehabilitation

- Medical record (injuries, history)
- Movement examination records
- ROM measurements (calculated, not clinically certified)
- Left/right asymmetry monitoring
- Configurable threshold alerts
- Rehabilitation measurement tracking
- Historical trend visualization

## 04.10 Administration

- User management
- Role management
- Analysis job monitoring
- System health dashboard
- AI model version registry
- Audit log viewer
- Notification management

---

# 05. FUNCTIONAL REQUIREMENTS

> Mỗi FR phải có: ID, mô tả, Acceptance Criteria (AC), và ghi chú kỹ thuật nếu cần.

## 05.1 Authentication

| ID          | Requirement                                                   |
| ----------- | ------------------------------------------------------------- |
| FR-AUTH-001 | User có thể đăng nhập bằng email/password.                    |
| FR-AUTH-002 | System enforce role-based access control (RBAC).              |
| FR-AUTH-003 | User có thể quản lý thông tin profile cá nhân.                |
| FR-AUTH-004 | Token hết hạn phải được xử lý gracefully (redirect to login). |
| FR-AUTH-005 | Admin có thể deactivate account.                              |
| FR-AUTH-006 | Đăng ký tự phục vụ tạo tài khoản role GUEST (chưa có Fighter profile, chưa có quyền Fighter). |
| FR-AUTH-007 | Mọi role có thể yêu cầu email khôi phục mật khẩu; response không tiết lộ tài khoản có tồn tại hay không. |
| FR-AUTH-008 | Đặt lại mật khẩu chỉ chấp nhận bằng chứng khôi phục do provider xác minh (recovery token), không tự cấp role. |

### AC — FR-AUTH-001

```
Given: User có tài khoản hợp lệ
When: Đăng nhập với email và password đúng
Then:
  - Nhận JWT access token (TTL: 1h) và refresh token (TTL: 7d)
  - Được redirect về dashboard của persona tương ứng

When: Đăng nhập với thông tin sai
Then:
  - Nhận thông báo lỗi generic (không tiết lộ field nào sai)
  - Không nhận token

When: Account bị deactivate
Then:
  - Nhận thông báo "Account không hoạt động"
  - Không nhận token
```

### AC — FR-AUTH-002

```
Given: User đã đăng nhập với role FIGHTER
When: Gọi API endpoint dành cho COACH hoặc ADMIN
Then:
  - Nhận HTTP 403 Forbidden
  - Không nhận data của endpoint đó

Note: Role permission phải được enforce server-side, không chỉ UI.
```

## 05.1b Fighter Admissions

| ID             | Requirement                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| FR-ADMIT-001   | GUEST có thể nộp hồ sơ gia nhập gồm họ tên, ngày sinh, hạng cân và phần giới thiệu/nền tảng tuỳ chọn.  |
| FR-ADMIT-002   | Mỗi GUEST chỉ có tối đa một hồ sơ đang mở; hồ sơ FAILED/REJECTED được giữ làm lịch sử và cho phép nộp lại. |
| FR-ADMIT-003   | Admin phân công đúng một Coach đang hoạt động cho mỗi hồ sơ; đổi Coach tạo một kỳ phân công mới kèm lý do. |
| FR-ADMIT-004   | Coach được phân công ghi các tiêu chí linh hoạt (tên, phương pháp, quan sát, giá trị/đơn vị tuỳ chọn) và kết luận thủ công PASS hoặc FAIL. |
| FR-ADMIT-005   | Đánh giá đã nộp là bất biến; không có API sửa hoặc xoá. FAIL kết thúc lần nộp đó.                      |
| FR-ADMIT-006   | Chỉ hồ sơ PASS mới được Admin phê duyệt hoặc từ chối; PASS không tự động cấp quyền Fighter.            |
| FR-ADMIT-007   | Khi Admin phê duyệt, hệ thống gửi email khôi phục mật khẩu cho chính danh tính hiện có của GUEST.      |
| FR-ADMIT-008   | Tài khoản chỉ trở thành FIGHTER sau khi mật khẩu được đổi thành công qua luồng khôi phục và bước kích hoạt hoàn tất. |
| FR-ADMIT-009   | Không thu thập dữ liệu y tế trong luồng gia nhập; Fighter mới giữ `current_medical_status = NOT_CLEARED`. |
| FR-ADMIT-010   | Có hai đường tạo FIGHTER: (a) tự ứng tuyển qua admission, (b) **chiêu mộ trực tiếp** bằng `POST /users` với `role: FIGHTER` cho vận động viên đã ký. Đường (b) không sinh hồ sơ admission — provenance nằm ở audit log của lần tạo. `POST /users` không tạo GUEST; GUEST chỉ đến từ tự đăng ký. |
| FR-ADMIT-011   | `email` trong hồ sơ là **snapshot** email tài khoản tại thời điểm nộp, lấy từ session đã xác thực, không nhận từ body. Email khôi phục luôn gửi tới email **hiện tại** của tài khoản Supabase Auth tương ứng; staff view hiển thị cả hai khi lệch nhau. |
| FR-ADMIT-012   | Mỗi lượt gửi email khôi phục phải được claim trong DB (trạng thái + cooldown) **trước khi** gọi provider; backend chỉ khẳng định “đã thử gửi” và “provider chấp nhận”, không bao giờ khẳng định “đã giao tới hộp thư”. |
| FR-ADMIT-013   | FIGHTER đã kích hoạt vẫn đọc được lịch sử hồ sơ của chính mình; chỉ GUEST mới được nộp hồ sơ mới. |

### AC — FR-ADMIT-008 (Activation)

```
Given: Hồ sơ đã được Admin phê duyệt
When: GUEST mở link khôi phục và đặt mật khẩu mới thành công
Then:
  - Trạng thái activation chuyển PASSWORD_SET
  - Gọi activation với session hợp lệ sẽ promote GUEST → FIGHTER trong cùng một transaction
    (đổi role, tạo Fighter profile từ snapshot hồ sơ, activation COMPLETED, hồ sơ ACTIVATED)

When: Mật khẩu chưa được đặt lại
Then:
  - Activation bị từ chối; tài khoản vẫn là GUEST và không có quyền Fighter

When: Gọi activation lại sau khi đã hoàn tất
Then:
  - Vẫn yêu cầu xác thực hợp lệ, trả về kết quả idempotent "đã kích hoạt"
  - Không tạo Supabase user thứ hai và không đổi email/identity

Note: Một GUEST bị cấp nhầm permission vẫn không vượt được ranh giới này:
      Authorization Guard từ chối mọi route permission-protected đối với role GUEST.
```

### AC — FR-ADMIT-012 (Recovery email & reset)

```
Given: Hồ sơ vừa được APPROVED hoặc Admin bấm resend
When: Backend chuẩn bị gửi email khôi phục
Then:
  - Claim lượt gửi bằng một UPDATE có điều kiện (status = PENDING và cooldown đã hết),
    tăng recovery_attempts và ghi attempted_at TRƯỚC khi gọi provider
  - Không giữ transaction mở trong lúc gọi mạng
  - accepted_at chỉ ghi khi provider trả về không lỗi; đây KHÔNG phải bằng chứng đã giao thư

When: Hai request resend chạy đồng thời
Then: Chỉ một request claim được; request còn lại nhận 409 (cooldown/đang xử lý)

When: Process chết sau khi claim nhưng trước khi provider trả lời
Then: attempted_at đã ghi, accepted_at rỗng; lượt gửi kế tiếp chỉ mở lại sau cooldown

Given: Provider đã đổi mật khẩu thành công nhưng DB không ghi được PASSWORD_SET
When: Người dùng thử lại
Then:
  - Không hệ thống nào được tự đánh dấu PASSWORD_SET khi thiếu bằng chứng đổi mật khẩu
  - Claim IN_PROGRESS bị bỏ dở được giải phóng về PENDING sau cửa sổ stale
  - Người dùng xin recovery link mới và đặt một mật khẩu KHÁC để tạo bằng chứng mới
  - Gửi lại đúng mật khẩu cũ sẽ bị Supabase trả mã same_password (409, không phải lỗi mơ hồ)

When: Reset token đã dùng hoặc hết hạn
Then: 401 RESET_TOKEN_INVALID, không ghi bất kỳ thay đổi nào vào DB
```

## 05.2 Fighter

| ID             | Requirement                                                           |
| -------------- | --------------------------------------------------------------------- |
| FR-FIGHTER-001 | Fighter có thể xem personal profile của mình.                         |
| FR-FIGHTER-002 | Fighter có thể xem training history (danh sách sessions).             |
| FR-FIGHTER-003 | Fighter có thể xem performance progress (score trend theo thời gian). |
| FR-FIGHTER-004 | Fighter có thể xem AI-generated insights từ ngôn ngữ đơn giản.        |
| FR-FIGHTER-005 | Fighter chỉ có thể xem data của chính mình.                           |

### AC — FR-FIGHTER-004

```
Given: Analysis đã hoàn thành cho một session
When: Fighter xem kết quả
Then:
  - Insights hiển thị bằng ngôn ngữ Fighter (đơn giản, tích cực)
  - Mỗi insight có: tiêu đề, mô tả, severity icon, recommendation
  - Insight có confidence < 0.5 không được hiển thị với Fighter
  - Insight phải có link đến evidence frame tương ứng

Note: KHÔNG hiển thị raw joint angles (ví dụ "147°") trực tiếp trong Fighter view.
      Thay bằng: "Chân chưa duỗi đủ (-13° so với reference)"
```

## 05.3 Training

| ID           | Requirement                                               |
| ------------ | --------------------------------------------------------- |
| FR-TRAIN-001 | Coach có thể tạo và quản lý training sessions.            |
| FR-TRAIN-002 | Coach có thể tạo training plans với schedule.             |
| FR-TRAIN-003 | Fighter có thể xem training plans được assign.            |
| FR-TRAIN-004 | System ghi lại completed training sessions với timestamp. |
| FR-TRAIN-005 | Training session có thể link đến một video analysis.      |

## 05.4 Video

| ID           | Requirement                                                    |
| ------------ | -------------------------------------------------------------- |
| FR-VIDEO-001 | User có thể upload video training theo supported formats.      |
| FR-VIDEO-002 | System validate video trước khi accept.                        |
| FR-VIDEO-003 | System lưu video metadata (fps, resolution, duration, format). |
| FR-VIDEO-004 | System tạo analysis job sau khi upload thành công.             |
| FR-VIDEO-005 | User có thể xem processing status real-time.                   |
| FR-VIDEO-006 | User có thể replay analyzed video trong browser.               |
| FR-VIDEO-007 | User có thể navigate đến specific evidence frame.              |

### AC — FR-VIDEO-001 & FR-VIDEO-002

```
Supported formats: MP4 (H.264/H.265), MOV (QuickTime)
Minimum resolution: 720p (1280×720)
Recommended resolution: 1080p (1920×1080)
Maximum file size: 500 MB
Frame rate: 24–120 fps (30fps recommended for analysis)
Minimum duration: 2 seconds
Maximum duration: 10 minutes (600 seconds)
Maximum persons in frame: không giới hạn (system chọn người chính = bbox lớn nhất)

When: Video không đáp ứng điều kiện trên
Then:
  - Upload bị reject TRƯỚC KHI gửi AI pipeline
  - User nhận thông báo lỗi cụ thể (ví dụ: "File vượt giới hạn 500MB")
  - Không tạo analysis job

When: Video hợp lệ
Then:
  - Analysis job được tạo với status PENDING
  - User nhận job ID để tracking
```

### AC — FR-VIDEO-005

```
Given: Analysis job đang xử lý
When: User xem status
Then:
  - Status cập nhật trong vòng 5 giây (polling hoặc WebSocket)
  - Hiển thị: PENDING | PROCESSING (với % progress nếu có) | DONE | FAILED
  - Khi FAILED: hiển thị error message có thể hiểu được (không phải stack trace)
```

## 05.5 AI Analysis

| ID        | Requirement                                             |
| --------- | ------------------------------------------------------- |
| FR-AI-001 | System trích xuất human pose từ supported video.        |
| FR-AI-002 | System track và chọn athlete chính trong frame.         |
| FR-AI-003 | System phát hiện các supported martial arts actions.    |
| FR-AI-004 | System phát hiện technique phases của mỗi action.       |
| FR-AI-005 | System tính các configured movement metrics.            |
| FR-AI-006 | System tạo technique findings từ metrics.               |
| FR-AI-007 | Mỗi finding phải có confidence score.                   |
| FR-AI-008 | Findings phải traceable đến evidence frames/timestamps. |
| FR-AI-009 | Analysis lưu model version và scoring version.          |
| FR-AI-010 | Frames có detection quality thấp phải được flag.        |
| FR-AI-011 | System tạo insights từ findings theo persona.           |

### AC — FR-AI-001

```
Given: Video MP4/MOV ≥ 720p, ≤ 500MB, 24–120fps
When: Analysis job được trigger
Then:
  - System detect 17 COCO keypoints per person per frame
    [nose, l_eye, r_eye, l_ear, r_ear, l_shoulder, r_shoulder,
     l_elbow, r_elbow, l_wrist, r_wrist, l_hip, r_hip,
     l_knee, r_knee, l_ankle, r_ankle]
  - Mỗi keypoint có: normalized_x (0–1), normalized_y (0–1), confidence (0–1)
  - Áp dụng EMA temporal smoothing (alpha = 0.35)
  - Frame không detect được dùng cached keypoints từ frame trước
  - Lưu pose_data với model_version vào database

Technical notes:
  - Model mặc định: YOLOv8n-Pose (CPU-friendly)
  - Conf threshold mặc định: 0.5
  - Person selection: largest bounding box = main athlete
  - Góc đo là 2D projection — KHÔNG phải 3D thực (xem Section 10.4)
```

### AC — FR-AI-007 & FR-AI-008

```
Given: AI đã tạo một Finding
Then: Finding PHẢI chứa:
  - finding_id (UUID)
  - analysis_id (FK)
  - action_id (FK)
  - phase (chamber | extension | impact | retract | guard)
  - metric_name (ví dụ: "knee_angle_at_impact")
  - metric_value (float)
  - metric_unit ("degrees" | "ms" | "px/s" | "ratio")
  - confidence (float, 0.0–1.0)
  - evidence_frame_start (int)
  - evidence_frame_end (int)
  - evidence_timestamp_start_ms (float)
  - evidence_timestamp_end_ms (float)
  - affected_body_part (ví dụ: "left_knee")
  - model_version (string)
  - scoring_version (string)

Constraint:
  - confidence < 0.4 → Finding được tạo nhưng flag UNCERTAIN
  - confidence < 0.2 → Finding không được gửi đến Frontend
```

### AC — FR-AI-010

```
Data quality levels:
  GOOD       — Detection > 80% frames, avg confidence > 0.7
  DEGRADED   — Detection 50–80% frames, hoặc avg confidence 0.5–0.7
  LOW        — Detection < 50% frames, hoặc avg confidence < 0.5
  NO_DATA    — < 10% frames có detection

When data_quality = LOW hoặc NO_DATA:
  - Hiển thị warning banner trong UI
  - Các metrics phải có disclaimer "Low quality data — results may be inaccurate"
  - Không generate Medical findings từ LOW/NO_DATA analysis
```

### Supported Actions (v3.0)

**MVP — controlled scope**
```text
Punches:
  - jab
  - cross
  - hook

Kicks:
  - round_kick
```

**Phase 2 / Bonus**
```text
Kicks:
  - front_kick
  - side_kick

Punches:
  - uppercut

Clinch/Grapple:
  - takedown_attempt
  - clinch
```

**Out of Scope for MVP**
```text
- elbows
- knees
- spinning techniques
- complex combinations
- full MMA fight understanding
- automatic professional judging
```

MVP analysis assumes a controlled single-athlete video with the relevant body parts visible.

## 05.6 Performance

| ID          | Requirement                                                   |
| ----------- | ------------------------------------------------------------- |
| FR-PERF-001 | System tính các supported performance metrics.                |
| FR-PERF-002 | Fighter có thể xem improvement trend theo thời gian.          |
| FR-PERF-003 | Coach có thể review performance history của athlete.          |
| FR-PERF-004 | System compare current vs historical performance.             |
| FR-PERF-005 | Performance metrics phải có baseline reference để meaningful. |

### AC — FR-PERF-002

```
Given: Fighter có ít nhất 2 sessions đã analyzed
When: Fighter xem Progress screen
Then:
  - Score trend chart (line chart, x=date, y=score 0–100)
  - Improvement % = (current_score - previous_score) / previous_score * 100
  - Hiển thị "+" hoặc "-" prefix và màu xanh/đỏ
  - Khi chỉ có 1 session: ẩn improvement %, hiển thị "Complete more sessions to see progress"
```

## 05.7 Ghost Mode

| ID           | Requirement                                                     |
| ------------ | --------------------------------------------------------------- |
| FR-GHOST-001 | User có thể chọn một reference movement từ library hoặc upload. |
| FR-GHOST-002 | System analyze reference movement bằng cùng pipeline.           |
| FR-GHOST-003 | System extract và normalize reference motion.                   |
| FR-GHOST-004 | System align reference và athlete motion theo thời gian.        |
| FR-GHOST-005 | System hiển thị skeleton comparison side-by-side.               |
| FR-GHOST-006 | System identify spatial, timing và trajectory differences.      |
| FR-GHOST-007 | Comparison score phải có giải thích về differences.             |

### AC — FR-GHOST-001

```
Reference sources:
  a) System library (curated expert videos, pre-analyzed)
  b) User-uploaded reference video (phải pass same video validation)
  c) Fighter's own previous session (self-comparison)

When: User chọn reference
Then:
  - Nếu reference chưa có analysis → trigger reference analysis job
  - Nếu reference đã có analysis → dùng cached reference motion
  - Show reference metadata: nguồn, technique, analyzer confidence
```

### AC — FR-GHOST-004 (Temporal Alignment)

```
Algorithm: Dynamic Time Warping (DTW) trên normalized pose sequences

Normalization approach:
  - Torso-length normalization: scale tất cả keypoints theo chiều dài thân (shoulder → hip)
  - Center alignment: dịch chuyển về center of mass
  - Mirror: tự động mirror nếu stance khác nhau (orthodox vs southpaw)

Phase-based alignment:
  - Primary alignment theo technique phase (chamber → extension → impact → retract)
  - Temporal offset tính bằng milliseconds

Output:
  - temporal_offset_ms (reference trước/sau athlete bao nhiêu ms)
  - alignment_quality (good | acceptable | poor)
  - dtw_distance (raw alignment cost — không hiển thị user)

Constraint:
  - Nếu alignment_quality = poor → hiển thị warning, không block nhưng note rõ
  - Ghost Mode không hoạt động với khác góc camera > 45° (không xác định được)
```

### AC — FR-GHOST-005 & FR-GHOST-006

```
Visualization:
  - Side-by-side video: athlete bên trái, reference bên phải
  - Skeleton overlay: stick figure trên video (toggle on/off)
  - Reference skeleton màu khác athlete skeleton
  - Synchronized playback (seek một bên → bên kia tự sync)

Difference output:
  - Spatial difference: joint-by-joint distance (cm equivalent, normalized)
  - Timing difference: phase start/end offset (ms)
  - Trajectory difference: path deviation (percentage)
  - Overall comparison score (0–100)

Note: Ghost Mode KHÔNG dùng pixel difference. Comparison dựa trên normalized keypoints.
      "Golden Pose" là khái niệm UX. Domain concept là Reference Motion.
      Reference không phải universally correct cho mọi athlete.
```

## 05.8 Comparison

| ID             | Requirement                                                   |
| -------------- | ------------------------------------------------------------- |
| FR-COMPARE-001 | System hỗ trợ synchronized side-by-side playback.             |
| FR-COMPARE-002 | User có thể compare current vs previous session.              |
| FR-COMPARE-003 | User có thể compare current vs reference motion (Ghost Mode). |
| FR-COMPARE-004 | User có thể seek synchronized timeline.                       |
| FR-COMPARE-005 | User có thể step frame-by-frame.                              |
| FR-COMPARE-006 | User có thể thay đổi playback speed (0.25x, 0.5x, 1x, 2x).    |
| FR-COMPARE-007 | User có thể toggle skeleton overlays.                         |
| FR-COMPARE-008 | Mỗi video source phải có label rõ ràng.                       |

### AC — FR-COMPARE-001

```
Given: Hai sources có analyses
When: User mở Comparison view
Then:
  - Hai video players sync chính xác đến frame level
  - Play/pause một video → video kia cũng play/pause
  - Seek một video → video kia tự seek tương ứng
  - Playback speed thay đổi áp dụng cho cả hai
  - Label hiển thị: "[Fighter Name] — [Date]" hoặc "Reference — [Technique]"
  - Frame step: ±1 frame buttons (khi pause)
```

## 05.9 Coach

| ID           | Requirement                                                  |
| ------------ | ------------------------------------------------------------ |
| FR-COACH-001 | Coach có thể quản lý danh sách assigned fighters.            |
| FR-COACH-002 | Coach có thể review sessions của athlete.                    |
| FR-COACH-003 | Coach có thể inspect AI findings chi tiết.                   |
| FR-COACH-004 | Coach có thể navigate trực tiếp đến evidence frame.          |
| FR-COACH-005 | Coach có thể thêm feedback/annotation vào session.           |
| FR-COACH-006 | Coach có thể correct/override AI findings.                   |
| FR-COACH-007 | Coach có thể compare sessions của athlete.                   |
| FR-COACH-008 | AI finding corrections được ghi lại với timestamp và author. |

### AC — FR-COACH-006

```
Given: Coach xem một AI Finding
When: Coach chọn "Override Finding"
Then:
  - Form cho phép Coach nhập: corrected_assessment, reason, notes
  - Override được lưu với: coach_id, timestamp, original_finding_id
  - UI hiển thị "Coach Override" badge thay finding gốc
  - Finding gốc vẫn được giữ trong DB (audit trail)
  - Override visible cho Fighter khi Coach chọn share

Override không xóa AI finding — nó là layer trên cùng.
```

## 05.10 Medical

| ID         | Requirement                                                    |
| ---------- | -------------------------------------------------------------- |
| FR-MED-001 | System tính configured ROM measurements từ video.              |
| FR-MED-002 | System tính left/right asymmetry.                              |
| FR-MED-003 | System hỗ trợ configurable monitoring thresholds.              |
| FR-MED-004 | System cung cấp historical movement trends.                    |
| FR-MED-005 | System ghi lại rehabilitation measurements.                    |
| FR-MED-006 | System tạo non-diagnostic monitoring alerts.                   |
| FR-MED-007 | Chỉ DOCTOR có assignment hiệu lực với Fighter và permission tương ứng được đọc medical information và measurements (§05.10.1). |
| FR-MED-008 | Tất cả medical measurements phải kèm accuracy disclaimer.      |
| FR-MED-009 | Chỉ assigned DOCTOR có permission tương ứng được ghi/cập nhật medical và measurements; ADMIN không được sửa medical; lịch sử số đo vẫn append-only. |

### 05.10.1 Chính sách truy cập Medical — đã duyệt, chưa triển khai

**Quyết định của chủ dự án ngày 2026-09-25; áp dụng cho feature Medical tương lai.** Chính sách này thay thế các yêu cầu cũ cho Fighter tự đọc medical, Coach đọc medical của Fighter được assign, Doctor đọc toàn bộ hoặc Admin toàn quyền medical. Không coi cập nhật spec là bằng chứng backend/database đã thực thi.

| Actor | Đọc medical và measurements | Ghi/cập nhật medical và measurements |
| --- | --- | --- |
| DOCTOR có assignment hiệu lực với Fighter | Cho phép khi có permission tương ứng | Cho phép khi có permission tương ứng |
| DOCTOR không có assignment hiệu lực | Từ chối | Từ chối |
| FIGHTER (kể cả bản thân), COACH (kể cả đang phụ trách), ADMIN, GUEST | Từ chối | Từ chối |

- Actor và Doctor profile phải đang hoạt động, không bị xóa; dùng quan hệ `doctor_fighters` với `starts_at <= now` và (`ends_at IS NULL` hoặc `ends_at > now`). Không dùng `coach_fighters` hay assignment đánh giá admission để cấp quyền medical.
- Permission guard và resource scope đều bắt buộc. Explicit user deny vẫn thắng role grant; grant/override cho role khác không vượt được điều kiện chỉ assigned DOCTOR. Không tự cấp permission medical/measurement cho ADMIN theo quy tắc seed chung.
- “Cập nhật measurements” không cho phép sửa/xóa lịch sử: `fighter_measurements` vẫn append-only, correction tạo record mới với `supersedes_id`; không tự cập nhật hạng cân hoặc số đo profile từ measurement.
- Medical gồm hồ sơ, clearance, injuries, treatments, recovery, joint states/history, baselines, alerts và measurements. Quyền đọc/ghi profile hoặc Training không tự cấp quyền với các field này. Các đường trả dữ liệu hỗn hợp cũng phải áp dụng chính sách cho phần medical, gồm status/filter và dữ liệu sức khỏe nhúng.
- Không thêm ngoại lệ ADMIN đọc toàn bộ hay Fighter tự đọc khi chưa có quyết định mới. Quản trị tài khoản/assignment không đồng nghĩa quyền đọc hoặc sửa nội dung y tế. Audit logs không được chứa bản sao nội dung y tế làm đường vòng cho Admin.

**Hiện trạng sau Coach revert:** 010 cấp 21 quyền cho COACH, có `fighter.measurement:read`, không có `fighter.medical:read`. Coach vẫn đọc measurements trong assignment scope và nhận `PublicFighterDto` có `currentMedicalStatus`/số đo profile; filter `medicalStatus` vẫn tồn tại. `medical-summary` legacy chưa kiểm tra Doctor assignment, medical-read audit đã bị gỡ. RLS y tế của 003 còn là lịch sử quyền rộng; không được diễn giải thành policy mới.

**Điều kiện triển khai sau này:** rà soát tất cả read/write paths (kể cả `/users/me`, Fighter list/detail/roster, profile mutation, dữ liệu nhúng và direct DB access), xác định projection/field contract và cập nhật FE; thêm scope/audit tại backend; dùng migration mới để chuyển RLS/grants, kiểm tra cả grant/override tồn tại. Không sửa lại SQL/checksum lịch sử 003/007/010. Giữ nguyên tính năng Training không thuộc medical. Chỉ công bố hoàn tất khi tests chứng minh role matrix, permission deny/override, assignment hiệu lực/hết hạn/tương lai/Doctor khác, và không rò dữ liệu qua route/filter khác. Đợt duyệt này không triển khai API, SQL, AI hay sửa tests.

### AC — FR-MED-001

```
ROM measurements được hỗ trợ (v2.0):
  - Knee flexion/extension (từ hip-knee-ankle angle)
  - Hip flexion (từ shoulder-hip-knee angle)
  - Elbow flexion/extension (từ shoulder-elbow-wrist angle)
  - Shoulder abduction (PROPOSED — phase 5)

Accuracy disclaimer (BẮT BUỘC hiển thị):
  "Measurements are estimated from 2D video projection using YOLOv8 pose
   estimation. Results are NOT clinically validated and should not replace
   professional physical assessment. Use for monitoring trends only."

When: ROM measurement được display
Then:
  - Giá trị đo (degrees, 1 decimal place)
  - Confidence level của measurement
  - Disclaimer text như trên
  - "Requires review" label nếu giá trị ngoài configured threshold
```

### AC — FR-MED-006

```
Alert types:
  - THRESHOLD_EXCEEDED: metric vượt configured threshold
  - SIGNIFICANT_ASYMMETRY: asymmetry > configured %
  - DECLINING_TREND: metric giảm ≥ X% so với baseline trong Y sessions

Alert KHÔNG phải là diagnosis. Language phải dùng:
  ✅ "Monitoring alert: Left knee ROM measurement outside configured threshold"
  ✅ "Observation: asymmetry increased from baseline"
  ✅ "Estimated measurement differs from monitoring baseline"
  ❌ "Injury detected"
  ❌ "Knee problem found"
  ❌ "Medically significant"

Alert phải được reviewed và dismissed bởi authorized medical user.
Alert tự động dismiss sau 30 ngày nếu không có action.
```

## 05.11 Administration

| ID           | Requirement                                                  |
| ------------ | ------------------------------------------------------------ |
| FR-ADMIN-001 | Admin có thể manage users (create, deactivate, change role). |
| FR-ADMIN-002 | Admin có thể manage roles và permissions.                    |
| FR-ADMIN-003 | Admin có thể monitor analysis jobs (list, filter, retry).    |
| FR-ADMIN-004 | Admin có thể inspect system errors và failed jobs.           |
| FR-ADMIN-005 | Admin có thể manage AI model versions (register, deprecate). |
| FR-ADMIN-006 | System ghi lại audit events cho sensitive operations.        |
| FR-ADMIN-007 | Admin có thể retry failed analysis jobs.                     |

### AC — FR-ADMIN-006 (Audit Events)

```
Phải audit:
  - Login / Logout
  - Role change
  - Account deactivation/reactivation
  - Medical data access
  - AI finding override
  - Coach override
  - Video deletion
  - Job retry
  - Model version change

Audit record gồm: event_type, user_id, target_id, timestamp, ip_address, user_agent
Audit logs phải immutable (append-only, không được xóa).
Retention: tối thiểu 1 năm.
```

---

# 06. CORE USER FLOWS

## 06.1 Fighter — Video Analysis Flow

```
Login
  ↓
Fighter Dashboard
  ↓
Upload Video → Select Technique Type → Confirm
  ↓
[Job PENDING → PROCESSING → DONE]
  ↓ (poll / real-time notification)
Analysis Ready → Notification
  ↓
Analysis Screen:
  ├── Summary Score + Grade
  ├── Insights (Fighter language)
  ├── Evidence Timeline (click → jump to frame)
  └── Comparison with previous session
  ↓
Progress Screen (trend chart)
```

## 06.2 Fighter — Realtime Flow

```
Camera → [Browser] MediaPipe Pose
  ↓
Frame Processing (client-side, < 50ms target)
  ↓
Technique Phase Detection (heuristic)
  ↓
Fast Metrics (knee angle, elbow extension)
  ↓
Immediate Feedback:
  ├── Score (0–100)
  ├── Speed indicator
  ├── Form warning (nếu lỗi rõ ràng)
  └── Phase label

Note: Realtime UI hiển thị score và simple feedback.
      KHÔNG hiển thị raw joint angles trong Fighter realtime view.
      Realtime dùng client-side MediaPipe, khác với offline YOLO-Pose.
      Results KHÔNG được lưu như "analysis" mà là "realtime session log".
```

**Realtime Technical Constraints:**

| Constraint               | Target                                                     |
| ------------------------ | ---------------------------------------------------------- |
| Frame processing latency | < 50ms (client-side)                                       |
| Pose model               | MediaPipe Pose (browser WASM)                              |
| Minimum device           | Mid-range smartphone (2020+)                               |
| Camera requirement       | 720p webcam/phone camera                                   |
| Network requirement      | Client-side only — không cần internet khi đang chạy        |
| Fallback                 | Nếu device quá yếu → disable realtime, suggest upload mode |

**Realtime KHÔNG thể:**

- Dùng YOLO-Pose (server round-trip quá chậm cho realtime)
- Detect action type phức tạp (chỉ basic phase detection)
- Lưu full pose data (memory constraint)
- Đạt accuracy tương đương offline analysis

## 06.3 Coach — Evidence Review Flow

```
Coach Dashboard
  ↓
Select Fighter → Fighter Profile
  ↓
Select Session → Session Overview
  ↓
Open Analysis
  ↓
  ├── Summary (score, primary technique, total actions)
  ├── Findings List (sorted by severity)
  │     ↓ Click Finding
  │     Jump to Evidence Frame → Slow Motion / Frame Step
  │     Inspect highlighted body part
  │     Accept AI Finding  OR  Override with coach assessment
  └── Add Coach Feedback (text + optional frame reference)
```

## 06.4 Doctor — Movement Review Flow

```
Medical Dashboard
  ↓
Select Fighter → Medical Profile
  ↓
Movement Assessment:
  ├── ROM Tab (current + trend chart)
  ├── Asymmetry Tab (left/right comparison)
  ├── Alerts Tab (threshold violations)
  └── Rehabilitation Tab (progress measurements)
  ↓
Review Alert → Acknowledge / Dismiss / Add Note
  ↓
Export Report (PDF — PROPOSED, phase 5)
```

---

# 07. DOMAIN MODEL

## 07.1 Core Entities

```
Authentication & Access:
  User
  Role (GUEST | FIGHTER | COACH | DOCTOR | ADMIN)
  Permission

Fighter Admissions:
  FighterApplication (thuộc về một GUEST, giữ snapshot bất biến của ứng viên)
  FighterApplicationCoachAssignment (lịch sử theo thời gian, đóng kỳ cũ khi đổi Coach)
  FighterApplicationAssessment (1:1 với application, append-only, chứa criteria)
  FighterApplicationDecision (1:1 với application, append-only, chỉ cho PASS)
  FighterApplicationActivation (PENDING → IN_PROGRESS → PASSWORD_SET → COMPLETED)

People:
  Fighter (extends User profile)
  Coach (extends User profile)
  SportsDoctor (extends User profile)
  CoachFighterAssignment (M:N)
  DoctorFighterAssignment (M:N)

Training:
  TrainingPlan
  TrainingPlanExercise
  TrainingSession
  Exercise

Video & Processing:
  Video
  AnalysisJob (queue job, status tracking)
  Analysis (output of completed job)
  PoseData (per-frame keypoints)
  MotionSequence (derived from pose data)

Actions & Findings:
  Action (detected kick/punch instance)
  Technique (e.g., round_kick)
  TechniquePhase (chamber/extension/impact/retract)
  Metric (measured value)
  Finding (AI-detected phenomenon)
  CoachOverride (human correction of Finding)
  Insight (persona-interpreted Finding)
  Recommendation

Comparison:
  ReferenceMotion
  ReferenceLibraryItem
  Comparison
  ComparisonResult

Medical:
  MedicalRecord
  MedicalExamination
  Injury
  ROMReading
  AsymmetryAnalysis
  RehabilitationMeasurement
  MedicalAlert
  MedicalAlertAcknowledgement

System:
  AIModelVersion
  ScoringVersion
  AuditLog
  Notification
```

## 07.2 Entity Relationships

```
User (1) ──────────────────── (0..1) Fighter
User (1) ──────────────────── (0..1) Coach
User (1) ──────────────────── (0..1) SportsDoctor

Coach (1) ─────────────────── (N) CoachFighterAssignment
Fighter (1) ────────────────── (N) CoachFighterAssignment

Fighter (1) ────────────────── (N) TrainingSession
Coach (0..1) ───────────────── (N) TrainingSession
TrainingPlan (0..1) ────────── (N) TrainingSession

TrainingSession (1) ─────────── (0..1) Video
Video (1) ──────────────────── (1) AnalysisJob
AnalysisJob (1) ────────────── (0..1) Analysis

Analysis (1) ───────────────── (N) PoseData
Analysis (1) ───────────────── (N) Action
Action (1) ─────────────────── (N) TechniquePhase
Action (1) ─────────────────── (N) Metric
Action (1) ─────────────────── (N) Finding
Finding (1) ────────────────── (N) Insight [by persona]
Finding (1) ────────────────── (0..1) CoachOverride

ReferenceMotion (1) ─────────── (N) Comparison
Analysis (1) ───────────────── (N) Comparison [as athlete side]
Comparison (1) ─────────────── (1) ComparisonResult

Fighter (1) ────────────────── (1) MedicalRecord
MedicalRecord (1) ──────────── (N) MedicalExamination
Analysis (1) ───────────────── (N) ROMReading
Analysis (1) ───────────────── (N) AsymmetryAnalysis
Fighter (1) ────────────────── (N) MedicalAlert
```

## 07.3 Analysis Evidence Chain

```
Video
  ↓
AnalysisJob (status, retry, model config)
  ↓
Analysis (model_version, scoring_version, data_quality)
  ├── PoseData (frame-by-frame keypoints, per-frame quality)
  ├── MotionSequence (derived temporal features)
  └── Action[] (detected technique instances)
        ↓
    TechniquePhase[] (chamber, extension, impact, retract)
        ↓
    Metric[] (knee_angle, hip_rotation, elbow_extension, speed, ...)
        ↓
    Finding[] (AI observations, with confidence + evidence)
        ↓
    CoachOverride? (human correction layer)
        ↓
    Insight[] (persona-specific interpretation)
        ↓
    Recommendation[] (actionable next steps)
```

**Traceability requirement:** Mọi Insight phải có đường đi ngược hoàn chỉnh đến:  
`Insight → Finding → Metric → TechniquePhase → Action → PoseData → Video frame`

---

# 08. INSIGHT ARCHITECTURE

## 08.1 Insight Entity

```
Insight {
  id                  UUID
  finding_id          FK → Finding
  analysis_id         FK → Analysis
  persona             FIGHTER | COACH | DOCTOR
  category            "technique" | "speed" | "guard" | "posture" | "medical"
  title               string (max 60 chars, ngôn ngữ của persona)
  description         string (max 300 chars)
  severity            "positive" | "info" | "warning" | "critical"
  confidence          float (inherited from Finding, possibly adjusted)
  evidence_frame_ref  int (primary evidence frame)
  recommendation      string (max 200 chars)
  created_at          timestamp
}
```

## 08.2 Persona-Specific Interpretation

Cùng một Finding có thể tạo ra 3 Insights khác nhau:

```
Finding: knee_angle_at_impact = 147° (baseline = 160°, deviation = -13°)
Confidence: 0.82, Model: yolov8n-pose-v8.3.0, Frame: 247

Fighter Insight:
  title: "Chân chưa duỗi đủ lúc tung đòn"
  description: "Tại thời điểm impact, góc duỗi chân chưa đạt mức tối ưu.
                Điều này làm giảm lực đá khoảng 15–20%."
  recommendation: "Thử giữ kick ở pha extension thêm 0.3s để tăng góc duỗi"

Coach Insight:
  title: "Knee extension 13° below baseline at impact (frame 247)"
  description: "Hip rotation initiates 45ms late relative to knee extension,
                limiting full chain transfer. Knee angle 147° vs baseline 160°."
  recommendation: "Drill hip-first initiation sequence. Evidence: frame 247"

Doctor Insight:
  title: "Knee extension measurement: 147° (monitoring baseline: 160°)"
  description: "Estimated knee extension at impact differs from monitoring
                baseline by 8.1%. This is an observation, not a diagnosis."
  recommendation: "Review trend data. Consider assessment if pattern persists."
```

## 08.3 Insight Generation Pipeline

```
Metrics + Findings
      +
  Persona Type
      +
  Fighter History (previous sessions)
      +
  Configured Thresholds
           ↓
     Insight Engine
     (rule-based v1, LLM-augmented PROPOSED v2)
           ↓
  Insights + Recommendations
  (filtered by confidence threshold per persona)
```

## 08.4 Confidence Display Rules

| Confidence | Fighter         | Coach                 | Doctor                      |
| ---------- | --------------- | --------------------- | --------------------------- |
| ≥ 0.8      | Show            | Show                  | Show                        |
| 0.5–0.8    | Show (no badge) | Show with level       | Show with disclaimer        |
| 0.4–0.5    | Hide            | Show "Low confidence" | Show with strong disclaimer |
| < 0.4      | Hide            | Hide                  | Hide                        |

---

# 09. AI / MOTION ANALYSIS SPECIFICATION

## 09.1 AI Architecture

```
AI Analysis Engine
│
├── PoseEstimator        (YOLOv8-Pose / MediaPipe)
├── PersonTracker        (largest bbox selection + EMA)
├── ActionDetector       (state machine per action type)
├── PhaseDetector        (per-action phase FSM)
├── BiomechanicsEngine   (angle calc, speed, asymmetry)
├── TechniqueRubricEngine (expert-defined criteria)
├── TechniqueScoringEngine (criterion-level weighted scoring)
├── ExpertValidationEngine (AI ↔ expert comparison)
├── AsymmetryAnalyzer    (left/right comparison)
├── ComparisonEngine     (DTW-based temporal alignment)
├── ScoringEngine        (weighted multi-criteria score)
└── InsightEngine        (persona-aware finding interpretation)
```

## 09.2 Offline Video Pipeline

```
Video Input
  ↓
Validation (format, size, duration)
  ↓
Person Detection (YOLOv8-Pose)
  ↓
Main Person Selection (largest bbox)
  ↓
Pose Estimation (17 COCO keypoints per frame)
  ↓
EMA Temporal Smoothing (alpha=0.35)
  ↓
Active Limb Detection (leg/arm side)
  ↓
Action Detection (state machine: GUARD→CHAMBER→EXTEND→IMPACT→RETRACT)
  ↓
Phase Detection (per-action)
  ↓
Biomechanics Calculation (angles, speed, trajectory)
  ↓
Technique Scoring (weighted criteria)
  ↓
Finding Generation (with confidence + evidence refs)
  ↓
Insight Generation (by persona)
  ↓
Result Serialization (JSON → Supabase Storage)
  ↓
Status Update (DONE + resultUrl)
```

## 09.3 Realtime Pipeline

```
Camera Input (browser)
  ↓
MediaPipe Pose (client-side WASM, < 50ms)
  ↓
Landmark Extraction (33 MediaPipe points → mapped to COCO subset)
  ↓
Simple Phase Detection (heuristic rules)
  ↓
Fast Metrics (knee angle, elbow extension, speed proxy)
  ↓
Real-time Score (0–100)
  ↓
Immediate UI Feedback (score, form indicator, speed trend)
```

**Realtime vs Offline differences:**

| Feature          | Realtime (MediaPipe)      | Offline (YOLO)          |
| ---------------- | ------------------------- | ----------------------- |
| Model            | MediaPipe Pose            | YOLOv8n/s/m-Pose        |
| Running where    | Browser (client)          | Python Worker (server)  |
| Keypoints        | 33 points                 | 17 COCO points          |
| Latency          | < 50ms                    | Minutes (async)         |
| Accuracy         | Lower                     | Higher                  |
| Action detection | Basic (phase only)        | Full technique analysis |
| Findings         | None                      | Full finding set        |
| Data saved       | Session log (lightweight) | Full analysis in DB     |

## 09.4 AI Confidence & Versioning

```
Every AI result MUST include:
  model_name:        string  (e.g., "yolov8n-pose")
  model_version:     string  (e.g., "8.3.0")
  scoring_version:   string  (e.g., "1.0.0")
  conf_threshold:    float   (threshold used)
  data_quality:      GOOD | DEGRADED | LOW | NO_DATA
  processed_at:      ISO8601 timestamp
```

Low-confidence results MUST NOT be presented as certain facts.  
Medical findings MUST NOT be generated from LOW or NO_DATA analyses.

---

# 10. BIOMECHANICS & PERFORMANCE

## 09.5 Technique Rubric Specification

### Rubric Entity

```text
TechniqueRubric {
  id
  technique_type
  version
  status: DRAFT | VALIDATED | DEPRECATED
  source_type: EXPERT_DEFINED
  expert_reference
  criteria[]
  scoring_method
  created_at
  updated_at
}
```

### Criterion Entity

```text
TechniqueCriterion {
  id
  rubric_id
  name
  description
  feature_name
  phase
  evaluation_method
  target_range
  threshold
  weight
  required_confidence
  evidence_required
}
```

### Scoring Rule

```text
Technique Score =
    Σ (criterion_score × criterion_weight)
    --------------------------------------
             Σ criterion_weight
```

A criterion must not contribute to the final score when its required evidence is unavailable or below the configured confidence threshold. The system must expose the resulting data-quality limitation.

### Rubric Governance

- A rubric starts as `DRAFT`.
- It becomes `VALIDATED` only after domain-expert review.
- Every released rubric has a unique `scoring_version`.
- Changes to criteria, thresholds or weights require a new version.
- Historical analyses retain the scoring version used at processing time.
- Reference Motion and Technique Rubric are related but not interchangeable.

## 10.1 Video Input Technical Specification

| Property     | Minimum         | Recommended          | Maximum               |
| ------------ | --------------- | -------------------- | --------------------- |
| Format       | MP4 (H.264)     | MP4 (H.264)          | MOV (QuickTime)       |
| Resolution   | 720p (1280×720) | 1080p                | 4K (upscaled → 1080p) |
| Frame rate   | 24 fps          | 30 fps               | 120 fps               |
| File size    | —               | ≤ 200 MB             | 500 MB                |
| Duration     | 2 seconds       | 30–120 seconds       | 10 minutes            |
| Lighting     | Adequate indoor | Good natural/studio  | —                     |
| Background   | Any             | Contrasting/clear    | —                     |
| Camera angle | Any             | Side-view (sagittal) | —                     |

## 10.2 Metric Categories

### Technique Metrics

| Metric              | Unit    | Description                            |
| ------------------- | ------- | -------------------------------------- |
| knee_angle          | degrees | Hip-Knee-Ankle angle                   |
| hip_angle           | degrees | Shoulder-Hip-Knee angle                |
| elbow_angle         | degrees | Shoulder-Elbow-Wrist angle             |
| hip_rotation_timing | ms      | Time between hip initiation and impact |
| phase_duration      | ms      | Duration of each technique phase       |
| recovery_time       | ms      | Time from impact to guard position     |
| body_alignment      | degrees | Torso tilt from vertical               |

### Performance Metrics

| Metric            | Unit     | Description                       |
| ----------------- | -------- | --------------------------------- |
| relative_velocity | px/frame | Wrist/ankle speed (pixel-based)   |
| movement_duration | ms       | Total technique execution time    |
| form_score        | 0–100    | Weighted technique quality score  |
| consistency_score | 0–100    | Score variance across repetitions |
| improvement_pct   | %        | Score delta vs previous session   |

### Medical Monitoring Metrics

| Metric             | Unit    | Description                         |
| ------------------ | ------- | ----------------------------------- |
| rom_knee           | degrees | Range of motion at knee             |
| rom_hip            | degrees | Range of motion at hip              |
| rom_elbow          | degrees | Range of motion at elbow            |
| lr_asymmetry       | %       | Left/right metric difference        |
| baseline_deviation | %       | Deviation from established baseline |
| threshold_status   | enum    | NORMAL / REVIEW / ALERT             |

## 10.3 Asymmetry Analysis

```
AsymmetryAnalysis {
  metric:              string  (e.g., "rom_knee")
  left_value:          float
  right_value:         float
  absolute_difference: float
  percentage_difference: float  (= abs(L-R) / max(L,R) * 100)
  baseline_left:       float   (from medical record)
  baseline_right:      float
  threshold_pct:       float   (configured per metric)
  status:              NORMAL | REVIEW | ALERT
  confidence:          float
  disclaimer:          string  (bắt buộc)
}

Example:
  left_rom_knee = 108°, right_rom_knee = 135°
  absolute_difference = 27°
  percentage_difference = 20%
  threshold = 15%
  status = ALERT
  disclaimer = "Estimated from 2D video. Not clinically validated."
```

## 10.4 Measurement Accuracy Disclaimer (BẮT BUỘC)

> [!IMPORTANT]
> Đây là section bắt buộc đọc trước khi implement bất kỳ medical hoặc biomechanics feature.

### Giới hạn kỹ thuật của video-based measurement:

**1. Monocular 2D Projection:**

- Tất cả angles được tính từ 2D projection của 3D movement.
- Góc đo thực tế có thể sai khác 5–20° so với 3D reality tùy góc camera.
- **Hệ quả:** ROM measurements là ước lượng, không phải absolute measurements.
- **Giải pháp hiển thị:** Luôn dùng từ "estimated", "approximately", "measurement from video".

**2. Camera Calibration:**

- Không có camera calibration → không thể tính absolute speed (m/s) hay distance (cm).
- Speed phải được trình bày là "relative speed" hoặc "speed proxy" (pixel/frame).
- **Nghiêm cấm:** Trình bày speed dưới dạng m/s hoặc km/h nếu không có calibration.

**3. Force Estimation:**

- Force KHÔNG thể đo được từ video thuần.
- Chỉ có thể ước lượng "force proxy" từ acceleration proxy.
- **Ngôn ngữ được phép:** "estimated impact intensity", "relative force proxy", "acceleration proxy".
- **Nghiêm cấm:** Trình bày inferred motion as measured physical force or report Newton values without an external validated measurement system.

**4. Occlusion và Multi-person:**

- Khi body part bị che khuất (occlusion): confidence thấp → metric không reliable.
- Multi-person: chỉ track 1 người (largest bbox) → nếu người khác to hơn → tracking sai.

**5. Clothing và Markers:**

- Không có body markers → keypoint detection dựa vào visual features.
- Quần áo rộng, tối hoặc không rõ ràng sẽ giảm accuracy.

### Language Guideline cho Medical Features:

| Không được dùng         | Phải dùng                                  |
| ----------------------- | ------------------------------------------ |
| "Detected injury"       | "Observation requires review"              |
| "Knee problem found"    | "ROM measurement outside threshold"        |
| "Force = 450N"          | "Estimated impact intensity: High"         |
| "Speed = 12 m/s"        | "Relative speed: Fast (pixel-based)"       |
| "ROM = 135°" (alone)    | "Estimated ROM: ~135° (video-based, ±10°)" |
| "Diagnosis"             | "Monitoring observation"                   |
| "Medically significant" | "Outside configured monitoring threshold"  |

---

# 11. GHOST MODE / REFERENCE MOTION

## 11.1 Domain Model

```
ReferenceLibraryItem {
  id, technique_type, source, description,
  video_url, analysis_id, quality_rating, created_at
}

ReferenceMotion {
  id
  source_video_id      FK → Video (or ReferenceLibraryItem)
  analysis_id          FK → Analysis
  technique_type       string
  normalized_sequence  JSON (DTW-ready normalized keypoints)
  body_height_ref      float  (torso length for normalization)
  dominant_side        LEFT | RIGHT | UNKNOWN
  quality              GOOD | ACCEPTABLE | POOR
  created_at           timestamp
}

Comparison {
  id
  athlete_analysis_id  FK → Analysis
  reference_motion_id  FK → ReferenceMotion
  technique_type       string
  temporal_offset_ms   float
  alignment_quality    GOOD | ACCEPTABLE | POOR
  dtw_distance         float  (internal use only)
  created_at           timestamp
}

ComparisonResult {
  comparison_id        FK → Comparison (1:1)
  spatial_diff_score   float (0–100, 100 = identical)
  timing_diff_score    float (0–100)
  trajectory_diff_score float (0–100)
  overall_score        float (0–100)
  joint_differences    JSON  (per-joint deviation)
  phase_differences    JSON  (per-phase timing offset)
}
```

## 11.2 Normalization Approach

```
Step 1: Torso-length normalization
  torso_length = distance(left_shoulder, left_hip)
  scale_factor = REFERENCE_TORSO / torso_length
  all_keypoints *= scale_factor

Step 2: Center-of-mass alignment
  center = midpoint(left_hip, right_hip)
  all_keypoints -= center

Step 3: Stance normalization
  Detect dominant_side from action type (kick/punch arm/leg)
  If athlete = southpaw AND reference = orthodox → mirror x-axis

Step 4: DTW temporal alignment
  Use DTW on joint angle sequences (not raw coordinates)
  Primary key sequence: [knee_angle, hip_angle, phase_label]
  Window constraint: max ±30% of sequence length
```

## 11.3 Comparison Output

```
Spatial Difference:   Per-joint mean distance (normalized units)
Timing Difference:    Phase offset in milliseconds
Trajectory Difference: Path deviation percentage
Phase Difference:     Phase duration delta
Overall Score:        Weighted average (spatial 40%, timing 30%, trajectory 30%)
```

**Ghost Mode Constraints:**

- Không dùng pixel difference — dùng normalized keypoint distance.
- Camera angle difference > 45° → không hỗ trợ (hiển thị error).
- Reference video phải pass cùng video validation rules.
- "Golden Pose" là UX concept — domain term là **Reference Motion**.
- Reference không phải universally correct — mọi comparison phải note điều này.

---

# 12. UX / UI SPECIFICATION

## 12.1 Role-Based Views

```
FIGHTER  → Fighter Dashboard, Analysis Viewer, Progress, Ghost Mode, Live
COACH    → Coach Dashboard, Athlete Manager, Evidence Review, Comparison, Feedback
DOCTOR   → Medical Dashboard, ROM, Asymmetry, Alerts, Rehabilitation
ADMIN    → Admin Panel, User Manager, Job Monitor, Audit Log
```

Cùng Analysis data hiển thị khác nhau theo persona (xem Section 08.2).

## 12.2 Fighter Information Architecture

```
Fighter App
├── Dashboard
│   ├── Today's session (quick status)
│   ├── Recent score + improvement badge
│   └── Quick actions (Upload / Live / Ghost Mode)
├── Upload Analysis
│   ├── Upload video
│   ├── Select technique type
│   └── Submit → Status tracking
├── Analysis Result
│   ├── Score card (big, prominent)
│   ├── Insights (Fighter language, severity icons)
│   ├── Video Player + Evidence Timeline
│   └── Frame evidence navigator
├── Ghost Mode
│   ├── Select reference
│   ├── Side-by-side player
│   ├── Skeleton overlay toggle
│   └── Difference summary
├── Progress
│   ├── Score trend chart
│   ├── Improvement stats
│   └── History list
└── Live Camera
    ├── Camera view + skeleton overlay
    ├── Real-time score
    └── Phase indicator
```

## 12.3 Coach Information Architecture

```
Coach App
├── Dashboard
│   ├── Athletes summary
│   ├── Recent sessions
│   └── Pending reviews
├── Athletes
│   ├── Athlete list
│   ├── Fighter profile
│   └── Training history
├── Training Plans
│   ├── Plan list
│   ├── Plan builder
│   └── Assignment
├── Sessions
│   ├── Session list (filterable)
│   └── Session detail
├── Analysis Review
│   ├── Summary (score, actions, findings)
│   ├── Evidence browser
│   │   ├── Finding list (by severity)
│   │   ├── Jump to evidence frame
│   │   ├── Slow motion player
│   │   ├── Accept / Override finding
│   │   └── Add coach annotation
│   └── Session comparison
└── AI Findings
    ├── All findings (filterable)
    ├── Override history
    └── Pending review
```

## 12.4 Medical Information Architecture

```
Medical App
├── Dashboard
│   ├── Active alerts
│   ├── Athletes under monitoring
│   └── Recent assessments
├── Athletes
│   ├── Athlete list
│   └── Medical profile
├── Movement Assessment
│   ├── Session selector
│   ├── ROM readings (with disclaimer)
│   └── Metric trend
├── ROM
│   ├── Per-joint ROM chart
│   ├── Baseline comparison
│   └── Historical trend
├── Asymmetry
│   ├── Left/right comparison table
│   ├── Asymmetry % chart
│   └── Threshold status
├── Alerts
│   ├── Active alerts (with acknowledge/dismiss)
│   └── Alert history
└── Rehabilitation
    ├── Measurement log
    ├── Progress chart
    └── Session notes
```

## 12.5 Analysis Screen Layout

```
┌─────────────────────────────────────────────────────┐
│ [Athlete Name] — [Date] — [Technique]       [Score] │
├─────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────┐   │
│ │   Athlete Video      │ │  Reference / Prev    │   │
│ │   [skeleton overlay] │ │  [skeleton overlay]  │   │
│ └──────────────────────┘ └──────────────────────┘   │
│    [◀◀] [◀] [▶/⏸] [▶] [▶▶]  [0.25x][0.5x][1x][2x] │
├─────────────────────────────────────────────────────┤
│ Phase Timeline:  [GUARD][CHAMBER][EXTEND][IMPACT][RETRACT] │
│ Evidence markers: ● ●    ●                          │
├─────────────────────────────────────────────────────┤
│ [Score] [Metrics] [Findings] [Insights] [Coach]     │
│                                                     │
│ Findings Tab:                                       │
│   🔴 Hip rotation late — Click to jump frame 247    │
│   🟡 Guard dropped momentarily — frame 312          │
│   🟢 Good knee extension — frame 189               │
├─────────────────────────────────────────────────────┤
│ Coach Feedback: [Add note...]         [Findings: 3] │
└─────────────────────────────────────────────────────┘
```

---

# 13. DATABASE SPECIFICATION

## 13.1 Schema Design Principles

- Schema phải derived từ domain model (Section 07).
- Mỗi table phải có: purpose, primary key, foreign keys, constraints, indexes, access control.
- Không tạo table chỉ vì tiện cho infrastructure — phải có domain justification.
- Audit-critical tables phải có `created_at`, `updated_at`, `created_by`.

## 13.2 Core Tables

```sql
-- Access & Identity
users                (id, email, role, status, created_at, updated_at)
fighters             (id, user_id FK, name, dob, weight_class, training_level,
                      dominant_side, height_cm, weight_kg, coach_id FK,
                      created_at, updated_at)
coaches              (id, user_id FK, name, gym_name, specialty, created_at)
sports_doctors       (id, user_id FK, name, specialty, license_no, created_at)
coach_fighter_links  (id, coach_id FK, fighter_id FK, start_date, end_date, active)
doctor_fighter_links (id, doctor_id FK, fighter_id FK, start_date, end_date, active)

-- Training
training_plans       (id, coach_id FK, name, description, duration_weeks,
                      target_technique, created_at, updated_at)
training_sessions    (id, fighter_id FK, coach_id FK, plan_id FK?,
                      date, type, duration_min, notes, status, created_at)

-- Video & Jobs
videos               (id, fighter_id FK, session_id FK?, filename, storage_url,
                      format, duration_ms, fps, width, height, size_bytes,
                      technique_type, uploaded_at, uploaded_by FK)
analysis_jobs        (id, video_id FK, status, model_config JSON, error_msg,
                      queued_at, started_at, finished_at, retry_count, created_by FK)

-- Analysis Results
analyses             (id, job_id FK, video_id FK, fighter_id FK,
                      model_version, scoring_version, data_quality,
                      processed_at, result_url, overall_score)
pose_data            (id, analysis_id FK, frame_idx, time_ms,
                      keypoints JSON, quality_flags JSON)
actions              (id, analysis_id FK, technique_type, arm_or_leg,
                      start_frame, end_frame, start_ms, end_ms, score, confidence)

-- Technique Rubric & Validation
technique_rubrics     (id, technique_id, version, status, source_type, expert_reference, scoring_method, created_at)
technique_criteria    (id, rubric_id, name, feature_name, phase, evaluation_method, threshold, weight, created_at)
criterion_results     (id, action_id, criterion_id, observed_value, score, confidence, evidence_frame_start, evidence_frame_end, created_at)
expert_annotations    (id, analysis_id, action_id, expert_id, criterion_results JSON, overall_assessment, created_at)

-- Findings & Insights
technique_phases     (id, action_id FK, phase_label, start_frame, end_frame,
                      start_ms, end_ms, duration_ms)
metrics              (id, action_id FK, phase_id FK?, metric_name, metric_value,
                      metric_unit, confidence)
findings             (id, action_id FK, analysis_id FK, category, title, description,
                      severity, confidence, evidence_frame_start, evidence_frame_end,
                      evidence_ms_start, evidence_ms_end, affected_body_part,
                      metric_id FK, model_version, scoring_version, created_at)
coach_overrides      (id, finding_id FK, coach_id FK, assessment, reason, notes,
                      created_at)
insights             (id, finding_id FK, analysis_id FK, persona, category, title,
                      description, severity, confidence, evidence_frame_ref,
                      recommendation, created_at)

-- Comparison & Ghost Mode
reference_motions    (id, video_id FK?, library_item_id FK?, technique_type,
                      normalized_sequence JSON, body_height_ref, dominant_side,
                      quality, created_at)
comparisons          (id, athlete_analysis_id FK, reference_motion_id FK,
                      technique_type, temporal_offset_ms, alignment_quality,
                      dtw_distance, created_at)
comparison_results   (id, comparison_id FK unique, spatial_diff_score,
                      timing_diff_score, trajectory_diff_score, overall_score,
                      joint_differences JSON, phase_differences JSON)

-- Medical
medical_records      (id, fighter_id FK unique, notes, created_at, updated_at)
medical_examinations (id, medical_record_id FK, examiner_id FK, date,
                      notes, created_at)
injuries             (id, medical_record_id FK, body_part, type, severity,
                      onset_date, recovery_date, status, notes)
rom_readings         (id, analysis_id FK, fighter_id FK, joint, side,
                      angle_degrees, baseline, confidence, disclaimer,
                      measured_at)
asymmetry_analyses   (id, analysis_id FK, fighter_id FK, metric_name,
                      left_value, right_value, abs_diff, pct_diff,
                      threshold_pct, status, confidence, disclaimer, created_at)
rehab_measurements   (id, fighter_id FK, examiner_id FK, metric_name,
                      value, unit, session_date, notes, created_at)
medical_alerts       (id, fighter_id FK, analysis_id FK, alert_type,
                      metric_name, metric_value, threshold, message,
                      status, created_at, acknowledged_at, acknowledged_by FK)

-- System
ai_model_versions    (id, model_name, version, framework, capabilities JSON,
                      limitations JSON, registered_at, deprecated_at)
scoring_versions     (id, version, technique_type, criteria JSON,
                      weights JSON, released_at, deprecated_at)
audit_logs           (id, event_type, user_id FK, target_type, target_id,
                      details JSON, ip_address, user_agent, created_at)
notifications        (id, user_id FK, type, title, body, read, created_at)
```

## 13.3 Access Control Matrix

Các hàng medical/measurements dưới đây là **target theo §05.10.1**, chưa phải RLS/runtime hiện tại. Quyền rộng trên bảng hỗn hợp (ví dụ `fighters`, `analyses`, `insights`) không bao gồm quyền đọc/ghi phần medical; projection/filter phải tôn trọng chính sách riêng.

| Table              | FIGHTER         | COACH             | DOCTOR            | ADMIN |
| ------------------ | --------------- | ----------------- | ----------------- | ----- |
| users              | Own only        | Own only          | Own only          | Full  |
| fighters           | Own only        | Assigned only     | Assigned only     | Full  |
| training_sessions  | Own only        | Assigned fighters | Assigned fighters | Full  |
| analyses           | Own only        | Assigned fighters | Assigned fighters | Full  |
| findings           | Own only        | Assigned fighters | Assigned fighters | Full  |
| coach_overrides    | Read own        | Write + read own  | Read              | Full  |
| insights           | Own, by persona | Coach persona     | Doctor persona    | Full  |
| medical_records    | No              | No                | Assigned only     | No    |
| rom_readings       | No              | No                | Assigned only     | No    |
| asymmetry_analyses | No              | No                | Assigned only     | No    |
| medical_alerts     | No              | No                | Assigned only     | No    |
| fighter_measurements | No            | No                | Assigned only; append-only corrections | No |
| audit_logs         | No              | No                | No                | Full  |

---

# 14. API SPECIFICATION

## 14.1 API Conventions

```
Base URL:    /api/v1
Auth:        Bearer JWT (Authorization: Bearer <token>)
Format:      JSON (Content-Type: application/json)
Errors:      { "error": { "code": string, "message": string, "details"?: object } }
Pagination:  { "data": [...], "meta": { "total": int, "page": int, "limit": int } }
```

### Standard Error Codes

| HTTP | Code             | Meaning                  |
| ---- | ---------------- | ------------------------ |
| 400  | VALIDATION_ERROR | Request body invalid     |
| 401  | UNAUTHORIZED     | Missing or invalid token |
| 403  | FORBIDDEN        | Insufficient permissions |
| 404  | NOT_FOUND        | Resource not found       |
| 409  | CONFLICT         | Resource already exists  |
| 422  | BUSINESS_ERROR   | Business rule violation  |
| 429  | RATE_LIMITED     | Too many requests        |
| 500  | INTERNAL_ERROR   | Unexpected server error  |

## 14.2 Auth Endpoints

```
POST /api/v1/auth/login
  Body: { email: string, password: string }
  Response 200: { access_token: string, refresh_token: string, user: UserDto }

POST /api/v1/auth/refresh
  Body: { refresh_token: string }
  Response 200: { access_token: string }

POST /api/v1/auth/logout
  Auth: Bearer required
  Response 200: { message: "Logged out" }

GET /api/v1/auth/me
  Auth: Bearer required
  Response 200: UserDto { id, email, role, profile }
```

## 14.3 Video Endpoints

```
POST /api/v1/videos
  Auth: Bearer required (FIGHTER | COACH | ADMIN)
  Body: multipart/form-data { file, technique_type, fighter_id?, session_id? }
  Response 202: { video_id, job_id, status: "PENDING" }
  Errors: 400 (validation), 413 (file too large)

GET /api/v1/videos/:id
  Auth: Bearer required (owner | assigned coach/doctor | admin)
  Response 200: VideoDto { id, fighter_id, filename, storage_url,
                            duration_ms, fps, resolution, technique_type,
                            analysis_job_id, uploaded_at }

DELETE /api/v1/videos/:id
  Auth: Bearer required (owner | admin)
  Response 204: No Content
  Note: Triggers audit log entry
```

## 14.4 Analysis Job Endpoints

```
GET /api/v1/jobs/:id
  Auth: Bearer required
  Response 200: JobDto { id, video_id, status, progress_pct?,
                          error_message?, queued_at, started_at, finished_at }

PATCH /api/v1/jobs/:id/status
  Auth: Worker token (x-worker-secret header)
  Body: { status, result_url?, score? }
  Response 200: JobDto

GET /api/v1/jobs
  Auth: Bearer required (ADMIN only)
  Query: { status?, page?, limit? }
  Response 200: Paginated<JobDto>

POST /api/v1/jobs/:id/retry
  Auth: Bearer required (ADMIN only)
  Response 202: { job_id, status: "PENDING" }
```

## 14.5 Analysis Endpoints

```
GET /api/v1/analyses/:id
  Auth: Bearer required (owner | assigned coach/doctor | admin)
  Response 200: AnalysisDto {
    id, video_id, fighter_id, model_version, scoring_version,
    data_quality, processed_at, overall_score,
    actions_count, findings_count
  }

GET /api/v1/analyses/:id/findings
  Auth: Bearer required
  Query: { severity?, category?, min_confidence? }
  Response 200: FindingDto[] {
    id, category, title, description, severity, confidence,
    evidence_frame_start, evidence_frame_end,
    evidence_ms_start, evidence_ms_end,
    affected_body_part, metric_name, metric_value,
    coach_override?: CoachOverrideDto
  }

GET /api/v1/analyses/:id/insights
  Auth: Bearer required
  Query: { persona: "fighter" | "coach" | "doctor" }
  Response 200: InsightDto[] {
    id, persona, category, title, description,
    severity, confidence, evidence_frame_ref, recommendation
  }

GET /api/v1/analyses/:id/pose-data
  Auth: Bearer required
  Query: { frame_start?, frame_end? }
  Response 200: PoseFrameDto[]
  Note: Returns paginated pose data for video player rendering
```

## 14.6 Fighter Endpoints

```
GET /api/v1/fighters/:id
  Auth: Bearer required
  Response 200: FighterDto { id, name, weight_class, training_level,
                               height_cm, weight_kg, dominant_side,
                               coach_id, created_at }

GET /api/v1/fighters/:id/sessions
  Auth: Bearer required
  Query: { page?, limit?, from_date?, to_date? }
  Response 200: Paginated<SessionDto>

GET /api/v1/fighters/:id/progress
  Auth: Bearer required
  Query: { technique_type?, from_date?, to_date? }
  Response 200: ProgressDto {
    sessions: [{ date, score, technique_type }],
    trend: "improving" | "stable" | "declining",
    improvement_pct: float
  }
```

## 14.7 Comparison Endpoints

```
POST /api/v1/comparisons
  Auth: Bearer required
  Body: {
    athlete_analysis_id: UUID,
    reference_motion_id?: UUID,
    reference_analysis_id?: UUID  // for session vs session
  }
  Response 202: { comparison_id, status: "PROCESSING" }

GET /api/v1/comparisons/:id
  Auth: Bearer required
  Response 200: ComparisonDto {
    id, athlete_analysis_id, reference_motion_id,
    alignment_quality, temporal_offset_ms,
    result: {
      spatial_diff_score, timing_diff_score,
      trajectory_diff_score, overall_score,
      joint_differences, phase_differences
    }
  }
```

## 14.8 Medical Endpoints

Target design cho feature tương lai; không phải danh sách route hiện đang triển khai. Mọi route dưới đây cần permission tương ứng **và** Doctor assignment hiệu lực theo §05.10.1; role/permission đơn lẻ không đủ. Contract thực tế hiện tại được mô tả riêng trong tài liệu FE.

```
GET /api/v1/fighters/:id/medical
  Auth: Bearer required (assigned DOCTOR + effective permission)
  Response 200: MedicalRecordDto

GET /api/v1/fighters/:id/rom
  Auth: Bearer required (assigned DOCTOR + effective permission)
  Query: { joint?, from_date?, to_date? }
  Response 200: ROMReadingDto[] (includes disclaimer field)

GET /api/v1/fighters/:id/asymmetry
  Auth: Bearer required (assigned DOCTOR + effective permission)
  Query: { metric?, from_date? }
  Response 200: AsymmetryDto[]

GET /api/v1/fighters/:id/alerts
  Auth: Bearer required (assigned DOCTOR + effective permission)
  Query: { status?: "active" | "acknowledged" }
  Response 200: MedicalAlertDto[]

PATCH /api/v1/alerts/:id/acknowledge
  Auth: Bearer required (assigned DOCTOR of alert's Fighter + effective permission)
  Body: { notes?: string }
  Response 200: MedicalAlertDto
```

## 14.9 Coach Endpoints

```
POST /api/v1/findings/:id/override
  Auth: Bearer required (COACH | ADMIN)
  Body: { assessment: string, reason: string, notes?: string }
  Response 201: CoachOverrideDto

GET /api/v1/coaches/:id/fighters
  Auth: Bearer required (COACH | ADMIN)
  Response 200: FighterDto[]

POST /api/v1/sessions/:id/feedback
  Auth: Bearer required (COACH)
  Body: { feedback: string, frame_ref?: int }
  Response 201: FeedbackDto
```

---

# 15. SYSTEM ARCHITECTURE

## 15.1 Logical Architecture

```
Users (Browser)
  ↓
Next.js Frontend (TypeScript)
  ├── Fighter View (React components)
  ├── Coach View
  ├── Medical View
  └── Admin View
  ↓ (REST API over HTTPS)
NestJS API (TypeScript)
  ├── Auth Module (JWT + RBAC Guards)
  ├── Videos Module
  ├── Jobs Module (BullMQ producer)
  ├── Analysis Module
  ├── Fighters Module
  ├── Coaches Module
  ├── Medical Module
  ├── Comparison Module
  └── Admin Module
  │
  ├─────────────── PostgreSQL (via Drizzle ORM)
  │                (Supabase hosted)
  │
  └─────────────── Redis (BullMQ queue)
                          ↓
                   Python AI Worker
                          │
             ┌────────────┴────────────┐
             ↓                         ↓
    Pose & CV Engine          Analysis Engine
    (YOLOv8-Pose, OpenCV)     (Analyzers, Scoring)
             │                         ↓
             └───────────── Insight Engine
                                       ↓
                            Supabase Storage
                            (results JSON, videos)
```

## 15.2 Technical Baseline

| Layer      | Technology                                   | Notes                       |
| ---------- | -------------------------------------------- | --------------------------- |
| Frontend   | Next.js 14+, TypeScript, Tailwind CSS        | App Router                  |
| Backend    | NestJS, TypeScript, Drizzle ORM              | REST API                    |
| Database   | PostgreSQL (Supabase)                        | Row Level Security          |
| Queue      | Redis + BullMQ                               | Async job processing        |
| AI Worker  | Python 3.11+, YOLOv8-Pose, OpenCV, MediaPipe | Docker                      |
| Storage    | Supabase Storage                             | Videos + JSON results       |
| Auth       | Supabase Auth (JWT)                          | RBAC via server-side guards |
| Deployment | Docker Compose (dev), container (prod)       |                             |

## 15.3 Deployment Architecture

```
[Docker Compose — Development]
  ├── nextjs-frontend (port 3000)
  ├── nestjs-api (port 3001)
  ├── python-worker (no port, queue consumer)
  ├── redis (port 6379)
  └── [Supabase cloud — external]

[Production — recommended]
  ├── Frontend: Vercel / CloudFlare Pages
  ├── API: Railway / Render (NestJS)
  ├── Worker: Railway / Render (Python, GPU if available)
  ├── Redis: Upstash Redis
  └── Database + Storage: Supabase
```

---

# 16. SECURITY / PRIVACY / MEDICAL SAFETY

## 16.1 Security

- Authentication: JWT (access token 1h TTL, refresh token 7d TTL)
- Authorization: RBAC với server-side enforcement (không chỉ UI)
- Least privilege: mỗi endpoint chỉ cho phép role cần thiết
- Secure file access: video URLs phải signed (time-limited)
- API authorization: mọi protected endpoint kiểm tra token
- Audit logging: sensitive operations (xem Section 05.11 AC-FR-ADMIN-006)
- Worker security: worker-to-API callback dùng shared secret token

## 16.2 Privacy

Training videos và health information là **sensitive data**.

| Data                  | Classification   | Access                                | Retention                     |
| --------------------- | ---------------- | ------------------------------------- | ----------------------------- |
| Training videos       | Sensitive        | Owner + assigned coach/doctor + admin | Until user deletion request   |
| Pose data (keypoints) | Sensitive        | Same as video                         | Same as video                 |
| Medical records       | Highly sensitive | Assigned Doctor only (§05.10.1 target) | 7 years (healthcare standard) |
| Analysis results      | Sensitive        | Owner + assigned + admin              | 3 years or user deletion      |
| Audit logs            | System           | Admin only                            | 1 year minimum                |

Data deletion request: user xóa account → xóa videos, analyses, medical records (soft delete → purge after 30 days).

## 16.3 Medical Safety

AI output là **assistive**, không phải diagnostic.

### Permitted Language

```
✅ "observation"
✅ "estimated measurement"
✅ "monitoring alert"
✅ "requires review"
✅ "outside configured threshold"
✅ "video-based estimate"
✅ "trend indicator"
```

### Forbidden Language

```
❌ "diagnosis"
❌ "injury detected"
❌ "medical condition"
❌ "clinically significant"
❌ "you have [condition]"
❌ Any absolute medical claim
```

### Mandatory Disclaimers

**Medical features MUST display:**

> "Measurements are estimated from 2D video using AI pose estimation.
> Results are NOT clinically validated. This system does not provide medical
> diagnosis. Consult a qualified healthcare professional for medical assessment."

**Medical alerts MUST include:**

> "This is a monitoring alert, not a medical diagnosis."

---

# 17. NON-FUNCTIONAL REQUIREMENTS

## Performance

| ID           | Requirement                                 | Target                          |
| ------------ | ------------------------------------------- | ------------------------------- |
| NFR-PERF-001 | UI responsive during analysis processing    | < 100ms UI interaction response |
| NFR-PERF-002 | Long-running AI analysis must be async      | No synchronous blocking         |
| NFR-PERF-003 | Realtime analysis latency (client-side)     | < 50ms per frame                |
| NFR-PERF-004 | Offline video processing (1 min video, CPU) | ≤ 5 minutes                     |
| NFR-PERF-005 | API response time (non-AI endpoints)        | < 500ms p95                     |
| NFR-PERF-006 | Video upload progress feedback              | Real-time progress bar          |

## Reliability

| ID          | Requirement                                                   |
| ----------- | ------------------------------------------------------------- |
| NFR-REL-001 | Failed analysis jobs phải detectable và reportable            |
| NFR-REL-002 | Queue jobs hỗ trợ retry (max 3 attempts, exponential backoff) |
| NFR-REL-003 | Analysis status phải persisted (survive worker restart)       |
| NFR-REL-004 | Worker crash không làm mất job data                           |

## Security

| ID          | Requirement                                      |
| ----------- | ------------------------------------------------ |
| NFR-SEC-001 | Protected resources yêu cầu valid authorization  |
| NFR-SEC-002 | Role permissions được enforce server-side        |
| NFR-SEC-003 | Sensitive operations được audit logged           |
| NFR-SEC-004 | Video storage URLs phải time-limited signed URLs |
| NFR-SEC-005 | Worker-to-API communication phải authenticated   |

## Privacy

| ID           | Requirement                                                    |
| ------------ | -------------------------------------------------------------- |
| NFR-PRIV-001 | Video access phải authorized (không public URL)                |
| NFR-PRIV-002 | Medical information và measurements chỉ cho DOCTOR có assignment hiệu lực và permission tương ứng (§05.10.1 target); không có Admin bypass. |
| NFR-PRIV-003 | Data lifecycle phải documented và enforced                     |
| NFR-PRIV-004 | User data deletion request phải được honored trong 30 ngày     |

## AI Quality

| ID         | Requirement                              | Metric                          |
| ---------- | ---------------------------------------- | ------------------------------- |
| NFR-AI-001 | AI results phải include confidence score | Per-finding confidence (0–1)    |
| NFR-AI-002 | AI results phải include model version    | Stored in DB                    |
| NFR-AI-003 | Low-quality input phải identifiable      | data_quality enum               |
| NFR-AI-004 | AI limitations phải documented           | Section 10.4                    |
| NFR-AI-005 | Pose estimation accuracy baseline        | PCK@0.5 ≥ 70% on held-out test set, if ground-truth keypoints are available |
| NFR-AI-006 | Action detection baseline                | Report Precision, Recall and F1; target ≥ 0.75 Precision and ≥ 0.70 Recall for MVP |
| NFR-AI-007 | Technique assessment validation          | Must report agreement against expert annotations before claiming validated technique scoring |
| NFR-AI-008 | Score explainability                     | Every technique score must expose criterion-level contributions and evidence |
| NFR-AI-009 | Confidence/data-quality propagation      | Low-quality evidence must reduce or invalidate affected criterion scores |

---

# 18. TESTING & ACCEPTANCE CRITERIA

## 18.1 Testing Strategy

```
Unit Tests:
  ├── Python: pytest (pose_math, kick_analyzer, punch_analyzer, insight_engine)
  ├── NestJS: vitest (services, guards, DTOs)
  └── Frontend: vitest + React Testing Library (components)

Integration Tests:
  ├── API contract tests (Bruno/Postman collections)
  ├── DB migration tests (clean DB apply all migrations)
  └── Worker integration (Redis → Worker → API callback)

E2E Tests (priority flows):
  ├── Fighter: upload → analysis → view insights
  ├── Coach: review session → override finding
  └── Auth: login → access control enforcement

AI Evaluation:
  ├── Pose estimation: PCK@0.5 on held-out test videos
  ├── Action detection: Precision/Recall on labeled dataset
  └── Phase detection: Phase accuracy on annotated clips

Performance Tests:
  ├── API load test (k6): 100 concurrent users
  └── Worker throughput: videos per hour benchmark
```

## 18.1A Technique Assessment Evaluation

Technique quality is evaluated separately from action recognition.

### Recommended evaluation

```text
Action Recognition:
  - Precision
  - Recall
  - F1-score
  - Confusion Matrix

Technique Assessment:
  - Expert agreement
  - MAE for numeric scores where appropriate
  - Weighted agreement / Kappa for ordinal labels where appropriate
  - Correlation only as a supplementary measure
```

### Required evaluation principle

```text
Train/Test split:
  split by athlete, not by random frames
```

The test set should contain athletes not used in training whenever the dataset size permits. This reduces identity leakage and gives a more meaningful estimate of generalization.

### Minimum validation dataset

For the capstone MVP, the project should prioritize a small but carefully annotated expert validation set over a large weakly labeled dataset.

## 18.2 Acceptance Criteria Examples

### FR-GHOST-001 AC

```
Given: Một valid reference video đã tồn tại trong library
When: User chọn Ghost Mode và chọn reference
Then:
  - Reference motion được load (nếu pre-analyzed) hoặc job được tạo
  - Side-by-side player hiển thị athlete bên trái, reference bên phải
  - Synchronized playback hoạt động (seek one → both seek)
  - Skeleton overlay có thể toggle
  - Comparison score và joint differences được hiển thị
  - Temporal offset (ms) được hiển thị
  - Overall comparison score (0–100) được hiển thị
```

### FR-COMPARE-001 AC

```
Given: Hai analyses đã hoàn thành
When: User mở Comparison view
Then:
  - Play/pause synchronization hoạt động đúng
  - Synchronized seek (drag timeline → cả hai video seek)
  - Frame step: ±1 frame buttons hoạt động khi paused
  - Playback speed: 0.25x, 0.5x, 1x, 2x áp dụng cả hai
  - Skeleton overlay toggle hoạt động độc lập cho mỗi video
  - Source label hiển thị: "[Name] — [Date]" hoặc "Reference — [Technique]"
```

### FR-AI-008 AC

```
Given: AI đã tạo một Finding
Then: Finding phải chứa tất cả fields bắt buộc:
  - finding_id (UUID, unique)
  - analysis_id (valid FK)
  - action_id (valid FK)
  - phase (valid enum value)
  - metric_name (non-empty string)
  - metric_value (numeric)
  - metric_unit (non-empty string)
  - confidence (0.0–1.0)
  - evidence_frame_start (>= 0)
  - evidence_frame_end (>= evidence_frame_start)
  - evidence_ms_start (>= 0)
  - evidence_ms_end (>= evidence_ms_start)
  - affected_body_part (non-empty string)
  - model_version (non-empty string)
  - scoring_version (non-empty string)

Missing any field → Finding is invalid → must not reach frontend
```

### FR-MED-006 AC (Medical Alert Language)

```
Given: A metric exceeds configured threshold
When: System creates alert
Then:
  - Alert message uses ONLY permitted language (Section 16.3)
  - Alert displays mandatory disclaimer
  - Alert type = THRESHOLD_EXCEEDED (not "injury" or "problem")
  - Alert status = ACTIVE until acknowledged by authorized user
  - Alert visible only to a DOCTOR currently assigned to this Fighter, with effective permission
  - Fighter does NOT see medical alerts directly
```

---

# 19. DEVELOPMENT RULES

## RULE-001 — Requirements Before Implementation

Không implement major functionality nếu chưa có requirement ID tương ứng trong spec này.

## RULE-002 — Domain Before Infrastructure

Không để infrastructure decisions define business domain. Database schema phải reflect domain model, không phải ngược lại.

## RULE-003 — Evidence Traceability

Mọi AI conclusion quan trọng phải traceable đến measurable evidence.  
Chain: `Insight → Finding → Metric → Phase → Action → PoseData → Video frame`

## RULE-004 — Persona-Aware Output

Cùng một metric phải tạo ra different insights cho different personas. Không send same text đến Fighter và Doctor.

## RULE-005 — Human-in-the-Loop

Coach và medical users phải có khả năng review relevant AI outputs. AI là assistant, không phải final authority.

## RULE-006 — AI Versioning

Luôn lưu `model_version` và `scoring_version` với mọi analysis result.

## RULE-007 — No Raw Data Dump

Raw pose coordinates không phải product feature. Mọi data phải được interpreted thành Metrics → Findings → Insights trước khi hiển thị.

## RULE-008 — No Undocumented Scope

Features mới phải được document là requirements trước khi implement. Dùng label `PROPOSED` cho ideas chưa approved.

## RULE-009 — API Contract Stability

Không break existing API contracts mà không document trong Change Log và notify consumers.

## RULE-010 — Documentation Sync

Architecture changes phải update documentation tương ứng.

## RULE-011 — Medical Language Compliance

Mọi text liên quan đến medical/health phải tuân theo language guidelines (Section 16.3). Không có exception.

## RULE-012 — Accuracy Disclaimer Mandatory

Mọi video-based biomechanics measurement phải kèm accuracy disclaimer (Section 10.4). Không được bỏ qua.

---

# 20. AI CODING AGENT RULES

Trước khi modify codebase, AI coding agent phải:

1. Đọc `MASTER-SPECIFICATION.md` (tài liệu này).
2. Xác định persona liên quan đến feature.
3. Xác định requirement ID tương ứng.
4. Xác định affected user flow.
5. Xác định affected domain entities.
6. Xác định affected API contracts.
7. Xác định affected UI.
8. Kiểm tra security/privacy implications.
9. Kiểm tra AI/medical safety implications.
10. Implement chỉ approved scope.
11. Update documentation nếu architecture thay đổi.
12. Mark undocumented ideas là `PROPOSED`.

### AI Agent MUST NOT

- Invent business requirements
- Invent medical conclusions
- Treat estimated video-based metrics như clinically validated measurements
- Couple UI trực tiếp với raw AI output
- Change domain models mà không có justification
- Remove existing behavior mà không kiểm tra requirements
- Dùng medical language không được phép (Section 16.3)
- Bỏ qua accuracy disclaimer requirement (Section 10.4)
- Hiển thị confidence < 0.4 findings đến Fighter view

---

# 21. DEFINITION OF DONE

Feature hoàn chỉnh khi:

```
Requirement → User Flow → Domain → Implementation → Tests → AC Passed → Docs Updated
```

Checklist:

- [ ] Requirement ID tồn tại trong spec
- [ ] Persona xác định
- [ ] User flow defined
- [ ] Domain impact reviewed (entities, relationships)
- [ ] API contract updated (nếu có)
- [ ] Database schema updated (nếu có)
- [ ] UI implemented theo persona view đúng
- [ ] AI impact reviewed (nếu applicable)
- [ ] Security reviewed (auth, RBAC)
- [ ] Medical safety reviewed (nếu applicable, language check)
- [ ] Accuracy disclaimer present (nếu applicable)
- [ ] Tests written (unit + integration)
- [ ] Acceptance criteria passed
- [ ] Documentation updated

---

# 22. ROADMAP & MVP DEFINITION

## 22.0 MVP Definition

> **MVP** = Hệ thống có thể dùng được bởi real users (Fighter + Coach) với core value.

**MVP Scope:**

- Auth (login, role, profile)
- Fighter profile
- Video upload → AI analysis (controlled MVP techniques)
- Pose + action recognition + temporal segmentation
- Expert-defined technique rubric for selected MVP techniques
- Criterion-level technique assessment + evidence frames
- Analysis result: score, findings (fighter + coach language), confidence/data quality
- Fighter dashboard: history, progress chart
- Coach: view athlete sessions, evidence review, finding override
- Expert validation dataset + AI-vs-expert evaluation report

**MVP Out of Scope (Phase 3+):**

- Ghost Mode
- Medical / Doctor view
- Realtime camera upgrade
- Comparison (session vs session — Phase 2)
- Admin full panel
- Universal "correctness" claims
- Physical impact-force measurement
- Medical diagnosis or injury detection

## 22.1 Phase 1 — Core Motion Analysis (Foundation)

- Video upload & validation
- YOLOv8-Pose pipeline
- KickAnalyzer + PunchAnalyzer
- Finding generation với evidence
- Result storage (Supabase)
- Basic job status API

## 22.2 Phase 2 — Fighter & Auth Experience

- Auth / RBAC (Supabase Auth)
- Fighter profile
- Training session management
- Fighter dashboard (score, history, insights in Fighter language)
- Analysis viewer (evidence timeline, frame navigation)
- Progress chart
- Insight Engine (Fighter persona)

## 22.3 Phase 3 — Coach Platform

- Coach view
- Athlete management
- Evidence review interface
- Finding correction/override
- Coach feedback
- Session comparison (A vs B)
- Insight Engine (Coach persona)
- Notification system

## 22.4 Phase 4 — Ghost Mode

- Reference motion library
- Reference video upload
- DTW temporal alignment
- Side-by-side synchronized comparison
- Skeleton overlay visualization
- Comparison score & difference output

## 22.5 Phase 5 — Biomechanics & Medical Support

- ROM calculation (knee, hip, elbow)
- Left/right asymmetry analysis
- Medical dashboard (Doctor view)
- Configurable thresholds
- Medical alerts (non-diagnostic)
- Rehabilitation tracking
- Insight Engine (Doctor persona)
- Mandatory medical disclaimers enforcement

## 22.6 Phase 6 — Advanced AI

- More technique types (uppercut, side kick, front kick, takedowns)
- Better action detection (higher precision/recall)
- Improved phase detection
- Advanced biomechanics (trunk rotation, multi-joint coordination)
- Personalized baselines
- Better insight generation (LLM-augmented)
- Multi-person support
- GPU-accelerated inference option

---

# 23. REQUIREMENT ID CONVENTION

```
FR-AUTH-xxx     Authentication & Authorization
FR-FIGHTER-xxx  Fighter features
FR-COACH-xxx    Coach features
FR-TRAIN-xxx    Training management
FR-VIDEO-xxx    Video upload & management
FR-AI-xxx       AI analysis pipeline
FR-PERF-xxx     Performance analytics
FR-GHOST-xxx    Ghost Mode / Reference Motion
FR-COMPARE-xxx  Comparison features
FR-MED-xxx      Medical / ROM / Asymmetry
FR-REHAB-xxx    Rehabilitation tracking
FR-ADMIN-xxx    Administration

NFR-PERF-xxx    Performance non-functional
NFR-SEC-xxx     Security non-functional
NFR-PRIV-xxx    Privacy non-functional
NFR-REL-xxx     Reliability non-functional
NFR-AI-xxx      AI quality non-functional

SAFETY-xxx      Medical safety constraints
PROPOSED-xxx    Ideas not yet approved as requirements
```

---

# 24. TRACEABILITY MODEL

Mỗi feature phải traceable theo chain:

```
Persona → Goal → User Story → Requirement ID → User Flow
  → Domain Entity → API Endpoint → UI Screen → Implementation → Test
```

Cho AI features, thêm chain:

```
Video → PoseData → Action → TechniquePhase → Metric
  → Finding (confidence, evidence_frame)
  → CoachOverride? (human review layer)
  → Insight (persona-specific)
  → Recommendation
```

---

# 25. MASTER PRODUCT PRINCIPLE

> **MMA-TMS is not primarily a pose detection system.**
>
> It is an **AI-assisted martial arts movement analysis and training management platform.**
>
> Pose estimation is an enabling technology.
>
> Metrics are measurement.
>
> Findings are observations.
>
> Insights create user value.
>
> Evidence creates trust.
>
> Human review creates accountability.
>
> Accurate disclaimers create safety.

The system must always answer:

> **"So what does this data mean for this specific user, and what can they do next?"**

---

# 26. AI LIMITATIONS REGISTER

> Đây là register chính thức về giới hạn kỹ thuật của hệ thống.
> Phải được update khi có model hoặc capability changes.

| ID      | Limitation                                                  | Impact                                         | Mitigation                                              |
| ------- | ----------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------- |
| LIM-001 | Monocular 2D video: angles are projections, not 3D absolute | ROM/angle measurements have ±5–20° uncertainty | Always show "estimated", show confidence                |
| LIM-002 | No camera calibration: speed cannot be absolute (m/s)       | Speed is relative only                         | Use "speed proxy" / "relative speed" language           |
| LIM-003 | Video-based force is inferred, not measured                 | Force claims are unreliable                    | Use "force proxy" / "impact intensity" language         |
| LIM-004 | Occlusion degrades keypoint accuracy                        | Affected metrics unreliable                    | Flag LOW quality, show warning                          |
| LIM-005 | Single-person tracking (largest bbox)                       | Multi-person scenarios may track wrong person  | Document limitation, note in UI for multi-person videos |
| LIM-006 | YOLOv8n accuracy vs YOLOv8x                                 | Lower accuracy model = more false positives    | Allow model selection per job; default to n for CPU     |
| LIM-007 | Ghost Mode: camera angle > 45° difference                   | Comparison alignment invalid                   | Error / warning if camera angles too different          |
| LIM-008 | Realtime (MediaPipe) accuracy < Offline (YOLO)              | Realtime insights less reliable                | Do not save realtime results as "analyses"              |
| LIM-009 | No 3D pose estimation                                       | Hip rotation, trunk rotation less accurate     | Note in medical reports                                 |
| LIM-010 | Clothing affects keypoint detection                         | Baggy/dark clothing reduces accuracy           | Recommend fitted, light-colored training clothes        |
| LIM-011 | Technique rubric depends on expert definition               | Different experts may assess technique differently | Version rubric, document expert source, report agreement |
| LIM-012 | Reference motion is not universal ground truth               | Different body types/styles may produce valid variations | Treat reference as baseline, not absolute correctness |
| LIM-013 | Technique score depends on observable evidence                | Occlusion/camera angle can invalidate criteria | Criterion-level confidence + evidence gating             |

---

# 27. CHANGE LOG

## v3.2 (2026-09-25)

**Chính sách Medical mới — approved target, chưa triển khai.**

- FR-MED-007 làm rõ chỉ assigned DOCTOR được đọc; thêm FR-MED-009 về ghi/cập nhật medical và measurements, không có ngoại lệ ADMIN. Fighter self-read và Coach assigned medical-read từ yêu cầu cũ không còn là target.
- Thêm §05.10.1 với role matrix, temporal assignment, permission precedence, append-only measurement corrections và khoảng cách với code sau Coach revert.
- Đồng bộ §13.3, §14.8, §16.2, NFR-PRIV-002 và AC FR-MED-006; các mục này không chứng nhận runtime/RLS hiện tại đã thay đổi.
- Tài liệu FE ghi đúng trạng thái hiện tại: 010 có 21 Coach grants, `PublicFighterDto` và filter `medicalStatus` được giữ; Coach measurements còn read-only. Chuyển đổi Medical cần công việc backend/database/FE/tests riêng, không sửa migration lịch sử.

## v3.1 (2026-09-22)

**Fighter Admissions policy. Thay thế luồng đăng ký Fighter trực tiếp của v3.0.**

### Functional Requirements

- Added FR-AUTH-006 (đăng ký tạo GUEST), FR-AUTH-007 (forgot password dùng chung),
  FR-AUTH-008 (reset password phải có bằng chứng recovery do provider xác minh)
- Added Section 05.1b: FR-ADMIT-001 … FR-ADMIT-009 và AC cho activation
- `POST /auth/register` không còn tạo Fighter profile; Fighter profile được tạo
  tại bước activation từ snapshot của hồ sơ đã duyệt
- Added FR-ADMIT-010 … FR-ADMIT-013 và AC cho recovery email/reset
- `POST /users` giữ `role: FIGHTER` cho nghiệp vụ chiêu mộ trực tiếp; admission
  là đường dành cho người tự ứng tuyển, không phải đường duy nhất tạo Fighter
- `GET /fighter-admissions/applications/me[/:id]` mở cho cả GUEST và FIGHTER
  theo ownership; `POST /fighter-admissions/applications` vẫn chỉ GUEST

### Integration

- Recovery email yêu cầu template dùng `{{ .TokenHash }}` (không dùng
  `{{ .ConfirmationURL }}` mặc định) để frontend nhận `token_hash`; kèm redirect
  allowlist và email provider — chi tiết trong `nestjs-api/README.md`

### Domain Model

- Added role `GUEST` vào `user_role`
- Added 5 bảng admission (application, coach assignment history, assessment,
  decision, activation) với trigger append-only và state machine ở tầng DB

### Security

- Authorization Guard từ chối mọi route permission-protected với role GUEST,
  kể cả khi user được cấp nhầm `user_permissions`
- Legacy `/jobs` read/create routes yêu cầu authenticated non-guest role.
  Giới hạn còn lại: chưa scope theo chủ sở hữu vì `analysis_jobs.user_id` là
  free text do client gửi, không có FK tới `public.users`

## v2.0 (2026-09-13)

**Upgraded from v1.0 Baseline. Key additions:**

### Functional Requirements

- Added Acceptance Criteria (Given/When/Then) cho tất cả FRs
- Added FR-VIDEO-002 (video validation before AI processing)
- Added FR-FIGHTER-005 (data isolation)
- Added FR-TRAIN-005 (session-video link)
- Added FR-AI-010 (data quality flagging)
- Added FR-AI-011 (persona-specific insight generation)
- Added FR-PERF-005 (baseline requirement for meaningful metrics)
- Added FR-GHOST-007 (comparison score explanation)
- Added FR-COMPARE-008 (source labels)
- Added FR-COACH-008 (override audit trail)
- Added FR-MED-008 (mandatory accuracy disclaimer)
- Added FR-ADMIN-007 (job retry)

### Technical Specifications Added

- Section 10.1: Video input technical specification (format, resolution, size, FPS limits)
- Section 10.2: Metric catalogue with units and descriptions
- Section 10.4: Measurement accuracy disclaimer — comprehensive technical limitations
- Section 11.2: Ghost Mode normalization algorithm (DTW, torso-length normalization)
- Section 26: AI Limitations Register

### Domain Model

- Added entity relationships (ERD in text form)
- Added full DB table definitions (Section 13.2)
- Added access control matrix (Section 13.3)

### API Specification

- Added API conventions (base URL, auth header, error codes)
- Added request/response schemas for all endpoints
- Added pagination conventions

### Realtime Analysis

- Added technical constraints table (latency targets, model, device requirements)
- Clarified MediaPipe vs YOLO-Pose differences
- Clarified realtime data is NOT saved as full "analysis"

### Ghost Mode

- Added complete technical design (DTW algorithm, normalization steps)
- Added camera angle constraint (> 45° = not supported)
- Added ComparisonResult entity detail

### MVP Definition

- Added explicit MVP scope definition (Section 22.0)
- Clarified what is Out of Scope for MVP

### Medical Safety

- Enhanced medical language guidelines (permitted vs forbidden)
- Added mandatory disclaimer text (exact wording)
- Added FR-MED-008 requiring disclaimer on all medical measurements

### Testing

- Added testing strategy overview (unit, integration, E2E, AI evaluation)
- Added NFR-AI-005 (pose estimation accuracy baseline: PCK@0.5 ≥ 70%)
- Added NFR-AI-006 (action detection: precision ≥ 0.75, recall ≥ 0.70)

### Development Rules

- Added RULE-011 (medical language compliance)
- Added RULE-012 (accuracy disclaimer mandatory)

## v3.0 (2026-09-14)

**Academic Hardening from v2.0.**

### Core Concept Changes
- Added explicit distinction between **action recognition** and **technique-quality assessment**.
- Added **Expert-defined Technique Rubric** as the formal basis for technique evaluation.
- Explicitly prohibited claims that the system determines universally correct MMA technique.
- Added criterion-level scoring, evidence and rubric versioning.
- Added expert validation as a first-class requirement.

### Functional Requirements
- Added `FR-TECH-001` → `FR-TECH-010`.
- Added `FR-VALID-001` → `FR-VALID-006`.
- Technique scores must be decomposable into criterion-level results.
- Validation status must be explicit.

### AI / Evaluation
- Added Technique Rubric Engine.
- Added Expert Validation Engine.
- Separated action-recognition confidence from technique-assessment confidence.
- Added expert-agreement evaluation requirements.
- Recommended athlete-level train/test split to reduce identity leakage.

### Scope Hardening
- MVP narrowed to a controlled set of techniques.
- Uppercut, front kick, side kick, takedown and clinch moved to later phases.
- Removed any implication that video alone measures physical impact force.
- Medical functionality remains separate from the core training-analysis MVP.

### Data Model
- Added technique rubric, criterion, criterion result and expert annotation concepts.
- Scoring versions now represent not only weights but the released technique rubric.

### Defense Principle
> "MMA-TMS does not decide universal correctness. It evaluates observable movement characteristics against predefined, expert-informed criteria and validates the assessment against expert annotations."

## v1.0 (2026-09-12)

Initial Master Product & System Specification (Baseline).

Future changes must be recorded here with version, date, and description.
