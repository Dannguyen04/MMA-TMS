# MMA-TMS — MASTER PRODUCT & SYSTEM SPECIFICATION

> **Single Source of Truth** cho sản phẩm, requirements, domain, AI, UX/UI và technical architecture của MMA-TMS.

**Version:** 1.0  
**Status:** Baseline Specification  
**Project:** MMA-TMS — MMA Training & Movement Analysis System

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

---

# 01. PRODUCT DEFINITION

## 01.1 Product Name

**MMA-TMS — MMA Training & Movement Analysis System**

## 01.2 Product Definition

MMA-TMS là nền tảng hỗ trợ huấn luyện và phân tích chuyển động võ sĩ MMA bằng video, computer vision và dữ liệu sinh cơ học.

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

**Goal:** “Tôi muốn đá nhanh hơn, mạnh hơn và đúng kỹ thuật.”

### Problems

- Khó tự nhận biết lỗi kỹ thuật
- Không biết mình có tiến bộ hay không
- Raw metrics khó hiểu
- Cần feedback nhanh trong quá trình luyện tập

### Needs

- Simple feedback
- Score
- Improvement %
- Speed/trend
- Form score
- Ghost Mode
- Realtime feedback

### Main Actions

- Upload training video
- Realtime analysis
- Xem analysis result
- Xem progress
- So sánh với session trước
- So sánh với reference movement

## 02.2 Coach

**Goal:** “Tôi muốn có bằng chứng trực quan để sửa lỗi cho học trò và quản lý tiến độ của cả võ đường.”

### Problems

- Khó chỉ ra chính xác thời điểm lỗi
- Khó theo dõi nhiều võ sĩ
- Khó so sánh session
- AI có thể nhận định sai

### Needs

- Frame-by-frame
- Timeline
- Slow motion
- Exact impact frame
- Highlight body part
- Evidence metrics
- Athlete history
- AI review/correction

### Main Actions

- Manage fighters
- Manage training plans
- Review sessions
- Inspect AI findings
- Compare sessions
- Add coach feedback
- Track progress

## 02.3 Sports Doctor / Physiotherapist

**Goal:** “Tôi muốn dữ liệu sinh cơ học đáng tin cậy để theo dõi nguy cơ vận động và quá trình phục hồi.”

### Problems

- Khó theo dõi ROM theo thời gian
- Khó phát hiện asymmetry bằng quan sát đơn thuần
- Cần dữ liệu định lượng
- Video-based metrics có giới hạn độ chính xác

### Needs

- ROM
- Left/right comparison
- Asymmetry
- Threshold monitoring
- Historical trends
- Rehabilitation measurements

### Main Actions

- Review athlete movement
- Review medical information
- Monitor ROM
- Review asymmetry
- Review alerts
- Track rehabilitation

## 02.4 System Administrator

- Account management
- Role management
- System monitoring
- Job monitoring
- Data management
- Audit logs
- AI model/version management

## 02.5 AI Module

AI không phải human actor. AI là **supporting system capability**.

### Responsibilities

- Pose estimation
- Person tracking
- Action detection
- Phase detection
- Biomechanical estimation
- Technique analysis
- Comparison
- Scoring
- Insight generation

AI không được tự nhận là Coach, Doctor hoặc Medical Diagnostician.

---

# 03. PRODUCT PRINCIPLES

## 03.1 Insight-First

Mọi metric quan trọng phải có mục đích sử dụng. Không xây metric chỉ vì model có thể tính được.

## 03.2 Metric ≠ Finding ≠ Insight ≠ Recommendation

**Metric:** Giá trị định lượng. Ví dụ `Knee angle = 147°`.

**Finding:** AI phát hiện một hiện tượng. Ví dụ `Extension below reference baseline`.

**Insight:** Giải thích có ý nghĩa đối với persona.

**Recommendation:** Hành động đề xuất.

---

# 04. PRODUCT SCOPE

## 04.1 Identity & Access

- Authentication
- Authorization
- RBAC
- Profile management

## 04.2 Fighter Management

- Fighter profile
- Body statistics
- Weight class
- Training level
- Training history

## 04.3 Training Management

- Training plan
- Training schedule
- Training session
- Exercise
- Session history
- Goals
- Progress

## 04.4 Video Management

- Upload video
- Video metadata
- Video storage
- Processing status
- Video playback
- Evidence frame navigation

## 04.5 AI Motion Analysis

- Pose estimation
- Person tracking
- Action detection
- Technique phase detection
- Motion metrics
- Technique findings
- Confidence
- Data quality

## 04.6 Performance Analytics

- Speed
- Form
- Consistency
- Timing
- Trajectory
- Progress
- Session comparison

## 04.7 Ghost Mode

- Reference video
- Reference analysis
- Reference motion
- Pose normalization
- Temporal alignment
- Side-by-side comparison
- Skeleton overlay
- Difference visualization

## 04.8 Coach Platform

- Athlete management
- Training management
- Analysis review
- AI evidence
- Coach feedback
- Progress comparison

## 04.9 Medical / Rehabilitation

- Medical record
- Examination
- ROM
- Asymmetry
- Alerts
- Rehabilitation measurements
- Historical trend

## 04.10 Administration

- Users
- Roles
- Jobs
- System health
- AI models
- Audit logs
- Notifications

---

# 05. FUNCTIONAL REQUIREMENTS

## 05.1 Authentication

| ID | Requirement |
|---|---|
| FR-AUTH-001 | User can authenticate into the system. |
| FR-AUTH-002 | System enforces role-based access. |
| FR-AUTH-003 | User can manage profile information. |

## 05.2 Fighter

| ID | Requirement |
|---|---|
| FR-FIGHTER-001 | Fighter can view personal profile. |
| FR-FIGHTER-002 | Fighter can view training history. |
| FR-FIGHTER-003 | Fighter can view performance progress. |
| FR-FIGHTER-004 | Fighter can view AI-generated insights. |

## 05.3 Training

| ID | Requirement |
|---|---|
| FR-TRAIN-001 | User can create/manage training sessions. |
| FR-TRAIN-002 | Coach can create training plans. |
| FR-TRAIN-003 | Fighter can view assigned training plans. |
| FR-TRAIN-004 | System records completed training sessions. |

## 05.4 Video

| ID | Requirement |
|---|---|
| FR-VIDEO-001 | User can upload supported training videos. |
| FR-VIDEO-002 | System stores video metadata. |
| FR-VIDEO-003 | System creates an analysis job after upload. |
| FR-VIDEO-004 | User can view processing status. |
| FR-VIDEO-005 | User can replay analyzed video. |

## 05.5 AI Analysis

| ID | Requirement |
|---|---|
| FR-AI-001 | System extracts human pose from supported video. |
| FR-AI-002 | System tracks the relevant athlete. |
| FR-AI-003 | System detects supported martial-art actions. |
| FR-AI-004 | System detects technique phases. |
| FR-AI-005 | System calculates configured movement metrics. |
| FR-AI-006 | System generates technique findings. |
| FR-AI-007 | AI findings include confidence. |
| FR-AI-008 | Findings are traceable to evidence frames/timestamps. |
| FR-AI-009 | Analysis stores model and scoring versions. |

## 05.6 Performance

| ID | Requirement |
|---|---|
| FR-PERF-001 | System calculates supported performance metrics. |
| FR-PERF-002 | Fighter can view improvement over time. |
| FR-PERF-003 | Coach can review athlete performance history. |
| FR-PERF-004 | System can compare current and historical performance. |

## 05.7 Ghost Mode

| ID | Requirement |
|---|---|
| FR-GHOST-001 | User can select a reference movement. |
| FR-GHOST-002 | System analyzes the reference movement. |
| FR-GHOST-003 | System extracts reference motion. |
| FR-GHOST-004 | System aligns reference and athlete motion. |
| FR-GHOST-005 | System visualizes skeleton comparison. |
| FR-GHOST-006 | System identifies spatial/timing/trajectory differences. |

> “Golden Pose” is a presentation concept. The domain concept should be **Reference Motion** because the reference is not universally correct for every athlete.

## 05.8 Comparison

| ID | Requirement |
|---|---|
| FR-COMPARE-001 | System supports synchronized side-by-side playback. |
| FR-COMPARE-002 | User can compare current vs previous session. |
| FR-COMPARE-003 | User can compare current vs reference motion. |
| FR-COMPARE-004 | User can seek synchronized timeline. |
| FR-COMPARE-005 | User can step frame-by-frame. |
| FR-COMPARE-006 | User can change playback speed. |
| FR-COMPARE-007 | User can toggle skeleton overlays. |

## 05.9 Coach

| ID | Requirement |
|---|---|
| FR-COACH-001 | Coach can manage assigned fighters. |
| FR-COACH-002 | Coach can review athlete sessions. |
| FR-COACH-003 | Coach can inspect AI findings. |
| FR-COACH-004 | Coach can navigate directly to evidence frames. |
| FR-COACH-005 | Coach can add feedback. |
| FR-COACH-006 | Coach can correct/override AI findings. |
| FR-COACH-007 | Coach can compare athlete sessions. |

## 05.10 Medical

| ID | Requirement |
|---|---|
| FR-MED-001 | System calculates configured ROM measurements. |
| FR-MED-002 | System calculates left/right asymmetry. |
| FR-MED-003 | System supports configurable monitoring thresholds. |
| FR-MED-004 | System provides historical movement trends. |
| FR-MED-005 | System records rehabilitation measurements. |
| FR-MED-006 | System generates non-diagnostic monitoring alerts. |
| FR-MED-007 | Authorized medical users can review medical information. |

## 05.11 Administration

| ID | Requirement |
|---|---|
| FR-ADMIN-001 | Admin can manage users. |
| FR-ADMIN-002 | Admin can manage roles. |
| FR-ADMIN-003 | Admin can monitor analysis jobs. |
| FR-ADMIN-004 | Admin can inspect system errors. |
| FR-ADMIN-005 | Admin can manage AI model versions. |
| FR-ADMIN-006 | System records audit events. |

---

# 06. CORE USER FLOWS

## 06.1 Fighter — Video Analysis

```text
Login → Dashboard → Upload Video → Select Training/Technique → Submit
→ Analysis Processing → Analysis Ready → View Score → View Insights
→ View Evidence → Compare Progress
```

## 06.2 Fighter — Realtime

```text
Camera → Pose Model → Frame Processing → Motion Detection → Technique Phase
→ Fast Metrics → Immediate Feedback
```

Realtime UI prioritizes score, speed/trend and simple feedback. Raw joint angles are not the primary Fighter UI.

## 06.3 Coach — Evidence Review

```text
Coach Dashboard → Select Fighter → Select Session → Open Analysis
→ Select Finding → Jump to Evidence Frame → Slow Motion / Frame Step
→ Inspect Body Part → Accept / Correct AI Finding → Add Coach Feedback
```

## 06.4 Doctor — Movement Review

```text
Medical Dashboard → Select Fighter → Movement Assessment → ROM
→ Asymmetry → Historical Trend → Monitoring Alert → Clinical Review
```

---

# 07. DOMAIN MODEL

## 07.1 Core Entities

```text
User
Fighter
Coach
SportsDoctor

TrainingPlan
TrainingSession
Exercise

Video
AnalysisJob
Analysis
PoseData
MotionSequence

Action
Technique
TechniquePhase

Metric
Finding
Insight
Recommendation

ReferenceMotion
Comparison

MedicalRecord
MedicalExamination
Injury
RehabilitationMeasurement
MedicalAlert

AIModelVersion
ScoringVersion
AuditLog
```

## 07.2 Analysis Evidence Chain

```text
Video
  ↓
AnalysisJob
  ↓
Analysis
  ├── PoseData
  ├── MotionSequence
  └── Action
        ↓
   TechniquePhase
        ↓
      Metrics
        ↓
     Findings
        ↓
      Insights
        ↓
 Recommendations
```

Every important result should be traceable to analysis ID, action ID, frame/timestamp, metric, scoring version, AI model version, confidence and data quality.

---

# 08. INSIGHT ARCHITECTURE

## 08.1 Insight Entity

```text
Insight
├── analysis_id
├── persona
├── category
├── title
├── description
├── severity
├── confidence
├── evidence
└── recommendation
```

## 08.2 Persona-Specific Interpretation

The same underlying analysis can generate different insights.

Example:

```text
Metric: Knee angle = 147°
Finding: Extension below reference baseline

Fighter: "Chân chưa duỗi đủ ở pha impact."
Coach: "Hip rotation bắt đầu muộn trước impact."
Doctor: "Extension measurement differs from monitoring baseline."
```

## 08.3 Insight Generation

```text
Metrics + Findings + Persona + History
                ↓
          Insight Engine
                ↓
      Insights + Recommendations
```

---

# 09. AI / MOTION ANALYSIS SPECIFICATION

## 09.1 AI Architecture

```text
AI Analysis Engine
│
├── PoseEstimator
├── PersonTracker
├── ActionDetector
├── PhaseDetector
├── BiomechanicsEngine
├── TechniqueAnalyzer
├── AsymmetryAnalyzer
├── ComparisonEngine
├── ScoringEngine
└── InsightEngine
```

## 09.2 Offline Video Pipeline

```text
Video → Person Detection → Pose Estimation → Tracking → Pose Normalization
→ Action Detection → Phase Detection → Biomechanics → Technique Analysis
→ Comparison → Scoring → Insight Generation
```

## 09.3 Realtime Pipeline

```text
Camera → Pose Model → Frame Processing → Motion Detection → Technique Phase
→ Fast Metrics → Immediate Feedback
```

Realtime and offline analysis may use different model configurations.

## 09.4 AI Confidence

Every important AI result should expose confidence, data quality, model version and analysis version. Low-confidence results must not be presented as certain facts.

---

# 10. BIOMECHANICS & PERFORMANCE

## 10.1 Metric Categories

### Technique

- Joint angles
- Hip rotation
- Limb trajectory
- Phase timing
- Recovery timing
- Body alignment

### Performance

- Relative velocity
- Movement duration
- Repetition consistency
- Form score
- Improvement %

### Medical Monitoring

- ROM
- Left/right difference
- Asymmetry %
- Baseline deviation
- Threshold status

## 10.2 Asymmetry

```text
AsymmetryAnalysis
├── metric
├── left_value
├── right_value
├── absolute_difference
├── percentage_difference
├── baseline
├── threshold
└── status
```

Example: Left ROM = 108°, Right ROM = 135°, Difference = 27°, Asymmetry = 20%, Status = REVIEW.

## 10.3 Speed and Force

Video-based speed should be treated as relative/estimated speed unless camera calibration and validated measurement methodology exist.

Force should not be presented as measured physical force when it is only inferred from motion. Preferred terminology: **force proxy**, **estimated impact intensity**, **relative acceleration proxy**.

---

# 11. GHOST MODE / REFERENCE MOTION

## 11.1 Domain Model

```text
ReferenceVideo → ReferenceAnalysis → ReferenceMotion → Comparison → ComparisonResult
```

## 11.2 Comparison Dimensions

1. Normalized pose
2. Joint angles
3. Trajectory
4. Timing
5. Phase alignment
6. Body proportions

Ghost Mode must not rely on simple pixel difference.

## 11.3 Comparison Output

```text
Spatial Difference
Timing Difference
Trajectory Difference
Phase Difference
Overall Comparison Score
```

---

# 12. UX / UI SPECIFICATION

## 12.1 Role-Based Views

```text
Fighter View
Coach View
Medical View
Admin View
```

The same analysis data may be presented differently depending on persona.

## 12.2 Fighter IA

```text
Dashboard
├── Today
├── Quick Training
├── Realtime
├── Upload Analysis
├── Ghost Mode
├── Progress
└── History
```

## 12.3 Coach IA

```text
Dashboard
├── Athletes
├── Training Plans
├── Sessions
├── Analysis
├── Comparisons
├── AI Findings
└── Feedback
```

## 12.4 Medical IA

```text
Dashboard
├── Athletes
├── Movement Assessment
├── ROM
├── Asymmetry
├── Alerts
├── Rehabilitation
└── History
```

## 12.5 Analysis Screen

```text
┌──────────────────────────────────────────┐
│ Video / Side-by-Side Comparison         │
│   Athlete        Reference / Previous    │
├──────────────────────────────────────────┤
│ Timeline / Phase / Evidence              │
├──────────────────────────────────────────┤
│ Score | Metrics | Findings | Insights    │
├──────────────────────────────────────────┤
│ Recommendation / Coach Review             │
└──────────────────────────────────────────┘
```

---

# 13. DATABASE SPECIFICATION

Database design must be derived from the domain model and requirements.

## 13.1 Core Tables

```text
users
fighters
coaches
sports_doctors
training_plans
training_sessions
exercises
videos
analysis_jobs
analyses
pose_data
motion_sequences
actions
techniques
technique_phases
metrics
findings
insights
recommendations
reference_motions
comparisons
medical_records
medical_examinations
injuries
rehabilitation_measurements
medical_alerts
ai_model_versions
scoring_versions
audit_logs
```

Each entity must document purpose, fields, PK, FK, constraints, indexes and access control.

---

# 14. API SPECIFICATION

API design must follow domain entities and user flows.

## 14.1 Video

```text
POST /videos
GET /videos/:id
DELETE /videos/:id
```

## 14.2 Analysis

```text
POST /analysis-jobs
GET /analysis-jobs/:id
GET /analyses/:id
```

## 14.3 Fighter

```text
GET /fighters/:id
GET /fighters/:id/history
GET /fighters/:id/progress
```

## 14.4 Comparison

```text
POST /comparisons
GET /comparisons/:id
```

## 14.5 Medical

```text
GET /fighters/:id/medical
GET /fighters/:id/movement-assessments
GET /fighters/:id/rehabilitation
GET /fighters/:id/alerts
```

---

# 15. SYSTEM ARCHITECTURE

## 15.1 Logical Architecture

```text
Users
  ↓
Next.js Frontend
  ├── Fighter View
  ├── Coach View
  ├── Medical View
  └── Admin View
  ↓
NestJS API
  ├── Auth / RBAC
  ├── Training
  ├── Video
  ├── Analysis
  ├── Comparison
  └── Medical
  │
  ├──────────────→ PostgreSQL / Supabase
  │
  └──────────────→ Redis / BullMQ
                          ↓
                    Python AI Worker
                          │
              ┌───────────┴───────────┐
              ↓                       ↓
        Pose / CV Engine       Analysis Engine
                                      ↓
                               Insight Engine
                                      ↓
                                Object Storage
```

## 15.2 Technical Baseline

- Frontend: Next.js, TypeScript
- Backend: NestJS, Prisma
- Database: PostgreSQL, Supabase
- Queue: Redis, BullMQ
- AI: Python, YOLOv8-Pose, OpenCV, MediaPipe
- Storage: Supabase Storage / Object Storage
- Deployment: Docker Compose

Technical choices may evolve, but changes must preserve product/domain contracts unless explicitly approved.

---

# 16. SECURITY / PRIVACY / MEDICAL SAFETY

## 16.1 Security

- Authentication
- RBAC
- Least privilege
- Secure file access
- API authorization
- Audit logging

## 16.2 Privacy

Training videos and health information are sensitive project data. Define access, retention, deletion, sharing and audit policies.

## 16.3 Medical Safety

AI output is **assistive**, not diagnostic.

Preferred language:

- observation
- estimated measurement
- monitoring alert
- requires review
- outside configured threshold

Medical alerts are not medical diagnoses.

---

# 17. NON-FUNCTIONAL REQUIREMENTS

## Performance

| ID | Requirement |
|---|---|
| NFR-PERF-001 | UI should remain responsive during analysis processing. |
| NFR-PERF-002 | Long-running AI analysis must execute asynchronously. |
| NFR-PERF-003 | Realtime analysis should prioritize low latency. |

## Reliability

| ID | Requirement |
|---|---|
| NFR-REL-001 | Failed analysis jobs must be detectable. |
| NFR-REL-002 | Queue jobs should support retry policies. |
| NFR-REL-003 | Analysis status must be persisted. |

## Security

| ID | Requirement |
|---|---|
| NFR-SEC-001 | Protected resources require authorization. |
| NFR-SEC-002 | Role permissions must be enforced server-side. |
| NFR-SEC-003 | Audit sensitive operations. |

## Privacy

| ID | Requirement |
|---|---|
| NFR-PRIV-001 | Video access must be authorized. |
| NFR-PRIV-002 | Medical information must have restricted access. |
| NFR-PRIV-003 | Data lifecycle must be documented. |

## AI Quality

| ID | Requirement |
|---|---|
| NFR-AI-001 | AI results include confidence. |
| NFR-AI-002 | AI results include model version. |
| NFR-AI-003 | Low-quality input must be identifiable. |
| NFR-AI-004 | AI limitations must be documented. |

---

# 18. TESTING & ACCEPTANCE CRITERIA

Every important requirement must have acceptance criteria.

## Example — FR-GHOST-001

Given a valid reference video, when the user selects Ghost Mode, the system provides reference movement, athlete movement, alignment, comparison visualization and evidence inspection.

## Example — FR-COMPARE-001

The system supports play/pause, synchronized seek, frame step, playback speed, overlay toggle and source labels.

## Example — FR-AI-008

Every important finding contains analysis ID, evidence frame range, timestamp, affected body part, supporting metrics and confidence.

---

# 19. DEVELOPMENT RULES

## RULE-001 — Requirements Before Implementation

Do not implement major functionality without a corresponding requirement.

## RULE-002 — Domain Before Infrastructure

Do not allow infrastructure decisions to define the business domain.

## RULE-003 — Evidence Traceability

Every important AI conclusion must be traceable to measurable evidence.

## RULE-004 — Persona-Aware Output

The same metric may produce different insights for different personas.

## RULE-005 — Human-in-the-Loop

Coach and medical users must be able to review relevant AI outputs.

## RULE-006 — AI Versioning

Store model and scoring versions for reproducibility.

## RULE-007 — No Raw Data Dump

Raw pose coordinates are not a product feature by themselves.

## RULE-008 — No Undocumented Scope

New features must first be documented as proposed requirements.

## RULE-009 — API Contract Stability

Do not break existing contracts without documenting the change.

## RULE-010 — Documentation Sync

Architecture changes must update the relevant documentation.

---

# 20. AI CODING AGENT RULES

Before modifying the codebase, an AI coding agent must:

1. Read `MASTER-SPECIFICATION.md`.
2. Identify the relevant persona.
3. Identify the requirement ID.
4. Identify affected user flow.
5. Identify affected domain entities.
6. Identify affected API contracts.
7. Identify affected UI.
8. Check security/privacy implications.
9. Check AI/medical safety implications.
10. Implement only the approved scope.
11. Update documentation if the architecture changes.
12. Clearly mark undocumented ideas as `PROPOSED`.

### AI Agent must NOT

- Invent business requirements
- Invent medical conclusions
- Treat estimated metrics as clinically validated measurements
- Couple UI directly to raw AI output
- Change domain models without justification
- Remove existing behavior without checking requirements

---

# 21. DEFINITION OF DONE

A feature is complete only when:

```text
Requirement → User Flow → Domain → Implementation → Tests → Acceptance Criteria → Documentation
```

Checklist:

- [ ] Requirement exists
- [ ] Persona identified
- [ ] User flow defined
- [ ] Domain impact reviewed
- [ ] API updated
- [ ] Database updated if required
- [ ] UI implemented
- [ ] AI impact reviewed if applicable
- [ ] Security reviewed
- [ ] Medical safety reviewed if applicable
- [ ] Tests written
- [ ] Acceptance criteria passed
- [ ] Documentation updated

---

# 22. ROADMAP

## Phase 1 — Core Motion Analysis

- Video upload
- Processing pipeline
- Pose extraction
- Action detection
- Basic metrics
- Findings
- Evidence navigation

## Phase 2 — Fighter Experience

- Fighter dashboard
- Realtime analysis
- Scores
- Progress
- History
- Simple insights

## Phase 3 — Coach Platform

- Athlete management
- Training plans
- Evidence review
- AI correction
- Comparison
- Coach feedback

## Phase 4 — Ghost Mode

- Reference video
- Reference motion
- Pose alignment
- Synchronized comparison
- Difference visualization

## Phase 5 — Biomechanics & Medical Support

- ROM
- Asymmetry
- Historical trends
- Threshold monitoring
- Rehabilitation tracking

## Phase 6 — Advanced AI

- More techniques
- Better phase detection
- Advanced biomechanics
- Better personalization
- Improved scoring
- Better insight generation

---

# 23. REQUIREMENT ID CONVENTION

```text
FR-AUTH-xxx
FR-FIGHTER-xxx
FR-COACH-xxx
FR-TRAIN-xxx
FR-VIDEO-xxx
FR-AI-xxx
FR-PERF-xxx
FR-GHOST-xxx
FR-COMPARE-xxx
FR-MED-xxx
FR-REHAB-xxx
FR-ADMIN-xxx

NFR-PERF-xxx
NFR-SEC-xxx
NFR-PRIV-xxx
NFR-REL-xxx
NFR-AI-xxx

SAFETY-xxx
```

---

# 24. TRACEABILITY MODEL

Every major feature should be traceable:

```text
Persona → Goal → User Story → Requirement → User Flow → Domain Entity → API → UI → Implementation → Test
```

For AI:

```text
Video → Analysis → Action → Phase → Metric → Finding → Evidence → Insight → Recommendation
```

---

# 25. MASTER PRODUCT PRINCIPLE

> **MMA-TMS is not primarily a pose detection system.**
>
> It is an **AI-assisted martial arts movement analysis and training management platform**.
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

The system must always answer:

> **“So what does this data mean for this user, and what can they do next?”**

---

# 26. CHANGE LOG

## v1.0

Initial Master Product & System Specification.

Established:

- Product vision
- Personas
- Product scope
- Functional requirements
- User flows
- Domain model
- Insight-first architecture
- AI pipeline
- Ghost Mode
- Comparison
- Biomechanics
- Medical safety
- UX architecture
- Database direction
- API direction
- System architecture
- NFR
- Testing
- AI agent rules
- Definition of Done
- Roadmap

Future changes must be recorded here.
