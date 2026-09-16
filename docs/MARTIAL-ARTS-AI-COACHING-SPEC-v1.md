# MARTIAL ARTS AI COACHING — PRODUCT & SYSTEM SPECIFICATION

**Mã tài liệu:** MA-AIC-SPEC-v1  
**Trạng thái:** Draft for team review  
**Ngày cập nhật:** 2026-09-15  
**Phạm vi:** Phân tích video huấn luyện Boxing, Kickboxing, Muay Thai, Karate và Taekwondo  
**Đối tượng đọc:** Product, AI/ML, Backend, Frontend, QA, HLV và chuyên gia thể lực

---

## 1. Mục đích

Tài liệu này là nguồn tham chiếu chung để team và AI agent hiểu thống nhất cách phát triển MMA-TMS từ hệ thống nhận diện đòn đơn lẻ thành nền tảng huấn luyện võ thuật bằng video.

Hệ thống phải hoàn thành vòng lặp:

```text
HLV giao bài → Võ sĩ thực hiện → AI đo lường → HLV xác nhận
→ Hệ thống đề xuất sửa lỗi → Võ sĩ tập lại → Chứng minh tiến bộ
```

Hệ thống không chỉ trả lời “đây là đấm hay đá”, mà phải:

1. Theo dõi đúng võ sĩ.
2. Phát hiện từng hành động.
3. Phân loại kỹ thuật và bên thực hiện.
4. Chia hành động thành các pha.
5. Đánh giá theo rubric đúng môn võ.
6. Trình bày bằng chứng trên video.
7. Tổng hợp lỗi và đề xuất bài tập.
8. Cho phép HLV xác nhận hoặc sửa kết quả.
9. Theo dõi tiến bộ theo baseline cá nhân.

---

## 2. Nguyên tắc sản phẩm bắt buộc

### 2.1 Tách ba bài toán AI

```text
Detection      Có một hành động xảy ra không?
Classification Đó là jab, cross, hook, kick hay knee?
Assessment     Kỹ thuật đó được thực hiện tốt đến mức nào?
```

Không dùng confidence của detection thay cho confidence của classification hoặc assessment.

### 2.2 Không kết luận từ một frame hoặc một góc đơn lẻ

Một hành động phải được nhận diện từ chuỗi chuyển động gồm chuẩn bị, phát lực, peak/impact và thu đòn. Các ngưỡng góc chỉ là cấu hình khởi tạo, không phải chuẩn sinh học áp dụng cho mọi võ sĩ và môn võ.

### 2.3 Không bịa dữ liệu

Nếu keypoint bị che, ra ngoài khung hình hoặc confidence thấp, tiêu chí liên quan phải có trạng thái `INSUFFICIENT_EVIDENCE` và không tham gia mẫu số tính điểm.

### 2.4 Phân biệt đo lường với diễn giải

- Có thể nói: “góc khuỷu ước lượng 164°”.
- Có thể nói: “tay đối diện rời vùng guard trong 62% pha extension”.
- Không được nói: “mất 30% lực” nếu hệ thống không đo lực trực tiếp.
- Không được chẩn đoán chấn thương hoặc bệnh lý.

### 2.5 Rubric phụ thuộc môn võ

Cùng tên `round_kick` nhưng Taekwondo, Karate và Muay Thai có kỹ thuật, chamber, quỹ đạo và cách phát lực khác nhau. Mỗi rubric phải có `martial_art`, `technique` và `version`.

### 2.6 HLV là người ra quyết định chuyên môn

AI cung cấp phép đo, bằng chứng và đề xuất. HLV có quyền xác nhận, sửa hoặc bác bỏ. Kết quả đã duyệt phải được phân biệt với kết quả chỉ do AI tạo.

---

## 3. Phạm vi sản phẩm

### 3.1 MVP

- Một võ sĩ là đối tượng phân tích chính.
- Video shadowboxing, heavy bag hoặc pad work.
- Camera chính diện, ngang hoặc góc 45° theo hướng dẫn.
- Boxing: jab, cross, hook.
- Muay Thai/Kickboxing: round kick và knee strike.
- Phát hiện, phân loại, chia pha, chấm rubric, hiển thị bằng chứng.
- HLV xác nhận/sửa nhãn và thời điểm hành động.
- Tổng hợp tối đa ba lỗi ưu tiên trong một buổi.
- So sánh với baseline cá nhân khi điều kiện video tương thích.

### 3.2 Sau MVP

- Uppercut, front kick, side kick, back kick, elbow strike.
- Combo và các action window chồng lấn.
- Phân tích nhiều võ sĩ/sparring.
- Phân tích chiến thuật và tương tác với đối thủ.
- Pose 3D hoặc multi-view.

### 3.3 Ngoài phạm vi hiện tại

- Đo lực va chạm tuyệt đối chỉ từ video monocular.
- Chẩn đoán y khoa hoặc dự báo chấn thương.
- Tự động thay thế đánh giá của HLV.
- Tuyên bố chính xác sinh cơ học 3D từ video 2D không hiệu chỉnh.

---

## 4. Vai trò người dùng

| Vai trò | Mục tiêu chính | Chế độ hiển thị |
|---|---|---|
| Võ sĩ mới | Hiểu lỗi và cách sửa | Đơn giản, tối đa 1–3 lỗi |
| Võ sĩ thi đấu | Tối ưu combo, độ ổn định và hiệu suất khi mệt | Xu hướng và baseline cá nhân |
| HLV kỹ thuật | Duyệt nhanh, sửa nhãn, giao bài | Bằng chứng, metric và annotation |
| HLV thể lực | Theo dõi tốc độ tương đối, đối xứng, suy giảm | Biểu đồ và thống kê |
| Chuyên gia phục hồi | Theo dõi ROM và sai lệch so với baseline | Có disclaimer, không chẩn đoán |
| Quản lý CLB | Quản lý người dùng, bài tập và mức sử dụng | Dữ liệu tổng hợp |
| Annotator | Tạo nhãn huấn luyện chính xác | Công cụ frame-level |
| Admin | Quản lý quyền, model và audit | Phiên bản, log và rollback |

---

## 5. Luồng nghiệp vụ chính

### 5.1 Thiết lập hồ sơ võ sĩ

1. Tạo hồ sơ và chọn môn võ.
2. Khai báo bên thuận và stance mặc định.
3. Thực hiện 5–10 lần mỗi kỹ thuật cơ bản.
4. HLV chọn các lần thực hiện tốt làm reference.
5. Hệ thống tạo baseline khi đủ số mẫu hợp lệ.

Baseline có thể chứa:

- Biên độ góc khớp.
- Thời gian từng pha.
- Vận tốc chuẩn hóa.
- Mức xoay vai/chậu.
- Guard retention.
- Balance/recovery.
- Độ ổn định giữa các lần lặp.

### 5.2 HLV giao bài

HLV cấu hình:

- Võ sĩ hoặc nhóm.
- Môn võ và kỹ thuật.
- Số hiệp, thời lượng hoặc số lần lặp.
- Mục tiêu kỹ thuật.
- Hạn hoàn thành.
- Camera view và target type yêu cầu.

`COMPLETED` nghĩa là hoàn thành khối lượng. `TECHNIQUE_PASSED` là trạng thái độc lập và không được suy ra chỉ từ việc hoàn thành bài.

### 5.3 Võ sĩ gửi video

1. Chọn bài tập.
2. Xem hướng dẫn đặt camera.
3. Quay/tải video.
4. Hệ thống kiểm tra video.
5. Nếu không đạt, chỉ rõ lý do và cách quay lại.
6. Nếu đạt, tạo analysis job.

### 5.4 Phân tích

```text
Video quality gate
→ Pose estimation
→ Target athlete tracking
→ Pose smoothing and normalization
→ Stance estimation
→ Candidate action detection
→ Technique classification
→ Phase segmentation
→ Rubric assessment
→ Session aggregation
```

### 5.5 HLV duyệt

HLV có thể:

- Xác nhận nhận diện đúng.
- Sửa loại đòn.
- Sửa tay/chân hoặc lead/rear.
- Sửa start, peak/impact và end frame.
- Đánh dấu không phải đòn đánh.
- Bác bỏ finding.
- Thêm nhận xét.
- Chọn action làm reference.

Mọi chỉnh sửa phải có audit trail.

### 5.6 Theo dõi tiến bộ

Chỉ so sánh trực tiếp khi:

- Cùng môn võ và kỹ thuật.
- Cùng rubric version hoặc có quy tắc chuyển đổi.
- Camera view tương thích.
- Pose quality đạt ngưỡng.
- Metric có cùng định nghĩa và đơn vị.

---

## 6. Taxonomy hành động

### 6.1 Nhãn chính

```text
punch:
  jab, cross, lead_hook, rear_hook,
  lead_uppercut, rear_uppercut, overhand, unknown_punch

kick:
  front_kick, round_kick, side_kick,
  back_kick, axe_kick, unknown_kick

other_strike:
  knee_strike, elbow_strike, unknown_strike

non_strike:
  block, parry, feint, clinch, guard_adjustment,
  walk, grapple, idle, unknown_non_strike
```

### 6.2 Quy tắc `unknown`

Không ép mô hình chọn một lớp khi confidence thấp. `unknown_*` là đầu ra hợp lệ và phải được đưa vào hàng chờ HLV duyệt.

### 6.3 Shadowboxing và impact

Trong shadowboxing, `impact_frame` là kinematic impact proxy: peak reach, peak attack velocity hoặc thời điểm đổi hướng. Nó không khẳng định có tiếp xúc vật lý.

---

## 7. Biểu diễn skeleton và feature

### 7.1 Keypoint tối thiểu

- Nose/head proxy.
- Left/right shoulder.
- Left/right elbow.
- Left/right wrist.
- Left/right hip.
- Left/right knee.
- Left/right ankle.

### 7.2 Keypoint khuyến nghị

- Heel và toe để xác định pivot/hướng bàn chân.
- Hand hoặc glove center để cải thiện quỹ đạo đấm.
- Pose 3D/pseudo-3D khi cần xoay thân và chuyển động theo chiều sâu.

### 7.3 Chuẩn hóa

- Gốc: trung điểm hai hông.
- Scale: shoulder width, hip width hoặc torso length.
- Trục cơ thể: hip center → shoulder center.
- Chuẩn hóa theo stance và hướng đối thủ.
- Cho phép mirror left/right về hệ quy chiếu lead/rear.

### 7.4 Feature theo frame

```text
position, confidence, velocity, acceleration,
elbow_angle, knee_angle, hip_angle,
torso_lean, shoulder_axis, pelvis_axis,
guard_distance, balance_proxy
```

### 7.5 Feature theo action window

```text
duration, phase_durations,
joint_angle_min/max/range,
trajectory_dx/dy/(dz),
trajectory_length, direct_distance, curvature,
peak_velocity, mean_velocity, retraction_velocity,
shoulder_rotation, pelvis_rotation,
hip_shoulder_delay,
guard_drop_duration,
recovery_time, pose_quality_ratio
```

Vận tốc đơn lẻ không được dùng làm bằng chứng duy nhất của strike.

---

## 8. Đặc trưng kỹ thuật

Các khoảng góc dưới đây chỉ là bootstrap hypotheses. Chúng phải được hiệu chỉnh bằng dữ liệu có nhãn và rubric của HLV.

| Kỹ thuật | Hình dạng chuyển động | Dấu hiệu chính |
|---|---|---|
| Jab | Đường thẳng, ngắn | Khuỷu mở; reach tăng; lead hand; ít xoay thân |
| Cross | Đường thẳng, dài | Rear hand; khuỷu mở; vai/chậu xoay; chuyển trọng lượng |
| Hook | Cung ngang | Khuỷu thường giữ khoảng 70–125°; bán kính quanh vai ít đổi; thân xoay |
| Uppercut | Cung từ dưới lên | Khuỷu thường giữ khoảng 55–115°; cổ tay đi lên và tới trước; có hỗ trợ chân/hông |
| Front kick | Push-style thẳng | Gối chamber rồi duỗi; ít xoay ngang; cổ chân tiến thẳng |
| Round kick | Throw-style/cung ngang | Xoay chậu; pivot chân trụ; cổ chân đi theo cung |
| Side kick | Push-style từ bên | Thân quay ngang; chamber; gót đẩy thẳng về mục tiêu |
| Knee strike | Gối là điểm tấn công | Gối giữ gập; gối/hông tiến; không có pha duỗi chân kiểu kick |

### 8.1 Jab và cross

- Không suy ra jab/cross từ tay trái/phải.
- Phải ước lượng stance và chuyển tay thành `lead`/`rear`.
- Nếu stance không chắc chắn, trả về `left_straight` hoặc `right_straight` ở dữ liệu trung gian và `unknown_punch` cho người dùng.

### 8.2 Hook

Không dùng điều kiện quỹ đạo thẳng của jab/cross để loại hook. Feature quan trọng gồm curvature, chuyển động tiếp tuyến, elbow range, shoulder/pelvis rotation và target-relative direction.

### 8.3 Knee strike

Không đi qua kick detector yêu cầu duỗi gối. Knee strike cần candidate detector dựa trên chuyển động của đầu gối và hông.

---

## 9. Rubric và scoring

### 9.1 Cấu trúc rubric

```yaml
id: muay_thai_round_kick_v1
martial_art: muay_thai
technique: round_kick
version: 1
criteria:
  - id: pelvis_rotation
    weight: 0.25
  - id: support_foot_pivot
    weight: 0.20
  - id: trajectory
    weight: 0.20
  - id: guard
    weight: 0.15
  - id: balance
    weight: 0.10
  - id: recovery
    weight: 0.10
```

### 9.2 Quy tắc tính điểm

- Chỉ tiêu có đủ bằng chứng mới tham gia mẫu số.
- Score tổng phải lưu rubric version.
- Không so sánh score được tạo từ hai rubric không tương thích.
- Tốc độ cao không được bù hoàn toàn cho guard hoặc balance kém.
- Assessment confidence phụ thuộc pose quality và mức phù hợp của camera view.

### 9.3 Phản hồi

Mỗi finding phải có:

- Mã lỗi ổn định.
- Mô tả thân thiện với võ sĩ.
- Metric/evidence hỗ trợ.
- Frame hoặc khoảng frame.
- Confidence.
- Body part.
- Recommendation từ thư viện đã được HLV duyệt.

Sau một buổi, chỉ hiển thị tối đa ba lỗi ưu tiên dựa trên mức độ, tần suất và khả năng hành động.

---

## 10. Hợp đồng đầu vào phân tích

```json
{
  "videoUrl": "https://...",
  "athleteId": "athlete_123",
  "sessionId": "session_456",
  "martialArt": "muay_thai",
  "trainingMode": "single_technique",
  "expectedTechniques": ["round_kick"],
  "stance": "orthodox",
  "cameraView": "front_45",
  "targetType": "heavy_bag",
  "skillLevel": "intermediate"
}
```

Các enum phải được quản lý tập trung. Giá trị không hợp lệ phải bị từ chối ở API boundary.

---

## 11. Hợp đồng đầu ra phân tích

### 11.1 Action thống nhất

```json
{
  "id": "action_12",
  "family": "punch",
  "technique": "cross",
  "attackingSide": "right",
  "limbRole": "rear",
  "stance": "orthodox",
  "confidence": {
    "detection": 0.94,
    "classification": 0.86,
    "assessment": 0.79
  },
  "phases": {
    "startFrame": 120,
    "launchFrame": 124,
    "peakFrame": 132,
    "impactFrame": 133,
    "endFrame": 141,
    "impactType": "visual_contact"
  },
  "metrics": {
    "maxElbowAngle": {
      "value": 168.4,
      "unit": "degree",
      "confidence": 0.91
    },
    "trajectoryCurvature": {
      "value": 1.08,
      "unit": "ratio",
      "confidence": 0.88
    }
  },
  "assessment": {
    "rubricId": "boxing_cross_v1",
    "score": 78,
    "status": "needs_improvement",
    "primaryError": "late_hip_rotation"
  },
  "review": {
    "status": "ai_generated"
  }
}
```

### 11.2 Confidence

```text
HIGH       ≥ configured high threshold
MEDIUM     đủ dùng nhưng nên kiểm tra khi ảnh hưởng score
LOW        không chấm hoặc chuyển HLV duyệt
```

Threshold phải cấu hình và version hóa; không hard-code trong UI.

### 11.3 Tương thích ngược

Trong giai đoạn chuyển đổi, JSON có thể giữ `punches` và `kicks`, đồng thời sinh thêm `actions`. Frontend mới đọc `actions`; frontend cũ vẫn hoạt động đến khi migration hoàn tất.

---

## 12. Kiến trúc phần mềm đề xuất

### 12.1 Python worker

```text
pipeline/
  video_quality.py
  pose_extractor.py
  pose_smoother.py
  coordinate_normalizer.py
  action_pipeline.py

detection/
  upper_body_candidate_detector.py
  lower_body_candidate_detector.py
  action_segmenter.py

classification/
  stance_estimator.py
  punch_classifier.py
  kick_classifier.py
  confidence_calibrator.py

features/
  joint_angles.py
  trajectories.py
  body_rotation.py
  guard.py
  balance.py
  kinetic_chain.py

assessment/
  rubric_engine.py
  feedback_generator.py
  session_summary.py

rubrics/
  boxing/
  muay_thai/
  karate/
  taekwondo/
```

`process_video.py` là orchestrator. Analyzer hiện tại được giữ làm candidate detector trong giai đoạn migration.

### 12.2 Backend

Backend chịu trách nhiệm:

- Validation metadata.
- Training session và assignment.
- Analysis jobs.
- Action/review persistence.
- Athlete baseline.
- Quyền truy cập.
- Audit trail.
- Model/rubric version registry.

### 12.3 Frontend

Frontend cần hai mode:

**Athlete mode**

- Kết quả ngắn gọn.
- Điểm mạnh và tối đa ba lỗi.
- Video evidence.
- Drill tiếp theo.
- So sánh với baseline/buổi trước.

**Coach mode**

- Timeline toàn bộ action.
- Góc, quỹ đạo, phase và confidence.
- Sửa nhãn/timing.
- Duyệt hoặc bác finding.
- Chọn reference.

---

## 13. Mô hình dữ liệu đề xuất

### 13.1 Bảng chính

```text
athletes
athlete_disciplines
training_sessions
training_assignments
analysis_jobs
detected_actions
action_phases
action_metrics
criterion_results
technique_findings
coach_reviews
athlete_baselines
progress_snapshots
model_versions
rubric_versions
```

### 13.2 Trạng thái review

```text
AI_GENERATED
NEEDS_REVIEW
COACH_APPROVED
COACH_CORRECTED
COACH_REJECTED
INSUFFICIENT_EVIDENCE
```

Kết quả lịch sử không được âm thầm thay đổi khi model hoặc rubric đổi version. Re-analysis phải tạo revision mới.

---

## 14. Giao diện tối thiểu

### 14.1 Trang tạo phiên phân tích

- Chọn võ sĩ.
- Môn võ.
- Kỹ thuật/bài tập.
- Stance.
- Camera view.
- Target type.
- Training mode.
- Upload video.

### 14.2 Video player

- Skeleton overlay.
- Highlight attacking limb.
- Action phase.
- Wrist/ankle/knee trajectory.
- Impact marker.
- Pose quality warning.
- Jump to evidence.

### 14.3 Action timeline

```text
00:04.13  Jab        84  High confidence
00:04.62  Cross      71  Late hip rotation
00:05.08  Lead hook  63  Needs coach review
00:05.71  Unknown     —  Insufficient evidence
```

### 14.4 Session summary

- Tổng action và số action phân tích được.
- Distribution theo kỹ thuật.
- Điểm mạnh chính.
- Tối đa ba lỗi ưu tiên.
- Drill đề xuất.
- So sánh với baseline tương thích.

---

## 15. Dữ liệu huấn luyện và annotation

### 15.1 Schema nhãn

```text
video_id
fighter_id
martial_art
stance
technique
attacking_side
limb_role
start_frame
chamber_frame
peak_frame
impact_frame
end_frame
impact_type
target_level
camera_view
target_type
occlusion
label_confidence
annotator_id
review_status
```

### 15.2 Quy tắc chất lượng

- Tách train/validation/test theo võ sĩ.
- Không đưa các clip trích từ cùng video gốc vào nhiều split.
- Negative class phải có parry, block, feint, clinch, guard adjustment và grapple.
- Một phần dữ liệu phải được hai annotator gắn nhãn độc lập.
- Bất đồng quan trọng do HLV phân xử.
- Chỉ dùng nhãn `COACH_APPROVED` hoặc đồng thuận kép để làm gold set.

### 15.3 Mức dữ liệu mục tiêu

Trước supervised classifier tổng quát, mục tiêu ban đầu:

- 20–30 võ sĩ.
- Cả orthodox và southpaw.
- Nhiều trình độ và hình thể.
- 200–500 action đã xác thực cho mỗi lớp chính.
- Nhiều camera view và điều kiện tập.
- Có cả kỹ thuật tốt, lỗi phổ biến và non-strike.

---

## 16. Đánh giá hệ thống

### 16.1 Detection

- Precision, recall, F1 của action occurrence.
- Temporal error của start/impact/end.
- False positive theo nhóm: parry, clinch, feint, grapple.

### 16.2 Classification

- Accuracy và macro-F1.
- Per-class precision/recall.
- Confusion matrix.
- Kết quả riêng theo stance, camera view và võ sĩ chưa từng xuất hiện.

### 16.3 Assessment

- Mức đồng thuận AI–HLV theo criterion.
- Sai số metric so với annotation/reference.
- Tỷ lệ `INSUFFICIENT_EVIDENCE` hợp lý.
- Độ ổn định của score khi phân tích lại cùng video.

### 16.4 Product outcome

- Thời gian HLV tiết kiệm.
- Tỷ lệ finding được HLV chấp nhận.
- Tỷ lệ bài tập được hoàn thành.
- Lỗi mục tiêu có giảm sau 2–4 tuần không.
- Người dùng có hiểu và thực hiện được recommendation không.

---

## 17. Yêu cầu chức năng

| ID | Yêu cầu |
|---|---|
| FR-SESSION-001 | HLV tạo và giao bài tập cho võ sĩ/nhóm. |
| FR-SESSION-002 | Võ sĩ tạo phiên tập tự do không cần assignment. |
| FR-VIDEO-001 | Hệ thống kiểm tra chất lượng video trước phân tích. |
| FR-POSE-001 | Hệ thống theo dõi đúng target athlete xuyên video. |
| FR-ACTION-001 | Hệ thống phát hiện action window và các pha. |
| FR-ACTION-002 | Hệ thống phân loại technique, side và lead/rear. |
| FR-ACTION-003 | Hệ thống hỗ trợ `unknown` và confidence riêng. |
| FR-RUBRIC-001 | Assessment dùng rubric đúng môn võ và version. |
| FR-RUBRIC-002 | Tiêu chí thiếu evidence không tham gia điểm. |
| FR-REVIEW-001 | HLV sửa label, side và phase timing. |
| FR-REVIEW-002 | Mọi sửa đổi có audit trail. |
| FR-FEEDBACK-001 | Mỗi finding có evidence frame và recommendation. |
| FR-FEEDBACK-002 | Session chỉ ưu tiên tối đa ba lỗi cho võ sĩ. |
| FR-BASELINE-001 | Hệ thống tạo baseline khi đủ mẫu hợp lệ. |
| FR-PROGRESS-001 | Chỉ so sánh các phiên có điều kiện tương thích. |
| FR-VERSION-001 | Mỗi kết quả lưu model và rubric version. |

---

## 18. Yêu cầu phi chức năng

- Kết quả phải truy vết được đến video, frame, model và rubric.
- Không mất kết quả cũ khi triển khai model mới.
- API validation không cho phép enum tự do ngoài taxonomy.
- Worker failure phải retry an toàn và không tạo action trùng.
- Dữ liệu cá nhân và video phải được phân quyền.
- Log kỹ thuật không ghi URL/token nhạy cảm không cần thiết.
- UI phải phân biệt rõ AI-generated và coach-reviewed.
- Các phép đo 2D phải kèm disclaimer khi dùng cho chuyên gia.

---

## 19. Roadmap triển khai

### Sprint A — Foundation

- Mở rộng analysis job metadata.
- Tạo `ActionResult` chung.
- Tách detection/classification/assessment.
- Stance và lead/rear.
- Tương thích ngược với `punches`/`kicks`.

### Sprint B — Coaching MVP

- Rubric theo môn võ.
- Trajectory, guard, balance và recovery metrics.
- Session aggregation.
- Thư viện error code → coach-approved drill.
- Athlete mode và Coach mode.

### Sprint C — Review và annotation

- Sửa label/phase trên timeline.
- Review status và audit trail.
- Dataset export.
- Hàng chờ action confidence thấp.

### Sprint D — Technique expansion

- Hook và uppercut hoàn chỉnh.
- Front/round/side kick.
- Knee detector riêng.
- Combo và action overlap.

### Sprint E — Machine learning

- Huấn luyện temporal classifier khi đủ gold data.
- Split theo võ sĩ.
- Confidence calibration.
- So sánh với rule-based baseline.
- Versioning, canary và rollback.

### Sprint F — Personalization

- Baseline cá nhân.
- Theo dõi xu hướng nhiều buổi.
- Fatigue drift.
- Lỗi tái diễn và mục tiêu tuần.

---

## 20. Definition of Done cho vertical slice đầu tiên

Vertical slice: `Jab–Cross Coaching`.

Hoàn thành khi:

1. HLV tạo bài jab–cross và giao cho võ sĩ.
2. Võ sĩ upload video cùng metadata.
3. Hệ thống khóa đúng target athlete.
4. Hệ thống ước lượng stance và lead/rear.
5. Hệ thống phát hiện jab/cross với start, impact và end.
6. Mỗi action có detection/classification/assessment confidence.
7. Rubric đánh giá quỹ đạo, guard, xoay thân, balance và recovery.
8. Finding nhảy được tới evidence frame.
9. HLV sửa được label và timing.
10. Kết quả duyệt được lưu cùng audit trail.
11. Session summary chọn tối đa ba lỗi ưu tiên.
12. Có test tự động cho API contract, state transition và backward compatibility.
13. Có benchmark riêng theo stance và unseen athlete.

---

## 21. Rủi ro và biện pháp kiểm soát

| Rủi ro | Hậu quả | Kiểm soát |
|---|---|---|
| Occlusion/motion blur | Sai khớp và sai phase | Evidence gating, temporal smoothing, quality warning |
| Camera theo chiều sâu | Quỹ đạo 2D bị co ngắn | Camera profile, hạ confidence, 3D lifting sau MVP |
| Nhầm người trong sparring | Kết quả gán sai võ sĩ | Persistent tracking, target selection, identity confidence |
| Ngưỡng quá cứng | Bỏ sót biến thể kỹ thuật | Rubric theo môn, baseline cá nhân, model temporal |
| Thiếu hook/uppercut | Classifier thiên lệch đòn thẳng | Thu gold data trước khi huấn luyện |
| Học thuộc võ sĩ | Test cao nhưng triển khai kém | Split dataset theo athlete/source video |
| AI phản hồi quá nhiều | Võ sĩ không hành động | Chỉ ưu tiên tối đa ba lỗi |
| Kết luận quá mức | Rủi ro chuyên môn/y khoa | Claim policy và disclaimer bắt buộc |

---

## 22. Các quyết định đã thống nhất

1. Giữ pipeline hiện tại và refactor theo từng bước, không viết lại toàn bộ.
2. `process_video.py` trở thành orchestrator.
3. Punch/kick analyzer hiện tại chuyển dần thành candidate detector.
4. `actions` là output chuẩn mới; `punches` và `kicks` được giữ tạm để tương thích.
5. Stance estimation đứng trước jab/cross classification.
6. Knee strike có detector riêng.
7. Rubric phải phụ thuộc môn võ và version.
8. HLV review là nguồn gold label quan trọng nhất.
9. Không huấn luyện classifier tổng quát cho lớp chưa đủ dữ liệu.
10. Giá trị sản phẩm được đo bằng tiến bộ của võ sĩ và thời gian HLV tiết kiệm, không chỉ bằng accuracy.

---

## 23. Câu hỏi cần Product/HLV chốt

- Môn võ ưu tiên đầu tiên là Boxing hay Muay Thai?
- Bộ kỹ thuật chính xác của MVP gồm những lớp nào?
- Ai có quyền tạo và phát hành rubric?
- Bao nhiêu mẫu hợp lệ để tạo baseline cá nhân?
- Threshold confidence nào bắt buộc HLV duyệt?
- Video và dữ liệu pose được giữ trong bao lâu?
- Võ sĩ có được tải/xóa dữ liệu của mình không?
- Thế nào là một buổi tập “đạt” ngoài việc hoàn thành số lần lặp?
- Thư viện drill ban đầu do HLV nào phê duyệt?

---

## 24. Hướng dẫn cho AI agent và thành viên mới

Trước khi thay đổi logic phân tích:

1. Đọc tài liệu này và Master Specification hiện hành.
2. Xác định thay đổi thuộc detection, classification hay assessment.
3. Không điều chỉnh threshold chỉ để cải thiện một clip.
4. Kiểm tra ảnh hưởng tới negative class và các môn võ khác.
5. Không thay đổi schema output mà không cập nhật type, API và migration.
6. Luôn lưu evidence và confidence cho finding mới.
7. Thêm ground truth/test trước hoặc cùng lúc với logic mới.
8. Báo cáo metric trên unseen athlete và source-video split khi có ML.
9. Ghi rõ model/rubric version trong kết quả.
10. Nếu dữ liệu không đủ, trả về `unknown` hoặc `INSUFFICIENT_EVIDENCE`.

---

## 25. Tài liệu liên quan trong repository

- `docs/MMA-TMS-MASTER-SPECIFICATION-v2.md`
- `python-worker/SPRINT2_TRACKING_POSTURE_REPORT.md`
- `python-worker/SPRINT3_SCOPE_AND_MOTION_FORENSICS_REPORT.md`
- `python-worker/PUNCH_DETECTOR_VALIDATION_REPORT.md`
- `python-worker/STRIKE_BENCHMARK_REPORT.md`
- `python-worker/technique_rubric.py`
- `python-worker/punch_analyzer.py`
- `python-worker/kick_analyzer.py`

