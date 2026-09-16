# MASTER PROMPT — TASK 4: ANALYSIS CONTEXT & DISCIPLINE-AWARE RUBRIC REGISTRY

Bạn là Senior AI/Computer Vision Backend Engineer chịu trách nhiệm triển khai trọn vẹn Task 4 trong repository MMA-TMS.

Bạn phải hoàn thành toàn bộ flow trong một lượt:

```text
Khảo sát → thiết kế → triển khai → tự review → chạy test
→ tự sửa → regression verification → final walkthrough
```

Không dừng lại để xin duyệt plan từng bước. Chỉ hỏi Technical Lead nếu cần thay đổi public contract, thay đổi rubric/threshold đã được đóng băng, regenerate golden baseline, hoặc có blocker thực sự không thể giải quyết từ repository.

---

## 1. Thông tin task

- **Task ID:** Task 4
- **Task name:** Analysis Context & Discipline-Aware Rubric Registry

### Task requirements

Thiết kế và triển khai nền tảng lựa chọn rubric theo đúng ngữ cảnh phân tích, để cùng một technique có thể sử dụng rubric khác nhau theo môn võ và version mà không làm thay đổi hành vi legacy hiện tại.

Task 4 phải cung cấp:

1. Một internal `AnalysisContext` bất biến, có validation rõ ràng cho các metadata cần thiết khi lựa chọn rubric.
2. Một rubric registry có khóa lựa chọn tối thiểu:

   ```text
   martial_art + technique + version
   ```

3. Validation cho rubric definition và registry.
4. Kết quả lựa chọn rubric có cấu trúc, deterministic và có lý do rõ ràng khi không tìm thấy rubric.
5. Cơ chế tương thích ngược cho các rubric legacy hiện tại.
6. Boundary rõ ràng để Task sau có thể triển khai rubric chuyên biệt theo từng môn võ mà không sửa detector FSM.

Task 4 là **foundation task**. Không được tự tạo threshold chuyên môn mới hoặc tuyên bố các rubric hiện tại là rubric chuẩn Muay Thai, Karate, Taekwondo hay Boxing nếu chưa có định nghĩa được HLV phê duyệt.

---

## 2. Nguồn chân lý

Đọc đầy đủ trước khi sửa code:

1. Prompt này.
2. `docs/MARTIAL-ARTS-AI-COACHING-SPEC-v1.md`, đặc biệt:
   - §2.5 Rubric phụ thuộc môn võ.
   - §8 Đặc trưng kỹ thuật.
   - §9 Rubric và scoring.
   - §10 Hợp đồng đầu vào phân tích.
   - §17 Yêu cầu chức năng.
   - §19 Sprint B — Coaching MVP.
3. `docs/MMA-TMS-MASTER-SPECIFICATION-v3.md`.
4. `python-worker/technique_rubric.py`.
5. `python-worker/action_result.py`.
6. `python-worker/process_video.py`.
7. `python-worker/pipeline/`.
8. Toàn bộ tests và golden fixtures liên quan.
9. TypeScript schema tại `nextjs-frontend/src/lib/api/worker-result.ts`.

Nếu có mâu thuẫn, áp dụng thứ tự ưu tiên:

1. Yêu cầu mới nhất của Technical Lead.
2. Specification.
3. Public contract hiện tại.
4. Golden baseline và hành vi legacy.

Không giả định walkthrough cũ phản ánh đúng code. Phải kiểm tra code thực tế.

---

## 3. Baseline đã hoàn thành và phải được bảo vệ

### Task 1 — Unified ActionResult

- `schemaVersion = "1.0.0"`.
- Punch và kick dùng `ActionResult` thống nhất.
- Ba chiều confidence độc lập: detection, classification, assessment.
- Không tạo metric hoặc phase khi thiếu evidence.
- Legacy arrays vẫn được giữ.

### Task 2 — Pipeline Separation

- Pipeline đã tách contracts, feature extraction và action orchestration.
- Golden fixtures và strike benchmark là regression baseline.

### Task 3 — Stance Context & Classification Boundary

- Precedence: coach → user → athlete profile → visual estimate → unknown.
- `StanceContext` có cross-field invariants.
- Chỉ orthodox/southpaw tạo lead/rear.
- Kick legacy luôn là `round_kick`.
- Southpaw + right-hand legacy cross vẫn là `cross + lead + classification confidence null`.
- Classification result là nguồn duy nhất cho các trường technique của `ActionResult`.

---

## 4. Phạm vi nghiệp vụ Task 4

### 4.1 AnalysisContext nội bộ

Khảo sát code hiện tại rồi thiết kế một internal contract, dự kiến đặt tại:

```text
python-worker/pipeline/analysis_context.py
```

Contract cần hỗ trợ tối thiểu:

- `martial_art`
- `training_mode`
- `expected_techniques`
- `camera_view`
- `target_type`
- `skill_level`
- `requested_rubric_version`

Yêu cầu:

- Immutable.
- Enum hoặc canonical string values được kiểm soát.
- Trim/lowercase tại ingestion boundary.
- Phân biệt omitted, unknown và invalid.
- Invalid input không được âm thầm biến thành một môn võ khác.
- Không dùng metadata này để thay đổi detector trong Task 4.
- Nếu repository chưa có taxonomy đầy đủ, chỉ khai báo tập tối thiểu có căn cứ từ specification và giữ `unknown` an toàn.
- Không mở rộng public output chỉ để chứa `AnalysisContext`.

Nếu tên hoặc cấu trúc khác phù hợp hơn sau khi khảo sát, có thể điều chỉnh nhưng phải giữ đầy đủ semantics trên và giải thích trong walkthrough.

### 4.2 Rubric identity

Mỗi rubric phải có identity rõ ràng:

- `id`
- `martial_art`
- `technique`
- `version`
- `status`
- `source_type`
- `criteria`

`TechniqueRubric` hiện có `technique_type`. Phải lựa chọn migration tương thích ngược:

- Không làm hỏng import hoặc call site hiện tại.
- Không để hai field `technique` và `technique_type` có thể mâu thuẫn.
- Nếu giữ alias compatibility, phải có một canonical field duy nhất và tests chứng minh alias không tạo hai nguồn chân lý.

Các rubric hiện tại chưa được gắn với một môn võ đã được HLV xác nhận. Hãy đăng ký chúng dưới namespace legacy/generic nội bộ phù hợp, không gắn giả thành Boxing hoặc Muay Thai.

Không đổi các ID/version hiện tại nếu việc đó làm golden output thay đổi.

### 4.3 Rubric registry

Tạo registry độc lập, dự kiến:

```text
python-worker/pipeline/rubric_registry.py
```

Registry phải:

- Đăng ký rubric theo canonical key `(martial_art, technique, version)`.
- Từ chối duplicate key.
- Từ chối duplicate rubric ID có definition khác.
- Lookup deterministic.
- Không phụ thuộc runtime vào PunchAnalyzer hoặc KickAnalyzer.
- Không mutate rubric definitions đã đăng ký.
- Có API liệt kê versions khả dụng theo martial art và technique.
- Có structured selection result thay vì chỉ trả `None` không lý do.

Selection result cần phân biệt tối thiểu:

- `selected`
- `not_registered`
- `unsupported_martial_art`
- `unsupported_technique`
- `version_not_found`
- `invalid_context`

Tên enum có thể điều chỉnh, nhưng semantics phải tương đương và được test.

### 4.4 Selection rules

Quy tắc lựa chọn:

1. Khi caller cung cấp đầy đủ martial art, technique và version:
   - Chỉ exact-match.
   - Không fallback sang môn võ khác.

2. Khi version omitted:
   - Không dùng so sánh chuỗi tùy tiện.
   - Nếu cho phép chọn default/latest, phải có quy tắc version deterministic, được document và test.
   - Không được hiểu rằng `10.0.0 < 2.0.0` vì lexical sorting.

3. Khi explicit martial art chưa có rubric:
   - Trả structured failure.
   - Không âm thầm dùng legacy/generic rubric rồi trình bày như rubric của môn đó.

4. Khi toàn bộ AnalysisContext omitted theo call style legacy:
   - Giữ nguyên rubric ID, rubric version, criteria, findings, score và grade hiện tại.
   - Đây là compatibility path, không phải discipline-aware assessment.

5. Rubric chỉ được chọn sau khi technique canonical đã tồn tại.

6. Stance không được dùng để chọn rubric trong Task 4, trừ khi specification có quy tắc rõ ràng và không phá baseline.

### 4.5 Rubric validation

Validation tối thiểu:

- ID, martial art, technique và version không rỗng.
- Criterion ID duy nhất trong một rubric.
- Criterion weight là số hữu hạn, không nhận bool, và lớn hơn 0.
- Tổng weight hợp lệ theo scoring method hiện tại.
- `required_confidence` hữu hạn trong `[0,1]`, không nhận bool.
- Không nhận NaN hoặc Infinity.
- Status/source/scoring method thuộc tập cho phép.
- Không có mutable alias khiến caller sửa được rubric đã đăng ký.

Phải kiểm tra cả field-level và cross-field invariants.

### 4.6 Integration boundary

Tích hợp ở mức nhỏ nhất cần thiết để chứng minh flow:

```text
AnalysisContext
→ canonical technique
→ rubric registry selection
→ assessment boundary / ActionResult metadata
```

Nhưng phải tuân thủ:

- Không re-score legacy analyzer result bằng rubric khác trong Task 4.
- Không đổi `assessment.rubricId` hoặc `rubricVersion` nếu criteria thực tế vẫn được sinh bởi rubric legacy.
- Không gắn metadata của rubric A lên score/criteria được tạo bởi rubric B.
- Nếu explicit discipline rubric chưa có evaluator tương ứng, trả selection failure nội bộ; không tạo assessment giả.
- Không thay đổi public JSON schema v1.0.0 trong Task 4.

Nếu việc tích hợp runtime hoàn chỉnh đòi hỏi tách scoring khỏi analyzer, hãy chỉ tạo boundary và contract cần thiết trong Task 4, ghi rõ phần migration còn lại cho Task tiếp theo. Không thực hiện refactor lớn ngoài scope.

---

## 5. Frozen constraints

Không được:

- Thay đổi PunchAnalyzer/KickAnalyzer FSM.
- Thay đổi angle, speed, duration hoặc confidence thresholds.
- Thay đổi scoring formula hiện tại.
- Tạo rubric chuyên môn mới chưa có expert-approved definition.
- Thay đổi score, grade, criteria hoặc findings legacy.
- Đổi nhãn jab/cross/round_kick hiện tại.
- Đổi `ActionResult schemaVersion`.
- Xóa hoặc đổi cấu trúc `punches`, `kicks`, `findings`, `frames`, `meta`, `summary`.
- Gán confidence chưa được calibrate.
- Sửa golden fixture để che regression.
- Tạo circular import.
- Commit, push hoặc reset Git nếu chưa được yêu cầu.

---

## 6. Delivery flow bắt buộc

### Bước 1 — Khảo sát

- Kiểm tra working tree và bảo vệ thay đổi hiện có.
- Tìm tất cả call sites của `TechniqueRubric`, rubric constants và scoring functions.
- Xác định nơi rubric ID/version được đưa vào `ActionResult`.
- Xác định dependency graph trước/sau.
- Đọc tests và golden fixtures trước khi sửa.

### Bước 2 — Thiết kế nội bộ

Tự lập checklist cho:

- Input/output contracts.
- Rubric key và version semantics.
- Registry ownership.
- Immutability.
- Duplicate handling.
- Exact-match/fallback behavior.
- Legacy compatibility.
- Unsupported context behavior.
- Import direction.
- Test matrix.

Không cần gửi plan riêng. Tiếp tục triển khai.

### Bước 3 — Triển khai

- Thực hiện patch nhỏ nhất đủ cho Task 4.
- Mỗi nghiệp vụ chỉ có một nguồn chân lý.
- Validation đặt tại construction/registration boundary.
- Không che lỗi contract bằng fallback âm thầm.
- Không mutate legacy objects.
- Output và registry ordering phải deterministic.

### Bước 4 — Self-review

Trước khi báo hoàn thành, tự kiểm tra:

1. Có thể đăng ký hai rubric trùng key không?
2. Có thể dùng cùng ID cho hai definition khác nhau không?
3. Caller có thể sửa rubric sau khi đăng ký không?
4. Version sorting có đúng semantic version không?
5. Explicit Muay Thai có thể vô tình nhận generic/Karate rubric không?
6. Rubric metadata có khớp với criteria thực sự sinh score không?
7. Omitted context có làm thay đổi golden output không?
8. Invalid context có thể đi tới public JSON không?
9. Có hai nguồn chân lý giữa `technique` và `technique_type` không?
10. Có internal registry metadata nào lọt ra schema v1.0.0 không?

Nếu phát hiện lỗi, tự sửa rồi mới chạy acceptance tests cuối.

---

## 7. Test matrix bắt buộc

Thêm tests cho tối thiểu:

### AnalysisContext

- Giá trị hợp lệ và normalization.
- Omitted/unknown/invalid.
- Enum sai.
- Empty/whitespace.
- Immutability.
- Cross-field invariants nếu có.

### Rubric definition

- Canonical identity.
- Duplicate criterion IDs.
- Empty ID/technique/martial art/version.
- Weight <= 0.
- Bool/NaN/Infinity.
- Invalid required confidence.
- Invalid status/source/scoring method.
- Immutability hoặc defensive copy.

### Registry

- Exact lookup.
- Duplicate key.
- Duplicate ID conflict.
- Unsupported martial art.
- Unsupported technique.
- Missing version.
- Deterministic default/latest version nếu được hỗ trợ.
- Semantic version ordering, gồm ít nhất `2.0.0` và `10.0.0`.
- Không cross-discipline fallback.
- Registered rubric không bị mutation từ bên ngoài.

### Compatibility

- Existing rubric constants/imports vẫn hoạt động.
- Existing analyzer results không đổi.
- `ActionResult` rubric ID/version không đổi trên legacy path.
- Public JSON không có field mới ngoài schema v1.0.0.
- Golden deep equality.
- Strike benchmark.
- Không circular import.

---

## 8. Verification bắt buộc

Chạy:

```text
Test riêng Task 4
Toàn bộ Python unittest discovery
Strike benchmark
Golden checksum/deep equality
git diff --check
```

Nếu TypeScript hoặc public output bị ảnh hưởng, chạy thêm frontend schema validation/build.

Không cần smoke video thật nếu Task 4 chỉ thêm internal context/registry và golden runtime path hoàn toàn không đổi. Nếu thay đổi runtime selection hoặc ActionResult metadata, phải chạy smoke video và so sánh trước/sau.

Nếu test thất bại:

1. Tìm root cause.
2. Sửa đúng code hoặc test.
3. Chạy lại test liên quan.
4. Chạy lại toàn bộ regression suite.
5. Chỉ kết thúc khi đạt Definition of Done.

Không xóa test hoặc nới assertion chỉ để test xanh.

---

## 9. Definition of Done

Task 4 chỉ hoàn thành khi:

- `AnalysisContext` có contract và validation rõ ràng.
- Rubric identity có `martial_art + technique + version`.
- Registry exact-match deterministic.
- Unsupported context không cross-discipline fallback.
- Version behavior được document và test.
- Rubric definitions/registry không bị mutation ngoài ý muốn.
- Legacy rubric path giữ nguyên output.
- Không có rubric chuyên môn hoặc threshold bị bịa mới.
- Không thay đổi detector, scoring formula hoặc public schema.
- Toàn bộ tests, benchmark và golden equality đạt.
- Không còn finding P1/P2 trong self-review.

---

## 10. Final walkthrough

Chỉ gửi walkthrough sau khi hoàn tất toàn bộ flow. Walkthrough phải gồm:

1. Kết quả Task 4.
2. Danh sách file NEW/MODIFIED.
3. Dependency graph trước/sau.
4. `AnalysisContext` contract và invariants.
5. Rubric identity, registry key và selection rules.
6. Legacy compatibility strategy.
7. Unsupported/invalid behavior.
8. Frozen constraints đã giữ.
9. Test suites đã chạy và số passed/failed thực tế.
10. Golden equality, benchmark và `git diff --check`.
11. Self-review findings đã phát hiện và sửa.
12. Technical debt còn lại.
13. Những quyết định cần Technical Lead phê duyệt; ghi “Không còn” nếu thực sự không còn.

Không dùng “100%”, “perfectly” hoặc “zero regression” nếu chưa có bằng chứng. Không mô tả code dự kiến như code đã triển khai.

Bây giờ hãy đọc repository và thực hiện toàn bộ Task 4 theo delivery flow này. Chỉ trả lại final walkthrough sau khi đã tự review, tự sửa và vượt qua toàn bộ acceptance criteria.
