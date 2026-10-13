# Temporal AI — thử nghiệm kiến trúc và khả năng chuyển sang YOLO

Ngày 2026-10-05. **Research-only; chưa đạt nghiệm thu AI production.**

**Bổ sung 2026-10-06:** rà soát ảnh RGB theo task phát hiện dấu hiệu lệch giữa
nhãn Adam và động tác nhìn thấy (7 nhãn AI đề xuất khác nguồn), cùng các đòn ở
khoảng cuối chưa có annotation. Các số đo Adam phía dưới giữ để truy nguyên,
chỉ mô tả độ khớp với CSV chưa xác thực; không dùng làm bằng chứng độ chính xác
nhận dạng trước khi căn chỉnh lại. Lượt rà soát AI dùng frame mẫu, chưa phải
gold label hoặc xác nhận HLV. Xem [bằng chứng từng task](../AI-DATASET-REVIEW-20261006.md).

## Những gì đã thực hiện

- Đọc Master Specification v3 và Coaching Spec; cập nhật thiết kế và lộ trình
  trong `docs/archive/ai/AI-TEMPORAL-IMPLEMENTATION.md`.
- Thêm normalizer offline theo timestamp, scale trong hệ pixel, mask/confidence,
  velocity theo giây, nguồn frame và chuyển động root riêng.
- Thêm exporter numeric NPZ/manifest có hash và auditor bốn split, bao gồm
  calibration, group leakage, nhãn được review, khoảng thời gian và checksum.
- Thêm residual TCN và graph-temporal baseline nhỏ; chạy so sánh với legacy TCN
  bằng ba seed và cùng feature/split/ngân sách epoch.
- Chọn epoch bằng V8; fit temperature và threshold trên V5. Không chọn threshold
  bằng Adam hoặc V9/V10. Giữ các tập đã quan sát ở vai trò diagnostic.
- Đánh giá trên Adam bằng pose lưu từ 2026-10-03 và một lượt YOLO mới
  `test_results/external/adam_temporal_20261005.json`, xử lý 597 frame giải mã được.
- Chuẩn bị quy trình dữ liệu cho HLV và template rỗng. Chủ dự án xác nhận chưa
  có bộ dữ liệu HLV xác nhận; không coi dữ liệu công khai là gold set của CLB.

## Protocol và giới hạn

Train V1/V2/V3/V4/V7, validation V8, calibration V5, observed diagnostic V9/V10.
Giữ 4.754 clip hợp lệ từ audit hiện có; V6 vẫn cách ly vì schema không tương thích.
Ba seed 20261005/20261006/20261007; tối đa 40 epoch, patience 10. Epoch cuối không
tự trở thành checkpoint tốt nhất. Số seed không phải số võ sĩ độc lập.

Tất cả kiến trúc dùng `body_relative_image_pose_v1` với 25 bước/clip để so sánh
kiến trúc trên cùng dữ liệu. Mirror thiếu metadata thời gian/aspect cần thiết,
nên không dùng nó để tuyên bố hiệu quả của normalizer mới
`coco17_timestamp_torso_v1`. Normalizer mới đã chạy trên output YOLO thực và
kiểm thử invariance/thời gian/missing-data; chưa có nhãn CLB để đo accuracy.

V8 không có rear_hook. Macro-F1 sáu lớp tính lớp này bằng 0: ngay cả đúng mọi
mẫu có trong V8 cũng không đạt 1.0. Cần validation mới có đủ lớp để quyết định
mô hình sản phẩm. Graph baseline dùng hai partition self/neighbour và head giữ
joint identity; không tái lập kiến trúc ST-GCN gốc hoặc CTR-GCN.

## Kết quả trên video ngoài tập huấn luyện

So sánh đủ **9 lần huấn luyện** (3 kiến trúc × 3 seed), trung bình trên cùng split:

| Kiến trúc | Macro-F1 validation V8 | Macro-F1 diagnostic V9/V10 | ECE sau calibration trên V9/V10 | Tham số |
| --- | ---: | ---: | ---: | ---: |
| Legacy TCN | 0.607 | 0.330 ± 0.059 | 0.208 | 37.382 |
| Residual TCN | 0.753 | 0.519 ± 0.083 | 0.253 | 81.158 |
| Small ST-GCN | 0.618 | 0.341 ± 0.135 | 0.257 | 168.262 |

± là độ lệch chuẩn giữa ba seed, không phải confidence interval theo võ sĩ.
Residual TCN được chọn cho vòng nghiên cứu tiếp theo bằng validation trung bình;
không kết luận ST-GCN nói chung kém hơn TCN từ một baseline nhỏ. Macro-F1 diagnostic
tăng nhưng ECE trung bình tệ hơn legacy; cả hai còn xa mục tiêu 0.85/0.05. Không
chọn một seed đẹp trên V9/V10 để thay số trung bình.

Seed đại diện cố định 20261005 cho cả ba kiến trúc, trên cùng cached YOLO inference:

| Mô hình | Đúng trên 18 đoạn có ranh giới nhãn | Số từ chối sau policy calibration |
| --- | ---: | ---: |
| Legacy TCN | 3/18 | 5 |
| Residual TCN | 4/18 | 3 |
| Small ST-GCN | 3/18 | 18 |

Graph seed này không tìm được threshold đáp ứng cận dưới precision/support trên
calibration; policy từ chối toàn bộ thay vì chọn một ngưỡng tùy ý. Từ chối nhiều
không phải bằng chứng mô hình đạt detection hoặc classification tốt.

Trên lượt YOLO mới, residual TCN ba seed lần lượt đúng 4/18, 3/18, 6/18 trước
abstention; số từ chối là 3, 2, 5. Seed 20261007 có validation tốt nhất trong
ba residual run, nhưng vẫn chỉ đúng 6/18 trên Adam. Không chọn lại seed theo Adam.
Các phép đo trên đều dùng ranh giới GT: không phải nhận dạng video end-to-end.

Detector shadow trên Adam vẫn TP=4, FP=7, FN=14 tại temporal IoU >= 0.5,
F1=0.276. Bộ classifier mới không thay ranh giới detector; các số detection vì thế
không được dùng làm thành tích của classifier. Nguồn không có nhãn impact thật.

## Chẩn đoán và quyết định tiếp theo

1. TCN trước đã chuẩn hóa hông/torso. Nguyên nhân F1 thấp không thể được kết luận
   là “thiếu centering/scale”. Residual/dilation cho baseline so sánh tốt hơn, chưa
   giải quyết được tổng quát hóa sang video YOLO.
2. Sự chênh lệch giữa tập mirror và Adam phù hợp với các vấn đề pose source,
   góc quay, aspect, thời gian, người thực hiện hoặc quy ước nhãn. Một video không
   đủ cô lập nguyên nhân; cần dữ liệu cùng pipeline và ablation theo từng yếu tố.
3. Threshold phù hợp trên V5 không giữ được độ chính xác mục tiêu trên dữ liệu
   khác. Không chuyển research probability thành confidence public đã kiểm định.
4. Normalizer mới xuất 596 frame sau khi loại một tracking-break frame; một cổ
   tay đủ confidence ở khoảng 52.35% frame. `ready_for_research` không đồng nghĩa
   đầy đủ bằng chứng cho mọi động tác. Giữ joint/velocity coverage và mask.
5. Giữ classifier và chấm kỹ thuật ngoài runtime authoritative. Ưu tiên dữ liệu
   YOLO có nhãn HLV, đầy đủ background và một test mới, rồi huấn luyện detection
   trên video liên tục và đánh giá cả detection → classification.

## Artifact và kiểm chứng

- Báo cáo tổng hợp có thể version-control:
  [`benchmark_results/temporal_architecture_20261005.json`](../../../../python-worker/benchmark_results/temporal_architecture_20261005.json).
  Có từng seed, confusion matrix, calibration, hash, nguồn dữ liệu và hạn chế;
  không chứa video hoặc checkpoint nhị phân.
- Run và checkpoint local/ignored: `test_results/temporal_benchmark/20261005_v1/`.
- Chi tiết từng run: `report.json`, numeric `model.npz`; root có configuration,
  runtime/code hashes và data audit.
- Báo cáo chuẩn hóa fresh: `test_results/temporal_pose/adam_fresh_20261005/manifest.json`.
- Báo cáo dữ liệu template: `test_results/temporal_dataset_template_audit_20261005.json`;
  mẫu rỗng được từ chối đúng thiết kế, không được tính là dataset đã chuẩn bị xong.
- Full Python suite: **911 tests + 105 subtests passed**. Sau bổ sung kiểm tra hash
  source checkpoint: **8 targeted tests passed**, và parity trên 18 đoạn Adam thật.
- Không đổi API/UI/output schema production, không deploy, không thay mô hình
  active, không cài thư viện mới. ONNX/ONNX Runtime chưa có trong môi trường nên
  chưa xuất/kiểm định ONNX. Các test chứng minh contract, không chứng minh accuracy.

Các runtime hash của báo cáo cũ ghi nhận code ở thời điểm chạy. Loader checkpoint
sau đó được bổ sung kiểm tra hash model/feature; parity đã kiểm tra không đổi dự
đoán. Evaluator vẫn ghi `cachedInferenceRuntimeVerified=false`; không tự nâng cờ
đó chỉ vì biết đường dẫn output. Lượt YOLO mới được thực thi trong phiên này nhưng
chưa có cơ chế chứng thực runtime capture hoàn chỉnh cho mọi artifact nguồn.
