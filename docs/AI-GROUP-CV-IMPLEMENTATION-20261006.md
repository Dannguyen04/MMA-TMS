# Thực thi thí nghiệm temporal AI theo nhóm nguồn

Đã hoàn tất 36 lượt CV và một lượt refit; xem
[kết quả thực đo và quyết định](AI-GROUP-CV-RESULTS-20261006.md).

## Phạm vi triển khai

Runner `python-worker/run_temporal_ablations.py` thực hiện A0–A3 trên ba fold,
mỗi fold ba seed. Mọi ứng viên dùng cùng manifest nhãn Adam gốc, 40 epoch tối đa,
patience 10, batch 128, AdamW lr/weight decay 0,001. Dữ liệu calibration và các
video diagnostic không vào lựa chọn ứng viên.

Các module model/feature v1 và checkpoint cũ được giữ nguyên. Code thử nghiệm ở
`pipeline/temporal_experiments.py`; không thay cấu hình model active của worker.

## Bốn cấu hình đã khóa trước khi chạy

| Cấu hình | Thay đổi |
| --- | --- |
| A0 baseline | Residual TCN, permutation từng epoch, CE với trọng số mẫu × cân bằng lớp |
| A1 source sampler | Lấy mẫu có hoàn lại, số draw bằng số mẫu train; tổng xác suất mỗi lớp bằng nhau, tăng phần nguồn ít mẫu theo căn bậc hai với hệ số tối đa 3 |
| A2 pose noise | Baseline + nhiễu Gaussian std 0,015 theo đơn vị torso, xác suất 0,35/clip làm mất một khớp khuỷu/cổ tay trong 2–5 frame |
| A3 auxiliary | Baseline + loss họ đòn và lead/rear, mỗi loss phụ hệ số 0,2; đầu ra inference vẫn là head sáu lớp |

A1 đưa độ tin cậy tương đối của nhãn vào xác suất lấy mẫu đúng một lần; batch
sampled dùng CE không nhân lại class/sample weight. Đây là cân bằng nguồn có
giới hạn, không ép mọi nguồn bằng nhau hoặc nhân bản Adam không giới hạn.
Sampler và loss thay đổi cùng nhau để biểu diễn mục tiêu này; không diễn giải
kết quả như đã cô lập riêng tác dụng của sampling randomness.

A2 chỉ áp dụng khi train: không sửa tensor gốc, không sửa nhãn hoặc split. Giữ
missing mask vốn có, không dropout torso, đặt tọa độ missing về 0 và tính lại
velocity. Velocity qua ranh giới missing cũng về 0. Không flip tay, không biến
2D rotation thành bằng chứng góc nhìn 3D, không tạo nhãn background giả.

A3 lấy nhãn phụ trực tiếp từ taxonomy gốc: jab/cross → straight, hai hook → hook,
hai uppercut → uppercut; lead/rear theo nhãn nguồn. Đây không phải stance hoặc
side được xác minh độc lập. Backbone khởi tạo giống A0 với cùng seed; RNG cho
thứ tự mẫu, augmentation và dropout tách riêng để dễ tái lập.

## Chọn ứng viên và huấn luyện lại

1. Mỗi CV run chọn epoch có macro-F1 validation tốt nhất trên đủ sáu lớp; hòa thì
   giữ epoch sớm nhất. Không cho V5/V8/V9/V10 vào hàm fit CV.
2. Trung bình macro-F1 qua ba seed và ba fold; fold có trọng số bằng nhau. Hòa
   thì dùng macro-F1 trung bình seed của nguồn kém nhất. Báo cả per-class,
   per-source và độ biến thiên seed; các nguồn thiếu lớp vẫn có support rõ ràng.
3. Ghi `selection.json` trước refit/calibration/diagnostic. Chọn seed refit cố định
   20261006; số epoch là median bestEpoch của chín CV run ứng viên thắng, làm tròn
   bằng NumPy rint. Không dùng V8 chọn lại seed hoặc epoch.
4. Refit trên đủ 3.681 mẫu train. A3 lưu cả weights có auxiliary head và export
   weights head chính tương thích residual TCN v1. Mọi run kiểm tra dự đoán bằng
   model đọc lại từ numeric NPZ trước khi ghi nhận thành công.
5. Sau refit, fit temperature và policy trên V5; V8/V9/V10 chỉ là diagnostic.
   Nạp checkpoint được chọn bằng loader thực có checksum và source contract.

Ba fold development chưa độc lập theo võ sĩ; chưa có metadata để khẳng định.
Chọn epoch và so sánh ứng viên trên cùng fold vẫn có selection bias. Không suy
độ lệch chuẩn seed thành khoảng tin cậy theo người. Policy calibration trên một
video V5 đã quan sát vẫn chưa được bảo đảm khi đổi nguồn.

## Chạy và artifact

Chạy tại `python-worker`:

```powershell
& '.\.venv\Scripts\python.exe' run_temporal_ablations.py --manifest test_results/provisional_dataset/20261006_adam_source_v1/manifest.json --fold-plan benchmark_results/proposed_development_folds_20261006.json --output test_results/temporal_ablations/new_group_run
```

`configuration.json` lưu hash code, manifest, fold plan và hyperparameter trước
khi train. `progress.json` ghi số CV run đã hoàn tất. Mỗi run có `training.json`,
`model.npz`, `validation_predictions.npz`; A3 thêm `training_model.npz`.
`selection.json` và `selected/` lưu quyết định/refit cuối; `report.json` tổng hợp
khi toàn bộ việc huấn luyện và kiểm tra checkpoint hoàn tất.

Có thể tiếp tục bỏ qua các CV run đã hoàn tất nếu configuration và weights hash
khớp. Run dở có thư mục nhưng chưa có report sẽ bị từ chối ghi đè; dùng output
mới hoặc xử lý riêng sau khi kiểm tra. Experiment hoàn tất là bất biến.

## Kiểm chứng code

20 kiểm thử đạt trước lượt chạy thật, gồm:

- Sampler cân bằng tổng xác suất lớp, giữ tỷ lệ reliability trong cùng nguồn,
  tăng phần nguồn nhỏ có giới hạn và từ chối thiếu lớp.
- Augmentation có thể tái lập, không sửa input, giữ missingness và không tạo
  velocity giả qua khoảng mất khớp.
- Fold audit từ chối nguồn chồng nhau, thiếu nguồn, số lượng sai, fold lặp và
  nguồn calibration vào CV; bộ manifest thật phải khớp hash.
- Auxiliary head nhận gradient; export head chính giữ dự đoán; refit không dùng
  validation và giữ đúng epoch cuối đã định trước.
- Kiểm thử nhãn Adam, loss, chọn epoch và loader từ lượt trước vẫn đạt.

Hai kiểm thử bổ sung về tổng hợp fold có trọng số bằng nhau và khôi phục epoch
tốt nhất trong runner CV mới cũng đạt: tổng cộng 22 test case liên quan đã qua.

`build_cv_review_queue.py` tạo hàng đợi review từ dự đoán ngoài fold của ứng viên
được chọn, tối đa 6 mẫu mỗi nguồn và ưu tiên đa dạng cặp nhãn bị nhầm. Điểm xếp
hàng là score ensemble chưa hiệu chuẩn, không phải confidence đã kiểm định.
Queue không có Adam, không sửa annotation, không xác nhận HLV. Cần RGB gốc để
kiểm tra nguyên nhân lỗi; bất đồng model/nguồn không tự chứng minh nguồn sai.

Đây là triển khai phần thực nghiệm chạy được với dữ liệu hiện có. Thu thập video
mới, huấn luyện detector trên background/ranh giới đầy đủ và đánh giá kỹ thuật
cần dữ liệu tương ứng, chưa được coi là hoàn tất bởi runner này.
