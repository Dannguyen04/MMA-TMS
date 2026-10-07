# Kết quả huấn luyện với nhãn Adam gốc — 2026-10-06

Đã huấn luyện residual TCN nhận dạng 6 loại đòn từ chuỗi pose. Ba seed đều chạy
40 epoch; checkpoint được chọn là **seed 20261007, epoch 37**. Model có 81.158
tham số, tổng thời gian huấn luyện ba lượt khoảng 136 giây trên CPU 4 thread.
YOLO-Pose được giữ nguyên; đây là model phân loại chuyển động sau bước trích pose.

## Dữ liệu và cách chọn model

Dataset cố định: `python-worker/test_results/provisional_dataset/20261006_adam_source_v1/manifest.json`.
Tổng 4.775 mẫu gồm 4.754 skeleton upstream, đủ 18 annotation Adam gốc và 3 nhãn AI
bao cát. Adam dùng đúng CSV đã khóa hash, giữ cả ranh giới chồng nhau. Không gọi
Gemini trong lượt huấn luyện này.

| Phần | Số mẫu | Nguồn / vai trò |
| --- | ---: | --- |
| Train | 3.681 | V1/V2/V3/V4/V7, Adam và bao cát |
| Validation | 199 | V8; chọn epoch và seed |
| Calibration | 595 | V5; hiệu chuẩn sau khi đóng băng lựa chọn |
| Diagnostic đã quan sát | 300 | V9/V10; chỉ đo sau khi chọn và hiệu chuẩn |

Adam và bao cát chỉ có trong train. Trọng số mẫu bổ sung là 0,25, upstream là 1.
Cross entropy nhân trọng số mẫu và trọng số cân bằng lớp tính từ tổng trọng số
của từng lớp trong train; chuẩn hóa bằng tổng trọng số hiệu dụng mỗi batch.
Trọng số 0,25 không phải xác suất nhãn đúng.

AdamW: learning rate 0,001, weight decay 0,001, batch 128, gradient clipping 5.
Tối đa 40 epoch, patience 10. Chọn macro-F1 validation trên đủ 6 lớp, giữ lần
sớm nhất khi hòa. Không chọn lại theo calibration hoặc V9/V10. Mọi lượt đều dùng
feature `body_relative_image_pose_v1`, kích thước 25×85, chạy deterministic.

## Kết quả thực đo

| Seed | Epoch tốt nhất | Epoch đã chạy | Macro-F1 validation |
| --- | ---: | ---: | ---: |
| 20261006 | 32 | 40 | 0,7411 |
| **20261007** | **37** | **40** | **0,7743** |
| 20261008 | 36 | 40 | 0,7217 |

Trung bình macro-F1 validation qua ba seed: 0,7457; độ lệch chuẩn 0,0217.
Các chỉ số dưới đây thuộc checkpoint được chọn, trước khi từ chối dự đoán:

| Phần | Accuracy khớp nhãn nguồn | Macro-F1 |
| --- | ---: | ---: |
| Validation | 92,96% | 0,7743 |
| Calibration | 88,74% | 0,7765 |
| Diagnostic V9/V10 | 57,33% | 0,5146 |

Validation đã được dùng để chọn cả seed và epoch nên có thiên lệch lựa chọn.
V8 không có rear hook; macro-F1 vẫn tính lớp này bằng 0. Tất cả nhãn đánh giá là
nhãn upstream chưa được HLV xác nhận. Đây là phân loại đoạn có ranh giới cho sẵn,
không phải accuracy phát hiện đòn trên video liên tục hoặc chấm kỹ thuật đúng/sai.

F1 từng lớp trên V9/V10: jab 0,5752; cross 0,5895; lead hook 0,5000; rear hook
0,1379; lead uppercut 0,6476; rear uppercut 0,6377. Rear hook là điểm yếu rõ rệt:
chỉ nhận đúng 2/17 mẫu trước khi lọc confidence. Không dùng Adam làm phép đo test
vì model đã học từ Adam. Chưa có thử nghiệm đối chứng để quy cải thiện cho 18 mẫu này.

## Hiệu chuẩn và giới hạn sử dụng

Temperature 1,389675 chọn bằng NLL trên calibration. ECE calibration giảm từ
0,0486 xuống 0,0221; ECE V9/V10 giảm từ 0,2213 xuống 0,1428. Hiệu chuẩn không cải
thiện mọi tập: ECE validation tăng từ 0,0450 lên 0,0899.

Ngưỡng confidence 0,663400 được chọn từ calibration, với mục tiêu cận dưới Wilson
90% và tối thiểu 30 mẫu. Calibration chấp nhận 530/595 mẫu, đúng 491/530 (92,64%).
Temperature và ngưỡng dùng chung V5 nên ước lượng này có thể lạc quan; không phải
bảo đảm thống kê cho dữ liệu mới.

Áp dụng nguyên ngưỡng đó lên V9/V10: chấp nhận 183/300 mẫu (61%), đúng 136/183
(74,32%); khoảng Wilson 95% là 67,53–80,10%. Mục tiêu 90% không tổng quát hóa sang
hai video này. Sau lọc, rear hook không còn dự đoán đúng nào. Model giữ
`research_only`, `productionEligible=false`, chưa thay classifier trong worker.

## Checkpoint, kiểm chứng và tái lập

Checkpoint được chọn:
`python-worker/test_results/provisional_training/20261006_adam_source_full_v1/selected/model.npz`.
SHA-256: `97f64c94d7c977387ee92ad7dbb2497bdfbbec77065983042b5877cf44aafc66`.

`selected/report.json` chứa policy, metric và hash; `configuration.json` ở thư mục
cha chứa cấu hình cùng hash dữ liệu/mã. `selection.json` ghi quyết định trước khi
chạy calibration/test. Mỗi `seed_*/training.json` lưu toàn bộ lịch sử epoch.
Giữ cấu trúc thư mục khi chuyển model, hoặc chép configuration bên cạnh report.
Nạp bằng `pipeline.temporal_checkpoint.load_temporal_checkpoint`.

Đã kiểm tra checksum, state numeric hữu hạn, source contract và dự đoán tương
đương khi nạp checkpoint bằng loader thực. **16 kiểm thử đạt**, gồm trọng số loss
và gradient, khôi phục epoch tốt nhất, dừng sớm, nguồn nhãn Adam, leakage và loader.

[Báo cáo máy đọc đầy đủ](../python-worker/benchmark_results/adam_source_training_20261006.json).

Chạy tại `python-worker`, dùng output mới:

```powershell
& '.\.venv\Scripts\python.exe' train_provisional_model.py --manifest test_results/provisional_dataset/20261006_adam_source_v1/manifest.json --output test_results/provisional_training/next_full_run --epochs 40 --patience 10 --include-observed-test
```

Bước phát triển tiếp theo là bổ sung dữ liệu các nguồn/võ sĩ khác, nhất là rear
hook và đoạn không có đòn; cần tập đánh giá độc lập. Kết quả hiện tại chưa chứng
minh khác võ sĩ giữa các split, chưa kiểm chứng normalizer timestamp/aspect mới
và chưa hỗ trợ chấm chất lượng kỹ thuật.
