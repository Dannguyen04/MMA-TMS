# Kiểm định AI bằng dữ liệu ngoài hệ thống — 2026-10-03

Tiếp nối ngày 2026-10-05: đã triển khai nền tảng temporal và chạy so sánh ba kiến
trúc × ba seed. Xem [báo cáo mới](./worker-reports/TEMPORAL_AI_RESEARCH_REPORT.md).
Các số liệu ngày 2026-10-03 bên dưới được giữ nguyên làm lịch sử; V9/V10 và Adam
vẫn là dữ liệu đã quan sát, không trở thành test mù mới ở vòng tiếp theo.

## Kết luận

**Chưa đạt production về độ chính xác AI.** Đã thực sự tải dữ liệu, huấn luyện và
chạy inference toàn bộ video; kết quả không đạt mục tiêu trong implementation_plan.
Mô hình mới không được thay thế pipeline active. Không có deploy cloud/DB hay
chi phí GPU. Nhận dạng loại đòn và đánh giá đòn đúng kỹ thuật là hai bài toán khác
nhau; dữ liệu đã tìm không có nhãn chất lượng kỹ thuật được HLV xác nhận độc lập.

## Dữ liệu và cách đo

- Nguồn nghiên cứu: [BoxingVI](https://arxiv.org/html/2511.16524v1), mirror
  [boxe.ml tại commit cố định](https://github.com/leonardosm14/boxe.ml/tree/96f3a7d0716040682381fb63f80afac96f74cfa6).
- Tải 10 tệp skeleton, 10 bảng nhãn và `videos/adam.mp4` cùng `evaluation/adam_gt.csv`.
  Không chạy notebook hoặc mô hình bên thứ ba. Tệp NPY đọc với `allow_pickle=False`.
- 5.451 hàng nhãn tổng cộng; cách ly 685 hàng V6 vì skeleton frame-level không
  khớp định dạng clip-level; loại thêm 12 hàng lỗi khoảng frame/thiếu pose.
  Còn 4.754 clip hợp lệ: train 3.660 (V1/V2/V3/V4/V7), validation 199 (V8),
  calibration 595 (V5), test 300 (V9/V10). Test gốc có 301 hàng, một hàng lỗi bị
  cách ly; số liệu classifier dưới đây chỉ tính 300 clip hợp lệ.
- Không chia ngẫu nhiên clip giữa các tập. Phát hiện trùng skeleton nguyên vẹn
  qua split sẽ dừng huấn luyện. Chưa xác minh được khác võ sĩ giữa video;
  đây không phải protocol hoặc full test set chính thức của BoxingVI.
- Giữ nguyên CSV nguồn; chỉ chuẩn hóa chữ hoa/khoảng trắng khi đọc và ghi lại hàng
  bị loại. Kiểm tra bảng nhãn theo skill Spreadsheets giúp tránh lệch thứ tự nhãn
  khi bỏ hàng lỗi. SHA-256 nằm trong `boxing_data_audit.json`.
- Video adam: 408×720, 30 fps, container khai báo 600 frame; OpenCV giải mã được
  597 frame. Đã đọc đến hết video, không dùng `max_frames`. 18 nhãn, ba đòn mỗi
  loại, đều nằm trong vùng giải mã được. Mỗi inference đầy đủ khoảng 30 giây trên CPU.

## Kết quả đo thật

| Phép đo | Kết quả | Giới hạn diễn giải |
| --- | ---: | --- |
| TCN sáu lớp: accuracy trên V9/V10 | 47.0% (141/300) | Clip có ranh giới chuẩn, không phải detection |
| TCN sáu lớp: macro-F1 | 0.379 | Mục tiêu >= 0.85 chưa đạt |
| Gộp họ straight/hook/uppercut: accuracy | 69.0% | Không phân biệt jab/cross hoặc lead/rear |
| Calibration ECE, 10 bins, V9/V10 | 0.227 | Mục tiêu <= 0.05 chưa đạt |
| Ngưỡng xác suất 0.8 trên V9/V10 | nhận 98/300, đúng 67/98 | Confidence cao vẫn sai; không dùng làm policy production |
| TCN trên 18 đoạn chuẩn adam, chưa abstain | 6/18 đúng | Domain shift pose/góc máy; không phải end-to-end |
| Legacy detector trên adam, IoU >= 0.1 | TP 8, FP 5, FN 10; F1 0.516 | Nhãn thời gian, không có impact thật |
| Shadow detector trên adam, IoU >= 0.1 | TP 8, FP 3, FN 10; F1 0.552 | Precision 0.727, recall 0.444 |
| Shadow detector trên adam, IoU >= 0.5 | TP 4, FP 7, FN 14; F1 0.276 | Báo cả ngưỡng chặt để không che lỗi ranh giới |

Ghép sự kiện tối đa một-một, class-agnostic; nhiều dự đoán cho cùng một đòn không
làm tăng recall. Không coi giữa đoạn nhãn là thời điểm impact. FP giả định nhãn
nguồn phủ hết video; độ phủ này chưa được HLV kiểm tra lại. Chỉ một video mới không
đủ chứng minh tổng quát hóa. V9/V10 và adam đã được quan sát; không tiếp tục tinh
chỉnh trên chúng rồi tuyên bố là test mù của phiên bản kế tiếp.

Mô hình: temporal CNN hai lớp, sáu nhãn, seed 20261003; chọn epoch 53 bằng V8,
temperature 1.08765 bằng V5. Python 3.11.15, NumPy 2.4.6, Torch 2.14.0+cpu.
Checkpoint số: `python-worker/test_results/boxing_research/run01/model.npz`.
Hash weights: `23898c2a5f646e3a0a1a2700cd97e413b0ae801debd8bf6647a66d391142fee1`.
Không có lớp background nên mô hình này không thể tự chứng minh một đoạn có đòn đánh.

## Thay đổi bảo vệ đầu ra

- Chặn score/grade “PERFECT”, findings và lời khuyên khẳng định từ rubric chưa được
  kiểm định, kể cả video vượt quality gate. Quality tốt không đồng nghĩa kỹ thuật đúng.
- Giữ ID, mốc thời gian, pose và các đại lượng chuyển động để HLV review. Nhãn
  heuristic được giữ ở `experimentalTechnique`, nhãn authoritative chưa xác định.
- Callback cũng áp dụng cùng policy, không khôi phục score từ payload cũ.
- Frontend hiển thị `Punch (unclassified)`; bỏ quy tắc đoán hook/cross từ góc cùi chỏ.
- Chặn combo confidence lấy từ rubric; baseline tự động không được kích hoạt.
- Sửa detector shadow để ranh giới mở rộng không vượt qua khoảng mất frame.

Đây là chặn output không đáng tin, **không phải cải thiện accuracy thành công**.
Các metric giao diện legacy như vận tốc quy đổi, balance/footwork proxy vẫn cần
làm rõ tính chất ước lượng trước khi phát hành sản phẩm đầy đủ.

## Định hướng sản phẩm

[Jabbr DeepStrike](https://jabbr.ai/deepstrike) nhấn mạnh thống kê, highlights và
quy trình quay/phân tích video; đó là tín hiệu sản phẩm tham khảo, không là bằng
chứng mô hình hiện tại có cùng khả năng. Ưu tiên phù hợp ở đây là timeline ứng viên,
review/sửa nhãn và theo dõi tiến bộ **sau khi HLV duyệt**. Không đưa chấm lực đấm,
tự chấm trận hoặc đánh giá kỹ thuật tuyệt đối vào phạm vi này.

## Điều kiện còn chặn production

1. Quyền sử dụng thương mại/consent của video và dữ liệu upstream chưa được xác minh.
   MIT của repo phần mềm không tự mở quyền thương mại cho dữ liệu bên thứ ba.
2. Cần dữ liệu pose cùng pipeline triển khai, background/hard negatives, protocol
   quay solo và metadata võ sĩ/góc máy/thế thủ. Không chỉ tăng epoch trên clip cắt sẵn.
3. Cần bộ kiểm định mới tách võ sĩ/nguồn, đủ từng kỹ thuật, hai HLV gán nhãn độc lập
   và xử lý bất đồng; thêm nhãn đúng/sai kỹ thuật nếu muốn bật chấm kỹ thuật.
4. Cần đạt detection, classification, calibration và coach-agreement gates của kế
   hoạch. Quyền truy cập dữ liệu/HVL không thể tự chứng nhận bằng code hoặc nhãn AI.
5. Full UI/browser acceptance, persistence DB thật và container build vẫn chưa được
   kiểm định trong lượt này. Docker daemon trên máy không chạy.

## Tái lập và artifact

Lệnh tải/học/đánh giá trong `python-worker/README.md`. Báo cáo máy đọc:

- `python-worker/benchmark_results/boxing_data_audit.json`
- `python-worker/benchmark_results/boxing_research_run01.json`
- `python-worker/benchmark_results/boxing_research_model_card.json`
- `python-worker/benchmark_results/external_adam_report.json` — baseline trước chặn output.
- `python-worker/benchmark_results/external_adam_guarded_report.json` — sau chặn output.

Inference JSON cũ có hash nhưng chưa có manifest runtime tại thời điểm sinh;
`cachedInferenceRuntimeVerified=false` nêu rõ giới hạn đó. Raw video và weights
được giữ cục bộ trong thư mục ignored, không commit/phát hành.

Kiểm thử: 824 Python tests + 105 subtests qua; 77 frontend tests liên quan + một
cross-language smoke test đọc JSON thực qua; frontend `tsc --noEmit` qua. Các
kiểm thử này chứng minh contract, không chứng minh accuracy. Lệnh pnpm kiểm tra
đã tự sắp xếp lại dependency links trước khi lỗi mạng; đã khôi phục từ cache có
sẵn, giữ bản types cũ trong `nextjs-frontend/test_results/dependency-recovery/`,
không đổi manifest/lockfile hoặc cài thêm package.
