# Duyệt chéo dữ liệu bằng Gemini

**Quyết định mới nhất:** chủ dự án đã [chốt nhãn Adam gốc](./AI-ADAM-LABEL-DECISION.md).
Kết quả Gemini bên dưới là đối chiếu lịch sử; không ghi đè nhãn Adam và không
còn yêu cầu loại bốn mẫu bất đồng khỏi train chỉ vì hai AI khác nhau.

Tích hợp ngày 2026-10-06 trong `python-worker/gemini_dataset_review.py`.
Key được đọc từ biến môi trường hoặc `python-worker/.env`; không lưu key, header
xác thực hoặc payload video base64 trong báo cáo. `.env` được Git bỏ qua.

## Phạm vi lượt đầu

- 9 task Adam: 7 nhãn AI đang khác nguồn và 2 khoảng chứa nhiều động tác.
- Một yêu cầu generateContent chứa toàn video Adam khoảng 20 giây, không phải
  chỉ 9 clip cắt. Video đi tới API chính thức của Google Gemini.
- Sampling đề xuất 10 FPS để kiểm tra chuyển động nhanh; không mặc định 1 FPS.
- Mô hình mặc định `gemini-3.8-flash` theo tài liệu Google tại thời điểm tích hợp.
  Có thể chỉ định `GEMINI_REVIEW_MODEL` trong `.env`; chương trình kiểm tra model
  hỗ trợ generateContent trước khi gửi video, không tự đổi model khi lỗi.
- Không gửi nhãn trước, nhận xét trước hoặc tên file gợi ý kỹ thuật. Prompt dùng
  ID cửa sổ trung tính và các mốc thời gian xấp xỉ, có thêm 750 ms ngữ cảnh mỗi bên.

Lượt tiếp theo có thể thêm `--include-training` với manifest dataset tạm để kiểm
tra toàn bộ 14 mẫu AI đang dùng train, cùng các task ưu tiên còn lại. CLI giới hạn
tối đa 2 video, 1 lượt generateContent cho mỗi video, 15 MB/video và 8192 token
output/yêu cầu. Không tự retry khi timeout hoặc lỗi HTTP để tránh gọi lặp ngoài ý muốn.
Giới hạn token/request không phải giới hạn chi phí tính bằng tiền.

## Cấu hình và chạy

Trong `python-worker/.env` (không gửi giá trị thật vào chat):

```dotenv
GEMINI_API_KEY=your-key
GEMINI_REVIEW_MODEL=gemini-3.8-flash
```

Chạy PowerShell tại `D:\test\ai\python-worker`:

```powershell
# Offline: chỉ kiểm tra hash và ghi kế hoạch/prompt, không gọi Google
& '.\.venv\Scripts\python.exe' gemini_dataset_review.py --output test_results/gemini_review/new_plan

# Online: chỉ chạy sau khi đã đồng ý gửi video tới Google
& '.\.venv\Scripts\python.exe' gemini_dataset_review.py --output test_results/gemini_review/new_run --run
```

Mỗi output phải là thư mục mới. Có thể dùng `--env-file` nếu key ở vị trí khác.
Không truyền key trên command line. Chương trình dùng requests đã có sẵn,
không cần cài SDK Google và không có endpoint tùy ý để chuyển hướng key.

## Đầu ra và cách dùng

`plan.json` ghi nguồn/hash, model yêu cầu, FPS và prompt, không có key hoặc nội
dung video. Khi API trả lời, `response_*.json` giữ phản hồi thực và usageMetadata;
`validated_*.json` giữ kết quả qua kiểm tra schema. `comparison.json` chỉ được
ghi sau khi hoàn thành đầy đủ, gồm modelVersion thực trả về và đối chiếu nhãn.

Validator từ chối thiếu/trùng task, trường approval tự thêm, nhãn ngoài taxonomy,
timestamp NaN/ngoài ngữ cảnh, kết quả bị cắt và số event không khớp quyết định.
Các đề xuất start/end vẫn chưa được xác nhận. Hai model đồng ý về tên đòn không
đồng nghĩa đồng ý ranh giới hoặc HLV xác nhận. Tất cả kết quả giữ
`AI_REVIEW_PROVISIONAL`, `coachConfirmed: false`, `goldEligible: false`.
Không tự thay nhãn training, không huấn luyện lại và không ghi vào backend.

## Kết quả thực tế ngày 2026-10-06

- 12 kiểm thử offline đạt: prompt không lộ nhãn/tên file, kiểm tra cấu trúc và
  timestamp đầu ra, lỗi mạng/HTTP không lộ key và không tự retry.
- Đã phát hiện key cấu hình cục bộ; API metadata model trả thành công khi dùng key.
- Đã tạo kế hoạch offline: 9 task, 1 video/request.
- Chủ dự án đã xác nhận gửi video Adam tới Google, chấp nhận phí tài khoản cho
  một yêu cầu duyệt 9 task. Đã gửi generateContent thực tế; Google trả HTTP 503.
  Thư mục lượt gọi: `test_results/gemini_review/20261006_priority_v3/`.
- Sau khi chủ dự án đồng ý thử lại đúng một lần, lượt thứ hai thành công:
  `test_results/gemini_review/20261006_priority_retry_v1/`. Model trả về
  `gemini-3.8-flash`; cả 9 bản ghi qua kiểm tra schema và giới hạn thời gian.
- Usage lượt thành công: input 14.725 token, output 1.607, thinking 3.871,
  tổng 20.203 theo API. Chưa quy đổi tiền; trạng thái tính phí lượt 503 chưa rõ.
- Không có video bao cát nào được gửi trong hai lượt này. Không thay nhãn train,
  không huấn luyện lại và không cấp xác nhận HLV.

| Task Adam | Nhãn AI trước | Gemini | Đối chiếu |
| --- | --- | --- | --- |
| 0010 | lead_uppercut | rear_uppercut | Bất đồng bên tay |
| 0012 | rear_uppercut | lead_uppercut | Bất đồng bên tay |
| 0016 | jab | jab | Cùng tên đòn |
| 0018 | cross | cross | Cùng tên đòn |
| 0020 | lead_hook | lead_hook | Cùng tên đòn |
| 0024 | lead_uppercut | rear_uppercut | Bất đồng bên tay |
| 0027 | rear_uppercut | lead_uppercut | Bất đồng bên tay |
| 0029 | Nhiều động tác | Đề xuất 3 đòn | Cùng nhận định cần tách; chưa chốt các event |
| 0030 | Nhiều động tác | Đề xuất 3 đòn | Cùng nhận định cần tách; chưa chốt các event |

Bốn bất đồng uppercut cho thấy cần xác minh lại thế thủ/bên tay; không lấy số
đông hoặc mô hình thứ hai làm trọng tài mặc định. Việc ba tên đòn trùng nhau
không xác nhận mốc bắt đầu/kết thúc hoặc chất lượng kỹ thuật. Đề nghị tách bốn
mẫu tranh chấp khỏi lượt train tiếp theo cho đến khi giải quyết, thay vì tự đổi
nhãn sang Gemini. Dataset tạm đã đóng băng vẫn được giữ nguyên để truy nguyên.

[Báo cáo đối chiếu đầy đủ](../../../python-worker/benchmark_results/gemini_cross_review_20261006.json)
lưu cả nhãn, bằng chứng Gemini trả về, usage và hash nguồn. Báo cáo này phân biệt
đồng thuận tên đòn với đồng thuận nhiều động tác; phản hồi API gốc không bị sửa.

Tài liệu tham chiếu: [video và custom FPS](https://ai.google.dev/gemini-api/docs/generate-content/video-understanding),
[generateContent REST](https://ai.google.dev/api/generate-content),
[structured output](https://ai.google.dev/gemini-api/docs/structured-output).
