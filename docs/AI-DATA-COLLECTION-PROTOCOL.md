# Thu thập và gán nhãn dữ liệu solo boxing

Ngày: 2026-10-05. Chủ dự án xác nhận chưa có bộ dữ liệu HLV xác nhận.
Tài liệu này là quy trình để xây dữ liệu; không phải xác nhận dữ liệu đã tồn tại.

## Mục tiêu và phạm vi

Vòng đầu phục vụ hai nhiệm vụ: tìm khoảng ra đòn trong video liên tục và phân
loại jab/cross/lead hook/rear hook/lead uppercut/rear uppercut. Chấm chất lượng
kỹ thuật có bộ nhãn criterion riêng ở vòng sau. Solo, camera cố định, một võ sĩ;
không gán nhãn sparring bằng contract single-label này.

Mục tiêu từ Coaching Spec §15.3: 20–30 võ sĩ, orthodox và southpaw, nhiều trình độ
và hình thể, 200–500 action đã xác thực cho mỗi lớp chính. Đây là mục tiêu thu
thập ban đầu, không bảo đảm accuracy. Dự kiến số người mỗi split sau khi kiểm kê
thực tế; không chia ngẫu nhiên các clip của một người giữa train và test.

## Phân công

| Vai trò | Công việc và bàn giao |
| --- | --- |
| Chủ dự án/CLB | Chọn protocol quay, người tham gia, điều kiện sử dụng dữ liệu và người quản lý file |
| Người quay | Video gốc, ID võ sĩ ẩn danh, buổi quay, góc máy, FPS/kích thước thực, thế thủ và điều kiện quay |
| HLV A/B | Gán nhãn độc lập trên một phần dữ liệu; test/calibration ưu tiên hai người; không xem gợi ý mô hình trước khi chốt gold label |
| HLV phân xử | Giải quyết bất đồng kỹ thuật, bên tay, ranh giới và phần không quan sát được |
| AI engineer | Trích pose, kiểm tra chất lượng, version/hash, audit leakage, huấn luyện và đo lỗi |

Không ghi tên thật, chẩn đoán hoặc thông tin y tế vào tên file và manifest ML.
Điều kiện đồng ý sử dụng video và quyền truy cập áp dụng theo quy trình dự án.
Auditor không tự xác nhận các điều kiện này từ một cờ JSON.

## Quay và bàn giao

1. Quay thử 2–3 người để kiểm tra đủ khớp, ánh sáng, chuyển động nhanh và timestamp.
   Giữ video gốc; tránh cắt/đổi tốc độ trước khi trích pose. Kiểm tra chất lượng
   sau khi giải mã, không chỉ tin FPS khai báo của container.
2. Trong mỗi buổi, quay cả đòn đơn và chuỗi đòn với khoảng nghỉ tự nhiên. Không
   chỉ quay mẫu hoàn hảo hoặc xóa hết đoạn không ra đòn.
3. Bổ sung hard negatives: đi lại, footwork, chỉnh găng, nâng/hạ tay thủ, block,
   parry và feint. Quy tắc strike/feint phải được HLV thống nhất trước khi gán nhãn.
4. Ghi rõ góc front/side/diagonal. Thu cả orthodox/southpaw; không dùng "tay trái"
   làm đồng nghĩa với jab. Nếu đổi thế thủ, chia khoảng có metadata tương ứng.
5. Đoạn bị che, ra ngoài ảnh, nhiều người hoặc camera di chuyển phải được đánh
   dấu. Không chuyển khớp không nhìn thấy thành nhãn “sai kỹ thuật”.
6. Lưu một video gốc cho mỗi `sourceVideoId`; mọi clip dẫn xuất kế thừa ID nguồn,
   `fighterId` và `sessionId`. Giữ nguồn nhiều góc của cùng buổi trong cùng split.

Cấu trúc bàn giao đề xuất, chưa tạo dữ liệu giả:

```text
local-data/
  videos/<sourceVideoId>.mp4
  recording-metadata.json
  annotations/<sourceVideoId>.json
  inference/<sourceVideoId>.json
  normalized/<sourceVideoId>/manifest.json + segment_*.npz
  dataset.manifest.json
```

## Quy tắc nhãn

- Xem video gốc, gán `startTimeMs` và `endTimeMs` trên timeline nguồn; thống nhất
  định nghĩa bắt đầu/hoàn tất chu kỳ trước pilot, rồi khóa phiên bản hướng dẫn.
- `technique`: một trong sáu kỹ thuật hoặc `background`. Gán đoạn background
  tường minh; khoảng chưa gán nhãn vẫn là chưa biết, không tự trở thành negative.
- Jab/cross cần bằng chứng thế thủ và tay trước/tay sau; không chắc thì chuyển
  HLV phân xử hoặc loại khỏi tập supervised có nhãn chắc chắn.
- Video shadowboxing không có impact thật. Có thể gán peak extension nếu cần,
  nhưng không đổi tên nó thành thời điểm chạm đích.
- Mỗi action lưu annotator ID và review status. Hai lần gán nhãn từ cùng một HLV
  không phải hai người độc lập. Lưu cả bản gốc và bản phân xử để xem bất đồng.
- Các action chồng thời gian cần xử lý riêng; auditor hiện từ chối chồng lấn vì
  contract single-label. Không ép sửa nhãn gốc cho vừa phần mềm hoặc xóa mẫu khó.
- Chỉ khai báo `annotationCoverage: exhaustive` sau khi đã kiểm tra toàn phạm vi
  video dùng để đánh giá. Nếu chỉ nhãn vài clip, không tính FP/phút như đã phủ hết.

Nhãn chất lượng ở giai đoạn sau phải có criterion, mức độ, bằng chứng thời gian,
điều kiện quan sát, reviewer và version rubric. Đòn từ võ sĩ chuyên nghiệp không
tự mang nhãn “đúng”; HLV vẫn đánh giá theo criterion và ngữ cảnh phù hợp.

## Chia tập và đóng băng

1. Lập nhóm theo võ sĩ trước; mọi buổi/video/clip của một người nằm trong một split.
   Xử lý mọi liên hệ nguồn trùng trước khi đóng băng, kể cả nhiều tên file.
2. Train để học weights; validation để chọn kiến trúc/epoch; calibration để fit
   temperature và policy abstention; test mới chỉ dùng cho nghiệm thu cuối.
3. Kiểm tra đủ lớp/góc/thế thủ ở từng tập. Không để thiếu một lớp như rear_hook ở
   V8 hiện tại rồi gọi macro-F1 đó là nghiệm thu toàn taxonomy.
4. Chạy auditor. Giải quyết lỗi grouping, checksum, pose interval và reviewer;
   không tự chuyển split để làm đẹp metric.
5. Đóng băng manifest/hash/hướng dẫn nhãn. Ghi người và thời điểm mở test. Sau khi
   dùng test để phân tích và điều chỉnh, ghi `testObserved: true`; chuẩn bị test
   mới cho vòng nghiệm thu tiếp theo.

## Checklist bàn giao dữ liệu cho AI engineer

- [ ] Video và recording metadata thực, có ID nhóm rõ ràng.
- [ ] Quyền dùng dữ liệu đã được người phụ trách xác nhận và lưu căn cứ.
- [ ] Nhãn kỹ thuật/thời gian, hard negatives và phạm vi annotation được khai báo.
- [ ] Nhãn được HLV duyệt, mẫu gán nhãn kép và lịch sử phân xử bất đồng.
- [ ] Tách bốn tập theo võ sĩ, buổi quay và video nguồn; đủ các lớp và strata.
- [ ] Pose do đúng phiên bản pipeline YOLO triển khai sinh ra, có timestamp/kích thước ảnh.
- [ ] Chạy `prepare_temporal_pose.py`; giữ mask, coverage và lý do loại trừ.
- [ ] Hoàn thiện manifest theo `AI-TEMPORAL-IMPLEMENTATION.md`, chạy
      `audit_temporal_dataset.py`; kiểm tra cả errors lẫn warnings.
- [ ] Bộ test độc lập được đóng băng và chưa dùng để chỉnh mô hình.

Không đánh dấu checklist hoàn tất chỉ vì code chạy hoặc các kiểm thử tổng hợp qua.
Sản phẩm nghiệm thu cuối vẫn theo các release gate trong
`AI_COACHING_RELIABILITY_PLAN.md`.
