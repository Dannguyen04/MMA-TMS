# AI movement evidence v1 — phạm vi đã triển khai

Ngày: 2026-10-03. Trạng thái: **bản đầu hỗ trợ review, chưa phải AI đo lường/đánh giá production**.

## Quyết định sản phẩm

Giữ nghiệp vụ hiện tại. AI chuẩn bị bằng chứng để HLV/bác sĩ xem xét, không tự
quyết định kỹ thuật đúng/sai, chẩn đoán, xác nhận hồi phục hoặc cấp clearance.
Bác sĩ có hai ngữ cảnh theo dõi: vận động dài hạn và phục hồi sau chấn thương.
Ngữ cảnh không cấp quyền đọc/ghi mới.

Nguồn quy tắc:

- Master spec §03.1–03.4: metric phải có mục đích, evidence-first, human-in-loop.
- Business Flows, Luồng 4: video → review → phản hồi của HLV.
- Master spec §05.10.1 (D1–D9, 2026-09-27): giữ nguyên quyền clinical và clearance.
- Master spec §10.4/giới hạn đo lường và §16.3: không suy ra lực, tốc độ tuyệt đối,
  chẩn đoán hoặc kết luận lâm sàng từ phép đo video chưa kiểm định.

Các dòng “Production-Ready” cho sáu kỹ thuật trong Business Flows không phải bằng
chứng nghiệm thu AI. Bảng clearance cũ trong Business Flows và đề xuất tự cấp
clearance trong Roadmap không được dùng để thay đổi policy D1–D9. Đợt này không
sửa nghiệp vụ clinical, quyền truy cập, migration hay dữ liệu production.

## Luồng đã có

1. Worker nhận metadata training mode/camera hiện hữu. Có thể nhận thêm
   `exerciseContext` từ caller tin cậy hoặc CLI.
2. Sau inference, tạo `movementEvidence` độc lập với kết quả nhận dạng đòn.
3. Chỉ chọn các khoảng frame liên tục có pose mới và đủ khớp nhìn thấy.
4. Ghi frame/timestamp, độ phủ dữ liệu, lý do loại trừ, hướng dẫn ghi hình và provenance.
5. Kết quả JSON đi qua đường đọc result hiện tại; bản báo cáo cũng được đưa vào
   provenance của coaching callback. Chưa kiểm thử callback với database thật.
6. Analysis Workspace hiển thị panel Movement evidence. Nhấn một khoảng thời gian
   để dừng và tua video đến đầu đoạn. Giữ luồng review ứng viên đòn/tổng kết HLV có sẵn.

Không yêu cầu phát hiện được đòn để có báo cáo. Các detector/rubric cũ vẫn chạy
trong pipeline phục vụ tương thích và nghiên cứu; không tuyên bố đã thay toàn bộ pipeline.

## Contract và ranh giới

`exerciseContext` chấp nhận đúng ba trường:

```json
{
  "exerciseId": "assigned-exercise-id",
  "protocolId": "upper_body_v1",
  "purpose": "longitudinal_monitoring"
}
```

- `exerciseId`: tùy chọn; metadata khai báo, không phải xác nhận thực hiện đúng bài.
- Protocol: `whole_body_v1`, `upper_body_v1`, `lower_body_v1`.
- Purpose: `training`, `longitudinal_monitoring`, `rehabilitation`.
- Không có trường cho phép tự khai báo quyền bác sĩ/phê duyệt lâm sàng.
- Mặc định không có exercise ID: báo rõ `EXERCISE_NOT_DECLARED`, không đoán từ đòn.
- API/queue producer hiện tại chưa nối bài tập trong kế hoạch vào context này;
  upload thông thường dùng protocol toàn thân và exercise chưa khai báo.
- Metadata camera chỉ là khai báo; hệ thống chưa xác nhận góc quay thực tế.

Điều kiện chọn frame: pose mới, không discontinuity/diagnostic-only, đủ 17 landmarks,
các khớp thuộc protocol nằm trong ảnh và confidence >= 0.5. Không dùng pose cache để
lấp chỗ thiếu. Không nối qua frame mất hoặc gián đoạn. Video nhiều người, tracking
không được xác minh, chronology không hợp lệ, metadata kích thước/FPS thiếu hoặc
FPS < 20 bị chặn chọn đoạn. Quality gate `blocked` không được nâng lên thành pass.

Đoạn review: ít nhất 6 frame và span 250 ms, chia tối đa 5 giây. Những ngưỡng này
là **engineering defaults**, không phải ngưỡng lâm sàng hay mức chính xác đã kiểm định.

Trạng thái:

- `review_ready`: có đoạn để xem, không đồng nghĩa đúng kỹ thuật hay an toàn y tế.
- `limited`: chỉ một phần dữ liệu đáp ứng điều kiện hoặc quality gate degraded.
- `recapture`: cần quay lại/xử lý lại; vẫn có thể xem video gốc bằng mắt.

`usableFrames` có thể lớn hơn tổng frame trong các đoạn: các khoảng quá ngắn không
được đưa thành review window. Độ phủ tính trên frame đã decode, không chứng minh
đã đọc đủ mọi frame của file nguồn. Window ID có phạm vi trong từng analysis/job.

Measurement policy cố định: chưa kiểm định, không score, không clinical use, không
so sánh tự động và không đếm lần lặp. Confidence của window là null, không dùng
confidence keypoint làm xác suất đúng của hành động.

Frontend kiểm tra version, policy, coverage, tính không chồng lấn và timestamp tham
chiếu nguồn; báo cáo sai contract bị từ chối, không hạ xuống luồng score cũ. Với
báo cáo mới, không hiển thị panel tốc độ/lực proxy/rotation legacy, không sinh thêm
combo/guard-drop hoặc vẽ góc khớp theo ứng viên đòn. Output cũ vẫn tương thích.

## Cách chạy

Từ `python-worker` (model có sẵn):

```powershell
.venv/Scripts/python.exe process_video.py --input path/to/video.mp4 --output test_results/movement.json --training-mode SHADOW_BOXING --camera-view FRONT --exercise-id assigned-exercise-id --evidence-protocol upper_body_v1 --analysis-purpose longitudinal_monitoring
```

Việc khai báo purpose rehabilitation không biến báo cáo thành đánh giá phục hồi.
Không cần và không nên khai báo một discipline-specific rubric chưa được hỗ trợ.

## Kiểm chứng đợt này

- Python: 863 tests + 105 subtests qua tại lần chạy toàn bộ đầu tiên sau tích hợp.
- Frontend: 425 tests qua, gồm contract từ JSON inference thật; TypeScript no-emit qua.
- Full frontend suite cần `NODE_PATH=D:/test/ai/node_modules/.pnpm/node_modules`
  trong môi trường hiện tại để resolve `@swc/helpers` đã có trong cache. Không cài
  package, không đổi manifest/lockfile. Đây không phải xác nhận production build.
- Unit render của panel kiểm tra context, nút xem đoạn và thông báo giới hạn;
  router Next được mock. Chưa chạy browser E2E, storage/API/database end-to-end.
- Video nghiên cứu Adam đã tải ở đợt trước: chạy inference mới, 597 frame decode,
  330 usable (55.28%), 266 loại vì visibility, 1 tracking break, 11 review windows,
  trạng thái limited. Đây là smoke test, không phải độ chính xác hoặc nghiệm thu.
- Raw result: `python-worker/test_results/external/adam_movement_evidence_v1.json`
  (local/ignored; không đưa video công khai vào repository).

## Tích hợp backend và review — 2026-10-03

Người dùng đã cho phép ghi đè riêng hạn chế triển khai backend trong AGENTS.md
để nối luồng này; các quy tắc phân quyền và clearance vẫn được giữ nguyên.

- Upload ở chế độ API cho phép chọn `sessionExerciseId` từ buổi tập và protocol
  whole/upper/lower body. Không suy đoán bài tập khi người dùng chưa chọn.
- Server xác minh bài thuộc đúng session/fighter của video, session còn hoạt động;
  snapshot ID, tên bài, protocol và người chọn vào `analysis_jobs.evidence_context`.
  Worker chỉ nhận exerciseId/protocolId/purpose, không nhận quyền hay cờ xác nhận.
  Purpose trong luồng upload này cố định `training`; chưa nối assignment phục hồi.
- Callback kiểm tra report và đối chiếu context với job, rồi lưu toàn bộ report
  trong `ai_analyses.style_profile.movementEvidence`, kể cả khi không có action.
  Job mới có context nhưng worker thiếu report sẽ bị từ chối, không im lặng hạ cấp.
- GET `/movement-evidence/sessions/:sessionId/exercises` trả lựa chọn theo scope.
- GET/POST `/movement-evidence/jobs/:jobId/reviews` đọc/lưu nhận xét từng window.
  Read cần `movement.evidence:read`; write cần cả read/review và vai trò COACH hoặc
  DOCTOR, hồ sơ và phân công hiện hành. ADMIN/FIGHTER không được write dù có grant.
  Fighter phải còn hoạt động. Quyền deny vẫn được áp dụng.
- Review gồm useful footage / narrow interval / not useful, ghi chú bắt buộc,
  người nhận xét, vai trò, thời gian, revision riêng theo reviewer/window và hash
  report gốc. Narrow chỉ được thu hẹp trong window cũ; không sửa bằng chứng máy.
- Khóa job trong transaction, `expectedRevision` chống ghi đè từ tab cũ, `requestId`
  chống ghi trùng khi retry. Trigger DB chặn UPDATE/DELETE/TRUNCATE lịch sử.
- Giao diện dùng BFF cùng origin, token chỉ ở server, hiện lỗi lưu/tải rõ ràng.
  Nhận xét này chia sẻ với võ sĩ và nhân sự có quyền; chẩn đoán/ghi chú lâm sàng riêng
  phải ở hồ sơ y tế. Xác nhận footage không đồng nghĩa đúng kỹ thuật hoặc clearance.

### Kiểm thử tích hợp đợt này

- Frontend: **438 tests / 50 files qua**, TypeScript no-emit qua. Có test BFF cho
  auth server-side, giả mạo actor, context upload, correction và lỗi persistence.
- Backend phạm vi coaching/jobs/video/auth guard: **34 tests / 4 files qua**;
  TypeScript theo `tsconfig.build.json` qua. Có test zero-action report, context sai,
  quyền deny, admin override, scope, retry, stale revision và khoảng thời gian.
- **26 kiểm tra PostgreSQL qua** trên instance tạm biệt lập, đã tự dừng; migration
  015/016, RLS/grants, INSERT, chống trùng, UPDATE/DELETE/TRUNCATE và reapply được kiểm tra.
  Checksum 001–016 qua. Không áp dụng migration lên database đang cấu hình.
- Kiểm tra backend toàn bộ chưa xanh: hai test medical clearance có lỗi; kiểm tra
  TypeScript gồm test có lỗi medical/training/OpenAPI ngoài phạm vi. Lượt test rộng
  đã dừng khi integration cũ cần Redis localhost không sẵn sàng. Không coi đó là
  một lượt E2E thành công. Unit render cô lập Next router và icon do cache có hai
  bản React; không thay thế kiểm thử browser thực tế.

### Kích hoạt và tương thích

1. Backup, kiểm tra lịch sử DB trên môi trường đích; áp dụng migration 015 (nếu thiếu)
   rồi **016_movement_evidence_reviews.sql** qua runner đã kiểm checksum.
2. Phối hợp rollout backend, worker có movement evidence và frontend mới. Không
   triển khai backend mới với worker cũ thiếu contract. Không bật production score.
3. Kiểm tra E2E trên dữ liệu thử được phép: upload → chọn bài → queue → callback →
   xem evidence → coach/doctor review → reload, retry, hai tab, revoke assignment.
4. Kết quả cũ không có report trong DB không được tạo review window giả; cần phân
   tích lại theo luồng revision/video phù hợp, không sửa receipt đã chốt.

## Phần chưa hoàn tất / thứ tự tiếp theo

1. Kiểm thử browser/storage/queue/database toàn tuyến, chạy migration trên môi
   trường đích được xác nhận và nghiệm thu trước khi kích hoạt cho người dùng.
2. Kiểm định từng phép đo bằng ground truth chuyên gia/thiết bị phù hợp và đánh giá
   sai số, độ lặp lại, coverage theo protocol/camera. Chưa bật ROM/asymmetry lâm sàng.
3. Baseline đã được chuyên gia chọn, kiểm tra tương thích bài/góc quay/phiên bản,
   rồi mới xem xét so sánh nhiều buổi. Chưa tự kết luận cải thiện/xấu đi.
4. Nối bài phục hồi do bác sĩ giao và theo dõi dài hạn trong quyền hiện hữu;
   review footage hiện tại chưa phải đánh giá tiến triển phục hồi.

Chưa có production deployment hoặc migration môi trường thật; chỉ migration DB tạm
phục vụ kiểm thử. Không đưa thêm dữ liệu video lên dịch vụ AI bên ngoài.
