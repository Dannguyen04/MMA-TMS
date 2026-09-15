# Kiểm chứng detector đấm/đá — 15/09/2026

## Kết quả đã xác nhận

Inference mới, YOLOv8n-pose, cùng trọng số và độ phân giải mặc định. Sai số ghép sự kiện tối đa **350 ms**, ghép một-một, kiểm tra bên trái/phải khi nhãn biết rõ. Không đánh giá độ chính xác tên kỹ thuật hoặc điểm kỹ thuật.

### So sánh đúng cùng 6 clip kiểm chứng cũ

| Phiên bản — đấm | TP | FP | FN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| Baseline đã lưu | 5 | 15 | 1 | 25,0% | 83,3% | 38,5% |
| Bản sửa, inference mới | 6 | 10 | 0 | **37,5%** | **100,0%** | **54,5%** |

Baseline được tính lại từ `test_results/validation`; dùng thuật toán ghép mới vẫn ra 5 TP / 15 FP / 1 FN. Mức tăng không đến từ đổi cách ghép hoặc đổi tolerance.

### Tập chẩn đoán mở rộng: 9 video/clip, 48 đòn có nhãn

| Loại | TP | FP | FN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| Đấm: 42 đòn | 14 | 10 | 28 | 58,3% | 33,3% | 42,4% |
| Đá/gối: 6 đòn | 1 | 1 | 5 | 50,0% | 16,7% | 25,0% |
| Tổng | 15 | 11 | 33 | 57,7% | 31,3% | 40,5% |

**Không so F1 mở rộng với F1 baseline như một mức cải thiện:** hai tập có nội dung và số nhãn khác nhau.

| Phạm vi mới | Kết quả |
|---|---|
| VIDEO_DATA_002 — đấm | 4 TP / 0 FP / 12 FN |
| VIDEO_DATA_003 — đấm | 4 TP / 0 FP / 16 FN |
| VIDEO_DATA_005 — đá/gối | 1 TP / 0 FP / 4 FN |
| Clip đối kháng vid_04 — đá | 0 TP / 0 FP / 1 FN |
| Clip vật vid_05 — kiểm chứng báo đá giả | 0 TP / 1 FP / 0 FN |

## Thay đổi giữ lại

- Đấm: tính cả quãng vươn tay ở bước bắt đầu ra đòn; trước đây bước này bị bỏ mất, đặc biệt bất lợi ở 25 fps. Áp dụng giới hạn thời gian chu trình trong mọi pha. Xóa lịch sử chuyển động khi khớp mất confidence hoặc hình học không hợp lệ.
- Pose: điểm khớp không đáng tin cậy không kéo tọa độ làm mượt của lần xuất hiện tiếp theo. Pose lưu khi mất detection không được coi là quan sát mới.
- Đá: xét chân riêng lẻ, nhận pha rút gối khi cổ chân còn dưới hông, giữ chân đã chọn trong chu trình và vẫn kiểm tra confidence/hình học. Không tính vận tốc giữa hai chân hoặc xuyên qua khoảng mất quan sát. Hủy chu trình khi tracking đứt hoặc tư thế được nhận là nằm sàn; loại chu trình nhiễu dưới 100 ms.
- Evaluator: ghép tối đa số sự kiện một-một rồi tối thiểu sai số thời gian; chỉ đánh giá loại đòn đã có nhãn; từ chối thời điểm không hợp lệ và cặp video không khớp. Không coi đấm trong file chỉ gắn nhãn đá là báo giả.
- Thêm runner có khả năng tiếp tục bằng hash video/mã detector, evaluator tổng hợp và công cụ replay có ghi rõ giới hạn làm tròn tọa độ.

## Nhãn và giới hạn

- VIDEO_DATA_005 vẫn có 5 đòn. Rà soát ảnh sửa đòn thứ ba từ gối thành vòng cầu; đòn thứ tư để loại kỹ thuật `unknown`; sửa mốc tiếp xúc theo ảnh và lưu lịch sử nhãn cũ. Đòn thứ năm là gối. Không tạo nhãn từ prediction.
- Thêm nhãn đấm tạm thời cho VIDEO_DATA_002/003, nhãn đá của VĐV mục tiêu trong clip đối kháng và một clip vật làm đối chứng. Nhãn mới cần người rà soát độc lập; đây là dữ liệu phát triển/chẩn đoán, **chưa phải tập test độc lập**.
- Nhãn mới không chắc bên đánh được để `unknown`; metric tương ứng chỉ kiểm tra thời gian và loại đòn. Clip đối kháng giữ phạm vi một VĐV mục tiêu như benchmark cũ.
- Không được mặc định cả sáu clip cũ không có đá: vid_04 thực sự có đòn đá. Các loại đòn chưa gắn nhãn không được tự xem là âm tính.
- Nhánh đá vẫn bỏ sót 5/6 đòn và còn một báo giả khi vật. Pose chân thường bị che hoặc ngoài khung hình; máy trạng thái duỗi gối hiện không đủ để nhận gối ổn định. Việc chấm điểm kỹ thuật chưa được chứng minh bằng ground truth chuyên gia.
- VIDEO_DATA_001, 004, 006 chưa có nhãn đầy đủ trên toàn video gốc. **Chưa thể công bố Precision/Recall/F1 cho toàn bộ video-data-test.** Các clip kiểm chứng trích từ 001 không phải video độc lập với 001.

## Kiểm tra và tái lập

**62/62 unittest pass**, cùng các kiểm tra có sẵn trong `test_pose_math.py`; `git diff --check` pass. Regression bao gồm mất confidence, đổi chân, đứt tracking, chu trình quá ngắn/quá hạn, bỏ mất quãng vươn đầu và ghép sự kiện xung đột. Ngưỡng đấm và tolerance benchmark không được nới theo một video.

Chạy trong `python-worker` bằng Python của `.venv`:

```text
python -m unittest discover -q
python run_strike_suite.py --resume --output test_results/strike_final
python evaluate_strike_suite.py test_results/strike_final --output test_results/strike_final/benchmark.json
```

Số liệu chi tiết và hash bằng chứng: [benchmark_results/strike_benchmark_2026-09-15.json](benchmark_results/strike_benchmark_2026-09-15.json). Kết quả chính ở đây dùng inference mới; replay pose đã làm tròn chỉ dùng chẩn đoán, không thay thế số liệu chính.

## Toàn bộ video gốc — đã xử lý xong

Đã chạy đủ **31.921 khung hình** của cả 6 video, cùng detector đã kiểm chứng ở trên. Đây là số lượt detector ghi nhận, không phải số đòn thực tế hoặc metric độ chính xác.

| Video | Frames | Đấm ghi nhận | Đá ghi nhận |
|---|---:|---:|---:|
| VIDEO_DATA_001.mp4 | 13611 | 58 | 9 |
| VIDEO_DATA_002.mp4 | 375 | 4 | 0 |
| VIDEO_DATA_003.mp4 | 232 | 4 | 0 |
| VIDEO_DATA_004.mp4 | 2257 | 0 | 0 |
| VIDEO_DATA_005.mp4 | 362 | 5 | 1 |
| VIDEO_DATA_006.mp4 | 15084 | 50 | 0 |

VIDEO_DATA_004 có cảnh tập bao cát nhưng detector ghi 0 đòn: đây là hạn chế còn tồn tại, không phải kết luận video không có đòn. Cần kiểm chứng lựa chọn mục tiêu và pose trong video này trước khi khẳng định độ chính xác trên toàn tập.
