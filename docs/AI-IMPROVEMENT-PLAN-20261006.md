# Phân tích lỗi và giải pháp AI sau lượt huấn luyện Adam

**Cập nhật sau khi triển khai:** A0–A3 đã được chạy đủ 36 lượt CV và refit theo
quy tắc chọn trước. A3 đứng đầu CV nhưng chưa cải thiện diagnostic; xem
[kết quả thực nghiệm](AI-GROUP-CV-RESULTS-20261006.md). Phần dưới giữ lại căn cứ
và kế hoạch đã lập trước thí nghiệm, không phải mô tả mọi bước vẫn chưa chạy.

Ngày 2026-10-06. Phân tích checkpoint seed 20261007, epoch 37 đã đóng băng.
Đã chạy lại dự đoán theo từng nguồn, đối chiếu metric với báo cáo huấn luyện,
kiểm tra trùng tensor và đọc nghiên cứu gốc. Chưa huấn luyện mô hình mới trong
lượt phân tích này; các thí nghiệm bên dưới là đề xuất có thứ tự.

**Quyết định đề xuất:** giữ residual TCN làm baseline; ưu tiên sửa cách đánh giá,
độ đa dạng nguồn và dữ liệu cùng pipeline YOLO. Chỉ thử model lớn hơn sau khi
có phép so sánh trên cùng dữ liệu và đủ nguồn đánh giá. Gemini dùng để hỗ trợ
review offline khi được cho phép, không trở thành nhãn chuẩn hoặc classifier runtime.

## 1. Những gì đã đo được

| Nhóm | Mẫu | Accuracy khớp nhãn nguồn | Macro-F1 6 lớp |
| --- | ---: | ---: | ---: |
| Train tổng | 3.681 | 96,63% | Xem JSON |
| Validation V8 | 199 | 92,96% | 0,7743 |
| Diagnostic V9 | 149 | 83,89% | 0,7086 |
| Diagnostic V10 | 151 | 31,13% | 0,3028 |
| Adam, đã thuộc train | 18 | 61,11% (11/18) | 0,6056 |

V10 tạo ra 104/128 lỗi của V9/V10. Ngưỡng confidence học ở V5 giữ 119 mẫu V9,
đúng 113 (94,96%); nhưng giữ 64 mẫu V10, chỉ đúng 23 (35,94%). Vì vậy tăng độ
tự tin hoặc chỉ hiệu chuẩn lại một scalar không giải quyết được lỗi nguồn này.
Không dùng V10 để thử hàng loạt ngưỡng rồi gọi kết quả là test độc lập.

Các phát hiện bổ sung:

- **Validation thiếu rear hook hoàn toàn.** Model vẫn bị phạt khi dự đoán nhầm
  mẫu khác thành rear hook, nhưng không được đo khả năng nhận đúng rear hook.
  Do đó chọn epoch chỉ bằng V8 là thiếu căn cứ cho lớp này.
- **Rear hook có 243 mẫu train**, so với 1.140 cross. Code đã dùng loss cân bằng
  lớp. Cần kiểm tra đa dạng nguồn/pose/quy ước nhãn; không thể quy toàn bộ lỗi
  cho việc chưa có class weight.
- **V1 chiếm 47,93% tổng trọng số hiệu dụng toàn tập train** sau cân bằng lớp;
  Adam chỉ 0,1722%, bao cát 0,0117%. Đây là tỷ trọng trong mục tiêu loss toàn tập,
  không phải phần trăm ảnh hưởng nhân quả lên weights; batch normalization của
  loss và độ lớn gradient có thể khác. 18 mẫu Adam chưa tạo ra dữ liệu thích nghi
  đủ đa dạng, kể cả khi tăng trọng số để model thuộc chúng.
- **86/128 lỗi là nhầm họ đòn** (straight/hook/uppercut); 42 lỗi còn lại là đúng
  họ nhưng sai lead/rear. Riêng 11/11 rear hook của V9 bị đoán lead uppercut.
  Cần kiểm tra chuyển động, góc nhìn và quy ước nguồn; đây không chứng minh nhãn
  V9 sai và không cho phép tự sửa nhãn.
- **Không có tensor feature trùng hoàn toàn** trong 4.775 mẫu. Kiểm tra này không
  loại trừ near-duplicate, các đoạn liền kề hoặc cùng võ sĩ giữa nhiều nguồn.
- Mask cổ tay của mirror đều bằng 1 theo tensor đang lưu; đó không phải bằng
  chứng pose hoàn hảo. Mirror chỉ giữ tọa độ; quality/confidence không tương
  đương output YOLO. Không so trực tiếp coverage này với coverage video đầy đủ.

[Bằng chứng máy đọc](../python-worker/benchmark_results/adam_source_error_analysis_20261006.json)
và [kết quả huấn luyện](AI-TRAINING-RESULTS-20261006.md). Mọi accuracy ở đây đo
khớp nhãn nguồn chưa xác nhận, trên clip có ranh giới cho sẵn; Adam chỉ đo fit.

## 2. Nguyên nhân: điều đã biết và giả thuyết cần kiểm tra

| Vấn đề | Mức bằng chứng | Phép kiểm tra / cách xử lý |
| --- | --- | --- |
| Chênh lệch hiệu quả giữa nguồn, V10 đặc biệt kém | Đã đo; nguyên nhân chưa cô lập | Kiểm tra joint order, hệ tọa độ, góc quay, stance, pose source, quy ước và ánh xạ hàng nhãn của V10; cần RGB gốc để xác minh kỹ thuật |
| Chọn model bằng V8 thiếu rear hook | Đã xác nhận trong manifest | Group validation nhiều nguồn, mỗi fold có đủ 6 lớp |
| Mirror chi phối tập train | Đã đo trọng số | So sánh sampler cân bằng theo nguồn và lớp; giới hạn lặp nguồn nhỏ |
| Feature làm mất thời gian vật lý và có khác biệt quality | Đã đọc code | Feature v2 từ YOLO có timestamp, kích thước ảnh, mask/confidence/velocity mask và root motion |
| Model cần hiểu thế thủ/tay trước sau rõ hơn | Có 42 lỗi cùng họ khác bên | Thử auxiliary head family/lead-rear; bổ sung stance metadata; không đoán stance chắc chắn khi không có bằng chứng |
| Model quá nhỏ hoặc cần Transformer | Chưa có bằng chứng | Chỉ thử kiến trúc khác trong ablation có kiểm soát |

Code cũ **đã trừ tâm hông và chuẩn hóa torso**. Chuẩn hóa không tự đảm bảo tọa
độ nằm trong [-1,1], không loại hết khác biệt phối cảnh và không bảo đảm tăng
accuracy. Feature v1 ép cả clip về 25 bước; velocity là chênh tọa độ mỗi bước,
không phải vận tốc theo giây. Normalizer v2 đã tồn tại nhưng cần dữ liệu có metadata
tương thích để huấn luyện; không đổi preprocessing của checkpoint v1 khi inference.

## 3. Giải pháp triển khai theo thứ tự

### Ưu tiên 1 — Sửa protocol chọn model trên dữ liệu đang có

Giữ checkpoint và split lịch sử để truy nguyên. Tạo protocol development mới,
chỉ dùng các nguồn train mirror hiện tại để cross-validation theo video:

| Fold | Nguồn validation | Mẫu validation | Số rear hook |
| --- | --- | ---: | ---: |
| 1 | V1 | 1.863 | 128 |
| 2 | V2 + V3 | 1.043 | 32 |
| 3 | V4 + V7 | 754 | 80 |

[Cấu hình fold đề xuất, đã kiểm tra đủ lớp và tách nguồn](../python-worker/benchmark_results/proposed_development_folds_20261006.json).
Trạng thái `PROPOSED_NOT_TRAINED`; chưa có kết quả cross-validation mới.

Nguồn mirror còn lại vào train ở từng fold; Adam và bao cát giữ train theo chính
sách hiện hành. Không gọi đây là tách võ sĩ: quan hệ danh tính giữa các nguồn chưa
biết. Khi có fighter/session ID, nhóm theo quan hệ nguồn cùng võ sĩ/buổi và chia
lại trước huấn luyện. Mỗi fold trên có đủ 6 lớp ở cả train và validation.

Chạy cùng ba seed cho mỗi ứng viên; báo mean macro-F1 theo fold, worst-source,
per-class recall/F1 và độ biến thiên giữa seed. Khóa quy tắc chọn trước khi chạy:
macro-F1 trung bình các fold là chính, dùng hiệu quả nguồn kém nhất khi hòa; báo
rõ hồi quy từng lớp, không chọn seed đẹp theo V9/V10. V8 chỉ là diagnostic lịch
sử trong protocol mới; V5 giữ calibration, V9/V10 giữ diagnostic đã quan sát.
Cross-validation này cũng là development, chưa phải nghiệm thu độc lập.

Đây là ứng dụng của group cross-validation: giữ toàn bộ một nhóm ngoài train ở
fold đánh giá. Stratification có thể giúp đủ lớp nhưng không bảo đảm điều đó với
số nhóm ít; phải kiểm tra thực tế từng fold.
[Tài liệu scikit-learn](https://scikit-learn.org/stable/modules/cross_validation.html#cross-validation-iterators-for-grouped-data).

### Ưu tiên 2 — Thí nghiệm nhỏ, một thay đổi mỗi lần

| Thử nghiệm | Thay đổi so với baseline trong protocol mới | Giả thuyết cần kiểm chứng |
| --- | --- | --- |
| A0 | Residual TCN, feature/loss hiện tại | Mốc so sánh mới trên ba fold |
| A1 | Sampler phân bổ theo nguồn trong từng lớp; tính lại loss để tránh cân bằng hai lần | Giảm chi phối của V1 mà không để 18 Adam bị lặp quá nhiều |
| A2 | Augmentation mô phỏng mất khớp trong đoạn ngắn, nhiễu tọa độ nhỏ; cập nhật mask và velocity tương ứng | Giảm phụ thuộc skeleton đầy đủ của mirror |
| A3 | Head chính 6 lớp + auxiliary family 3 lớp + lead/rear 2 lớp | Giảm lỗi có cấu trúc; không giả định chỉ sai bên tay |

So A1/A2/A3 với A0 độc lập trước khi kết hợp; không thay loss, sampler, feature và
kiến trúc cùng lúc. Mức augmentation và hệ số auxiliary là hyperparameter chỉ
chọn qua development folds. Không tạo mẫu tổng hợp vào calibration/test. Không
lật ảnh rồi tự hoán đổi jab/cross: ánh xạ khớp trái/phải và thế thủ phải được kiểm
chứng; tạm bỏ phép lật nếu chưa có metadata phù hợp.

Tăng Adam từ weight 0,25 lên 1 có thể là ablation phụ, nhưng 11/18 → 18/18 trên
Adam train không chứng minh tổng quát hóa. **Giữ nguyên đủ 18 nhãn Adam gốc**,
không thay bằng Gemini, không loại mẫu vì mô hình dự đoán khác nhãn.

### Ưu tiên 3 — Dữ liệu cùng pipeline YOLO, tập trung vào điểm yếu

Đề xuất pilot thu thập mới **16 võ sĩ × 2 buổi × 6 lớp × 10 lần lặp = 1.920 đòn
được thực hiện**, thêm video liên tục có footwork, feint, guard, block, chỉnh găng
và các khoảng nghỉ được gán nhãn đầy đủ. Đây là mục tiêu thu thập ban đầu, chưa
phải dữ liệu có sẵn hoặc số mẫu đủ bảo đảm accuracy.

Phân bổ front/side/diagonal giữa các buổi và nhóm, có orthodox/southpaw; ưu tiên
thêm rear hook ở góc/thế thủ đang yếu. Nếu quay nhiều góc cùng một đòn, giữ chung
group và không đếm các góc đó như nhiều lần thực hiện độc lập. Pilot 16 người
có thể chia 8 train / 2 validation / 2 calibration / 4 test trước khi trích clip;
quy mô này vẫn chỉ là pilot, cần mở rộng nếu độ bất định giữa người còn lớn.

Trích toàn bộ bằng cùng YOLO/tracker/normalizer phiên bản dùng khi triển khai.
Không loại mọi clip khó; lưu trạng thái che khuất, mask và điều kiện quan sát.
Nguồn mirror thiếu timestamp/aspect giữ vai trò baseline hoặc pretraining có
contract riêng; không trộn tensor v1/v2 như thể tương đương. Cần nhánh adapter
được kiểm thử nếu thử chuyển weights; phương án đơn giản đầu tiên là train v2
trên dữ liệu thật tương thích và so sánh trên cùng nhóm đánh giá.

Quy trình nhãn và bàn giao đã có tại [protocol thu thập](AI-DATA-COLLECTION-PROTOCOL.md).
AI có thể đề xuất và xếp hàng clip cần review, nhưng không ghi `coachConfirmed`
cho nhãn chưa có người xác nhận. Dùng uncertainty cùng độ đa dạng nguồn để chọn
mẫu review; vẫn lấy mẫu ngẫu nhiên các dự đoán tự tin để bắt lỗi như V10.

### Ưu tiên 4 — Phát hiện đòn trên video liên tục

TCN hiện tại chỉ nhận clip đã cắt. Bổ sung detector thời gian có nhãn background,
ranh giới bắt đầu/kết thúc và quy tắc cho combo/đòn chồng nhau. Baseline đầu tiên
có thể là TCN theo frame với head actionness/boundary; dùng MS-TCN làm đối chứng
khi có đủ video liên tục, không mặc định smoothing sẽ phù hợp đòn rất ngắn.
MS-TCN nghiên cứu segmentation bằng temporal convolutions và loss giảm chia
vụn hành động; hiệu quả trên boxing vẫn phải đo.
[MS-TCN, CVPR 2019](https://openaccess.thecvf.com/content_CVPR_2019/html/Abu_Farha_MS-TCN_Multi-Stage_Temporal_Convolutional_Network_for_Action_Segmentation_CVPR_2019_paper.html).

Đo tách biệt: detection event F1 và FP/phút trên video gán nhãn đầy đủ;
classification với ranh giới chuẩn; cuối cùng end-to-end với matching một-một
theo temporal IoU. Không gán background cho khoảng chưa được review. Solo
shadowboxing không có ground-truth impact; không đổi peak extension thành impact.

### Ưu tiên 5 — Hiệu chuẩn và model bổ sung

Sau khi đóng băng model, fit temperature bằng calibration có nhiều người/góc
quay, rồi kiểm tra coverage/accuracy/ECE theo nguồn và từng lớp trên tập riêng.
Tách phần fit temperature, chọn policy và xác minh policy khi số nhóm đủ;
với pilot nhỏ phải báo thiếu bằng chứng thay vì khẳng định cận tin cậy 90%.

Temperature scaling là biện pháp hậu xử lý có cơ sở, nhưng không thay đổi thứ tự
logit nên không sửa được nhãn argmax sai. Nghiên cứu dưới dataset shift cũng cho
thấy hiệu chuẩn hậu xử lý có thể thất bại; kết quả V10 của dự án phù hợp với rủi ro
này, chưa xác định được loại shift cụ thể.
[Guo et al., ICML 2017](https://proceedings.mlr.press/v70/guo17a.html),
[Ovadia et al., NeurIPS 2019](https://proceedings.neurips.cc/paper_files/paper/2019/hash/8558cb408c1d76621371888657d2eb1d-Abstract.html).

Nếu lỗi vẫn gắn với pose nhiễu/che khuất sau A0–A3 và có ngân sách tính toán,
thử **PoseC3D/PoseConv3D pretrained** như ứng viên đối chứng, kiểm tra domain,
license weights, VRAM và latency trước. Paper dùng heatmap pose theo thời gian
và báo robustness/cross-dataset tốt hơn các GCN được so sánh trong nghiên cứu;
không suy ra chắc chắn tốt hơn residual TCN của dự án hoặc mọi ST-GCN.
[Duan et al., CVPR 2022](https://openaccess.thecvf.com/content/CVPR2022/html/Duan_Revisiting_Skeleton-Based_Action_Recognition_CVPR_2022_paper.html).

Thử ensemble ba TCN chỉ khi chi phí inference chấp nhận được và có protocol
chọn/hiệu chuẩn trước; không mặc định ba model cùng dữ liệu sẽ sửa lỗi hệ thống.
Gemini tiếp tục là công cụ review offline tùy chọn. Không cần lượt API mới để
thực hiện A0–A3, và không gọi Gemini trong nghiên cứu này.

## 4. Tiêu chí ra quyết định và phần việc tiếp theo

1. Hoàn tất A0 theo group folds rồi mới kết luận ứng viên A1–A3 có lợi. Báo cả
   trường hợp không cải thiện, worst-source và recall rear hook; không cam kết
   một tỷ lệ accuracy tương lai khi chưa có phép đo.
2. Dữ liệu pilot và feature v2 là điều kiện để đo khả năng dùng trên video CLB.
   Nếu chưa có RGB V10, ghi rõ không thể xác minh góc/quy ước nhãn của nguồn đó.
3. Giữ release gates trong [Reliability Plan](AI_COACHING_RELIABILITY_PLAN.md),
   bao gồm classification, side, ECE, detection và regression theo nhóm. Tài liệu
   gate hiện viết “macro F1 ... for each technique”; cần ghi rõ trong evaluator
   macro-F1 toàn taxonomy và F1 từng lớp, không dùng một số trung bình để che lớp yếu.
4. Chỉ mở model trong chế độ thử nghiệm có đánh dấu sau kiểm tra pipeline; phát
   hành coaching cần test độc lập và nhãn chất lượng kỹ thuật riêng. Sáu nhãn
   loại đòn hiện tại không huấn luyện được head đánh giá đúng/sai động tác.

Phần việc nên làm ngay là **A0 group validation → A1 cân bằng nguồn → A2 robustness**,
đồng thời chuẩn bị dữ liệu YOLO mới. Đây là thứ tự đề xuất từ bằng chứng hiện tại;
chưa có kết quả thí nghiệm mới để thay checkpoint đã huấn luyện.

## Tái lập phép phân tích đã chạy

Tại `python-worker`, output phải chưa tồn tại:

```powershell
& '.\.venv\Scripts\python.exe' analyze_provisional_model.py --manifest test_results/provisional_dataset/20261006_adam_source_v1/manifest.json --checkpoint test_results/provisional_training/20261006_adam_source_full_v1/selected --output benchmark_results/new_error_analysis.json
```

Script kiểm tra hash manifest/checkpoint, tái lập accuracy/macro-F1 của báo cáo
cũ bằng assertion, và xuất count/confusion/trọng số theo nguồn. Không thay nhãn,
không fit lại model, temperature hoặc threshold và không thay cấu hình worker.
