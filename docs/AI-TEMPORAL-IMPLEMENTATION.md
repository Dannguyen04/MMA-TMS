# Triển khai AI thời gian sau YOLO-Pose

Ngày: 2026-10-05. Phạm vi: nghiên cứu solo boxing và nền tảng dữ liệu cho
`python-worker`. Đây là kế hoạch thực thi và ghi nhận trạng thái; không thay quyền
clinical, nghiệp vụ huấn luyện hay chính sách phát hành AI hiện tại.

## Căn cứ và thứ tự ưu tiên

- Master Specification v3, §03, §09, §10.4 và §16.3: bằng chứng truy vết được,
  HLV xác nhận, không suy ra phép đo tuyệt đối hoặc quyết định y tế từ pose 2D.
- Martial Arts AI Coaching Spec v1, §07, §15, §16, §22 và §24: tách detection,
  classification, assessment; tách dữ liệu theo võ sĩ/video; refactor từng bước.
- `AI_COACHING_RELIABILITY_PLAN.md`: các ngưỡng nghiệm thu là mục tiêu cần đạt
  bằng dữ liệu độc lập, không được tự sửa để hợp thức hóa kết quả thử nghiệm.
- Quyết định trong trao đổi 2026-10-05: rà soát dữ liệu và lỗi trước; so sánh TCN
  với ST-GCN; calibration riêng; đánh giá kỹ thuật cần nhãn HLV riêng.
- `AI_RESEARCH_RESULTS.md`: V9/V10 và Adam đã được quan sát. Các lần chạy tiếp
  theo trên chúng là diagnostic, không phải tập test mù mới.

Các ví dụ score và bảng so sánh accuracy trong tài liệu lịch sử mô tả ý định hoặc
prototype. Chúng không thay thế bằng chứng nghiệm thu và policy hiện đang chặn
đầu ra chưa được kiểm định.

## Thiết kế đã chốt cho đợt này

```text
Video + bài tập/góc quay/thế thủ khai báo
  -> YOLO-Pose + theo dõi người + chất lượng/timestamp
  -> chuẩn hóa có mask, giữ thời gian và chuyển động tâm hông
  -> phát hiện khoảng hành động (cần dữ liệu video liên tục)
  -> phân loại kỹ thuật (benchmark trên đoạn có nhãn trước)
  -> calibration + abstention
  -> HLV duyệt/sửa, tích lũy dữ liệu
  -> đánh giá chất lượng theo criterion (giai đoạn riêng)
```

Luồng `movementEvidence` hiện tại vẫn có thể cung cấp đoạn video cho HLV kể cả
khi detection/classification chưa đủ tốt. Không đưa mô hình thử nghiệm vào đầu ra
authoritative; không dùng confidence của keypoint hoặc softmax để thay confidence
đã được kiểm định. Không bổ sung kick vào bộ nhãn boxing.

## Các module và contract

### 1. Chuẩn hóa offline từ worker JSON

`pipeline/pose_normalizer.py`, phiên bản `coco17_timestamp_torso_v1`:

- Input: COCO-17, tọa độ ảnh `[0,1]`, confidence, `frameIdx`, `timeMs`, kích thước
  ảnh và quality/tracking metadata. Không tự sắp xếp lại chronology bị hỏng.
- Phải có quality pass/degraded và bằng chứng single-person tracking từ worker.
  Không biến metadata này thành chứng nhận danh tính độc lập.
- Đổi `(x*width, y*height)` về pixel trước khi tính độ dài để không méo tỷ lệ ảnh.
- Trừ mid-hip từng frame; chia median khoảng cách mid-shoulder–mid-hip trong
  một run liên tục. Không ép tọa độ về `[-1,1]`.
- Chỉ nhận torso đủ tin cậy; các khớp còn lại có mask và confidence riêng.
- Loại pose cache/discontinuity/diagnostic-only; ngắt run khi mất frame, đổi
  `trackId` hoặc khoảng thời gian giữa hai frame vượt giới hạn.
- Lấy mẫu theo timestamp, mặc định 30 FPS; không co một clip tùy ý về 25 frame.
  Nội suy chỉ giữa hai khớp hợp lệ kề nhau trong cùng run, không lấp khớp bị che.
- Vận tốc dựa trên giây thực. Missing joint giữa hai output khi downsample cũng
  làm mất hiệu lực vận tốc; sample đầu tiên có velocity mask false.
- Giữ root displacement/velocity riêng để centering không xóa dấu vết dịch chuyển.
  Đây vẫn là chuyển động chiếu lên ảnh, chịu tác động của camera/phối cảnh.
- Chưa smoothing, anti-alias filtering, body-axis rotation, stance mirroring hoặc
  3D lifting. Scale median dùng cả run, nên không coi module này là causal/realtime.

NPZ có `positions [T,17,2]`, `velocity [T,17,2]`, `mask [T,17]`,
`velocity_mask`, `confidence`, `timestamps_ms`, `source_frame_pairs`,
`root_positions`, `root_velocity`, `torso_scale_pixels`, `features [T,85]`.
85 kênh là position 34 + velocity 34 + visibility mask 17. Confidence,
velocity mask và root có lưu riêng; chưa được đưa vào bộ classifier benchmark.

CLI xuất manifest, hash nguồn/code/NPZ, độ phủ từng khớp và danh sách loại trừ.
Một run pose liên tục không tự trở thành một đòn hoặc nhãn huấn luyện.
`ready_for_research` chỉ xác nhận có tensor hợp lệ; không chứng minh đủ khớp nhìn
thấy cho mọi kỹ thuật hoặc chất lượng động tác.

```powershell
# Chạy trong python-worker; mỗi lần dùng output directory mới.
.venv/Scripts/python.exe prepare_temporal_pose.py --inference test_results/external/adam_movement_evidence_v1.json --output test_results/temporal_pose/adam_new --fps 30
```

### 2. Kiểm tra tập dữ liệu CLB trước huấn luyện

`pipeline/temporal_dataset.py` và `audit_temporal_dataset.py` kiểm tra bốn split:
`train`, `validation`, `calibration`, `test`. Không tự gán võ sĩ hoặc chia clip
ngẫu nhiên. Leakage được kiểm tra theo fighter, session, source video ID/hash,
source inference hash và pose asset hash, kể cả calibration.

Template rỗng: `docs/examples/temporal-dataset.manifest.json`. Template cố ý chưa
đủ điều kiện huấn luyện; không có người/nhãn/consent giả. Mỗi sample cần các trường:

```json
{
  "sampleId": "action-id-from-annotation",
  "split": "train",
  "fighterId": "pseudonymous-fighter-id",
  "sessionId": "recording-session-id",
  "sourceVideoId": "source-video-id",
  "sourceVideoSha256": "<64 lowercase hexadecimal characters>",
  "sourceInferenceSha256": "<64 lowercase hexadecimal characters>",
  "posePath": "relative/path/to/segment_0000.npz",
  "poseSha256": "<64 lowercase hexadecimal characters>",
  "startTimeMs": 1000,
  "endTimeMs": 1600,
  "technique": "jab",
  "stance": "orthodox",
  "cameraView": "front",
  "annotatorIds": ["coach-id"],
  "reviewStatus": "COACH_APPROVED",
  "testObserved": false
}
```

Khoảng nhãn là `[startTimeMs,endTimeMs)`, nằm trong một NPZ run liên tục. Đây là
contract single-label cho solo; khoảng chồng nhau bị từ chối để xử lý nhãn trước,
không tự ép hai động tác thành một. Không dùng cho sparring/multi-label.

Taxonomy: jab, cross, lead_hook, rear_hook, lead_uppercut, rear_uppercut, background.
Background phải bao gồm chuyển động không phải đòn, không chỉ đứng yên. Nhãn
`unknown` là abstention của hệ thống, không tự chuyển thành background.
`COACH_APPROVED` hoặc `DUAL_AGREEMENT` với hai annotator khác nhau mới qua kiểm tra
nhãn. Danh tính reviewer, consent/quyền dùng dữ liệu, tính exhaustive và hash nguồn
video/inference vẫn là khai báo cần đối chiếu bên ngoài; auditor chỉ xác minh bytes
của pose asset cục bộ. Đây chưa phải ký duyệt hoặc xác thực annotation độc lập.

Mặc định kiểm tra ít nhất 30 sample/lớp/split để phát hiện thiếu coverage; đây là
engineering preflight, **không phải** thay mục tiêu 200–500 action/lớp và 20–30 võ sĩ
trong spec. Báo counts theo stance/view/class để phát hiện thiếu strata. Đủ counts
không chứng minh độc lập thống kê hoặc tổng quát hóa. Cần khai báo phạm vi annotation
exhaustive sau khi kiểm tra video, không mặc định mọi khoảng trống là background.

```powershell
.venv/Scripts/python.exe audit_temporal_dataset.py --manifest path/to/manifest.json --output test_results/temporal_dataset_audit.json
```

Exit 2 nếu chưa đủ metadata/support cho training; exit 0 chỉ là preflight đạt.
Auditor không cho phép release production. Loader để huấn luyện trực tiếp từ
contract mới và nhãn temporal segmentation còn là hạng mục tiếp theo; chưa nối
template này vào benchmark dữ liệu mirror.

### 3. Benchmark kiến trúc có kiểm soát

`pipeline/temporal_models.py` và `benchmark_temporal_models.py`:

- `legacy_tcn`: baseline hai Conv1D hiện hữu, receptive field convolution 5 bước.
- `residual_tcn`: ba residual block, mỗi block hai temporal convolution, dilation
  1/2/4; receptive field convolution 29 bước trước pooling. GroupNorm và pooling
  dùng ngữ cảnh toàn clip; đây là classifier offline, không causal detector.
- `small_stgcn`: graph COCO-17 có hai partition self/neighbour và temporal
  convolution. Giữ node identity ở đầu phân loại. Đây là baseline nhỏ lấy ý tưởng
  từ ST-GCN, **không tái lập kiến trúc/checkpoint chính thức**, không phải CTR-GCN.
- Cùng dữ liệu, feature version, split, optimizer, weighting, ngân sách epoch,
  early stopping và danh sách seed; báo số tham số để thấy khác biệt capacity.
- Chọn epoch/kiến trúc theo validation. Calibration trên V5; chọn threshold bằng
  cận dưới Wilson cho precision >= 0.90 với support >= 30, chỉ phục vụ nghiên cứu.
  Nếu không có threshold đáp ứng thì abstain toàn bộ, không fallback về 0.8.
- Báo confusion matrix, từng lớp/video, ECE, NLL, Brier, coverage và độ chính xác
  phần được chấp nhận. Không bỏ abstention khỏi mẫu số recall/classification.
- Seed khác nhau cho biết độ biến động khởi tạo; không thay confidence interval
  theo võ sĩ. Một tập validation thiếu rear_hook chưa đủ để chốt mô hình sản phẩm.
- Numeric NPZ checkpoint, kiểm tra roundtrip, hash dữ liệu/code/runtime và thư mục
  run bất biến. Không ghi đè kết quả cũ. Latency chỉ đo model CPU batch=1, không gồm
  video/YOLO/preprocessing và không phải benchmark dịch vụ trong tải thực tế.

**Hai feature contract tách biệt:** mirror BoxingVI không đủ timestamp/aspect
metadata, nên benchmark giữ `body_relative_image_pose_v1` với 25 bước/clip.
Không giả lập FPS hoặc kích thước ảnh để ép mirror vào normalizer mới. Không trộn
checkpoint v1 với feature mới dù đều có 85 kênh. Cần dữ liệu YOLO cùng pipeline để
huấn luyện/kiểm định `coco17_timestamp_torso_v1` ở vòng tiếp theo.

```powershell
.venv/Scripts/python.exe benchmark_temporal_models.py --output test_results/temporal_benchmark/new_run --epochs 40 --patience 10 --seeds 20261005 20261006 20261007
# Chỉ thêm --include-observed-test để mô tả V9/V10 đã quan sát, không chọn mô hình bằng chúng.
```

`pipeline/temporal_checkpoint.py` kiểm tra contract, checksum, temperature,
threshold, weights hữu hạn và hash code model/feature trước khi load. Khi chuyển
checkpoint sang thư mục khác, giữ `configuration.json` của benchmark bên cạnh
run hoặc tại thư mục cha. Có thể đánh giá checkpoint nghiên cứu
trên Adam bằng `evaluate_external_boxing.py --temporal-model <run-directory>`.
Confidence public vẫn null; softmax được lưu rõ là research probability.

## Lộ trình có điều kiện nghiệm thu

Trạng thái đợt 2026-10-05: code normalizer/export/audit và benchmark nghiên cứu đã
được triển khai, đã chạy 9 lần huấn luyện và một lượt YOLO đầy đủ mới. Kết quả,
tests và các hạn chế trong [báo cáo thực nghiệm](../python-worker/TEMPORAL_AI_RESEARCH_REPORT.md).
Đây là hoàn tất đợt nền tảng/nghiên cứu, chưa hoàn tất toàn bộ lộ trình AI.

| Pha | Đầu ra | Điều kiện hoàn tất |
| --- | --- | --- |
| 0. Rà soát | Căn cứ kỹ thuật, lỗi baseline, protocol thí nghiệm | Báo cáo và artifact tái lập; không đổ lỗi thiếu normalization khi code đã có |
| 1. Chuẩn hóa/dữ liệu | Offline normalizer, exporter, auditor; bộ dữ liệu CLB | Code/tests là phần đã triển khai; dataset mới cần metadata và HLV xác nhận |
| 2. Classification | So sánh TCN/graph theo nhiều seed | Diagnostic mirror trước; sau đó nghiệm thu trên võ sĩ/video mới cùng YOLO pipeline |
| 3. Detection | Nhãn temporal liên tục, background/hard negatives, segmentation model | Event precision/recall/F1; nhiều tIoU; FP/phút; lỗi theo subgroup; đánh giá cả classifier trên predicted intervals |
| 4. Calibration/runtime | Policy abstention, ONNX parity, benchmark worker, chạy shadow | Đạt các release gate hiện hành; giữ null/unknown khi không đủ bằng chứng |
| 5. Quality | Criterion do HLV định nghĩa, nhãn lỗi/độ nặng, kiểm định agreement | Không dùng embedding similarity làm điểm chất lượng nếu chưa được kiểm định |

Để tránh mơ hồ trong reliability plan: báo cả macro-F1 toàn taxonomy và F1 từng
lớp; “macro-F1 cho từng kỹ thuật” không phải một metric riêng. Các mục tiêu chưa
được đạt chỉ là mục tiêu. Chốt cách dùng ngưỡng theo lớp trước vòng nghiệm thu;
không chỉnh cách tính sau khi xem test. Impact chỉ đánh giá khi có nhãn contact
thật; shadowboxing không tạo nhãn impact từ giữa đoạn.

Các phụ thuộc chưa thể thay bằng code: dữ liệu CLB có quyền sử dụng phù hợp; nhóm
võ sĩ/buổi quay được xác minh; test mới chưa quan sát; HLV gán nhãn độc lập và phân
xử bất đồng; video liên tục có background; nhãn criterion nếu muốn chấm chất lượng.
ONNX/ONNX Runtime chưa cài trong môi trường hiện tại; chưa xuất hoặc kiểm định
artifact ONNX. Không bật classifier/chấm điểm tự động khi các bằng chứng còn thiếu.

Chủ dự án xác nhận ngày 2026-10-05 chưa có bộ dữ liệu HLV xác nhận. Quy trình
bàn giao và checklist đã được chuẩn bị trong `AI-DATA-COLLECTION-PROTOCOL.md`.

## Tài liệu nghiên cứu gốc

- [ST-GCN, Yan et al.](https://arxiv.org/abs/1801.07455): học quan hệ khớp và thời gian.
- [TCN, Bai et al.](https://arxiv.org/abs/1803.01271): baseline convolution theo thời gian.
- [Calibration, Guo et al.](https://proceedings.mlr.press/v70/guo17a.html): xác suất
  softmax và calibration; không mặc định xác suất cao tương đương độ chính xác cao.
- [FineDiving](https://openaccess.thecvf.com/content/CVPR2022/html/Xu_FineDiving_A_Fine-Grained_Dataset_for_Procedure-Aware_Action_Quality_Assessment_CVPR_2022_paper.html):
  minh họa đánh giá chất lượng cần nhãn và so sánh theo cấu trúc động tác; không là
  bằng chứng một embedding boxing chưa huấn luyện có thể chấm kỹ thuật.
