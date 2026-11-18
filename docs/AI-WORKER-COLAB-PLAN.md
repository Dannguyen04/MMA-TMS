# Chạy thử AI worker trên Google Colab

Cập nhật 15/11/2026. Mục tiêu: phân tích video (YOLO pose) chạy được mà không cần máy của Dan hay laptop của team. Đây là bản **chạy thử**, không thay chỗ chạy chính. Notebook: [python-worker/colab/run_worker.ipynb](../python-worker/colab/run_worker.ipynb).

## 1. Luồng job hiện tại (đọc từ code)

```text
Web (Vercel) → API (Render) POST /jobs
  API: tạo signed URL của video trên Supabase Storage (hạn 1 giờ), ghi analysis_jobs = PENDING,
       đẩy job BullMQ vào Redis (Render Key Value mma-tms-redis), queue "video-analysis"
Worker (python-worker/worker.py), vòng lặp poll:
  LMOVE bull:video-analysis:wait → bull:video-analysis:active   (lấy 1 job, nguyên tử)
  PATCH {API}/jobs/:id/status  PROCESSING     (header x-worker-secret)
  tải video qua signed URL → YOLO pose → upload JSON kết quả lên Supabase bucket analysis-results
  POST  {API}/coaching/results
  PATCH {API}/jobs/:id/status  DONE (hoặc FAILED)
Web hỏi trạng thái job qua API (getJobPollState) cho tới khi DONE/FAILED.
```

- Nguồn: `nestjs-api/src/jobs/jobs.service.ts` (`createJob`, `updateJobStatus`), `nestjs-api/src/videos/videos.service.ts` (`signedWorkerUrl`, 3600 giây), `python-worker/worker.py`.
- **Worker chỉ gọi ra ngoài**: tới Redis, API và Supabase. Không ai gọi vào worker. Vì vậy **không cần tunnel** (cloudflared hay ngrok). Redis trên Render đã mở cho mọi IP (`ipAllowList 0.0.0.0/0` trong [render.yaml](../render.yaml)), dùng External URL dạng `rediss://` (TLS, `get_redis()` đã xử lý).
- Gemini **không** chạy trong worker. Gợi ý chiến thuật, lời dặn giữa hiệp, phân tích video đối thủ gọi Gemini từ API (Render) và server web (Vercel). Colab không cần key Gemini.

## 2. Worker cần gì

| Thứ | Chi tiết |
| --- | --- |
| Python | 3.10 trở lên (code dùng `int \| None`). Colab hiện có sẵn. |
| GPU | Không bắt buộc. Có GPU (T4 trên Colab) thì ultralytics tự dùng CUDA, nhanh hơn nhiều. Chọn Runtime > Change runtime type > T4 GPU. |
| Thư viện | `python-worker/requirements.txt`: ultralytics, opencv-python, numpy, redis, httpx, python-dotenv, tqdm. `torch` có sẵn trên Colab, ultralytics dùng luôn. |
| Trọng số YOLO | `yolov8n-pose.pt` ở thư mục gốc repo (có trong git). Notebook chép vào `python-worker/` để worker dùng đúng bản đã khoá, không tải bản mới từ mạng. |
| Code | Clone nhánh `release/final-review` (cùng nhánh API trên Render đang chạy, để hợp đồng callback khớp). Repo đang public. |

## 3. Biến môi trường và Colab Secrets

Nhập ở biểu tượng chìa khoá (Secrets) bên trái Colab, bật "Notebook access". Notebook đọc bằng `google.colab.userdata.get(...)`, không in giá trị, không ghi ra file.

| Tên secret | Bắt buộc | Lấy ở đâu |
| --- | --- | --- |
| `REDIS_URL` | Có | Render > `mma-tms-redis` > External Key Value URL (`rediss://…`) |
| `NESTJS_API_URL` | Có | `https://mma-tms-api.onrender.com` |
| `WORKER_SECRET_TOKEN` | Có | Giống biến cùng tên trên Render |
| `SUPABASE_URL` | Có | Giống `nestjs-api/.env` |
| `SUPABASE_SERVICE_KEY` | Có | Giống `nestjs-api/.env` (service role) |
| `YOLO_MODEL` | Không | Mặc định `yolov8n-pose` |
| `POLL_INTERVAL_S` | Không | Mặc định `3` |

`GEMINI_API_KEYS` **không** đặt trên Colab. Biến này đặt ở Render (API) và Vercel (web), xem mục 6.

Lưu ý bảo mật: Colab lưu output của ô vào notebook. Worker trước đây in nguyên `REDIS_URL` có mật khẩu; nay đã che (`redact_url` trong `worker.py`). Đừng chia sẻ notebook kèm output, đừng `print` secret.

## 4. Notebook làm gì

1. Kiểm tra GPU (`nvidia-smi`), báo nếu đang chạy CPU.
2. Đọc secret, báo **tên** secret còn thiếu rồi dừng.
3. Clone repo (nhánh `release/final-review`, `--depth 1`), cài `requirements.txt`, chép `yolov8n-pose.pt`.
4. Kiểm tra kết nối: gọi `/health` của API (đánh thức Render, lần đầu khoảng 1 phút), `PING` Redis, đếm job đang chờ và đang chạy dở.
5. (Tuỳ chọn, mặc định tắt) Đưa job kẹt ở `active` về `wait`.
6. Chạy `python worker.py` với biến môi trường lấy từ secret. Thấy `Đang lắng nghe queue 'video-analysis'` là được. Dừng bằng nút Stop của ô.

## 5. Giới hạn của Colab và job đang chạy dở

| Giới hạn (Colab miễn phí) | Ảnh hưởng |
| --- | --- |
| Ngắt khi không tương tác khoảng 90 phút, tối đa khoảng 12 giờ mỗi phiên, GPU có thể không được cấp khi hết hạn mức | Worker dừng, video mới đứng ở PENDING cho tới khi chạy lại notebook |
| Mỗi lần mở lại là máy mới | Phải chạy lại từ ô đầu (clone, cài, khoảng 2–3 phút) |
| Signed URL của video hết hạn sau 1 giờ | Job chờ quá 1 giờ mới được lấy sẽ FAILED khi tải video |

**Khi Colab ngắt giữa lúc xử lý một job:**

- Job id nằm lại trong `bull:video-analysis:active`; trong database job ở `PROCESSING` (worker đã báo trước khi chạy YOLO). Không có gì tự cứu: API chỉ đẩy job, không có BullMQ worker nào chạy kiểm tra job treo cho queue này, và `worker.py` khi khởi động chỉ lấy từ `wait`.
- Cách xử lý:
  - Video tạo dưới 1 giờ: bật `REQUEUE_STUCK = True` ở ô 5 rồi chạy, job được xử lý lại. API cho phép `PROCESSING → PROCESSING`. **Chỉ làm khi không có worker nào khác đang chạy** (ví dụ máy Dan), nếu không sẽ cướp job của worker kia.
  - Video cũ hơn 1 giờ: signed URL đã hết hạn, job sẽ FAILED. Người dùng tải lại video.
- Job đang chờ (`wait`) không mất khi Colab ngắt, worker sau lấy tiếp. Riêng Redis Free trên Render mất hết job khi Render khởi động lại Redis.

Chạy cùng lúc Colab và máy Dan được: `LMOVE` nguyên tử nên mỗi job chỉ một worker lấy. Khi thử nên tắt worker của Dan để biết chắc job nào do Colab chạy.

## 6. Xoay vòng key Gemini

Áp dụng cho mọi chỗ gọi Gemini của tính năng: `nestjs-api/src/bouts/bout-ai.client.ts` (chiến thuật trước trận, lời dặn giữa hiệp, quan sát đối thủ từ video) và `nextjs-frontend/src/lib/services/opponent-video-ai.ts` (gợi ý quan sát từ video đối thủ).

- Biến mới: `GEMINI_API_KEYS`, nhiều key cách nhau bằng dấu phẩy. `GEMINI_API_KEY` (một key) vẫn dùng được khi `GEMINI_API_KEYS` trống.
- Key bị hết hạn mức (HTTP 429, `RESOURCE_EXHAUSTED`) hoặc sai/hết hạn (401, 403, 400 `API_KEY_INVALID`) thì gửi lại đúng request đó bằng key kế tiếp. Lỗi 5xx vẫn thử lại 1 lần với cùng key như trước.
- Hết mọi key: log `All N Gemini API key(s) failed (quota: x, invalid or expired: y)`, app trả `QUOTA` nếu có key hết hạn mức, ngược lại `UPSTREAM`.
- Nhớ key cuối cùng chạy được, request sau bắt đầu từ key đó. Log chỉ ghi số thứ tự key (`key 2/5`), không bao giờ ghi key.
- Cần đặt: Render (`mma-tms-api`) và Vercel (project `mma-tms`, Production và Preview). Đặt xong phải Redeploy. Code: `gemini-key-pool.ts` ở `nestjs-api/src/shared/gemini/` và `nextjs-frontend/src/lib/services/`.

## 7. Checklist chạy thử

1. [ ] Render: thêm `GEMINI_API_KEYS`, redeploy API (chỉ cần cho phần Gemini).
2. [ ] Colab: mở notebook, Runtime > Change runtime type > **T4 GPU**.
3. [ ] Colab Secrets: nhập 5 secret bắt buộc ở mục 3, bật Notebook access cho cả 5.
4. [ ] Tắt worker trên máy Dan (để biết chắc job do Colab chạy).
5. [ ] Chạy ô 1–4: GPU có, không thiếu secret, `/health` trả `ok`, Redis `PING` thành công.
6. [ ] Chạy ô 6: thấy `Đang lắng nghe queue 'video-analysis'`.
7. [ ] Trên https://mma-tms-demo.vercel.app tải một clip ngắn (dưới 50 MB, dưới 1 phút).
8. [ ] Log Colab có `Đang xử lý job …`, rồi `Job … hoàn thành`; ghi lại thời gian xử lý (dòng `Xử lý xong trong …s`).
9. [ ] Web hiện trạng thái hoàn tất và kết quả phân tích.
10. [ ] Thử ngắt: dừng ô giữa lúc xử lý một clip, chạy lại với `REQUEUE_STUCK = True`, xác nhận job hoàn tất.
11. [ ] Ghi kết quả (thời gian GPU so với máy Dan, lỗi gặp) vào cuối file này.

## Kết quả chạy thử

Chưa chạy.
