# Kết quả triển khai A0–A3 theo nhóm nguồn — 2026-10-06

Đã hoàn tất **36 lượt cross-validation và một lượt refit**, khoảng 19,8 phút
huấn luyện CPU. A3 auxiliary có điểm CV cao nhất và được chọn đúng quy tắc đã
khóa, nhưng mức tăng nhỏ và kết quả chẩn đoán sau refit kém checkpoint lịch sử.
**Chưa có bằng chứng để đưa model mới vào ứng dụng hoặc tuyên bố cải thiện ổn định.**

## Kết quả so sánh cùng protocol

Mỗi cấu hình dùng cùng ba fold, ba seed, tối đa 40 epoch và patience 10. Các fold
đều đủ sáu lớp; chỉ dùng các nguồn train lịch sử. Đủ 18 nhãn Adam gốc giữ nguyên
và nằm trong train của mọi fold. V5, V8, V9/V10 không tham gia chọn ứng viên.

| Cấu hình | Macro-F1 trung bình fold/seed | Chênh so A0 | F1 rear hook trung bình fold/seed | Macro-F1 nguồn kém nhất |
| --- | ---: | ---: | ---: | ---: |
| A0 baseline | 0,4151 | — | 0,1741 | 0,0854 |
| A1 sampler theo nguồn | 0,4102 | −0,0048 | 0,1722 | 0,0841 |
| A2 nhiễu/mất khớp pose | 0,4163 | +0,0013 | 0,2863 | 0,1633 |
| **A3 nhánh phụ họ đòn + lead/rear** | **0,4187** | **+0,0036** | **0,2767** | **0,1717** |

Chênh lệch là điểm tuyệt đối macro-F1, không phải phần trăm accuracy. Mỗi fold
được tính trọng số bằng nhau. F1 từng lớp ở đây là trung bình theo fold và seed,
không phải F1 gộp tất cả dự đoán. Không có kiểm định độc lập chứng minh mức tăng
0,0036 có ý nghĩa; epoch và ứng viên đều được chọn trên development folds.

| Fold validation | A0 mean ± seed std | A3 mean ± seed std |
| --- | ---: | ---: |
| V1 | 0,4664 ± 0,0732 | 0,4651 ± 0,0125 |
| V2 + V3 | 0,5457 ± 0,0471 | 0,5348 ± 0,0162 |
| V4 + V7 | 0,2331 ± 0,0028 | 0,2562 ± 0,0165 |

Độ lệch chuẩn seed không phải khoảng tin cậy theo võ sĩ. A3 cải thiện nhóm cuối
nhưng không tốt hơn ở hai fold đầu. Theo từng nguồn, V4 tăng macro-F1 từ 0,0854
lên 0,1717, còn V7 giảm từ 0,5018 xuống 0,3764. F1 lead uppercut giảm từ 0,2316
xuống 0,1978 và rear uppercut từ 0,4706 xuống 0,4016. Không gọi A3 là cải thiện
toàn diện chỉ vì rear hook hoặc trung bình tổng tăng.

## Refit được chọn bằng CV

- Cấu hình A3; seed cố định 20261006 theo protocol trước khi chạy.
- 34 epoch, bằng median bestEpoch của chín lượt A3; không chọn lại bằng V8.
- Train đủ 3.681 mẫu, giữ nhãn/trọng số provenance gốc.
- Xuất head chính sáu lớp thành checkpoint residual TCN v1, tương thích loader
  cũ; lưu riêng weights có nhánh phụ để truy nguyên. Không đổi feature version.
- Đóng băng `selection.json` trước refit/calibration/diagnostic.

| Tập sau refit | Accuracy khớp nhãn nguồn | Macro-F1 | ECE sau hiệu chuẩn |
| --- | ---: | ---: | ---: |
| V8, diagnostic lịch sử | 89,95% | 0,7394 | 0,0288 |
| V5, dùng hiệu chuẩn | 91,26% | 0,8482 | 0,0348 |
| V9/V10, diagnostic đã quan sát | 52,67% | 0,4298 | 0,2434 |

V9 riêng: accuracy 73,15%, macro-F1 0,5629. V10 riêng: accuracy 32,45%, macro-F1
0,2557. Rear hook trên V9/V10 không nhận đúng mẫu nào trong 17 mẫu nguồn.

Checkpoint lịch sử chọn bằng V8 có macro-F1 V9/V10 0,5146, cao hơn refit mới
0,4298. Đây là so sánh hai artifact thực tế, **không phải ablation cô lập tác dụng
của auxiliary head**, vì seed và cách chọn số epoch cũng khác. Phép so sánh A0–A3
có kiểm soát là bảng CV phía trên. Không đổi người thắng CV dựa vào V9/V10 sau
khi xem kết quả; cả checkpoint cũ lẫn mới vẫn là model nghiên cứu.

Temperature = 1,126398; threshold = 0,509911, chọn trên V5. Policy chấp nhận
583/595 mẫu calibration, đúng 539/583. Trên V9/V10, policy chấp nhận 271/300 mẫu,
chỉ đúng 56,83% trong phần chấp nhận. Ngưỡng này không bảo đảm mục tiêu precision
trên nguồn khác. Không dùng score đó làm confidence đã kiểm định trong sản phẩm.

## Những gì đã triển khai và kiểm chứng

- `run_temporal_ablations.py`: audit fold/hash, chạy đối chứng, chọn bằng CV,
  refit cố định, hiệu chuẩn riêng và xuất report/checkpoint có provenance.
- `pipeline/temporal_experiments.py`: sampler có giới hạn theo nguồn, augmentation
  giữ mask/velocity và auxiliary heads chỉ dùng trong train.
- `build_cv_review_queue.py`: hàng đợi review từ dự đoán ngoài fold, liên kết về
  ID dòng và ranh giới frame CSV; không ghi đè nhãn.
- **22 test case liên quan đã đạt**, gồm sampler, augmentation, ngăn rò rỉ nguồn,
  chọn/khôi phục epoch, refit, tổng hợp metric và các kiểm thử dataset/loader cũ.
- 36 checkpoint CV kiểm tra numeric NPZ và dự đoán tương đương sau nạp lại;
  refit cũng qua roundtrip và loader thực. Đã kiểm tra hash cả 36 checkpoint,
  11 source file của experiment và việc checkpoint lịch sử vẫn nạp được.

## Danh sách review tiếp theo

Đã tạo **30 mục, 6 mục mỗi nguồn V1/V2/V3/V4/V7**, từ 1.663 bất đồng giữa dự đoán
ensemble ngoài fold của A3 và nhãn nguồn. Mỗi nguồn ưu tiên một lỗi rear hook
nếu có, sau đó chọn đa dạng cặp nhãn nhầm. Đây là hàng đợi cần xác minh, không
phải 30 nhãn sửa tự động hoặc nhãn HLV đã xác nhận. Adam không nằm trong queue.

[Hàng đợi review và frame nguồn](../python-worker/benchmark_results/group_cv_review_queue_20261006.json).
Cần video RGB gốc để xác minh kỹ thuật/stance/ánh xạ annotation; skeleton và
model disagreement chưa đủ kết luận nhãn nguồn sai. Ưu tiên kiểm tra V4 và bổ
sung dữ liệu các điều kiện đang thiếu, thay vì tiếp tục chọn hyperparameter
theo kết quả V9/V10.

## Artifact và tái lập

[Báo cáo máy đọc đầy đủ](../python-worker/benchmark_results/temporal_group_cv_20261006.json).

Thư mục experiment:
`python-worker/test_results/temporal_ablations/20261006_group_cv_v1/`.

Checkpoint refit:
`selected/model.npz`, SHA-256
`636594a2f03c1cc0b5ab6a97cfd2be81b03bb286b050f114a0dac06f00847211`.
Lưu `selected/report.json` và `configuration.json` thư mục cha cùng checkpoint
khi chuyển máy; nạp qua `load_temporal_checkpoint`.

Giữ nguyên manifest, fold plan và các báo cáo lịch sử. Trạng thái
`PROPOSED_NOT_TRAINED` trong file fold plan là snapshot lúc thiết kế; báo cáo
experiment hiện tại ghi `CV_AND_REFIT_COMPLETED` cùng hash tham chiếu plan đó.

[Cấu hình chi tiết và lệnh chạy](AI-GROUP-CV-IMPLEMENTATION-20261006.md).

Phần thử nghiệm A0–A3 đã hoàn tất. Thu thập video CLB mới, train feature v2 bằng
timestamp thật, train detector có background và đánh giá chất lượng kỹ thuật
vẫn cần dữ liệu tương ứng. Vòng này không gọi Gemini, không thay nhãn Adam,
không đổi model active, không triển khai production và không tạo dữ liệu HLV giả.
