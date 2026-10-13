# Kế hoạch thu thập dữ liệu CLB cho AI nhận diện đòn

Ngày: 2026-10-06. Người thực hiện: chủ CLB và 1–2 HLV, có một AI engineer hỗ trợ
phần kỹ thuật. Tài liệu này là **kế hoạch**, chưa có dữ liệu nào được thu theo nó.
Mọi con số về quy mô, giờ công và tỉ lệ hao hụt là **ước lượng lập kế hoạch**, chưa
được chứng minh là đủ; chỗ nào cần đo lại ở pilot đều ghi rõ.

Tài liệu bám theo [quy trình thu thập và gán nhãn](./AI-DATA-COLLECTION-PROTOCOL.md)
(sau đây gọi là "protocol"). Điều protocol đã quyết thì làm theo; chỗ khác hoặc
chưa rõ nằm ở mục [Khác biệt cần chủ dự án quyết](#khác-biệt-với-tài-liệu-hiện-có).

## 1. Mục tiêu và thế nào là "xong"

### Vì sao cần dữ liệu này

| Điều đã đo | Số liệu | Nguồn |
| --- | --- | --- |
| Macro-F1 CV theo nguồn (B0, trung bình bốn fold) | 0,5092 | [AI-SIX-PUNCH-VIDEO](./AI-SIX-PUNCH-VIDEO-20261006.md) |
| F1 diagnostic V9 so với V10 | 0,7086 so với 0,3028 | [AI-IMPROVEMENT-PLAN](./AI-IMPROVEMENT-PLAN-20261006.md) |
| Detector đòn đang chạy, 9 video / 48 đòn | P 57,7%, R 31,3%, F1 40,5% | [STRIKE_BENCHMARK_REPORT](./worker-reports/STRIKE_BENCHMARK_REPORT.md) |
| Rear hook so với cross trong skeleton nguồn | 296 so với 1.370 | [AI-COACH-REVIEW-DATASET](./AI-COACH-REVIEW-DATASET.md) |
| Phần V1 trong trọng số loss của tập train | 47,93% | [AI-IMPROVEMENT-PLAN](./AI-IMPROVEMENT-PLAN-20261006.md) |
| Nhãn do HLV xác nhận | 0 | [AI-COACH-REVIEW-DATASET](./AI-COACH-REVIEW-DATASET.md) |

Tài liệu hiện có chỉ ra ba thiếu sót mà tăng epoch hay đổi kiến trúc không sửa được:
skeleton huấn luyện đến từ bộ ước lượng pose khác YOLO đang triển khai; không có
đoạn không-ra-đòn và ranh giới sự kiện trên video liên tục; không có nhãn HLV.
Kế hoạch này nhắm vào ba thiếu sót đó.

### "Xong" ở hai mức

**Mức 1 — bộ dữ liệu sẵn sàng (phạm vi Giai đoạn 1 bên dưới).** Đạt khi:

- Có 16 võ sĩ, 32 buổi quay thật, đã được đồng ý sử dụng (mục 7).
- Mọi video đánh giá được gán nhãn toàn timeline, kể cả đoạn không ra đòn (mục 4).
- Validation, calibration, test có gán nhãn kép và đã phân xử.
- `audit_temporal_dataset.py` không còn **error**; mọi **warning** đã được đọc và ghi
  lý do giữ (protocol, checklist bàn giao).
- Test đã đóng băng bằng hash và chưa dùng để chỉnh mô hình.

Mức 1 **không** có nghĩa AI đạt chuẩn. Nó chỉ có nghĩa đã có dữ liệu để đo.

**Mức 2 — đo được các release gate (Giai đoạn 2, tùy chọn).** Release gate nằm ở
[AI_COACHING_RELIABILITY_PLAN](./AI_COACHING_RELIABILITY_PLAN.md). Bảng dưới cho thấy
kế hoạch này phục vụ gate nào:

| Gate | Nội dung | Kế hoạch này |
| --- | --- | --- |
| 1 | Event P/R/F1 ≥ 0,90 | Có: nhãn toàn timeline, FP/phút từ đoạn không ra đòn |
| 2 | Impact timing ≤ 100 ms (median) | **Không**: shadow không có tiếp xúc; chưa thu nhãn contact |
| 3 | Macro-F1 6 lớp ≥ 0,85 | Có, nhưng cỡ test của Giai đoạn 1 không đủ để khẳng định (mục 3) |
| 4 | Độ chính xác bên tay ≥ 0,95 | Có một phần: nhãn lead/rear và thế thủ do HLV gán |
| 5 | ECE ≤ 0,05 | Có tập calibration, nhưng chỉ 2 võ sĩ ở Giai đoạn 1 |
| 6 | Không chấm điểm khi thiếu bằng chứng | Không thuộc phạm vi dữ liệu |
| 7 | Phát hiện huấn luyện ≥ 90% HLV đồng ý | **Không**: cần nhãn chất lượng riêng (protocol, "giai đoạn sau") |
| 8 | Mọi strata (camera/ánh sáng/hình thể) đều đạt | Chỉ một phần: cỡ mẫu từng strata quá nhỏ |

Gate 2, 6, 7 cần việc khác, nằm ngoài kế hoạch này.

## 2. Quay video

### Thiết bị và cài đặt

Dùng điện thoại, vì HLV Việt Nam gần như chỉ có điện thoại
([VIETNAM-MARKET-ANALYSIS](../../VIETNAM-MARKET-ANALYSIS.md), §2.2: iPhone slow-mo ~90%).
Cần chân máy hoặc chỗ kê cố định; camera không di chuyển trong clip.

| Mục | Quy định | Căn cứ |
| --- | --- | --- |
| FPS | **Quay 30 fps, tốc độ không đổi**. Dưới 20 fps bị worker chặn | `LOW_FPS` trong [movement_evidence.py](../../../python-worker/pipeline/movement_evidence.py); normalizer lấy mẫu mặc định 30 fps ([AI-TEMPORAL-IMPLEMENTATION](./AI-TEMPORAL-IMPLEMENTATION.md)) |
| Độ phân giải | 1080p, ngang | Đề xuất; kiểm tra ở pilot |
| Chế độ | **Tắt slow-motion**, tắt ổn định hình ảnh, tắt zoom số, tắt bộ lọc làm đẹp, khóa lấy nét và phơi sáng | Protocol: không đổi tốc độ, không cắt trước khi trích pose. Ổn định hình ảnh cắt và méo khung (đề xuất) |
| File | Giữ **file gốc** từ máy. Chuyển bằng cáp hoặc ổ đĩa, không gửi qua ứng dụng chat vì nhiều ứng dụng nén lại video | Protocol: giữ video gốc |
| Kiểm tra sau quay | Số frame giải mã, FPS thực, thời lượng. Không chỉ tin FPS ghi trong container | Protocol; ví dụ Adam: 597 frame giải mã so với 600 khai báo ([AI-COACH-REVIEW-DATASET](./AI-COACH-REVIEW-DATASET.md)) |

Thẻ ID: đầu mỗi video, võ sĩ giơ một tờ giấy ghi mã ẩn danh và mã buổi
(ví dụ `F007 S1`) trong 3 giây. **Không ghi tên thật** trên giấy, trong tên file hay
metadata ML (protocol).

### Khung hình, góc máy, ánh sáng

- Một võ sĩ trong khung. Không có người khác, kể cả người cầm đích hay người đứng xem.
  Video nhiều người bị chặn chọn đoạn (movement evidence) và protocol chỉ định solo.
- Thấy đủ đầu đến chân và khoảng vươn tay khi ra đòn, còn chừa lề. Gợi ý: máy cao
  ngang ngực–hông, đặt cách 3–4 m, võ sĩ chiếm khoảng 60–70% chiều cao khung. Đây là
  gợi ý bố trí, **không phải ngưỡng đã kiểm chứng**; pilot quyết định.
- Ba góc theo protocol: front, side, diagonal (khoảng 45°). Dán băng keo lên sàn để
  võ sĩ hướng đúng chiều trong các khối đòn có kiểm soát.
- Ánh sáng đều, không đứng ngược cửa sổ hoặc đèn mạnh phía sau. Áo ôm vừa để thấy
  vai và hông, màu khác nền.
- Mỗi buổi quay **một camera** ở Giai đoạn 1. Camera thứ hai là tùy chọn, không tính
  vào mục tiêu; nếu quay thì cùng buổi, cùng split, không đếm như đòn độc lập (protocol).

### Phân góc máy

Mỗi võ sĩ quay hai buổi, **khác ngày**, hai góc khác nhau. Võ sĩ số `i` (1–16): buổi 1
dùng góc thứ `((i−1) mod 3)+1` trong dãy [front, diagonal, side]; buổi 2 dùng góc kế
tiếp. Sau khi chia split (mục 5) phải kiểm tra từng split có đủ ba góc; nếu thiếu thì
đổi góc buổi chưa quay, không đổi split.

### Kịch bản một buổi (khoảng 20 phút video, ước lượng)

| Khối | Nội dung | Thời lượng ước |
| --- | --- | --- |
| A | Guard đứng yên, đi lại tự nhiên | 2 phút |
| B | **Đòn đơn có kiểm soát**: 10 lần mỗi loại trong 6 loại, HLV gọi theo thứ tự ngẫu nhiên, nghỉ ít nhất 1 giây giữa hai đòn | 4 phút |
| C | Shadow 3 hiệp × 2 phút: combo 2–3 đòn, rồi tự do | 6 phút |
| D | Bao cát 2 hiệp × 2 phút | 4 phút |
| E | **Không ra đòn có chủ đích** (mỗi loại 3 lần): footwork, nâng/hạ guard, chỉnh găng, block, parry, feint, slip/bob, đi bộ và nghỉ đứng trong khung | 3 phút |
| F | Đổi thế thủ: 1 phút footwork ở thế còn lại, 3 đòn mỗi loại ở thế đó (nếu còn sức) | 2 phút |

Ghi chú:

- HLV gọi tên đòn chỉ để võ sĩ biết cần làm gì. **Nhãn là động tác nhìn thấy**, không
  phải lệnh đã gọi. Người mới ra uppercut sai dạng thì HLV gán theo những gì thấy, hoặc
  đánh dấu chưa chắc (mục 4). Ghi lại thứ tự lệnh để phân xử, nhưng HLV A/B không xem
  nó khi gán nhãn.
- Khối B cố ý lặp lại cùng cách để có đủ mẫu từng lớp; khối C, D cho chuỗi đòn tự nhiên.
  Chỉ khối B được tính vào mục tiêu 10 đòn/lớp/buổi. Protocol yêu cầu không chỉ quay
  mẫu hoàn hảo hay xóa mọi đoạn không ra đòn.
- Rear hook đang thiếu và dễ bị nhầm (V9: 11/11 rear hook bị đoán là lead uppercut,
  [AI-IMPROVEMENT-PLAN](./AI-IMPROVEMENT-PLAN-20261006.md)). Nếu võ sĩ còn sức, thêm 5
  rear hook ở khối B. Phần thêm này nằm ngoài tổng kế hoạch bên dưới.
- Đòn đã gọi ở thế thủ nào thì ghi thế thủ đó. Tay trước/sau đổi theo thế thủ: jab là
  tay trước, cross là tay sau. Không dùng "tay trái" thay cho jab (protocol).
- **Đánh đích (pad work) không đưa vào vòng đầu**: người cầm đích vào khung và phá
  điều kiện một võ sĩ. Nếu muốn quay, phải giữ được track một người, và phải ghi cờ
  riêng.
- Mỗi buổi gồm hoạt động mạnh. Chỉ võ sĩ đang được phép tập theo quy định hiện hành
  của CLB mới tham gia. Kế hoạch này không đặt ra hay đổi quy tắc y tế/clearance.

### Cân bằng võ sĩ

- **Thế thủ**: ít nhất **5** võ sĩ southpaw trong 16 người, để mỗi split có ít nhất một
  người (2 train, 1 validation, 1 calibration, 1 test). Nếu CLB không có đủ southpaw
  tự nhiên thì báo cáo thẳng điều đó trong báo cáo dữ liệu và **không** kết luận
  về southpaw (mục 8). Khối F cho thêm đòn ở thế đối diện nhưng đó là thế thủ chuyển,
  không thay thế southpaw tự nhiên.
- **Trình độ và hình thể**: spec yêu cầu nhiều trình độ và hình thể
  ([Coaching Spec §15.3](./MARTIAL-ARTS-AI-COACHING-SPEC-v1.md)). Mục tiêu lập kế hoạch:
  có ít nhất ba nhóm trình độ (mới tập, trung cấp, nhiều kinh nghiệm), mỗi nhóm ít nhất
  4 người, và không nhóm nào quá nửa. Ghi chiều cao/cân nặng theo khoảng, không ghi
  số chính xác.
- Chỉ người từ đủ 18 tuổi ở vòng đầu (mục 7).

## 3. Mục tiêu quy mô

### Giai đoạn 1 (kế hoạch chính)

Lấy từ pilot đề xuất ở [AI-IMPROVEMENT-PLAN](./AI-IMPROVEMENT-PLAN-20261006.md) (Ưu tiên 3):
16 võ sĩ × 2 buổi × 6 lớp × 10 lần = 1.920 đòn **được thực hiện**, chia 8 train /
2 validation / 2 calibration / 4 test.

| Hạng mục | Mục tiêu | Ghi chú |
| --- | --- | --- |
| Võ sĩ khác nhau | 16 | Spec §15.3 nêu 20–30: Giai đoạn 1 thấp hơn mức này |
| Buổi quay | 32 (2/võ sĩ, khác ngày, hai góc) | |
| Video | khoảng 640 phút (32 × 20), tức khoảng 10,7 giờ | Ước lượng |
| Đòn đơn có kiểm soát | 320/lớp, tổng 1.920 | 20 đòn/lớp/võ sĩ |
| Theo split (đòn/lớp, trước hao hụt) | train 160, validation 40, calibration 40, test 80 | |
| Sau hao hụt giả định 20% | train 128, validation 32, calibration 32, test 64 | **20% là giả định**, chưa có số đo |
| Đoạn không ra đòn | gần như toàn bộ phần timeline còn lại; ít nhất 3 đoạn mỗi loại trong 9 loại ở mỗi buổi | Xem E ở bảng trên |
| Chuỗi đòn tự nhiên | khối C, D mỗi buổi | Chưa đặt mục tiêu số đòn; đếm sau khi gán nhãn |

### Vì sao mỗi lớp đều có 10 lần mỗi buổi

Skeleton nguồn lệch nặng: rear hook 296, cross 1.370 (AI-COACH-REVIEW-DATASET). Lấy đều
10 đòn mỗi lớp loại bỏ lệch lớp ngay từ khâu thu, thay vì phải bù bằng trọng số loss.

### Vì sao tách theo võ sĩ và vì sao 2 võ sĩ cho validation/calibration là quá ít

V10 cho F1 0,3028, V9 cho 0,7086 trên cùng một mô hình (AI-IMPROVEMENT-PLAN). Mô hình
sai nhiều khi gặp nguồn mới. Vì vậy mọi buổi của một võ sĩ phải nằm trong một split
(protocol), và số võ sĩ ở mỗi split quyết định độ tin cậy của phép đo. Validation và
calibration chỉ có 2 võ sĩ ở Giai đoạn 1: đủ để protocol/auditor không báo thiếu
(auditor mặc định cần ít nhất 30 mẫu/lớp/split, đây là kiểm tra kỹ thuật, không phải
mục tiêu thống kê; [AI-TEMPORAL-IMPLEMENTATION](./AI-TEMPORAL-IMPLEMENTATION.md)), nhưng độ
bất định giữa người còn lớn. AI-IMPROVEMENT-PLAN cũng nói quy mô này "chỉ là pilot".

### Cỡ test cần để đo release gate

Đây là phép tính số học, giả định các đòn **độc lập**. Thực tế các đòn của cùng một
võ sĩ tương quan nên cần nhiều hơn. Cận dưới Wilson 95% khi quan sát đúng 90% (n đòn
mỗi lớp):

| n | 80 | 120 | 160 | 200 | 250 |
| --- | --- | --- | --- | --- | --- |
| Cận dưới | 0,815 | 0,833 | 0,844 | 0,851 | 0,857 |

Với 4 võ sĩ test (80 đòn/lớp, 64 sau hao hụt), dù mô hình đúng 90% cũng chưa chứng minh
được ≥ 0,85. Cận dưới chỉ qua 0,85 từ khoảng 200 đòn dùng được mỗi lớp, trùng với mốc
thấp nhất 200–500 của spec. Đây là lý do có Giai đoạn 2.

### Giai đoạn 2 (tùy chọn, quyết ở tuần 12)

Mục tiêu: tập nghiệm thu có ít nhất khoảng 200 đòn dùng được mỗi lớp. Với 20 đòn/lớp/võ
sĩ và hao hụt giả định 20%, mỗi võ sĩ cho khoảng 16 đòn/lớp, tức khoảng **13 võ sĩ
test**. Cách làm:

1. Giữ 4 võ sĩ test của Giai đoạn 1 **niêm phong, không mở**. Phát triển bằng
   validation, calibration và cross-validation theo nhóm.
2. Thêm khoảng 9 võ sĩ cho test (18 buổi), thành 13 và 25 võ sĩ cả bộ, nằm trong mức
   20–30 của spec.
3. Nếu có sức, thêm 2 võ sĩ cho calibration.
4. Mở test **một lần** khi đã chốt mô hình. Sau đó đặt `testObserved: true`; vòng sau
   cần test mới (protocol).

Giờ HLV Giai đoạn 2: khoảng 3,8 giờ mỗi buổi (tính ở mục 6) × 18 buổi, khoảng
**69 giờ**. Con số này phụ thuộc giả định năng suất của mục 6 và phải tính lại sau pilot.

### Điều chưa biết

8 võ sĩ train (960 đòn đơn) có thể không đủ để huấn luyện feature v2 từ đầu; skeleton
nguồn v1 không trộn được vì khác hợp đồng feature (AI-TEMPORAL-IMPLEMENTATION, "Hai
feature contract tách biệt"). Tuần 11 nhờ AI engineer chạy đường cong học (train với 4
võ sĩ so với 8 võ sĩ) để biết có cần thêm võ sĩ train hay không. Đây là phép đo, không
phải cam kết.

## 4. Gán nhãn

### Quy tắc nền (theo protocol)

- Xem video gốc, gán `startTimeMs`, `endTimeMs` trên timeline nguồn.
- `technique` là một trong 6 lớp hoặc `background`. Khoảng chưa gán là chưa biết, không
  tự thành background.
- Chỉ khai `annotationCoverage: exhaustive` sau khi đã kiểm tra toàn bộ phạm vi.
- Mỗi action lưu annotator ID và review status. Hai lần gán của cùng một HLV không
  phải hai người độc lập. Lưu bản gốc lẫn bản phân xử.
- Không xem gợi ý mô hình trước khi chốt gold label. Với kế hoạch này, vòng 1 không dùng
  tiền gán nhãn bằng mô hình ở bất kỳ buổi nào.

### Gán toàn timeline

Mỗi video được phủ liên tục từ đầu đến cuối bằng các khoảng nửa mở `[start, end)`:

| Loại khoảng | Nội dung |
| --- | --- |
| Một trong 6 lớp đòn | Nhãn lớp, start/peak/end, lead/rear, thế thủ |
| `background` | Kèm loại: đứng yên, đi lại/footwork, nâng-hạ guard, chỉnh găng, block, parry, feint, slip/bob, đổi thế thủ |
| Không rõ | Che khuất, ra ngoài khung, nhiều người, camera dịch: ghi lý do; **không** tính vào mẫu số FP/phút và không chuyển thành background |

Các mốc:

- **start**: frame đầu tiên của chuyển động có chủ đích của tay ra đòn, sau tư thế guard.
- **peak**: lúc duỗi tay tối đa. Shadow không có tiếp xúc nên **không** gọi peak là
  impact (protocol; [Coaching Spec §6.3](./MARTIAL-ARTS-AI-COACHING-SPEC-v1.md)).
- **end**: lúc tay về guard, hoàn tất chu kỳ.
- Spec nêu chuỗi chuẩn bị – phát lực – peak – thu đòn ([Coaching Spec §2.2](./MARTIAL-ARTS-AI-COACHING-SPEC-v1.md)).
  Định nghĩa trên là **đề xuất**; protocol yêu cầu HLV chốt và khóa phiên bản hướng dẫn
  trước pilot (xem tuần 1–2).
- Combo: hai đòn liền nhau chia ở điểm tốc độ tay xuống thấp nhất giữa hai đòn; đòn sau
  bắt đầu đúng lúc đòn trước kết thúc, `end` đòn trước = `start` đòn sau. Auditor từ chối
  khoảng chồng nhau (`OVERLAPPING_SINGLE_LABEL_INTERVALS`), nhưng nửa mở nên liền nhau
  không bị tính chồng. Trường hợp đòn sau bắt đầu trước khi đòn trước về guard phải được
  hướng dẫn nhãn quy định rõ trước khi gán.

### Trường cần ghi cho mỗi khoảng

| Trường | Giá trị |
| --- | --- |
| `technique` | jab, cross, lead_hook, rear_hook, lead_uppercut, rear_uppercut, background |
| `backgroundType` | Chỉ với background: 9 loại ở trên |
| `startTimeMs`, `endTimeMs` | Mili-giây trên timeline nguồn |
| `peakTimeMs` | Tùy chọn, chỉ với đòn |
| `leadRear` | lead, rear, không áp dụng |
| `stance` | orthodox, southpaw |
| `qualityFlags` | che khuất, ra ngoài khung, nhiều người, mờ chuyển động, thiếu sáng, camera dịch, track đứt, pose kém |
| `certainty` | chắc, chưa chắc (chưa chắc đi vào phân xử, không bị xóa) |
| `annotatorId`, `guideVersion`, `reviewStatus` | Theo protocol |

Schema file `annotations/<sourceVideoId>.json` chưa được định nghĩa trong repo (protocol
chỉ nêu tên file). Bảng trên là đề xuất để AI engineer chốt ở tuần 1. `peakTimeMs` và
`leadRear` nằm trong file nhãn; contract manifest hiện tại chỉ có start/end và technique.

### Hai người gán độc lập và phân xử

Protocol: HLV A/B gán độc lập trên **một phần** dữ liệu; test và calibration ưu tiên hai
người; có HLV phân xử. Spec §15.2 cũng yêu cầu một phần dữ liệu có hai annotator độc
lập. Kế hoạch:

| Split | Gán kép |
| --- | --- |
| Validation, calibration, test | 100% buổi |
| Train | 25% buổi, chọn ngẫu nhiên có hạt giống cố định trước khi gán, mỗi lớp và mỗi góc đều có mặt |
| Pilot (3 buổi tuần 1–2) | 100%, lấy từ nhóm train nên được tính vào 25% ở trên |

Cách làm:

1. HLV A và B gán trên máy hoặc browser profile riêng, không trao đổi, không xem nhật ký
   lệnh gọi và không xem gợi ý mô hình.
2. AI engineer so hai bản bằng script (hiện chưa có, xem Khoảng trống bên dưới), xuất báo
   cáo bất đồng.
3. Chỉ họp phân xử các mục bất đồng: khác lớp, khác lead/rear, đòn chỉ một người gán,
   chênh ranh giới lớn, một bên đánh dấu chưa chắc.
4. Lưu bản A, bản B, bản phân xử và lý do. Không ghi đè bản gốc.
5. Chỉ sau phân xử mới đặt `reviewStatus` để dữ liệu qua auditor (`DUAL_AGREEMENT` với
   hai annotator khác nhau, hoặc `COACH_APPROVED`). Cách ghi trạng thái cho mục đã phân
   xử chưa được protocol quy định; AI engineer cần xác nhận cách auditor chấp nhận.

Nếu chỉ có hai HLV, buổi phân xử là họp chung của A và B, yếu hơn một người thứ ba độc
lập. Nên mời thêm một HLV bên ngoài phân xử riêng cho test; ghi rõ trong báo cáo ai
phân xử.

### Chỉ số độ đồng thuận phải báo cáo

Tính trên bản gán độc lập **trước** phân xử, riêng từng split, không chỉnh lại sau:

1. **Khớp sự kiện** giữa A và B, ghép một-một theo IoU thời gian 0,1 / 0,3 / 0,5 (giống
   các ngưỡng evaluator, [AI-SIX-PUNCH-VIDEO](./AI-SIX-PUNCH-VIDEO-20261006.md)): F1 giữa hai
   người, số đòn chỉ một người thấy.
2. **Cohen's kappa** cho lớp trên các sự kiện đã ghép, kèm ma trận nhầm và phần trăm
   đồng ý từng lớp. Kappa chịu ảnh hưởng của tần suất lớp nên không báo kappa đơn lẻ.
3. Đồng thuận lead/rear và thế thủ.
4. Sai lệch ranh giới (start, end, peak): median và p95, mili-giây.
5. Số mục chuyển phân xử và kết cục.

Ngưỡng chấp nhận độ đồng thuận **chưa có trong tài liệu hiện có**. Đề nghị chủ dự án
chốt ở tuần 2, sau pilot, trước khi gán phần còn lại. Quy ước thường dùng trong tài liệu
thống kê coi kappa ≥ 0,8 là đồng thuận rất cao; đó là gợi ý, không phải yêu cầu của
repo. Đồng thuận giữa hai HLV cũng là một giới hạn thực tế cho điểm nghiệm thu: không
nên đòi mô hình khớp "nhãn vàng" tốt hơn mức hai HLV khớp nhau.

### Công cụ duyệt hiện có và khoảng trống

[`coach_review.html`](../../../python-worker/review_tools/coach_review.html) và
[`serve_coach_review_dataset.py`](../../../python-worker/serve_coach_review_dataset.py) (cách
chạy ở [AI-COACH-REVIEW-DATASET](./AI-COACH-REVIEW-DATASET.md)):

**Đã có:** phát 0,25×/0,5×/1×; nút lùi/tiến một bước theo FPS; lấy mốc start/end từ vị
trí phát; chọn nhãn gồm `background`; chọn thế thủ; ghi chú; ẩn nhãn nguồn mặc định;
xuất JSON có mã người duyệt, SHA-256 video và các cờ chưa xác thực; máy chủ hỗ trợ HTTP
Range.

**Khoảng trống so với kế hoạch (chỉ liệt kê, không phải triển khai):**

| # | Khoảng trống | Vì sao ảnh hưởng |
| --- | --- | --- |
| 1 | Mỗi task chỉ một khoảng và một nhãn; không thêm, tách hoặc xóa khoảng | Không gán được toàn timeline và combo |
| 2 | Task do builder tạo từ gói pinned theo hash; chưa có cách nạp video CLB mới và tự dựng timeline trống | Không dùng được cho video quay mới |
| 3 | Không hiển thị độ phủ timeline, khoảng hở, khoảng chồng | Không kiểm được "exhaustive" |
| 4 | Không có trường lead/rear, peak, loại background, cờ chất lượng, mức chắc chắn | Thiếu các trường ở bảng trên |
| 5 | Có `Có đổi thế thủ` cho cả task; auditor cần `orthodox` hoặc `southpaw` cho từng mẫu | Phải chia khoảng theo thế thủ |
| 6 | Mã người duyệt nhập tay, không xác thực; tính độc lập của A/B chỉ dựa vào profile riêng | Protocol nói rõ chưa phải xác thực |
| 7 | Không so A với B, không tính độ đồng thuận, không có hàng đợi phân xử | Cần cho mục trên |
| 8 | Bước frame là bước thời gian theo FPS khai báo, không bảo đảm frame-exact; chưa kiểm VFR/PTS | Ranh giới có thể lệch vài frame |
| 9 | Không biểu diễn đòn chồng nhau | Cùng giới hạn single-label của auditor |
| 10 | File xuất chưa nối vào backend hay gold exporter | Cần bước nhập có xác thực của dự án |
| 11 | Chưa có script nối nhãn đã phân xử thành `dataset.manifest.json` và file nhãn | Do AI engineer làm ở tuần 10 |

Cách tạm cho pilot nếu công cụ chưa sửa kịp: HLV ghi khoảng vào bảng tính theo mẫu
(`sourceVideoId`, start, end, nhãn, thế thủ, cờ), AI engineer chuyển sang JSON. Giờ gán
trong mục 6 tính theo giả định công cụ đủ dùng; nếu dùng bảng tính, đo lại giờ ở tuần 2.
Chủ dự án quyết chờ công cụ hay dùng cách tạm; kế hoạch này không chọn thay.

7 video và 67 task của gói duyệt hiện có (AI-COACH-REVIEW-DATASET) dùng được để HLV làm
quen công cụ và đo thời gian ở tuần 1–2. Chúng không phải dữ liệu CLB mới, đã được quan
sát trong nghiên cứu, **không** được dùng làm test nghiệm thu.

## 5. Chia tập và trích pose

### Chia tập

1. Chia **theo võ sĩ** trước khi gán nhãn, theo quy tắc ghi thành văn bản (hạt giống ngẫu
   nhiên, ràng buộc bên dưới). Không đổi sau khi đã xem bất kỳ chỉ số nào
   (protocol: không tự chuyển split để làm đẹp metric).
2. Mọi buổi, video và clip dẫn xuất của một võ sĩ nằm trong một split. Một sourceVideoId
   chỉ có một video gốc; clip dẫn xuất kế thừa `fighterId`, `sessionId`.
3. Ràng buộc: mỗi split có ít nhất một southpaw; có từ hai nhóm trình độ; sau khi chia,
   test đủ ba góc.
4. Mỗi split đủ cả 7 nhãn (6 lớp và background). Auditor kiểm tra rò rỉ theo fighter,
   session, source video, hash inference và hash pose.
5. Bốn tập theo protocol: train học trọng số; validation chọn kiến trúc và epoch;
   calibration fit temperature và policy từ chối; **test chỉ nghiệm thu**.

### Tập nghiệm thu không dùng để chỉnh

- Test được quay và gán nhãn cùng quy trình, rồi **niêm phong**: ghi hash manifest,
  người giữ, ngày. AI engineer không chạy mô hình ứng viên trên test khi phát triển.
- HLV không xem kết quả mô hình trên test khi còn gán nhãn hay họp phân xử. Họp xem lỗi
  mô hình ở tuần 11 chỉ dùng validation và calibration.
- Khi đã dùng test để phân tích và chỉnh, ghi `testObserved: true`, rồi chuẩn bị test mới
  (protocol). Giai đoạn 2 chính là nguồn test mới.
- Nếu có thể, đưa một phần test sang CLB hoặc điện thoại khác để "độc lập" đúng nghĩa
  hơn. Giai đoạn 1 quay ở một CLB, chưa chứng minh gì cho nơi khác.

### Trích pose đúng pipeline triển khai

- Dùng **cùng trọng số YOLO, tracker và normalizer** như worker đang chạy
  (`YOLO_MODEL=yolov8n-pose` trong [.env.example](../../../python-worker/.env.example); normalizer
  `coco17_timestamp_torso_v1`). Ghi trọng số, hash, commit mã worker và phiên bản
  normalizer vào manifest.
- Chạy cùng cấu hình cho cả bốn split. Không chỉnh ngưỡng pose theo split.
- Chạy `process_video.py` rồi `prepare_temporal_pose.py --fps 30`
  ([AI-TEMPORAL-IMPLEMENTATION](./AI-TEMPORAL-IMPLEMENTATION.md)). Giữ mask, độ phủ và lý do
  loại trừ; không loại các clip khó để làm đẹp (AI-IMPROVEMENT-PLAN).
- Kiểm tra pilot: độ phủ khớp tay và thân tối thiểu 80% frame ở ngưỡng pose 0,3 là quy
  tắc bằng chứng kỹ thuật của bộ nhận diện thử nghiệm (AI-SIX-PUNCH-VIDEO), không phải độ tin
  cậy đã học. Dùng làm tiêu chí rà pilot; nếu nhiều buổi dưới mức này thì sửa cách quay,
  không sửa ngưỡng.
- Giữ video gốc để trích lại khi trọng số production đổi.
- Khoảng nhãn phải nằm trong một run pose liên tục. Track đứt hoặc ra khỏi khung thì ghi
  cờ, không nối ngang.

## 6. Tiến độ và giờ công HLV

### Giả định giờ công (phải đo lại ở tuần 2)

Không có số đo năng suất trong repo. Các số dưới là giả định:

- Mỗi buổi khoảng 20 phút video.
- Gán lần đầu toàn timeline: **4 lần thời lượng video**, tức 80 phút/buổi cho mỗi người.
- Phân xử: 20 phút/buổi cho **cả hai HLV** cùng họp, tức 40 người-phút.
- HLV có mặt lúc quay: 30 phút/buổi (có thể trùng giờ dạy thường).
- Số buổi gán kép: 20 = 16 buổi validation/calibration/test + 4 buổi train (3 buổi pilot
  nằm trong 4 này).

### Lịch theo tuần

Giờ ở cột cuối là **tổng giờ của các HLV** (người-giờ). Giai đoạn 1 kéo dài 12 tuần.

| Tuần | Mốc | Việc chính | Giờ HLV |
| --- | --- | --- | ---: |
| 0 | Chuẩn bị | Chủ CLB chốt người tham gia, mẫu đồng ý, nơi lưu, người giữ bảng mã. HLV dự thảo hướng dẫn nhãn v0 (định nghĩa start/peak/end, quy tắc feint, combo) | 4 |
| 1 | Quay thử 3 buổi (võ sĩ nhóm train) | Quay 3 buổi; AI engineer kiểm FPS thực, số frame, độ phủ pose; HLV làm quen công cụ bằng gói 67 task; họp chốt hướng dẫn nhãn (mỗi HLV 3 giờ) | 7,5 |
| 2 | **Cổng G1** | Gán kép 3 buổi pilot, tính độ đồng thuận, đo giờ thực tế, khóa hướng dẫn nhãn v1, chốt ngưỡng đồng thuận và cách xử lý công cụ | 10 |
| 3 | Quay đợt 1 (5 buổi) | Gán các buổi đã quay | 8,5 |
| 4–7 | Quay mỗi tuần 5 buổi | Gán và phân xử theo sau quay 1 tuần | 12,5 mỗi tuần |
| 8 | **Cổng G2**: đủ 32 buổi | Quay 4 buổi cuối; tiếp tục gán | 12 |
| 9 | Gán nốt | Gán và phân xử | 10 |
| 10 | **Cổng G3** | Xong gán và phân xử; AI engineer trích pose, dựng manifest, chạy auditor, sửa lỗi dữ liệu | 6,8 |
| 11 | **Cổng G4** | Đóng băng split và test, ghi hash; chạy mô hình cơ sở trên train/validation/calibration; họp xem lỗi (HLV chỉ xem validation/calibration); đường cong học | 4 |
| 12 | Quyết định | Báo cáo dữ liệu, quyết định Giai đoạn 2. Tuần đệm cho việc trễ | (đệm) |
| | **Tổng Giai đoạn 1** | | **khoảng 113** |

Cách tính tổng: gán A 42,7 giờ + gán B 26,7 giờ + phân xử 13,4 người-giờ (20 buổi × 20
phút × 2 người) + có mặt lúc quay 16 giờ + chuẩn bị, họp và xem lỗi 14 giờ ≈ 113 giờ.

Với hai HLV, đỉnh khoảng 12,5 giờ/tuần chung, tức khoảng 6 giờ mỗi người. Đối chiếu
thực tế: HLV dạy 6–9 giờ PT mỗi ngày, thời gian rảnh rất ít
([VIETNAM-MARKET-ANALYSIS](../../VIETNAM-MARKET-ANALYSIS.md), §2.3). Nếu không dành được, kéo dài
tiến độ (khoảng 16 tuần) chứ không bỏ gán kép ở validation, calibration, test.

Giờ không phải của HLV (ước lượng, cùng giả định): người quay khoảng 27 giờ (32 buổi ×
50 phút gồm dựng máy, quay, kiểm tra, bàn giao); chủ CLB khoảng 6 giờ cho đồng ý và lưu
trữ. AI engineer không tính ở đây.

### Cổng quyết định

| Cổng | Điều kiện qua |
| --- | --- |
| G0 (trước tuần 1) | Có mẫu đồng ý và người giữ bảng mã; biết CLB có đủ southpaw không |
| G1 (hết tuần 2) | Pilot đủ FPS và độ phủ pose; độ đồng thuận đã đo và chốt ngưỡng; hướng dẫn nhãn v1 khóa; giờ thực tế đã đo và lịch tính lại |
| G2 (hết tuần 8) | 32 buổi, 16 võ sĩ, đúng thế thủ và góc theo kế hoạch; mỗi buổi đã qua kiểm tra sau quay |
| G3 (hết tuần 10) | Mọi video đánh giá phủ timeline, auditor không còn error, warning đã đọc, ghi nhận `annotationCoverage` |
| G4 (hết tuần 11) | Split và test đóng băng bằng hash; báo cáo độ đồng thuận từng split |

## 7. Đồng ý, quyền riêng tư, lưu trữ

Spec coi video và dữ liệu pose là dữ liệu nhạy cảm
([Master Spec v3 §16.2](../../MMA-TMS-MASTER-SPECIFICATION-v3.md)). Protocol: "Auditor không tự
xác nhận các điều kiện này từ một cờ JSON". Kế hoạch này không phải tư vấn pháp lý. Chủ CLB
cần hỏi người có chuyên môn về Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân (repo
chưa có tài liệu nào đối chiếu văn bản này).

### Đồng ý

- Mỗi võ sĩ ký **bản đồng ý riêng** trước khi quay. Nội dung tối thiểu: mục đích (huấn
  luyện và đánh giá AI nhận diện đòn), ai được xem video (HLV gán nhãn, AI engineer, chủ
  CLB), nơi và thời gian lưu, quyền rút lại, không dùng để đánh giá hay xếp hạng cá nhân.
- **Mục riêng, mặc định "không"**: cho phép gửi video đến dịch vụ AI bên ngoài (ví dụ
  Gemini). Tài liệu [AI-GEMINI-CROSS-REVIEW](./AI-GEMINI-CROSS-REVIEW.md) ghi lượt online
  chỉ chạy sau khi chủ dự án đồng ý gửi video tới Google.
- Chỉ đặt `dataUseApproved: true` trong manifest sau khi chủ CLB đã đối chiếu từng bản đồng
  ý. Không để AI engineer tự đặt.
- Không ghi chẩn đoán hay thông tin y tế vào video, tên file, manifest hoặc bản đồng ý
  dùng cho dữ liệu ML (protocol).

### Người dưới 18 tuổi và người ngoài cuộc

- **Vòng đầu chỉ quay người từ đủ 18 tuổi.** Đây là lựa chọn an toàn của kế hoạch này.
  Muốn quay người dưới 18 cần chữ ký cha mẹ hoặc người giám hộ, sự đồng thuận của em đó
  và chủ CLB quyết riêng.
- Người khác vô tình vào khung: quay lại. Không cắt bỏ người đó khỏi video gốc; cắt
  hay chỉnh trước khi trích pose bị protocol cấm.

### Lưu trữ và truy cập

- Mã ẩn danh `F###` (võ sĩ) và `S#` (buổi) trong mọi tên file và manifest. **Bảng mã ↔ tên
  thật do chủ CLB giữ riêng**, không nằm chung nơi với video hay manifest.
- Bản làm việc ở thư mục cục bộ theo protocol (`local-data/`), trên máy mã hóa đĩa của người
  được chỉ định. Bản sao lưu ở **bucket riêng tư**, không công khai, chỉ truy cập qua tài
  khoản có xác thực. Bucket này phải tách khỏi bucket `videos` của sản phẩm để không lẫn dữ
  liệu nghiên cứu với video võ sĩ thật; bucket hiện chưa tồn tại.
- Lưu ý: `DEPLOY_GUIDE.md` (dòng 33) hướng dẫn đặt bucket **Public**, trái với README
  (bucket riêng tư, truy cập qua route có xác thực). **Với dữ liệu này, làm theo README.**
- Truy cập: HLV A/B, HLV phân xử, AI engineer, chủ CLB. Ghi người nào đã mở video nào (log
  đơn giản cũng được). Video không gửi lên dịch vụ ngoài khi chưa có mục đồng ý riêng.

### Lưu giữ và rút đồng ý

- Spec §16.2: video và pose giữ đến khi võ sĩ yêu cầu xóa; yêu cầu xóa là xóa mềm, xóa
  hẳn sau 30 ngày. Kế hoạch này theo quy tắc đó. Đề xuất thêm (chủ dự án quyết): chủ CLB
  rà lại việc còn cần giữ dữ liệu sau mỗi 12 tháng.
- Võ sĩ rút đồng ý: xóa video, pose, nhãn và dòng manifest của người đó; loại khỏi mọi lần
  huấn luyện sau; ghi vào nhật ký dữ liệu. Mô hình **đã** huấn luyện trước đó không "gỡ" được
  người này khỏi trọng số; điều này nói rõ trong bản đồng ý.
- Lưu bản ký đồng ý cùng thời hạn như dữ liệu, ở nơi chủ CLB giữ, riêng với video.

## 8. Rủi ro và điều sẽ KHÔNG kết luận

### Rủi ro

| Rủi ro | Hậu quả | Giảm thiểu |
| --- | --- | --- |
| HLV không có đủ giờ (mục 6) | Trễ lịch, nhãn qua loa | Đo giờ ở tuần 2; kéo dài tiến độ, không bỏ gán kép ở val/cal/test |
| Giả định 4× thời lượng video sai | Giờ công lệch nhiều | Tính lại ở G1 |
| Công cụ duyệt chưa gán được toàn timeline | Trễ hoặc phải dùng bảng tính | Chủ dự án quyết sớm (tuần 1) |
| Chỉ có hai HLV, phân xử không độc lập | Nhãn test yếu hơn | Mời HLV ngoài phân xử riêng cho test |
| Võ sĩ trình diễn đòn mẫu sạch hơn thực tế | Mô hình quá lạc quan | Có khối C, D, E; báo cáo tách đòn có kiểm soát và đòn tự nhiên |
| Thiếu southpaw | Không đo được southpaw | Báo cáo thẳng; không kết luận (bên dưới) |
| Hook và uppercut khó phân biệt từ video 2D | Bất đồng cao ở các lớp này | Cho phép "chưa chắc"; báo cáo bất đồng từng lớp |
| FPS thực biến thiên, nhòe chuyển động ở 30 fps | Ranh giới lệch, pose kém | Kiểm tra sau giải mã ở pilot; điều chỉnh cách quay |
| Test bị lộ khi phát triển | Mất tập nghiệm thu | Niêm phong, ghi `testObserved`, Giai đoạn 2 |
| Rò rỉ video hoặc bảng mã | Vi phạm riêng tư | Tách bảng mã; bucket riêng tư; không dùng chat nén; không gửi dịch vụ ngoài |
| Một CLB, một nhóm điện thoại | Không tổng quát | Ghi giới hạn; thêm CLB/điện thoại vào test nếu được |
| 8 võ sĩ train không đủ | Mô hình v2 yếu | Đường cong học ở tuần 11; Giai đoạn 2 thêm võ sĩ train nếu cần |

### Điều sẽ không kết luận từ dữ liệu này

- Không kết luận AI "đạt chuẩn", "Reliable AI Coaching" hay sẵn sàng chạy production. Chỉ
  khi đủ mọi gate trên tập độc lập mới được dùng nhãn đó
  ([AI_COACHING_RELIABILITY_PLAN](./AI_COACHING_RELIABILITY_PLAN.md)).
- Không kết luận đòn đúng hay sai kỹ thuật. Nhãn ở đây chỉ là loại đòn và thời gian;
  chất lượng cần bộ criterion riêng (protocol).
- Không kết luận về thời điểm chạm đích (impact) từ video shadow.
- Không kết luận về sparring, đòn chân, nhiều người, người dưới 18 tuổi, hay CLB/điện thoại
  khác ngoài những gì thực sự có trong test.
- Không kết luận về southpaw nếu số southpaw tự nhiên ít hơn kế hoạch.
- Không kết luận độ chính xác theo từng góc, ánh sáng, hình thể (gate 8) với cỡ mẫu Giai đoạn 1.
- Không kết luận cỡ mẫu "đủ". Mọi con số ở mục 3 là kế hoạch, và phép tính Wilson giả định
  đòn độc lập.
- Không coi đồng thuận cao giữa hai HLV là bằng chứng nhãn là "sự thật".
- Không kết luận từ bất kỳ mô hình nào được chạy trên validation hay calibration của dữ liệu
  này rằng mô hình đã được nghiệm thu.

## Khác biệt với tài liệu hiện có

Những chỗ kế hoạch này khác hoặc làm rõ tài liệu đã có. Cần chủ dự án quyết hoặc xác nhận:

| # | Vấn đề | Kế hoạch này làm gì |
| --- | --- | --- |
| 1 | AI-IMPROVEMENT-PLAN đề xuất pilot 16 võ sĩ; Coaching Spec §15.3 yêu cầu 20–30 võ sĩ, 200–500 đòn/lớp | Giai đoạn 1 theo pilot 16 người; Giai đoạn 2 mở rộng đến khoảng 25. Train chỉ 160 đòn/lớp, dưới mốc 200 của spec |
| 2 | Protocol: gán kép trên "một phần" dữ liệu | Gán kép 100% validation/calibration/test và 25% train. Không phải 100% toàn bộ vì giờ HLV |
| 3 | Auditor yêu cầu `stance` là orthodox hoặc southpaw cho **mọi** mẫu, kể cả `background`; công cụ có `unknown` và `switching` | Gán thế thủ theo từng khoảng. Với background mà không xác định được thế thủ, ghi thế thủ khai báo của buổi. AI engineer xác nhận, không đổi auditor |
| 4 | Protocol cho phép gán peak "nếu cần"; contract manifest chỉ có start/end; Coaching Spec có `peak_frame` | Ghi `peakTimeMs` trong file nhãn, không đưa vào manifest |
| 5 | Protocol không nêu FPS tối thiểu | Quay 30 fps, tối thiểu cứng 20 fps theo `LOW_FPS` của worker |
| 6 | Protocol: nhãn "đã phân xử" chưa có trạng thái riêng | Dùng `COACH_APPROVED` hoặc `DUAL_AGREEMENT` theo auditor; AI engineer xác nhận cách ghi người gán |
| 7 | Protocol giả định solo, một võ sĩ; đánh đích có người cầm đích | Bỏ đánh đích khỏi vòng đầu |
| 8 | Auditor từ chối khoảng chồng nhau; combo nhanh có thể chồng | Dùng khoảng nửa mở liền nhau; ca chồng thật cần quy tắc trong hướng dẫn nhãn |
| 9 | `DEPLOY_GUIDE.md` nói bucket Public; README nói bucket riêng tư | Dữ liệu này dùng bucket riêng tư |
| 10 | Spec §16.2: giữ đến khi võ sĩ yêu cầu xóa | Theo spec; thêm đề xuất rà soát 12 tháng, cần chủ dự án quyết |

## Checklist

**Chuẩn bị (G0)**

- [ ] Chủ dự án chốt 16 võ sĩ (và người dự phòng), đủ southpaw, đủ trình độ, từ 18 tuổi.
- [ ] Mẫu đồng ý có mục riêng về dịch vụ AI bên ngoài (mặc định không) và quyền rút lại.
- [ ] Bảng mã ↔ tên thật do chủ CLB giữ riêng.
- [ ] Bucket riêng tư mới đã tạo, không công khai; thư mục `local-data/` ở máy mã hóa.
- [ ] Quyết: chờ công cụ gán toàn timeline hay dùng bảng tính tạm.
- [ ] Quyết: ai là HLV A, B và người phân xử (nếu có người ngoài).
- [ ] Chia split theo võ sĩ, ghi quy tắc và hạt giống, trước khi gán nhãn.

**Quay (G1, G2)**

- [ ] Điện thoại: 30 fps, tắt slow-mo, ổn định, zoom số và bộ lọc; khóa lấy nét và phơi sáng.
- [ ] Mỗi buổi: thẻ ID đầu video, kịch bản A–F, một võ sĩ trong khung.
- [ ] Kiểm tra sau quay: FPS thực, số frame giải mã, đủ khớp, ánh sáng, một người.
- [ ] Recording metadata đủ: võ sĩ, buổi, góc, FPS và kích thước thực, thế thủ, điều kiện.
- [ ] Pilot 3 buổi: độ phủ pose đạt, quy trình ổn, nếu không thì quay lại.
- [ ] 32 buổi, 16 võ sĩ, hai góc khác nhau mỗi võ sĩ, đủ ba góc ở từng split.

**Gán nhãn (G1, G3)**

- [ ] Hướng dẫn nhãn v1 khóa sau pilot; ngưỡng đồng thuận đã chốt.
- [ ] Gán toàn timeline, có background và khoảng "không rõ" ghi lý do.
- [ ] Gán kép 100% validation/calibration/test, 25% train; giữ bản A, B và bản phân xử.
- [ ] Báo cáo đồng thuận trước phân xử cho từng split.
- [ ] Chỉ khai `annotationCoverage: exhaustive` sau khi đã kiểm tra.

**Dữ liệu và đóng băng (G3, G4)**

- [ ] Pose trích bằng đúng YOLO, tracker, normalizer đang triển khai; ghi hash và phiên bản.
- [ ] Manifest đầy đủ trường theo AI-TEMPORAL-IMPLEMENTATION; chạy `audit_temporal_dataset.py`.
- [ ] Auditor không còn error; warning đã đọc và ghi lý do giữ.
- [ ] `dataUseApproved: true` chỉ sau khi chủ CLB đối chiếu từng bản đồng ý.
- [ ] Test niêm phong: hash, người giữ, ngày; chưa dùng để chỉnh.
- [ ] Báo cáo dữ liệu nêu rõ giới hạn ở mục 8.

Không đánh dấu hoàn tất chỉ vì code chạy hoặc dữ liệu đã được thu. Nghiệm thu cuối vẫn theo
các release gate (protocol).

## Trạng thái công cụ

Cập nhật 2026-10-06 (cùng ngày với kế hoạch). Công cụ mới chạy được trên video CLB, nhưng **chưa dùng
với dữ liệu CLB thật** và chưa thử với HLV; mô tả và lệnh ở
[AI-COACH-REVIEW-DATASET](./AI-COACH-REVIEW-DATASET.md#gán-nhãn-toàn-timeline-cho-video-clb-mới-2026-10-06).
Bảng quyết định ở mục "Khác biệt với tài liệu hiện có" **không đổi**; bảng dưới chỉ đối chiếu 11
khoảng trống ở mục 4 ("Công cụ duyệt hiện có và khoảng trống").

| # | Khoảng trống | Trạng thái | Ghi chú / quyết định còn chặn |
| --- | --- | --- | --- |
| 1 | Một khoảng/nhãn mỗi task | Đã đóng (video CLB mới) | Thêm, sửa, tách, xóa, hoàn tác nhiều khoảng. Gói 67 task cũ giữ nguyên |
| 2 | Nạp video CLB mới, timeline trống | Đã đóng | `import_club_session.py`: hash, FPS/frame/thời lượng, ID ẩn danh, mã tham chiếu đồng ý. Mỗi gói một video |
| 3 | Độ phủ, khoảng hở, chồng lấn | Đã đóng | Thanh timeline, danh sách khoảng hở, bảng lỗi; không tick "hoàn chỉnh" khi còn lỗi/hở. Công cụ **không** tự khai `annotationCoverage: exhaustive` |
| 4 | Lead/rear, peak, loại background, cờ chất lượng, mức chắc chắn | Đã đóng | Từ vựng lấy theo mục 4; chốt cuối theo hướng dẫn nhãn v1 (tuần 1–2) |
| 5 | Thế thủ theo từng khoảng | Đóng một phần | Bắt buộc cho đòn. Với `background`/`unclear` để trống, **không có mặc định**: chờ quyết định #3 (thế thủ của background) |
| 6 | Mã người duyệt | Đóng một phần | Mã tự do được kiểm tra mẫu ID ẩn danh; file xuất luôn chưa xác thực. Xác thực danh tính HLV vẫn thuộc luồng review/attestation của dự án |
| 7 | So A với B, đồng thuận, phân xử | Đóng một phần | `review_agreement.py`: các chỉ số mục 4 trừ "kết cục phân xử", cộng danh sách phân xử. Chưa có hàng đợi trên giao diện. Không pass/fail: chờ ngưỡng đồng thuận; kết cục phân xử chờ quyết định #6 (trạng thái nhãn đã phân xử) |
| 8 | Frame-exact, VFR/PTS | Đóng một phần | Mốc làm tròn về đầu frame theo FPS khai báo; nhập video cảnh báo lệch số frame và nghi VFR. Chưa kiểm PTS thật (cần ffprobe/PyAV, chưa có trên máy); trình duyệt vẫn không bảo đảm tua đúng frame |
| 9 | Đòn chồng nhau | Chưa làm (có chủ đích) | Chồng là lỗi, khớp auditor single-label. Chờ quyết định #8 và quy tắc trong hướng dẫn nhãn |
| 10 | Nối file xuất vào backend / gold exporter | Chưa làm | Chờ luồng nhập có xác thực của dự án và quyết định #6 |
| 11 | Script nối nhãn đã phân xử thành `dataset.manifest.json` | Chưa làm | Việc của AI engineer tuần 10; chờ quyết định #3, #4, #6 |

Số "xác nhận HLV đã kiểm chứng / đủ điều kiện gold" vẫn là 0: không có đường nào trong công cụ đặt
`coachConfirmed`, `goldEligible` hay `dataUseApproved` thành `true`. Quyết định "chờ công cụ hay dùng
bảng tính tạm" (checklist G0) vẫn là của chủ dự án; công cụ này chỉ làm cho lựa chọn thứ nhất khả dụng
để thử ở pilot.
