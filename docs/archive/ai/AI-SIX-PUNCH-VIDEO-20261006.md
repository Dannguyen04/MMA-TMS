# Nhận diện 6 đòn trên video và từ chối khi không chắc

Phạm vi người dùng chốt ngày 2026-10-06: jab, cross, lead/rear hook,
lead/rear uppercut; trả `unknown` khi không đủ bằng chứng. Nhận diện loại đòn
không đồng nghĩa chấm chất lượng kỹ thuật. Lượt này triển khai bộ chạy thử
video một võ sĩ, kiểm tra dữ liệu gốc, khôi phục V6 và huấn luyện lại.

**Trạng thái:** đã hoàn tất 24 lượt CV và hai lượt refit; **chưa đạt nghiệm thu**.
Đã chạy cả ba checkpoint (baseline cũ, B0, B1) qua kiểm tra RGB và video Adam.
Không thay model đang chạy trong worker. Chưa có model đạt yêu cầu nhận diện
sáu loại đòn trên video; cơ chế từ chối có hoạt động nhưng chất lượng và độ phủ
chưa đủ để sử dụng.

## Dữ liệu đã xác minh

- Đối chiếu 10 bảng XLSX gốc BoxingVI với CSV mirror: đủ 5.451 hàng khớp theo
  thứ tự, khoảng frame và tên lớp sau chuẩn hóa khoảng trắng/chữ hoa. Không
  phát hiện lỗi chuyển đổi CSV; điều này chưa chứng minh mọi nhãn đúng nội dung.
- Tải skeleton gốc V4, V6, V10: bằng byte với mirror đã dùng.
- V6 có dạng `[46497,1,17,3]`; ba cột là **frame ID, x, y**. Frame ID là số
  nguyên, giống nhau ở 17 khớp, tăng nghiêm ngặt. Ghép theo giá trị ID, không
  dùng vị trí hàng. Cả 685 khoảng nhãn có đủ frame tương ứng.
- V6 bổ sung 125 lead hook, 95 rear hook, 259 lead uppercut, 206 rear uppercut;
  không có jab/cross. Tám khoảng dài hơn 25 frame được resample toàn khoảng,
  không cắt bỏ phần cuối. Không dùng khoảng trống chưa gán nhãn làm background.
- Dataset mở rộng có 5.460 mẫu: train 4.366, V8 199, V5 calibration 595,
  V9/V10 diagnostic 300. Mọi tensor/target/trọng số cũ được so sánh bằng tuyệt
  đối sau khi nạp lại. Toàn bộ 18 nhãn Adam gốc vẫn giữ nguyên.
- V4 và V6 tải từ metadata tác giả có FPS 24000/1001; V10 là 25 FPS. Vì vậy
  không đổi frame sang giây bằng một FPS cố định cho mọi video.

Nguồn tác giả: [BoxingVI](https://github.com/Bikudebug/BoxingVI),
[thư mục công khai](https://drive.google.com/drive/folders/1Vyl8twJQ1qkqEPwhvfsrJsJ8nLQ92uoy).
Các file đã tải nằm trong `python-worker/test_results/external/boxingvi_original_20261006`.
Metadata RGB là bảng liên kết YouTube, không phải các MP4 do tác giả đóng gói.

Bằng chứng: [đối chiếu annotation](../python-worker/benchmark_results/boxingvi_original_annotation_audit_20261006.json),
[khôi phục V6](../python-worker/benchmark_results/v6_recovery_20261006.json).

## Thí nghiệm đã đóng băng trước khi chạy

Hai cấu hình dùng cùng dữ liệu có V6, kiến trúc residual TCN với hai đầu phụ
family/lead-rear khi train. B0 không phản chiếu; B1 phản chiếu 50% clip trong
batch, đổi dấu tọa độ/vận tốc x và đổi đúng các khớp trái/phải COCO17, kể cả
mask. Biến đổi mô phỏng đổi thế thủ, giữ nhãn tay trước/sau; không tạo nhãn mới
cho tay trái/phải giải phẫu. Đầu inference vẫn là sáu lớp như checkpoint v1.

Giữ riêng lần lượt V1; V2+V3; V4+V7; V6. Adam/heavybag chỉ ở train. Mỗi cấu
hình/fold chạy seed 20261006/7/8, tối đa 40 epoch, patience 10: tổng 24 lượt CV
và một refit. Chọn cấu hình bằng trung bình macro-F1 trên **các lớp có support**
của từng fold, vì V6 chỉ có bốn lớp; vẫn lưu đủ sáu lớp trong confusion matrix.
Không so trực tiếp trung bình bốn fold này với con số ba fold của A0–A3 cũ.

Refit dùng seed đầu tiên, số epoch là median epoch tốt nhất của 12 lượt CV
thuộc cấu hình thắng. V5 chỉ hiệu chuẩn; V8/V9/V10 chỉ diagnostic sau chọn.
Đây vẫn là CV chọn model và chưa chứng minh độc lập võ sĩ giữa các nguồn.

### Kết quả đầy đủ

| Chỉ số CV | B0: thêm V6 | B1: thêm V6 + phản chiếu |
| --- | ---: | ---: |
| Trung bình bốn fold (lớp có support) | 0,5092 | 0,5048 |
| V1 | 0,4616 | 0,4067 |
| V2+V3 | 0,5718 | 0,4935 |
| V4+V7 | 0,2514 | 0,4771 |
| V6, bốn lớp | 0,7520 | 0,6418 |
| Riêng V4 | 0,0773 | 0,4550 |

Theo quy tắc đóng băng, B0 thắng và refit 26 epoch. Sau khi thấy cải thiện lớn
ở nguồn yếu nhất, xuất thêm B1 ở median 16 epoch như **thử nghiệm phụ mang tính
khám phá**; không viết lại kết quả chọn chính thức hay gọi lượt phụ là xác nhận
độc lập. Cả hai dùng seed 20261006. Tổng thời gian train đo được khoảng 1.015 giây
trên CPU, không gồm chuẩn bị dữ liệu và các phép đánh giá.

| Diagnostic V9/V10 (đã quan sát, 300 clip) | B0 chính | B1 phụ |
| --- | ---: | ---: |
| Accuracy trước từ chối | 0,5367 | 0,4567 |
| Macro-F1 sáu lớp trước từ chối | 0,5417 | 0,4491 |
| ECE, hiệu chuẩn ở V5 | 0,3221 | 0,2832 |
| Giữ lại chỉ theo ngưỡng xác suất | 239/300 | 190/300 |
| Đúng trong phần giữ lại | 137/239 = 57,32% | 105/190 = 55,26% |

Đây chưa phải chính sách đầy đủ có phản chiếu/quality gate. B0 đạt F1 0,7781
ở V9 nhưng chỉ 0,3075 ở V10. Rear hook của B0 có 15/17 mẫu đúng sau ngưỡng;
cross chỉ 1/63. Không dùng cải thiện riêng một lớp để nghiệm thu cả sáu lớp.
F1 B0 cao hơn baseline lịch sử 0,5146, nhưng accuracy/calibration và nhiều lớp
không đồng thời tốt hơn; dữ liệu, seed và số epoch khác nhau nên không kết luận
đây là hiệu quả nhân quả riêng của V6.

[24 lượt CV và refit chính](../python-worker/benchmark_results/v6_reflection_training_20261006.json),
[refit phụ](../python-worker/benchmark_results/v6_robustness_refit_20261006.json).
Checkpoint nằm ở `python-worker/test_results/temporal_ablations/`:

- `20261006_v6_reflection_v1/selected/model.npz` (B0), SHA256
  `3fa9cf2195615220a1ca4149cb018d5cd56bed10cb53912ebb8cdf5181aaccd9`.
- `20261006_v6_robustness_v1/selected/model.npz` (B1), SHA256
  `45f2f8fd345ddf0504850d46855ad4ca07c0a9aab0fa562aaa14b6751218ffa4`.

## Kiểm tra skeleton nguồn so với YOLO trên RGB

Chọn cố định ba hàng phân bố theo thứ tự cho mỗi lớp có trong V4/V6/V10:
48 đoạn nguồn, mỗi đoạn thử hai offset frame (-1, 0), thành 96 trường hợp.
YOLO dùng weights có sẵn, kích thước inference 640, chỉ nhận đúng một người.
Đây là phép đo có ghép cặp, không phải 96 mẫu độc lập. Chưa tự chọn offset
thành nhãn thời gian đã xác nhận và chưa đưa các pose này vào train.

Với model cũ (seed 20261007, epoch 37), ở offset 0:

| Nguồn | Đoạn chọn | Đúng với skeleton nguồn | Đúng với YOLO RGB |
| --- | ---: | ---: | ---: |
| V4 | 18 | 17 | 13 |
| V6 | 12 | 10 | 7 |
| V10 | 18 | 8 | 7 |

Median sai khác vị trí khớp trong tọa độ ảnh xấp xỉ 0,007–0,009 ở offset 0.
Sai khác nhỏ về khớp vẫn đi kèm thay đổi dự đoán. Các khác biệt gồm estimator,
resolution/codec và có thể cả căn frame; không quy toàn bộ nguyên nhân cho YOLO.
V4 thuộc train cũ, V10 đã quan sát, nên không suy ra accuracy tổng quát từ bảng.

[Báo cáo ghép cặp baseline](../python-worker/benchmark_results/rgb_pose_bridge_baseline_20261006.json).

Sau huấn luyện, tại offset 0, B0 trên YOLO khớp 14/18 V4, 11/12 V6 và 8/18 V10.
Khi thêm ngưỡng và điều kiện phản chiếu, B0 vẫn nhận sai cả hai mẫu V10 được giữ.
B1 nhận 10 mẫu V10 nhưng chỉ đúng ba. Do đó ngay cả đồng thuận phản chiếu cũng
không đủ làm cơ chế phát hiện đầu vào khác phân phối.
[B0 RGB](../python-worker/benchmark_results/rgb_pose_bridge_v6_reflection_20261006.json),
[B1 RGB](../python-worker/benchmark_results/rgb_pose_bridge_v6_secondary_20261006.json).

## Luồng chạy thử và từ chối

`recognize_boxing_video.py`: video → pose + theo dõi một người → ứng viên sự kiện
→ feature đúng phiên bản checkpoint → sáu lớp hoặc `unknown`.

Từ chối nếu thiếu frame, đứt tracking, thiếu torso, độ phủ từng khớp tay/torso
dưới 80% ở ngưỡng pose 0,3, không có ngưỡng calibration được hỗ trợ, xác suất
thấp hoặc dự đoán đổi nhãn khi phản chiếu pose. Ngưỡng coverage là quy tắc bằng
chứng kỹ thuật, không phải độ tin cậy đã học. Phản chiếu nhất quán cũng không
bảo đảm đúng; chính sách này cần đo precision và recall độc lập.

Kết quả có từng khoảng thời gian, nhãn, lý do từ chối và số ứng viên. `confidence`
vẫn null; softmax chỉ là `researchProbability` để chẩn đoán. Không có điểm kỹ
thuật. Không dùng số ứng viên làm tổng số đòn thật, không tính sự kiện bỏ sót
thành từ chối đúng.

Metric mới tính FP cho dự đoán dư, FN cho bỏ sót/từ chối, FP+FN cho sai loại.
Matching theo lớp là một-một với IoU thời gian. Báo cáo cả IoU 0,1/0,3/0,5;
không thay ngưỡng để làm điểm đẹp hơn. Adam là video train nên chỉ dùng regression.

Baseline Adam: 19 ứng viên; 11/18 khớp ở IoU 0,1, 5/18 ở IoU 0,5. Chính sách
từ chối mới giữ hai dự đoán cross nhưng không khớp sự kiện cross nguồn ở các
ngưỡng đã đo. Điều này cho thấy phải sửa cả event localization và classifier.
[Regression baseline](../python-worker/benchmark_results/adam_video_recognition_baseline_20261006.json).

B0 mới từ chối cả 19 ứng viên Adam. B1 nhận năm ứng viên nhưng không có nhận
diện đúng theo lớp và khoảng frame ở cả IoU 0,1/0,3/0,5. Đã đối chiếu trực tiếp
frame của năm dự đoán với CSV nguồn, không chỉ dựa vào một số tổng hợp.
Đây là thất bại ở video đã thuộc train, nên chắc chắn chưa đủ chứng minh ứng dụng.
[B0 video](../python-worker/benchmark_results/adam_video_recognition_v6_primary_20261006.json),
[B1 video](../python-worker/benchmark_results/adam_video_recognition_v6_secondary_20261006.json).

Kiểm chứng: 22 test pass (V6, phản chiếu, từ chối, metric tính FP/FN, checkpoint),
24 checkpoint CV qua roundtrip, hai checkpoint refit nạp lại có logits tương
đương, toàn bộ hash source đóng băng còn khớp, checkpoint lịch sử vẫn nạp được.
`git diff --check` toàn repo còn báo khoảng trắng trong file kiểm thử notifications
ngoài phạm vi công việc này; không sửa thay đổi đó.

## Cách chạy lại

Từ thư mục `python-worker`, dùng Python trong `.venv`:

```powershell
.\.venv\Scripts\python.exe run_v6_reflection.py --manifest test_results/provisional_dataset/20261006_v6_recovered_v2/manifest.json --output test_results/temporal_ablations/NEW_RUN
.\.venv\Scripts\python.exe recognize_boxing_video.py --video VIDEO.mp4 --checkpoint test_results/temporal_ablations/20261006_v6_reflection_v1/selected --output test_results/video_recognition/NEW_VIDEO
```

Có thể truyền `--pose-cache` cho cache được xác minh SHA256 video và weights.
Không ghi đè run đã hoàn tất; output mới là bắt buộc. Dataset/model/report đều
có hash. Pipeline v1 lịch sử được giữ nguyên để checkpoint cũ vẫn nạp được.

## Những gì cần đạt để nghiệm thu phạm vi này

Giữ các mục phù hợp trong [reliability plan](AI_COACHING_RELIABILITY_PLAN.md):
event precision/recall/F1 ≥ 0,90; macro-F1 sáu lớp ≥ 0,85, báo cáo rõ từng lớp;
ECE ≤ 0,05 nếu hiển thị xác suất; đánh giá video/nhóm góc quay độc lập. Phải
tính cả `unknown`, sự kiện bỏ sót và dự đoán dư, không chỉ accuracy trên số
ít mẫu được nhận. Các gate impact timing, form quality và coaching không nằm
trong yêu cầu nhận diện sáu loại đòn này.

Hướng dữ liệu tiếp theo đã có căn cứ: trích lại nguồn RGB bằng pipeline YOLO
thống nhất; bổ sung annotation đầy đủ khoảng không ra đòn và ranh giới sự kiện;
giữ riêng video mới để nghiệm thu cả chuỗi. Tăng epoch trên skeleton cũ không
giải quyết hai khoảng trống này.

Nguồn bổ sung đã khảo sát: [BoxMAC](https://arxiv.org/html/2412.18204v1) có sáu
loại đòn và hành động khác, nhưng là đa nhãn trên hai võ sĩ, không tự động thành
nhãn của một track. [Olympic Boxing](https://github.com/piotr-stefanski/boxing-fight-video-analysis)
có dữ liệu do trọng tài gán nhãn; cần kiểm tra taxonomy, track và stance trước
khi nhập. Chưa tải hay coi những nguồn này là tập nghiệm thu đã có.
