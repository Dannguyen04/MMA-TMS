# Sử dụng bộ dữ liệu tạm — 2026-10-06

Chủ dự án đồng ý sử dụng tạm bộ dữ liệu đã rà soát. Đã tạo dataset có thể nạp
vào huấn luyện; sau lượt thử 3 epoch đã chạy residual TCN đầy đủ 3 seed × 40 epoch.
Các nhãn nguồn/AI được dùng
như nhãn nghiên cứu chưa xác minh; không chuyển thành nhãn HLV xác nhận.

**Quyết định hiện hành:** chủ dự án chốt toàn bộ 18 nhãn Adam gốc. Không dùng
nhãn AI/Gemini thay thế hoặc loại mẫu Adam vì bất đồng. Đã tạo dataset mới với
4.775 mẫu (3.681 train); xem [quyết định và kiểm chứng](./AI-ADAM-LABEL-DECISION.md).
Checkpoint mới đã huấn luyện theo nhãn vừa chốt, chọn seed 20261007, epoch 37.
Xem [kết quả, hiệu chuẩn và giới hạn](./AI-TRAINING-RESULTS-20261006.md).

## Phiên bản đang dùng cho thử nghiệm

Manifest: `python-worker/test_results/provisional_dataset/20261006_adam_source_v1/manifest.json`.
Feature: `features.npz` cùng thư mục, numeric NPZ không pickle.
Kết quả và hash hiện hành: [adam_source_selection_20261006.json](../../../python-worker/benchmark_results/adam_source_selection_20261006.json).

## Lịch sử dataset v2 và lượt train trước khi chốt nhãn Adam

Các số liệu bên dưới thuộc `20261006_v2`, không phải dataset hiện hành.
Kết quả lịch sử: [provisional_training_20261006.json](../../../python-worker/benchmark_results/provisional_training_20261006.json).

| Phần dữ liệu | Số mẫu | Cách dùng |
| --- | ---: | --- |
| Skeleton nguồn | 4.754 | Giữ split theo video nguồn như benchmark trước |
| Nhãn AI qua kiểm tra pose | 14 | Chỉ train; trọng số loss 0,25 |
| Train tổng | 3.674 | 3.660 upstream + 14 AI |
| Validation | 199 | Chỉ đo độ khớp nhãn upstream chưa xác minh |
| Calibration | 595 | Giữ riêng; chưa dùng trong lần chạy thử |
| Diagnostic test đã quan sát | 300 | Giữ riêng; không chạy dự đoán trong lần thử này |

Trong 67 task RGB, 15 task có nhãn AI đề xuất. Đã trích lại YOLO-Pose từ video
Adam và bao cát bằng model local; 14 task qua kiểm tra. Task
`vid_01_cross_heavybag-review-0000` chứa frame pose không liên tục nên bị loại
nguyên khoảng, không tự cắt frame để làm mẫu hợp lệ. 52 task còn lại chưa được
dùng làm nhãn supervised: ngoài phạm vi, nhiều đòn, chuyển tiếp hoặc chưa rõ.

Trọng số 0,25 là lựa chọn thử nghiệm để giảm ảnh hưởng nhãn AI, không phải mức
tin cậy 25%. Nhãn nguồn dùng trọng số 1 cũng chưa được HLV xác nhận. Không thêm
background giả. Ranh giới và bên tay của 14 mẫu AI vẫn cần chỉnh khi có dữ liệu tốt hơn.

Adam và heavybag đã trở thành nguồn train của nhánh thử nghiệm này. Không dùng
chúng làm test, calibration hoặc để tuyên bố độ chính xác. Chia theo video không
bảo đảm khác võ sĩ; danh tính giữa corpus mirror và video RGB vẫn chưa xác minh.

## Lần chạy đã hoàn thành

- Kiến trúc residual TCN, seed 20261006, CPU 4 thread, 3 epoch.
- Weighted training loss: 1,7041 → 1,2966 → 0,9920.
- Macro-F1 đo độ khớp nhãn validation nguồn ở epoch cuối: 0,3888. Đây không phải
  accuracy đã xác nhận và không so sánh trực tiếp với benchmark 40 epoch trước.
- Đã kiểm tra checkpoint numeric NPZ cho dự đoán tương đương sau khi đọc lại.
- 13 kiểm thử đạt: lọc candidate, không thay provenance, từ chối nhãn AI trong
  tập đánh giá, kiểm tra leakage nguồn, checksum và pose bị đứt quãng.

Checkpoint thử nằm tại
`python-worker/test_results/provisional_training/20261006_smoke_v1/smoke_model.npz`.
Không có policy confidence đã hiệu chuẩn. Lần chạy ngắn chỉ kiểm tra dữ liệu và
luồng huấn luyện, chưa phải thử nghiệm đối chứng hoặc model phát hành.

## Tiếp tục sử dụng

Chạy tại `D:\test\ai\python-worker`; output phải là thư mục mới:

```powershell
# Chạy một vòng thử ngắn với dataset hiện hành dùng nhãn Adam gốc
& '.\.venv\Scripts\python.exe' train_provisional_smoke.py --manifest test_results/provisional_dataset/20261006_adam_source_v1/manifest.json --output test_results/provisional_training/next_smoke --epochs 3

# Tạo phiên bản mới: Adam lấy CSV gốc; video khác dùng candidate AI
& '.\.venv\Scripts\python.exe' prepare_provisional_dataset.py --output test_results/provisional_dataset/next_version --ai-weight 0.25
```

Builder kiểm tra hash của pack, review và video; ghi nhãn, trọng số, split,
frame gốc và nguồn pose vào manifest. Loader chỉ chấp nhận schema nghiên cứu
tạm; nhãn AI phải nằm trong train và có trọng số thấp hơn 1. Không thay đổi
gold exporter, điều kiện xác thực HLV hoặc classifier đang chạy trong ứng dụng.

Feature vẫn là `body_relative_image_pose_v1` dạng 25×85 để khớp corpus mirror.
Dataset này chưa kiểm chứng tác dụng của normalizer timestamp/aspect mới.
`coachConfirmed`, `goldEligible`, `productionEligible` đều false.

## Vấn đề gặp khi trích dữ liệu

Lần thử qua `process_video` đầy đủ bị dừng ở video bao cát vì thứ tự phase
retraction 6283,4 ms / recovery 6283,3 ms. Builder hiện dùng YOLO-Pose và
PersonTracker trực tiếp, không gọi postprocessing chấm pha. Lỗi phase của
pipeline đầy đủ chưa được sửa trong công việc này. Thư mục dataset v1 là lần
chạy dở, không có manifest hoàn chỉnh; sử dụng v2 nêu trên.

[Bản rà soát từng task](./AI-DATASET-REVIEW-20261006.md) vẫn là nguồn nhận xét;
gói review gốc và nhãn nguồn không bị ghi đè. Khi có HLV thật duyệt, tạo phiên
bản nhãn mới và đo lại trước khi thay thế cấu hình nghiên cứu này.
