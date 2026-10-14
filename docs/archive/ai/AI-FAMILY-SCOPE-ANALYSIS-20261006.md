# Phân tích phạm vi họ đòn (3 lớp) cho B0/B1

Ngày: 2026-10-06. Trạng thái: **nghiên cứu, không train, không thay đổi checkpoint/runtime**.

Câu hỏi: nếu thu hẹp sản phẩm từ 6 loại đòn xuống 3 họ (straight = jab + cross,
hook = lead hook + rear hook, uppercut = lead uppercut + rear uppercut) thì có
gần ngưỡng nghiệm thu macro-F1 ≥ 0,85 không?

Kết luận ngắn: **thu hẹp phạm vi giúp rõ rệt ở V8 và V9 nhưng không giải quyết
được V10, nên gộp V9+V10 vẫn chỉ đạt macro-F1 0,7056 (B0), còn xa 0,85.** CV theo
nguồn trung bình 0,5798, kém xa hơn nữa. Từ chối theo ngưỡng không cứu được V10
vì mô hình sai V10 với độ tin cậy cao.

## Phương pháp và ràng buộc

- Không train gì. Họ = tổng xác suất softmax 6 lớp trong từng họ (nhiệt độ của
  checkpoint, 0,913), chọn họ có tổng lớn nhất. Đây không phải đầu 3 lớp được huấn
  luyện; một đầu 3 lớp riêng có thể khác.
- Kiểm tra hash trước khi dùng (script dừng nếu lệch):
  - B0 `3fa9cf2195615220a1ca4149cb018d5cd56bed10cb53912ebb8cdf5181aaccd9` khớp.
  - B1 `45f2f8fd345ddf0504850d46855ad4ca07c0a9aab0fa562aaa14b6751218ffa4` khớp.
  - Manifest `bcbb417c1eafa1a0c1d40db26021cd3c17a631af4adb2cc41ab669d34b91769b`
    khớp `manifestSha256` trong report của cả hai checkpoint.
  - Nạp qua `load_temporal_checkpoint` (kiểm tra thêm hash mã nguồn). Suy luận lại
    trên feature đã lưu tái tạo đúng macro-F1 sáu lớp V9/V10 đã lưu (0,5417 B0,
    0,4491 B1); script sẽ dừng nếu không khớp.
- Không có dự đoán từng mẫu được lưu trong `benchmark_results/*.json` (chỉ ma trận
  nhầm lẫn 6x6), nên phải chạy lại **suy luận** (không phải huấn luyện) để có
  xác suất. Dự đoán từng mẫu được ghi ở
  `python-worker/test_results/family_scope_20261006/sample_predictions.csv`.
- **V9/V10 là diagnostic đã quan sát**, không phải test độc lập. V8 và V9/V10 được
  xem sau khi chọn cấu hình; V5 chỉ dùng hiệu chuẩn/chọn ngưỡng. Việc gộp họ này là
  đọc lại sau khi đã biết dữ liệu, nên mọi con số tốt ở đây cần xem là giả thuyết.
- Khoảng tin cậy bootstrap bên dưới coi clip độc lập (clip cùng video tương quan)
  nên **quá lạc quan**. Nguồn chưa được xác minh là các võ sĩ độc lập.
- Clip đã cắt sẵn, toàn mẫu dương: không đo phát hiện sự kiện liên tục, không có
  lớp "không đòn". Phạm vi họ không thay đổi điều này.

## 1. Macro-F1 sáu lớp so với ba họ

Gate phát hành: macro-F1 ≥ 0,85. Số liệu từ
[family_scope_analysis_20261006.json](../../../python-worker/benchmark_results/family_scope_analysis_20261006.json).

### B0 (checkpoint chính)

| Tập | Clip | Acc 6 lớp | Macro-F1 6 lớp | Acc 3 họ | **Macro-F1 3 họ** | Bootstrap 95% (lạc quan) | Acc đoán họ đa số |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| V8 validation | 199 | 0,8593 | 0,7271 | 0,8945 | **0,8941** | 0,849–0,933 | 0,442 |
| V5 calibration (tham khảo) | 595 | 0,8605 | 0,8153 | 0,8706 | 0,8266 | 0,791–0,860 | 0,629 |
| V9 diagnostic | 149 | 0,8054 | 0,7781 | 0,9329 | **0,9305** | 0,885–0,969 | 0,403 |
| V10 diagnostic | 151 | 0,2715 | 0,3075 | 0,4437 | **0,4647** | 0,404–0,520 | 0,563 |
| V9+V10 (300) | 300 | 0,5367 | 0,5417 | 0,6867 | **0,7056** | 0,656–0,753 | 0,477 |

Chú ý V10: accuracy 3 họ (0,4437) **thấp hơn** việc luôn đoán "straight"
(0,563), vì mô hình gần như không bao giờ đoán straight ở V10.

### B1 (thăm dò, không phải checkpoint chính)

| Tập | Acc 6 lớp | Macro-F1 6 lớp | Acc 3 họ | **Macro-F1 3 họ** |
| --- | ---: | ---: | ---: | ---: |
| V8 validation | 0,6834 | 0,6020 | 0,7035 | 0,7064 |
| V5 calibration | 0,8655 | 0,7692 | 0,8992 | 0,8531 |
| V9 | 0,6040 | 0,5829 | 0,9530 | 0,9461 |
| V10 | 0,3113 | 0,2937 | 0,4238 | 0,4086 |
| V9+V10 | 0,4567 | 0,4491 | 0,6867 | 0,6854 |

B1 tốt hơn B0 ở V9 họ nhưng tệ hơn rõ ở V8 (hook recall 0,466, 32/88 hook bị
đoán thành uppercut). Nó không cải thiện V10 và không nên được chọn lại vì kết quả
này (đó sẽ là chọn theo dữ liệu đã quan sát).

### Per-class (B0, ba họ)

| Tập | Họ | Support | Precision | Recall | F1 |
| --- | --- | ---: | ---: | ---: | ---: |
| V8 | straight | 57 | 0,855 | 0,825 | 0,839 |
| V8 | hook | 88 | 0,907 | 0,886 | 0,897 |
| V8 | uppercut | 54 | 0,914 | 0,981 | 0,946 |
| V9 | straight | 58 | 1,000 | 0,862 | 0,926 |
| V9 | hook | 31 | 0,906 | 0,935 | 0,921 |
| V9 | uppercut | 60 | 0,896 | 1,000 | 0,945 |
| V10 | straight | 85 | 1,000 | **0,047** | 0,090 |
| V10 | hook | 31 | 0,744 | 0,935 | 0,829 |
| V10 | uppercut | 35 | 0,315 | 0,971 | 0,476 |
| V9+V10 | straight | 143 | 1,000 | 0,378 | 0,548 |
| V9+V10 | hook | 62 | 0,817 | 0,935 | 0,872 |
| V9+V10 | uppercut | 95 | 0,537 | 0,989 | 0,696 |

Ma trận nhầm lẫn B0 (hàng = thật, cột = đoán; straight, hook, uppercut):

| Tập | Ma trận |
| --- | --- |
| V8 | [[47, 7, 3], [8, 78, 2], [0, 1, 53]] |
| V9 | [[50, 3, 5], [0, 29, 2], [0, 0, 60]] |
| V10 | [[4, 9, 72], [0, 29, 2], [0, 1, 34]] |
| V9+V10 | [[54, 12, 77], [0, 58, 4], [0, 1, 94]] |

Ma trận B1 và per-class đầy đủ nằm trong file JSON.

Lỗi chủ yếu: **72/85 clip straight của V10 bị đoán là uppercut** (47/49 jab của
V10 theo ma trận 6 lớp bị đoán là lead uppercut). Trong 77 straight bị bỏ sót ở V9+V10,
72 đến từ V10. Chúng ta không có bằng chứng nguyên nhân (FPS 25, góc quay, hay
chất lượng pose của V10); đó là giả thuyết chưa kiểm chứng.

### Từng fold CV theo nguồn

Dự đoán out-of-fold của 24 lượt CV **đã được lưu** (`validation_predictions.npz`
trong từng thư mục run), nên không cần chạy lại. Dùng logit nhiệt độ 1,0; macro-F1
trung bình ba seed, chỉ tính lớp/họ có support. Các số 6 lớp tái tạo đúng báo cáo
cũ (B0 0,5092; B1 0,5048).

| Fold (nguồn) | Clip | Macro-F1 6 lớp B0 | **Macro-F1 3 họ B0** | Acc 3 họ B0 | Macro-F1 3 họ B1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 (V1) | 1863 | 0,4616 | 0,5342 | 0,5777 | 0,4438 |
| 2 (V2+V3) | 1043 | 0,5718 | 0,5990 | 0,6814 | 0,5166 |
| 3 (V4+V7) | 754 | 0,2514 | 0,3824 | 0,4248 | 0,5293 |
| 4 (V6, chỉ hook/uppercut) | 685 | 0,7520 | 0,8039 | 0,7791 | 0,8408 |
| **Trung bình bốn fold** | | **0,5092** | **0,5798** | | **0,5826** |

Chỉ fold 4 (V6) vượt 0,80, và V6 không có straight (hai họ có support) nên là bài
toán dễ hơn. Không fold nào ≥ 0,85. Fold tệ nhất (V4+V7) chỉ 0,38 với B0. Theo
nguồn: V4 0,252 (6 lớp 0,0773), V1 0,5342. Đây là điểm yếu sau khi thu hẹp, và các
mô hình CV này đã tham gia chọn B0/B1 nên điểm bị lạc quan thêm.

## 2. Chỉ riêng bên (lead/rear), có điều kiện đúng họ

Điều kiện: chỉ tính các clip mà họ đã đoán đúng.

| Tập (B0) | Đúng họ | Đúng cả bên | Accuracy bên | Lỗi sai họ | Lỗi đúng họ sai bên |
| --- | ---: | ---: | ---: | ---: | ---: |
| V8 | 178 | 171 | 0,961 | 21 | 7 |
| V5 | 518 | 512 | 0,988 | 77 | 6 |
| V9 | 137 | 120 | 0,876 | 12 | 17 |
| V10 | 67 | 41 | 0,612 | 84 | 26 |
| V9+V10 | 204 | 161 | 0,789 | 96 | 43 |

(Ở bảng này "đúng họ" lấy từ argmax sáu lớp; hơi khác argmax tổng xác suất họ ở
mục 1: V9 12 so với 10 lỗi họ.)

- Trên V9+V10, 139 lỗi sáu lớp = 96 sai họ + 43 đúng họ sai bên. Gộp họ chỉ loại
  được 43/139 (31%) lỗi; **phần lớn lỗi vẫn là sai họ**, khớp phân tích trước
  (86/128 sai họ).
- Bên khá đáng tin khi họ đúng ở V8/V5 (≥ 96%), nhưng giảm ở V9 (0,876, chủ yếu
  15 cross bị đoán là jab) và rất kém ở V10 (0,612, mẫu nhỏ: 67 clip, chỉ 4
  straight đúng họ).
- Ở B0 trên V9, straight chỉ đúng bên 33/48; B1 còn tệ hơn (side 0,634 ở V9,
  25/52 straight). Lead/rear cho straight (jab vs cross) là chỗ yếu nhất; cross chỉ
  đúng 5/63 trên V9+V10 với B0. Vì vậy phạm vi họ còn có lợi ích riêng: tránh hứa
  hẹn jab vs cross.

## 3. Từ chối (abstention) ở mức họ

Ngưỡng chọn **chỉ trên V5**; độ tin cậy = max tổng xác suất họ. Hai quy tắc: (a)
precision điểm ≥ 0,90 với độ phủ lớn nhất (tối thiểu 30 mẫu giữ); (b) cận dưới
Wilson 95% ≥ 0,90 (quy tắc sẵn có của repo, thận trọng hơn). V5 không từ chối đã có
acc họ 0,8706.

### B0

| Quy tắc | Ngưỡng | V5 giữ | V5 precision |
| --- | ---: | ---: | ---: |
| (a) điểm ≥ 0,90 | 0,5501 | 552/595 | 0,9004 |
| (b) Wilson ≥ 0,90 | 0,6649 | 502/595 | 0,9263 |

Áp dụng ngưỡng cố định (không điều chỉnh trên V8/V9/V10):

| Tập | (a) Phủ | (a) Precision | (a) F1 tính từ chối là bỏ sót | (b) Phủ | (b) Precision | (b) F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| V8 | 0,990 | 0,9036 | 0,8998 | 0,935 | 0,9355 | 0,9037 |
| V9 | 0,926 | 0,9493 | 0,9163 | 0,812 | 0,9504 | 0,8438 |
| V10 | 0,993 | **0,4400** | 0,4574 | 0,934 | **0,4539** | 0,4633 |
| V9+V10 | 0,960 | 0,6840 | 0,6898 | 0,873 | 0,6832 | 0,6508 |

Từ chối **không giúp V10**: 84 dự đoán họ sai ở V10 có độ tin cậy trung bình 0,935
(trung vị 0,986), bằng mức của dự đoán đúng (0,930); 66/84 có độ tin ≥ 0,9. Ngưỡng
chỉ giữ precision ở V9 (0,95) vì ở đó lỗi sai có độ tin thấp (trung bình 0,64, không
lỗi nào ≥ 0,9). So với chính sách sáu lớp đã lưu của B0 (giữ 239/300 với 57,3%
đúng), mức họ tốt hơn rõ nhưng 0,68 vẫn xa mục tiêu 0,90 và không được đảm bảo
cho nguồn mới.

Ghi chú B1: ngưỡng (a) trên V5 là 0,387 (giữ 99,8%, thực chất không từ chối) và
precision V9+V10 0,689; ngưỡng Wilson 0,6217 cho V9+V10 giữ 0,907, precision 0,7243,
V10 0,4593. Cùng kết luận.

## 4. So với 6 lớp và gate

| Chỉ số B0 | 6 lớp | 3 họ | Gate | Khoảng cách (3 họ) |
| --- | ---: | ---: | ---: | ---: |
| V8 macro-F1 | 0,7271 | 0,8941 | 0,85 | đạt (+0,044), CI 0,849–0,933 |
| V9 macro-F1 | 0,7781 | 0,9305 | 0,85 | đạt |
| V10 macro-F1 | 0,3075 | 0,4647 | 0,85 | thiếu 0,385 |
| V9+V10 macro-F1 | 0,5417 | 0,7056 | 0,85 | thiếu 0,144 |
| V5 macro-F1 (hiệu chuẩn) | 0,8153 | 0,8266 | 0,85 | thiếu 0,023 |
| CV bốn nguồn (trung bình) | 0,5092 | 0,5798 | 0,85 | thiếu 0,270 |
| CV fold tệ nhất | 0,2514 | 0,3824 | 0,85 | thiếu 0,468 |

Trả lời thẳng:

1. Phạm vi họ **cải thiện số đo** ở mọi tập (V9+V10 +0,164 macro-F1, CV +0,071),
   chủ yếu vì loại lỗi lead/rear mà cross/jab gây ra. Với V8 và V9 nó vượt 0,85,
   nhưng V8/V9 đã được quan sát và V8 vượt gate sát sườn với CI chạm 0,849.
2. **V10 vẫn là vấn đề chính** và không phải vì lỗi bên tay: họ vẫn sai 84/151
   clip (macro-F1 0,465). Mô hình đoán uppercut cho straight với độ tin cậy rất cao,
   nên từ chối ngưỡng xác suất không bắt được lỗi đó.
3. Gộp V9+V10 (0,7056) **vẫn xa gate 0,85**, và CV trên nguồn mới (0,5798, tệ nhất
   0,3824) cho thấy mô hình chưa tổng quát hóa qua nguồn ngay cả ở mức họ. Gate cũng
   còn yêu cầu F1 sự kiện ≥ 0,90 trên video liên tục, ECE ≤ 0,05 (ECE hiện 0,32 ở 6
   lớp) và nhóm góc quay độc lập; không có mục nào được đáp ứng bởi phân tích này.

## Hệ quả đề xuất (không phải quyết định)

- Không công bố "đã đạt gate" cho phạm vi họ. Không nên coi thu hẹp phạm vi là sửa
  được chỗ yếu; nó che bớt lỗi bên tay nhưng không sửa lỗi sai họ theo nguồn.
- Nếu muốn thu hẹp phạm vi sản phẩm, nên coi họ là mục tiêu hiển thị tạm với cảnh
  báo "nghiên cứu", và vẫn yêu cầu dữ liệu video mới, độc lập, có annotation đầy
  đủ để nghiệm thu. Điều tra V10 trước (FPS 25, chất lượng pose, phân bố nhãn)
  trước khi tin rằng 0,93 ở V9 sẽ lặp lại ở nguồn mới.
- Bài kiểm tra tiếp theo hợp lý, chưa làm vì ngoài phạm vi: huấn luyện đầu 3 họ
  riêng trên cùng CV theo nguồn, rồi đánh giá trên video mới giữ riêng. Không
  nên so kết quả đó với diagnostic V9/V10 hiện tại như bằng chứng độc lập.

## Cách tái tạo

```powershell
cd python-worker
.\.venv\Scripts\python.exe analyze_family_scope.py   # từ chối ghi đè output cũ
```

Tệp mới: `python-worker/analyze_family_scope.py`,
`python-worker/benchmark_results/family_scope_analysis_20261006.json`,
`python-worker/test_results/family_scope_20261006/sample_predictions.csv`. Không sửa
tệp có sẵn.
