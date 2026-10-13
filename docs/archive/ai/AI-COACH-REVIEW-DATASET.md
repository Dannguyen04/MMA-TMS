# Bộ dữ liệu chờ HLV xác nhận — 2026-10-05

Đã tạo dữ liệu thực và công cụ duyệt cục bộ theo yêu cầu chủ dự án. Trạng thái
hiện tại là `PENDING_COACH_REVIEW`: **0 mẫu có xác nhận HLV đã được kiểm chứng**.
AI chuẩn bị dữ liệu, nguồn nhãn, bằng chứng và công cụ; không tự nhận vai trò HLV.

Ngày 2026-10-06 đã có [lượt rà soát bằng frame của AI](./AI-DATASET-REVIEW-20261006.md)
cho 67 task RGB. Có dấu hiệu nhãn Adam lệch động tác; nhãn AI vẫn là đề xuất,
chưa nâng bất kỳ mẫu nào thành dữ liệu HLV xác nhận.

## Gói đã xây

Thư mục bàn giao: `python-worker/test_results/coach_review_dataset/20261005_v2/`.
Các bản v1 là bản phát triển; dùng v2 và máy chủ hỗ trợ HTTP Range bên dưới.
Video và dữ liệu lớn chỉ lưu cục bộ, được Git bỏ qua. Thống kê và SHA-256 được
lưu tại [báo cáo JSON](../../../python-worker/benchmark_results/coach_review_dataset_20261005.json).

| Thành phần | Số lượng / trạng thái |
| --- | --- |
| Skeleton hợp lệ từ mirror BoxingVI | 4.754 mẫu; nhãn upstream chưa xác nhận |
| Video xem được trong gói | 7: Adam và 6 video validation có sẵn |
| Khoảng video cần duyệt | 67; không đồng nghĩa với 67 đòn |
| Khoảng có gợi ý từ CSV nguồn | 18 |
| Khoảng chưa có nhãn | 49; không tự coi là background |
| Khoảng bị chồng ranh giới nguồn | 6; giữ nguyên để phân xử |
| Dòng nguồn lỗi bị cách ly | 12; V6 bị loại riêng vì schema frame-level |
| Nhãn HLV đã kiểm chứng / đủ điều kiện gold | 0 / 0 |

Phân bố nhãn skeleton nhập từ nguồn: jab 1.282, cross 1.370, lead hook 907,
rear hook 296, lead uppercut 428, rear uppercut 471. Đây là thống kê nhãn nguồn,
không phải thống kê nhãn đã được HLV của dự án xác nhận.

`research_features.npz` chứa feature lịch sử `(4754, 25, 85)` và nhãn upstream;
`research_samples.json` ánh xạ từng hàng về video/row nguồn. 4.754 mẫu này chưa có
RGB tương ứng trong gói, nên chưa thể dùng giao diện video để xác nhận chúng.
Không đồng nhất corpus skeleton với 67 khoảng review RGB.

## Mở và sử dụng

Chạy PowerShell tại `D:\test\ai\python-worker`:

```powershell
& '.\.venv\Scripts\python.exe' serve_coach_review_dataset.py test_results/coach_review_dataset/20261005_v2
```

Mở <http://127.0.0.1:8768/review.html>. Máy chủ chỉ nghe localhost và chỉ phục vụ
thư mục gói này. Giữ cửa sổ chạy máy chủ trong khi duyệt. Không dùng máy chủ
`http.server` mặc định cho video MP4 phân mảnh: khi kiểm tra Adam, trình duyệt
chỉ đọc một phần thời lượng nếu không hỗ trợ byte range. Máy chủ kèm theo đã được
kiểm tra tua tới 18,13 giây, gần cuối video khoảng 20 giây.

1. HLV dùng mã người duyệt thật của mình, chọn đoạn, xem chậm và xem ngữ cảnh.
2. Xác định nhãn/thế thủ và sửa mốc bắt đầu/kết thúc. Nhãn nguồn ẩn mặc định;
   chỉ mở sau đánh giá độc lập nếu cần đối chiếu.
3. Chọn đủ bằng chứng, chưa đủ bằng chứng hoặc ngoài phạm vi. Khoảng 2 giây
   chỉ là cửa sổ tìm kiếm; nếu có nhiều đòn, cần tách annotation ở bước tiếp nhận.
   Giao diện hiện lưu một khoảng/nhãn cho mỗi task; sửa lại tạo revision,
   không tự tạo nhiều event độc lập. Không khai báo annotation đã phủ hết video.
4. Lưu bản duyệt cục bộ rồi xuất JSON để bàn giao. Browser storage có thể mất khi
   xóa dữ liệu duyệt web; file xuất mới là bản bàn giao. Mỗi HLV duyệt độc lập
   dùng browser profile riêng, tránh đọc bản nháp của nhau trên cùng máy.
5. Người phụ trách xác minh danh tính/tư cách HLV, nguồn video và quyền sử dụng;
   giải quyết bất đồng trước khi nhập qua luồng review/attestation của dự án.

File xuất có `LOCAL_REVIEW_UNVERIFIED`, `reviewerAuthenticated: false`,
`coachConfirmed: false`, `goldEligible: false`. Mã người duyệt nhập bằng tay
không thay thế đăng nhập hoặc chữ ký xác thực. Công cụ chưa tự đồng bộ vào backend;
không đưa file xuất thẳng vào gold exporter hoặc tự đổi cờ approval.

## Tái tạo

```powershell
& '.\.venv\Scripts\python.exe' build_coach_review_dataset.py --output test_results/coach_review_dataset/new_pack
```

Đường dẫn output phải chưa tồn tại. Builder kiểm tra SHA-256 toàn bộ nguồn pinned
theo audit nghiên cứu trước khi tạo gói, giải mã toàn video, kiểm tra checksum
bản sao và ghi hash các artifact. Không tải thêm video hoặc chạy mã từ bên ngoài.

Mốc gợi ý dùng frame index / FPS khai báo, chưa xác minh VFR. Adam có 597 frame
giải mã thay vì 600 khai báo; trình duyệt báo khoảng 20,002 giây, khác 19,900 giây
tính từ frame giải mã. Nút bước frame là bước thời gian theo FPS, không bảo đảm
frame-exact seeking. HLV phải đối chiếu timeline thực; cần kiểm tra PTS trước
khi chuyển ranh giới sang frame để huấn luyện. Không tự nén timeline hay coi
những khác biệt này là bằng chứng nhãn chính xác.

## Căn cứ nguồn và giới hạn

- [BoxingVI, bài báo gốc](https://arxiv.org/html/2511.16524v1) mô tả dataset và
  ghi nhận cộng tác của HLV. Điều đó không cung cấp biên bản xác nhận từng mẫu
  cho mirror đang dùng trong dự án.
- [BoxMAC, bài báo gốc](https://arxiv.org/html/2412.18204v1) mô tả người gán nhãn
  dưới sự hướng dẫn của HLV. Chưa nhập dữ liệu BoxMAC vì chưa xác minh được gói
  tải trực tiếp và hồ sơ nguồn phù hợp. Không ghi BoxMAC vào số lượng đã có.
- 6 video validation có thể chứa nhiều người, thi đấu hoặc hoạt động ngoài solo
  boxing. Tên file không phải ground truth; nhãn dự đoán/đánh giá cũ không được
  chuyển thành nhãn HLV. Không coi đây là dữ liệu CLB mới thu.
- Không tự tạo ID võ sĩ/buổi quay, quyền sử dụng hoặc tập test mù. Những video
  này đã được quan sát trong nghiên cứu; duyệt lại không tạo test độc lập mới.
- Bộ này hỗ trợ nhận dạng loại đòn/thời gian. Chưa có rubric và nhãn đủ để học
  chấm chất lượng kỹ thuật. Thu dữ liệu CLB mới vẫn theo
  [quy trình thu thập và gán nhãn](./AI-DATA-COLLECTION-PROTOCOL.md).

## Kiểm chứng đã chạy

36 test đạt cho builder, auditor temporal và HTTP Range: giữ gap chưa nhãn,
giữ overlap, cách ly interval lỗi, từ chối hash nguồn thay đổi, không tự cấp
approval/identity/split, không ghi đè pack, đáp ứng GET/HEAD range và từ chối
range lỗi. Kiểm tra trình duyệt: mở video Adam và heavybag, tua đoạn cuối Adam,
xuất JSON rỗng thành công, số nhãn HLV đã kiểm chứng vẫn 0. Không tạo bản duyệt
giả danh HLV để kiểm thử. Kiểm thử này xác nhận công cụ, không xác nhận nhãn.

## Gán nhãn toàn timeline cho video CLB mới (2026-10-06)

Gói 67 task ở trên giữ nguyên (một khoảng/nhãn cho mỗi task, dùng để HLV làm quen). Video CLB
mới dùng bộ công cụ riêng, bám [kế hoạch dữ liệu CLB](./AI-CLUB-DATA-PLAN-20261006.md). Bộ này chưa
được dùng với dữ liệu CLB thật: chưa có buổi quay nào, và đã được thử trên clip nghiên cứu cũ với ID
giả (`test_results/review_tool_demo_20261006/`, nhãn tùy ý, không phải nhãn thật).

### Lệnh

Chạy PowerShell tại `D:\test\ai\python-worker`:

```powershell
# 1. Nhập một video buổi quay thành gói (mỗi gói một video; output phải chưa tồn tại)
& '.\.venv\Scripts\python.exe' import_club_session.py --video D:\club\raw\clip.mp4 `
    --source-video-id F007_S1 --fighter-id F007 --session-id S1 --consent-ref CONSENT-F007 `
    --camera-view front --declared-stance orthodox --guide-version v1 --output local-data/review_packs/F007_S1

# 2. Mở gói (cùng máy chủ HTTP Range như trên) rồi vào http://127.0.0.1:8768/review.html
& '.\.venv\Scripts\python.exe' serve_coach_review_dataset.py local-data/review_packs/F007_S1

# 3. Sau khi hai người gán độc lập đã xuất file: so hai bản (nhiều video cùng split: lặp --pair A B)
& '.\.venv\Scripts\python.exe' review_agreement.py annotation-F007_S1-ANN-A.json annotation-F007_S1-ANN-B.json --output-dir out/F007_S1
```

### Nhập buổi quay

`import_club_session.py` giải mã toàn video, ghi SHA-256, FPS khai báo, số frame giải mã và khai báo,
kích thước, thời lượng (frame giải mã / FPS) và dao động mốc thời gian vào `review_index.json`; bản
sao video nằm ở `media/<sourceVideoId>.mp4`. Chỉ nhận ID ẩn danh (`sourceVideoId`, `fighterId`,
`sessionId`, `--consent-ref`: chữ không dấu, số, `.`, `_`, `-`); tên thật, email, số điện thoại bị từ
chối. **Tên file gốc không được ghi lại.** `--consent-ref` chỉ là mã tham chiếu bản đồng ý do chủ CLB
giữ; `consentVerified`, `identityVerified`, `dataUseApproved` luôn `false`, và công cụ không có tùy
chọn nào để đổi chúng. Cảnh báo (không chặn nhập): `LOW_FPS` (< 20), `FPS_NOT_30`,
`FRAME_COUNT_MISMATCH`, `VFR_SUSPECTED` (mốc thời gian dao động quá nửa frame),
`NO_CONSENT_REFERENCE`. `variableFrameRateVerified` luôn `false`: OpenCV có thể suy mốc từ chỉ số
frame nên việc không thấy dao động không chứng minh FPS cố định.

### Giao diện gán nhãn (`review_tools/club_timeline.html`)

- Timeline ban đầu **trống**; khoảng chưa gán hiển thị sọc và được liệt kê, không bao giờ tự thành
  background. Không có gợi ý mô hình.
- Nhiều khoảng nửa mở `[bắt đầu, kết thúc)` cho mỗi video: sáu lớp đòn, `background` (kèm loại:
  đứng yên, footwork, nâng-hạ guard, chỉnh găng, block, parry, feint, slip/bob, đổi thế thủ, khác),
  `unclear` (bắt buộc lý do: che khuất, ra ngoài khung, nhiều người, mờ chuyển động, thiếu sáng,
  camera dịch, track đứt, pose kém, khác + ghi chú). Với đòn: peak (tùy chọn, phải nằm trong
  khoảng), tay lead/rear, thế thủ orthodox/southpaw (bắt buộc); cờ chất lượng, mức chắc chắn
  (`uncertain` đi vào phân xử), ghi chú. Thêm, sửa, tách tại playhead, xóa, hoàn tác.
- **Chồng lấn không bị bỏ qua**: khoảng chồng vẫn được lưu nhưng báo trong thông báo, viền đỏ trên
  timeline, ở bảng kiểm tra và trong file xuất (`validation.errors`); không tick được "timeline đã
  hoàn chỉnh" khi còn lỗi hoặc khoảng hở. Lead/rear lệch tên lớp (ví dụ jab ghi rear) là cảnh báo.
- Thế thủ của `background`/`unclear` để trống nếu người gán không điền; **không có giá trị mặc định**
  (chưa có quyết định chung, xem [kế hoạch](./AI-CLUB-DATA-PLAN-20261006.md#trạng-thái-công-cụ)). Ô
  "nhớ thế thủ" mặc định tắt và chỉ áp cho đòn.
- Phím tắt (bỏ qua khi đang gõ trong ô nhập): Space phát/dừng; `,` `.` hoặc ← → bước 1 frame
  (Shift: 10); `[` `]` `p` lấy start/end/peak từ playhead (làm tròn xuống đầu frame theo FPS khai
  báo; end là frame đầu tiên *sau* khoảng, nên khoảng liền nhau dùng chung mốc); `1`–`6` lớp đòn, `0`
  background, `u` không rõ; `f`/`b` lead/rear; `o`/`s` orthodox/southpaw; Enter lưu (mốc bắt đầu
  của khoảng kế tiếp lấy từ cuối khoảng vừa lưu); `n` khoảng mới; `x` tách; Delete xóa; ↑ ↓ chọn;
  Ctrl+Z hoàn tác.
- Mã người gán là **mã tự khai**, kiểm tra theo mẫu ID ẩn danh (không dấu, không khoảng trắng, không
  `@`). Bản nháp lưu trong trình duyệt theo gói + mã người gán; file xuất mới là bản bàn giao
  `annotation-<sourceVideoId>-<annotatorId>.json` (`club_timeline_annotation_v1`). File luôn có
  `status: LOCAL_REVIEW_UNVERIFIED`; `reviewerAuthenticated`, `annotatorIdentityVerified`,
  `coachConfirmed`, `goldEligible` đều `false`; `annotationCoverage: unverified`. Giao diện và
  `review_agreement.py` không có đường nào đặt các trường này thành `true`, và file tự nhận đã xác
  thực bị `review_timeline.py` từ chối.

### So hai người gán (`review_agreement.py`)

Nhận hai file của cùng một video (cùng SHA-256, hai mã người gán khác nhau; cùng một mã hai lần bị
từ chối vì không độc lập), kiểm tra lại timeline từ đầu (không tin trường `validation` trong file;
còn chồng lấn thì dừng). Xuất `agreement_report.json`, `agreement_summary.txt` và
`adjudication_queue.json`. Số liệu ở IoU 0,1 / 0,3 / 0,5, theo từng video và (nhiều cặp) gộp:

- Ghép sự kiện một-một, tham lam theo IoU giảm dần, không xét lớp; F1 = 2·ghép/(số đòn A + số đòn B),
  số đòn chỉ một người thấy.
- Lớp đòn trên các cặp đã ghép: phần trăm đồng ý, Cohen's kappa (`null` khi không xác định, ví dụ cả
  hai chỉ dùng một nhãn), ma trận nhầm (hàng A, cột B), đồng thuận riêng từng lớp = 2·cả hai/(A gọi
  + B gọi).
- Đồng thuận lead/rear và thế thủ trên cặp đã ghép (kèm kappa), và thế thủ theo thời gian (chỉ tính
  đoạn cả hai đều có ghi thế thủ).
- Sai lệch ranh giới start/end/peak (B − A): median và p95 của trị tuyệt đối (nội suy tuyến tính),
  median có dấu.
- Danh sách phân xử (ghép ở IoU 0,1 trừ khi đặt `--disagreement-iou`): khác lớp, khác lead/rear, khác
  thế thủ, đòn chỉ một người gán (kèm khoảng của người kia đè lên, ví dụ feint), một bên `uncertain`.
  Mỗi mục `PENDING_ADJUDICATION`, `resolution: null`.

Báo cáo **không có pass/fail**: ngưỡng chấp nhận độ đồng thuận chưa được chốt. Chênh ranh giới chỉ
thành mục phân xử khi truyền `--boundary-tolerance-ms` (không có mặc định). `coachConfirmedCount` và
`goldEligibleCount` luôn 0. Không ghi kết cục phân xử hay `reviewStatus` của nhãn đã phân xử.

### Kiểm chứng và giới hạn

Logic timeline nằm trong `review_tools/timeline_core.js` (không đụng DOM) và bản Python
`review_timeline.py`; `test_club_timeline_core.py` chạy cả hai bằng Node và so kết quả. Thêm 90 test
(nhập, schema xuất, chồng lấn/khoảng hở, chỉ số đồng thuận tính tay trên ví dụ nhỏ). Ngoài ra đã chạy
giao diện thật trong Edge headless qua DevTools Protocol trên gói demo: video H.264 mở được qua máy chủ
Range; phím tắt; lưu/tách/xóa/hoàn tác; chồng lấn được báo; khoảng không rõ thiếu lý do và đòn thiếu
thế thủ bị từ chối; xuất file; khôi phục bản nháp sau tải lại; hai mã người gán không thấy bản nháp của
nhau. Đây là kiểm tra tự động, **chưa phải thử nghiệm với HLV thật**, chưa đo thời gian gán, và chưa
thử trên Chrome/Safari/điện thoại. Giới hạn đã biết:

- Mốc lấy theo FPS khai báo; trình duyệt không bảo đảm tua đúng từng frame. Trên clip demo trình
  duyệt báo 20,002 s trong khi 597 frame giải mã tương ứng 19,900 s. Chưa kiểm PTS bằng
  ffprobe/PyAV (máy này không có).
- Không biểu diễn đòn chồng thời gian (khớp giới hạn single-label của auditor): chồng là lỗi.
- Một gói một video. Chưa có hàng đợi phân xử trên giao diện, chưa nối vào backend hay gold exporter,
  chưa có script dựng `dataset.manifest.json` từ nhãn đã phân xử.
