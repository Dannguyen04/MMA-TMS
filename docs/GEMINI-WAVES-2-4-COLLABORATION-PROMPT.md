# GEMINI MULTI-AGENT COLLABORATION PROMPT — WAVES 2–4

Sử dụng prompt này sau khi Wave 1 hoàn thành và chỉ khi Technical Lead đã phê duyệt Integration Gate 2.

## 0. ENTRY GATE

Nếu chưa có câu xác nhận rõ ràng `INTEGRATION GATE 2 APPROVED`, dừng và chỉ trả về:

`BLOCKED: Waiting for Technical Lead approval of Integration Gate 2.`

Không tự xem test pass là phê duyệt.

## 1. MỤC TIÊU ĐIỀU PHỐI

Hoàn thành Waves 2–4 nhanh nhất có thể bằng nhiều agent thực sự chạy song song, giao tiếp trực tiếp và review chéo, đồng thời giữ:

- một owner duy nhất cho mỗi file trong từng wave;
- canonical Contract Pack đã được phê duyệt;
- backward compatibility;
- deterministic output;
- không sửa FSM, detector threshold hoặc rubric threshold hiện hành;
- không merge khi dependency contract chưa được xác nhận.

Nhiều agent được khuyến khích trao đổi tối đa về interface, fixture, finding và dependency. Việc giao tiếp nhiều không đồng nghĩa với nhiều agent cùng sửa một file.

## 2. AGENT TOPOLOGY

Giữ tối thiểu các agent sau:

- Agent A — Task 5 Assessment Engine owner.
- Agent B — Task 6 Temporal Phase owner.
- Agent C — Task 7 Kinematic Feature owner.
- Agent D — Task 8 Shadow Classifier owner.
- Agent E — Independent QA/adversarial reviewer.
- Orchestrator — shared integration owner và quyết định contract cuối.

Nếu còn concurrency slot, tạo thêm:

- Agent F — Integration test/performance specialist; chỉ viết test/benchmark, không sửa implementation của A–D.

Mọi báo cáo phải dùng agent ID thực tế, không chỉ dùng tên vai trò.

## 3. COMMUNICATION PROTOCOL BẮT BUỘC

### 3.1 Dependency channels

Các agent phải chủ động gửi message trực tiếp theo graph:

- B → C: phase types, boundary semantics, missing-phase behavior, fixtures.
- B → A: assessment phase adapter và completeness semantics.
- C → D: metric IDs, units, nullability, evidence level/quality, feature version.
- C → A: assessment-eligible metrics và evidence provenance.
- A → Orchestrator: evaluator/rubric provenance và public adapter requirements.
- D → Orchestrator: complete shadow JSON contract và abstention behavior.
- E → A/B/C/D: findings trực tiếp đến đúng owner; đồng thời CC Orchestrator.
- F → Orchestrator và owner liên quan: integration/performance failures.

### 3.2 Message format

Mọi inter-agent message liên quan contract phải theo mẫu:

```text
[CONTRACT|FIXTURE|FINDING|HANDOFF|BLOCKER]
From: <agent-id>
To: <agent-id>
Component: <component>
Interface/version: <name/version>
Facts: <observed facts>
Requested action: <specific action>
Files affected: <paths or NONE>
Tests proving completion: <test names>
```

### 3.3 Response SLA

- Agent nhận contract question phải trả lời trước khi thay đổi interface phụ thuộc.
- Blocker phải được gửi ngay, không chờ agent hoàn thành toàn bộ task.
- Agent owner phải acknowledge finding P0/P1 trước khi sửa.
- Nếu hai agent bất đồng contract, cả hai dừng phần phụ thuộc và gửi options/trade-offs cho Orchestrator quyết định.

### 3.4 No silent assumptions

Không agent nào được tự đoán:

- tên metric;
- unit;
- nullability;
- enum value;
- evidence semantics;
- threshold/config version;
- JSON field;
- phase ordering.

Khi dependency chưa rõ, hỏi owner trực tiếp và ghi lại quyết định.

## 4. SHARED COLLABORATION ARTIFACTS

Orchestrator duy trì một in-memory/shared report với bốn bảng; không để nhiều agent đồng thời sửa một documentation file chung:

1. Interface Ledger: producer, consumer, version, fields, status.
2. Fixture Ledger: fixture ID, owner, consumers, expected result.
3. Finding Ledger: severity, reporter, owner, status, regression test.
4. Integration Ledger: module, commit/diff state, tests, readiness.

Sau mỗi dependency handoff, Orchestrator cập nhật ledger và gửi phần thay đổi cho tất cả consumer liên quan.

## 5. WAVE 2 — PARALLEL IMPLEMENTATION

### Agent C — Task 7

Triển khai `pipeline/kinematic_features.py` và test thuộc ownership dựa trên Task 6 đã được Gate 2 duyệt.

Trước khi code:

- nhận phase fixture chính thức từ Agent B;
- gửi danh sách metric ID/unit/nullability dự kiến cho Agents A và D;
- chờ acknowledgement về interface, không chờ review implementation.

Trong khi code:

- gửi fixture sớm cho Agent D ngay khi từng nhóm metric ổn định;
- gửi metric/evidence mappings cho Agent A;
- không thay đổi Task 6 contract.

### Agent D — Task 8

Triển khai `pipeline/shadow_classifier.py` và test thuộc ownership.

Có thể làm song song với Agent C bằng synthetic fixtures đã khóa. Khi code Task 7 sẵn sàng:

- chạy lại test trên DTO thực tế;
- xác nhận mọi config field được sử dụng;
- giữ confidence `None`;
- serialize mọi executed decision, kể cả abstained/rejected;
- kiểm tra evidenceLevel `unavailable` cho missing evidence và `derived_proxy` khi có derived evidence.

### Agents A và B — Reviewer/Support trong Wave 2

- Agent B review cách C sử dụng phase boundaries, FPS và time/frame correspondence.
- Agent A review evidence/provenance semantics của C và D.
- A/B không sửa file của C/D; gửi findings và đề xuất test trực tiếp.

### Agent E — Continuous adversarial QA

Không chờ cuối wave. Khi C/D công bố interface hoặc fixture:

- viết adversarial tests song song;
- fuzz missing/NaN/Infinity/boundary/nullability cases;
- gửi P0/P1 ngay cho owner;
- không tự sửa implementation.

### Agent F — Integration test preparation

- chuẩn bị cross-module fixtures và benchmark harness;
- kiểm tra import graph, deterministic serialization và performance;
- không sửa shared integration files.

## 6. MINI SYNC POINTS

Orchestrator tổ chức ba sync point ngắn trong Wave 2:

### Sync 2A — Interface acknowledgement

Điều kiện:

- B → C phase handoff hoàn tất;
- C → A/D metric contract acknowledged;
- D classifier input contract locked.

### Sync 2B — First executable slice

Điều kiện:

- ít nhất một punch và một kick fixture chạy qua Task 6 → Task 7;
- ít nhất một classified và một abstained punch chạy qua Task 7 → Task 8;
- A xác nhận provenance không bị false-stamp.

### Sync 2C — Wave 2 candidate

Điều kiện:

- targeted tests pass;
- Agent E không còn P0/P1 mở;
- Agent F có integration fixtures sẵn sàng;
- owners xác nhận file list và interface version.

Không cần chờ mọi agent idle mới sync; dùng messages/handoffs ngay khi artifact sẵn sàng.

## 7. PAIR REVIEW MATRIX

Trước Integration Gate 3, bắt buộc review chéo:

- B reviews C: phases, time/frame, containment, missing evidence.
- C reviews D: metric usage, threshold inputs, feature provenance.
- A reviews C và D: evidence semantics, assessment compatibility, false provenance.
- D reviews C: classifier-consumed feature stability và units.
- E reviews tất cả bằng adversarial tests.
- F reviews cross-module imports, JSON safety, determinism và runtime overhead.

Reviewer không được approve chỉ dựa trên walkthrough; phải đọc diff và chạy test liên quan.

## 8. INTEGRATION GATE 3

Orchestrator chỉ mở Wave 3 khi:

- Task 7 và Task 8 targeted tests pass;
- pair reviews hoàn tất;
- P0/P1 bằng 0;
- contract drift bằng 0;
- import-order tests pass;
- deterministic fixture equality pass;
- không agent nào sửa file ngoài ownership.

Tại Gate 3, báo cáo:

- Agent roster và messages/handoffs quan trọng.
- Interface/Fixture/Finding ledgers.
- File changes theo owner.
- Commands và test counts thực tế.
- Open P2/P3.

Sau đó dừng chờ Technical Lead xác nhận `INTEGRATION GATE 3 APPROVED`.

## 9. WAVE 3 — CENTRAL INTEGRATION

Chỉ Orchestrator được sửa:

- `python-worker/action_result.py`
- `python-worker/process_video.py`
- `python-worker/pipeline/__init__.py`
- `nextjs-frontend/src/lib/api/worker-result.ts`

Trong lúc Orchestrator tích hợp, Agents A–F tiếp tục làm việc song song:

- A: kiểm tra assessment equivalence và provenance.
- B: kiểm tra phase mapping sang ActionPhases.
- C: kiểm tra metric mapping/unit/null handling.
- D: kiểm tra shadow output không overwrite legacy technique.
- E: chạy adversarial tests trên từng integration slice.
- F: chạy Zod/schema, golden, import và performance tests.

Mỗi owner phải phản hồi ngay khi Orchestrator hỏi về contract; không được tự sửa shared file.

## 10. WAVE 4 — SWARM QA & REMEDIATION

Agent E điều phối QA nhưng findings được xử lý song song theo ownership:

- Assessment finding → A.
- Phase finding → B.
- Kinematic finding → C.
- Classifier finding → D.
- Integration/schema finding → Orchestrator.
- Cross-module/performance finding → F phối hợp owner.

Quy trình finding:

1. E/F tạo minimal failing test.
2. Gửi finding cho owner và Orchestrator.
3. Owner sửa duy nhất file thuộc ownership.
4. Reporter chạy lại failing test.
5. Orchestrator chạy impacted integration tests.
6. Chỉ đóng finding khi có regression test pass.

Không sửa theo kiểu “drive-by fix” trong file của agent khác.

## 11. TEST SHARDING ĐỂ TĂNG TỐC

Chạy song song các shard độc lập:

- Shard A: assessment/rubric tests.
- Shard B: temporal phase/pose validity tests.
- Shard C: kinematic/synthetic trajectory tests.
- Shard D: classifier/stance/shadow tests.
- Shard E: adversarial/golden/immutability/JSON tests.
- Shard F: frontend schema/build, imports, benchmark/performance.

Sau khi shards pass, Orchestrator vẫn phải chạy full Python suite và frontend verification một lần trên integrated tree.

## 12. ESCALATION RULES

Agent phải báo blocker ngay khi:

- cần sửa file ngoài ownership;
- producer contract khác consumer expectation;
- test chỉ pass bằng cách đổi frozen threshold/rubric/FSM;
- output cần schemaVersion mới;
- golden fixture thay đổi ngoài optional/null relaxation đã duyệt;
- không thể giữ deterministic output;
- confidence cần giá trị nhưng chưa được calibrate.

Orchestrator không tự mở rộng scope. Nếu quyết định ảnh hưởng public contract, dừng integration và xin Technical Lead.

## 13. FINAL DEFINITION OF DONE

Chỉ kết thúc khi:

- Waves 2–4 hoàn thành theo gates;
- tất cả agent handoffs có bằng chứng;
- P0/P1 bằng 0;
- P2 còn lại được ghi rõ và không vi phạm contract;
- full test suite, benchmark, golden regression, import-order và frontend validation pass;
- JSON output không NaN/Infinity;
- ActionResult.technique legacy không bị shadow classifier thay đổi;
- classification confidence vẫn `None`;
- insufficient assessment score là `None`;
- mọi executed shadow decision được serialize;
- documentation nêu rõ 2D proxy limitations.

Final walkthrough phải báo cáo agent IDs, communication/handoff log, ownership, files, test commands/counts, QA findings và limitations thực tế.

