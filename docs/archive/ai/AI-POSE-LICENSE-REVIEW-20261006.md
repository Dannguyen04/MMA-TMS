# Rà soát giấy phép bộ ước lượng pose (Ultralytics YOLOv8-Pose) và phương án thay thế

Ngày: 2026-10-06. Phạm vi: `python-worker`, `nextjs-frontend` của MMA-TMS.

**Đây không phải tư vấn pháp lý.** Báo cáo tổng hợp văn bản giấy phép và tài liệu công khai
để chuẩn bị cho buổi làm việc với luật sư. Mọi kết luận về "có vi phạm hay không" phải do luật sư
(am hiểu luật sở hữu trí tuệ Việt Nam và hợp đồng quốc tế) quyết định. Câu hỏi cho luật sư ở mục 8.

Quy ước nhãn bằng chứng:

- **[ĐÃ ĐỌC]** đã mở URL nguồn chính (repo, trang chính thức, văn bản giấy phép) trong phiên này.
- **[THỨ CẤP]** chỉ có từ kết quả tìm kiếm hoặc trang không phải của chủ sở hữu.
- **[SUY LUẬN]** do tôi suy ra từ mã nguồn hoặc từ kiến thức chung, chưa có URL xác nhận.
- **[CHƯA XÁC MINH]** không đọc được nguồn.

Lưu ý phương pháp: công cụ mở trang web trả về bản tóm tắt do một mô hình nhỏ tạo ra, không phải HTML
thô. Câu trích dẫn nguyên văn đáng tin nhất là AGPL §13 (khớp ở 3 nguồn: GitHub LICENSE của Ultralytics,
trang pháp lý Ultralytics, opensource.org). Các con số AP/FPS lấy qua tóm tắt, nên cần đối chiếu lại nguồn
trước khi đưa vào hợp đồng hay tài liệu bán hàng.

---

## 1. Kết luận ngắn

1. Pipeline AI đang chạy trên server dùng `ultralytics` (AGPL-3.0) và weights `yolov8n-pose.pt`.
   Ultralytics công khai tuyên bố rằng SaaS/API dùng YOLO "phía sau" cần Enterprise License, trừ khi mở
   mã toàn bộ dự án theo AGPL-3.0. Họ cũng tuyên bố weights đã huấn luyện mặc định thuộc AGPL-3.0.
   Họ không công bố giá. **[ĐÃ ĐỌC]**
2. Bản thân văn bản AGPL §13 hẹp hơn lập trường của Ultralytics: §13 chỉ nói đến người dùng đã **sửa đổi**
   chương trình, và output của chương trình chỉ bị phủ nếu bản thân output là "covered work" (§2).
   Khoảng cách giữa văn bản giấy phép và lập trường thương mại của Ultralytics là điểm mấu chốt cho luật
   sư; tôi không thể tự giải quyết nó. **[ĐÃ ĐỌC]** cho văn bản; **[SUY LUẬN]** cho cách áp vào kiến trúc của repo.
3. Rủi ro thực tế cho kế hoạch bán cho CLB là **đáng kể và không nên bỏ qua**: nó là nghĩa vụ giấy phép
   của thành phần cốt lõi, nhà cung cấp có sản phẩm thương mại bán đúng giấy phép thay thế, và nếu CLB
   tự cài (on-prem) thì còn kích hoạt nghĩa vụ phân phối (AGPL §5, §6), không chỉ §13.
4. Có phương án thay thế dùng giấy phép Apache-2.0 rõ ràng, xuất ra COCO-17 hoặc ánh xạ được:
   **RTMPose/RTMO (MMPose, chạy qua `rtmlib`)** và **MediaPipe BlazePose (33 điểm → 17 điểm)**.
   Chi phí đổi nằm ở xác thực lại dữ liệu nghiên cứu hơn là ở mã adapter (mục 5).
5. Thời điểm hợp lý để quyết định là **trước** khi trích lại toàn bộ dữ liệu RGB bằng pipeline YOLO
   (Ưu tiên 3 trong `AI-IMPROVEMENT-PLAN-20261006.md`), nếu không phải làm hai lần.

---

## 2. Giấy phép Ultralytics

### 2.1 Bản chất giấy phép [ĐÃ ĐỌC]

- Repo `github.com/ultralytics/ultralytics`: file LICENSE là **GNU AGPL v3, 19/11/2007**
  ([raw LICENSE](https://raw.githubusercontent.com/ultralytics/ultralytics/main/LICENSE)).
- Gói cài trong `.venv` của repo này tự khai: `ultralytics 8.4.146`, `License: AGPL-3.0`
  (file `python-worker/.venv/Lib/site-packages/ultralytics-8.4.146.dist-info/METADATA`). Phụ thuộc
  `ultralytics_thop 2.1.6` cũng khai AGPL-3.0 (cùng thư mục site-packages).
- Ultralytics bán giấy phép song song (dual licensing) tại [ultralytics.com/license](https://www.ultralytics.com/license).

### 2.2 AGPL §13 nói gì [ĐÃ ĐỌC]

Trích nguyên văn (khớp ở [opensource.org](https://opensource.org/license/agpl-v3) và LICENSE của Ultralytics):

> "If you modify the Program, your modified version must prominently offer all users interacting with it
> remotely through a computer network (if your version supports such interaction) an opportunity to receive
> the Corresponding Source of your version by providing access to the Corresponding Source from a network
> server at no charge, through some standard or customary means of facilitating copying of software."

Các định nghĩa liên quan (§0, LICENSE Ultralytics): "modify" là sao chép hoặc chuyển thể toàn bộ hoặc một
phần tác phẩm theo cách cần quyền tác giả (trừ bản sao y nguyên); "convey" là mọi hình thức phổ biến cho phép
bên khác tạo hoặc nhận bản sao. "Corresponding Source" (§1) gồm mọi mã cần để tạo, cài, chạy và sửa tác phẩm,
cả script điều khiển các việc đó.

Đọc vào SaaS (phần này là **[SUY LUẬN]**, cần luật sư):

| Yếu tố của §13 | Áp vào MMA-TMS |
| --- | --- |
| "If you modify the Program" | Repo không vá mã Ultralytics (chỉ `from ultralytics import YOLO`). Nhưng nếu worker được coi là "work based on" thư viện thì dự án có thể bị coi là bản sửa đổi/tác phẩm phái sinh. Đây là tranh luận pháp lý chưa có đáp án trong tài liệu tôi đọc. |
| "users interacting with it remotely through a computer network" | Người dùng gọi Next.js/NestJS; worker lấy job từ Redis (BullMQ) và chấm video, không có cổng mạng cho người dùng cuối (`worker.py` dùng Redis, `process_video.py`). Có thể lập luận người dùng không "tương tác" trực tiếp với worker; cũng có thể lập luận ngược lại vì họ nhận kết quả của nó. |
| Nghĩa vụ nếu bị kích hoạt | Cung cấp Corresponding Source của cả "phiên bản của bạn" cho mọi người dùng, miễn phí, nổi bật. Nếu phiên bản đó là toàn bộ worker + logic chấm điểm thì đó là mã cốt lõi. |
| Phân phối (§5, §6) | Nếu CLB nhận image Docker/bản cài riêng (on-prem) thì đó là "convey": phải cấp mã nguồn tương ứng và cấp phép toàn bộ tác phẩm theo AGPL. Dockerfile hiện tại đóng gói `ultralytics` và weights vào image (`python-worker/Dockerfile`). |

### 2.3 Lập trường của Ultralytics [ĐÃ ĐỌC, qua tóm tắt công cụ]

Từ [ultralytics.com/license](https://www.ultralytics.com/license):

- "If you use Ultralytics YOLO code, models, architectures, training pipelines, or trained/fine-tuned
  models, you must either: Open-source your entire project under AGPL-3.0, or Obtain an Ultralytics
  Enterprise License."
- Enterprise License được liệt kê là cần cho "SaaS platforms, APIs, or cloud systems that use YOLO behind
  the scenes", cho sản phẩm thương mại, mã đóng, và dùng model tự huấn luyện/fine-tune trong bối cảnh
  thương mại.
- "Train your own model from scratch" và "Do not use pretrained weights" vẫn đòi AGPL-3.0 hoặc Enterprise.
- "All Ultralytics YOLO trained models fall under the AGPL-3.0 License by default."
- Từ [docs.ultralytics.com/help/contributing](https://docs.ultralytics.com/help/contributing/): "Using
  Ultralytics YOLO models or code in your project requires that your entire derivative work also be
  open-sourced under AGPL-3.0."
- Trong [GitHub Discussion #1260](https://github.com/orgs/ultralytics/discussions/1260) một maintainer viết:
  "Any usage of Ultralytics models, including in an R&D setup within a company, requires an Ultralytics
  Enterprise License unless the entire project is open-sourced under the AGPL-3.0 license."
  Đồng thời họ nói một dịch vụ cloud mở mã toàn bộ theo AGPL-3.0 "should comply".

### 2.4 Weights và output

- **Weights:** văn bản AGPL không nhắc đến weights (không phải mã nguồn theo nghĩa thường; **[SUY LUẬN]** từ
  việc không thấy từ khóa này trong các phần đã đọc). Ultralytics **tuyên bố** weights của họ mặc định thuộc
  AGPL-3.0. Đây là tuyên bố của chủ sở hữu, chưa có phán quyết nào tôi biết về hiệu lực của nó. **[ĐÃ ĐỌC]**
  cho tuyên bố; **[CHƯA XÁC MINH]** cho hiệu lực pháp lý.
- **Output:** AGPL §2 viết: "The output from running a covered work is covered by this License only if the
  output, given its content, constitutes a covered work." **[ĐÃ ĐỌC]** Trong các trang Ultralytics tôi đọc,
  **không thấy** họ tuyên bố rằng tọa độ keypoint đầu ra bị phủ AGPL. (Một kết quả tìm kiếm thứ cấp có câu
  "trained models and their outputs" nhưng không phải trích dẫn từ trang Ultralytics, **không dùng làm bằng chứng**.)
  Với repo này: keypoint JSON và điểm kỹ thuật là output; nhưng **model huấn luyện bằng skeleton trích từ YOLO**
  (các checkpoint temporal trong `test_results/temporal_ablations`) là điểm cần luật sư xét, vì Ultralytics nói
  đến "trained/fine-tuned models". Các model này dùng mã PyTorch riêng, không dùng pipeline huấn luyện của
  Ultralytics (**[SUY LUẬN]** từ `pipeline/temporal_models.py`, `train_provisional_model.py`).

### 2.5 Enterprise License

- Cho phép dùng, sửa, triển khai mã và model YOLO trong sản phẩm độc quyền, nội bộ và thương mại, không
  nghĩa vụ mở mã AGPL; kèm toàn bộ mã nguồn YOLO (YOLO26 và các đời trước, đời sau), pretrained models và
  "subsequent modifications"; hỗ trợ doanh nghiệp. **[ĐÃ ĐỌC]**
  ([license](https://www.ultralytics.com/license), [Siemens](https://www.siemens.com/en-us/products/ultralytics-enterprise-license/)).
- **Giá không công khai.** Trang license: "tailored to each organization's size and specific use case"; trang
  pricing: gói Enterprise là "Custom/contact us"; trang Siemens: "Contact us for sales and pricing information".
  Có kênh qua Siemens (trang Siemens quảng bá giấy phép này; **[SUY LUẬN]** đó là kênh phân phối/đối tác).
  **[ĐÃ ĐỌC]**
- Không đọc được văn bản hợp đồng Enterprise. Các điều khoản về số lượng triển khai, bên thứ ba (CLB là
  khách), quyền chuyển nhượng, thời hạn, SaaS đa khách hàng cần hỏi trực tiếp. **[CHƯA XÁC MINH]**
- Đổi sang đời mới (YOLO26) **không** giải quyết vấn đề giấy phép: cùng AGPL. Bảng YOLO26-pose trên
  [docs.ultralytics.com/tasks/pose](https://docs.ultralytics.com/tasks/pose/): n 57,2 / s 63,0 / m 68,8 / l 70,4 /
  x 71,6 mAPpose 50-95; CPU ONNX n 40,3 ms, s 85,3 ms, m 218 ms. **[ĐÃ ĐỌC]** Không tìm thấy bảng AP cho
  YOLOv8-pose trong tài liệu hiện tại (trang YOLOv8 chỉ có bảng detection), nên không nêu AP của
  `yolov8n-pose` ở đây.

---

## 3. Kiểm kê phụ thuộc trong repo

### 3.1 Ultralytics: đường chạy sản xuất

Chuỗi: `Dockerfile` → `worker.py` → `process_video.process_video()` → YOLO → `person_tracker.PersonTracker` →
`pose_math` → pipeline phân tích. **[ĐÃ ĐỌC mã]**

| Vị trí | Vai trò |
| --- | --- |
| `python-worker/requirements.txt:6` | `ultralytics>=8.2.0`. Không ghim phiên bản; `.venv` đang là 8.4.146. |
| `python-worker/Dockerfile` | `COPY yolov8n-pose.pt` và `RUN python -c "import process_video; from ultralytics import YOLO; YOLO('yolov8n-pose.pt')"`: weights nằm trong image. |
| `python-worker/process_video.py:29` | `from ultralytics import YOLO` (thoát chương trình nếu thiếu). |
| `python-worker/process_video.py:194` | `model = pose_model if pose_model is not None else YOLO(model_name)`. |
| `python-worker/process_video.py:244` | `results = model(frame, conf=conf_threshold, verbose=False)`; `:245-247` đếm người qua `results[0].boxes`; `:250` gọi `person_tracker.update(results, ...)`. |
| `python-worker/process_video.py:741-743` | CLI cho chọn `yolov8{n,s,m,l,x}-pose`. |
| `python-worker/worker.py:26,50,74` | `from process_video import YOLO`; `YOLO_MODEL` mặc định `yolov8n-pose`; `_pose_model = YOLO(YOLO_MODEL)` (cache model qua các job). |
| `python-worker/person_tracker.py:88-132` | Đọc trực tiếp object kết quả của Ultralytics (`result.boxes`, `boxes[i].xyxy[0]`, `boxes[i].conf[0]`, `result.keypoints.data[i].cpu().numpy()`). Đây là chỗ gắn chặt nhất. |
| `python-worker/pose_math.py:240` | `parse_yolo_keypoints` (chỉ chuẩn hóa tọa độ), `KP` theo thứ tự COCO-17. |
| `python-worker/.env.example:11` | `YOLO_MODEL=yolov8n-pose`. |
| Chuỗi nhãn phiên bản | `pipeline/finding_engine.py:184` và `technique_rubric.py:60` ghi cứng `"yolov8n-pose"`; `action_result.py` dùng cho `modelVersion` trong kết quả trả về. Đây là metadata, không phải phụ thuộc mã. |
| Frontend `src/lib/mocks/ai.ts:61,1937-1958` | Chỉ dữ liệu giả hiển thị tên "Ultralytics 8.3 · TensorRT 10". Không phụ thuộc. |

`pipeline/assessment_engine.py` ghi rõ "Không import cv2, torch, ultralytics" (đã kiểm tra): phần lớn logic
chấm điểm độc lập khỏi estimator. Ranh giới phụ thuộc là `process_video.py` + `person_tracker.py` + `worker.py`.

### 3.2 Ultralytics: script nghiên cứu / phát triển (không nằm trong image sản xuất)

- Import trực tiếp: `audit_rgb_pose_bridge.py`, `prepare_provisional_dataset.py` (hàm `extract_video_pose`, tạo
  dữ liệu huấn luyện), `scratch_cardy_forensics.py`.
- Gọi `process_video()` (nên phụ thuộc gián tiếp): `evaluate_external_boxing.py`, `evaluate_public_dataset.py`,
  `run_strike_suite.py`, `replay_strikes.py`, `benchmark_tasks9_17.py`, `create_golden_baseline.py`, và các tool
  dưới `benchmark_results/detector_remeasure_20261006_tools/`.
- Băm SHA-256 `yolov8n-pose.pt` để ghi nguồn gốc (provenance): `ai_upgrade_benchmark.py`, `evaluate_strike_suite.py`,
  `evaluate_external_boxing.py`, `recognize_boxing_video.py`, `run_strike_suite.py`.
- Test: `test_person_tracker.py:16` giả lập cấu trúc kết quả Ultralytics; nhiều test dùng chuỗi `yolov8n-pose`.
- Theo lập trường của Ultralytics (mục 2.3, trích GitHub Discussion), ngay cả dùng nội bộ cho R&D trong công ty
  cũng cần Enterprise hoặc mở mã. Nên "chỉ là nghiên cứu" **không** miễn rủi ro theo cách Ultralytics diễn giải.

Weights: `python-worker/yolov8n-pose.pt` (6,8 MB) và `yolov8x-pose.pt` (139 MB) nằm trong thư mục; `.gitignore`
loại `*.pt` nên không bị commit (đã kiểm tra `git ls-files`), nhưng Dockerfile copy `yolov8n-pose.pt` vào image.

### 3.3 Các phụ thuộc AI khác và giấy phép

Lấy từ metadata gói đã cài trong `python-worker/.venv` (đọc trực tiếp, **[ĐÃ ĐỌC]**), trừ ghi chú khác:

| Thành phần | Bản trong `.venv` | Giấy phép khai trong metadata | Ghi chú |
| --- | --- | --- | --- |
| ultralytics | 8.4.146 | AGPL-3.0 | Vấn đề của báo cáo này |
| ultralytics-thop | 2.1.6 | AGPL-3.0 | Kéo theo bởi ultralytics |
| torch | 2.14.0 | Apache-2.0 AND BSD-2/3 AND MIT AND BSL-1.0 ... | Không có trong `requirements.txt`; vào qua ultralytics. Chạy sản xuất cần; code temporal nghiên cứu import torch (`pipeline/temporal_*.py`, không nằm trong chuỗi import của `process_video.py`: **[SUY LUẬN]** từ grep). |
| torchvision | 0.29.0 | BSD | |
| opencv-python | 5.0.0.93 | Apache 2.0 | Wheel có đóng gói FFmpeg (`LICENSE-3RD-PARTY.txt`: "FFmpeg is redistributed within all opencv-python packages"; FFmpeg thường là LGPL: **[SUY LUẬN]**, cần kiểm khi phân phối image). |
| numpy | 2.4.6 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 | |
| scipy / matplotlib / polars / pillow / pyyaml | (không đọc hết) | matplotlib: PSF-style; polars: MIT; pillow: MIT-CMU; pyyaml: MIT | Phụ thuộc truyền của ultralytics |
| redis (py) | 8.1.0 | MIT | |
| httpx | 0.28.1 | BSD-3-Clause | |
| python-dotenv | 1.2.3 | BSD-3-Clause | |
| tqdm | 4.70.0 | MPL-2.0 AND MIT | |
| MediaPipe (frontend) | Không nằm trong `package.json` | Repo `google-ai-edge/mediapipe`: Apache-2.0 **[ĐÃ ĐỌC]**; model card BlazePose GHUM 3D: "Apache License, Version 2.0" **[ĐÃ ĐỌC]** | Trang `live-form-check.tsx:43` nạp `@mediapipe/pose@0.5.1675469404` từ CDN jsdelivr lúc chạy. Đây là giải pháp "legacy": Google ghi "As of May 10, 2023, this solution was upgraded to a new MediaPipe Solution" **[ĐÃ ĐỌC]** ([pose.md](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/pose.md)). |
| Gói npm AI khác | Không có | | `package.json` frontend không có thư viện pose; `nestjs-api/package.json` không có phụ thuộc pose/YOLO. |

Tóm lại, trong toàn repo chỉ có **Ultralytics (và thop đi kèm)** thuộc loại copyleft mạnh có điều khoản mạng.
Phần còn lại permissive (Apache/BSD/MIT) hoặc copyleft yếu (FFmpeg trong opencv, MPL trong tqdm). Chưa rà
phụ thuộc Node.js đầy đủ và license của dữ liệu huấn luyện riêng của dự án (BoxingVI: "không khai license",
xem `AI-EXTERNAL-DATASETS-SURVEY-20261006.md`), nằm ngoài phạm vi.

---

## 4. Phương án thay thế

Tiêu chí: xuất COCO-17 hoặc ánh xạ được; dùng thương mại được; hỗ trợ nhiều người (pipeline chọn và
theo dõi một mục tiêu trong khung có nhiều người; `person_tracker.py`); tốc độ CPU; có ONNX/runtime.

### 4.1 Bảng tổng hợp

| Ứng viên | Giấy phép mã | Giấy phép weights | Dữ liệu huấn luyện | Dùng thương mại? | Multi-person / detector | AP COCO (nguồn) | Tốc độ CPU | ONNX/runtime |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **RTMPose** (MMPose) | Apache-2.0 [ĐÃ ĐỌC] | Mirror Hugging Face `Tau-J/RTMPose` gắn "apache-2.0" [ĐÃ ĐỌC]; README OpenMMLab không nêu riêng giấy phép weights; rtmlib: "Model weights follow their original licensing from OpenMMLab and Hugging Face sources" [ĐÃ ĐỌC] | Bản "AIC+COCO"; bản "Body8" gồm AI Challenger, COCO, CrowdPose, MPII, sub-JHMDB, Halpe, PoseTrack18 [ĐÃ ĐỌC]; cũng có config chỉ huấn luyện trên COCO (danh mục config [ĐÃ ĐỌC]) | Mã: có. Weights: **có khả năng**, còn tồn đọng về điều khoản dữ liệu (4.3) | Top-down: cần detector (RTMDet-nano 40,3 AP person, hoặc YOLOX qua rtmlib) | t 68,5 / s 72,2 / m 75,8 / l 76,5 (AIC+COCO, 256x192); Body8: m 74,9 / l 76,7 [ĐÃ ĐỌC] | "RTMPose-m 90+ FPS trên Intel i7-11700, ONNXRuntime 1.12.1" (pose model, đo kèm detector mỗi 5 khung) [ĐÃ ĐỌC] | ONNX, TensorRT, ncnn, OpenVINO; `rtmlib` chạy chỉ cần numpy/opencv/onnxruntime (không cần torch/mmcv) [ĐÃ ĐỌC] |
| **RTMO** (MMPose) | Apache-2.0 (cùng repo) [ĐÃ ĐỌC] | Như trên, không nêu riêng | Có bản Body7 (CrowdPose 83,8 AP) [ĐÃ ĐỌC] | Như trên | **Một giai đoạn, không cần detector**, nhiều người | COCO val: s 67,7 / m 70,9 / l 72,4 [ĐÃ ĐỌC] | Độ trễ 8,9 / 12,4 / 19,1 ms (README ghi theo tóm tắt; phần cứng/chuẩn đo **chưa xác minh**) | ONNX và checkpoint; rtmlib liệt kê RTMO [ĐÃ ĐỌC] |
| **MediaPipe BlazePose / Pose Landmarker** | Apache-2.0 [ĐÃ ĐỌC] | Model card: "Apache License, Version 2.0" [ĐÃ ĐỌC] | Dữ liệu riêng của Google: ảnh chụp bằng ứng dụng AR, 30K ảnh có đồng ý, ~85K ảnh tư thế thể dục (model card) [ĐÃ ĐỌC] | **Có** (giấy phép rõ nhất trong danh sách) | `num_poses` cho nhiều người [ĐÃ ĐỌC], nhưng model card ghi **"Multiple people in an image" là ngoài phạm vi** và "Tracks only one person on scene if multiple present" [ĐÃ ĐỌC] | **Không có AP COCO**; đo bằng PDJ@0.2 trên tập riêng: Lite 93,8 / Full 96,6 / Heavy 98,3 (model card) [ĐÃ ĐỌC]; không so được với AP | Lite ~44 FPS, Full ~18 FPS, Heavy ~4 FPS trên CPU Pixel 3 (XNNPack TFLite) [ĐÃ ĐỌC]; CPU desktop **chưa đo** | TFLite; wheel `mediapipe` Python **[SUY LUẬN]** |
| **ViTPose** | Apache-2.0 (repo + Hugging Face) [ĐÃ ĐỌC] | HF `usyd-community/vitpose-base-simple`: "apache-2.0" [ĐÃ ĐỌC]; weights gốc từ OneDrive "không có tuyên bố giấy phép rõ" [ĐÃ ĐỌC] | COCO, AI Challenger, MPII, CrowdPose; tiền huấn luyện MAE (ImageNet: **[SUY LUẬN]**) | Mã: có. Weights: khả năng, kèm điều khoản dữ liệu | Top-down, cần detector (đo với detector 56 AP person) [ĐÃ ĐỌC] | B 75,8 / L 78,3 / H 79,1 (val) [ĐÃ ĐỌC] | Nặng (B: 85,9M tham số [ĐÃ ĐỌC]); không có số CPU nên **chưa xác minh** | PyTorch/Transformers; ONNX **chưa xác minh** |
| **MoveNet** (Google) | Apache-2.0 [THỨ CẤP: kết quả tìm kiếm trích trang Kaggle/TF Hub; không đọc được trực tiếp] | Như trên [THỨ CẤP] | COCO + "Active" (video YouTube yoga/fitness/dance Google tự gán nhãn) [ĐÃ ĐỌC, blog TF] | Có [THỨ CẤP] | SinglePose (1 người), MultiPose Lightning tối đa 6 người [ĐÃ ĐỌC, tfjs-models README] | Không có AP công bố trong nguồn đọc được | "30+ FPS" trên desktop/laptop (README) [ĐÃ ĐỌC] | TF/TFLite |
| **Detectron2 Keypoint R-CNN** | Apache-2.0 [ĐÃ ĐỌC] | **CC BY-SA 3.0**: "All models available for download ... are licensed under the Creative Commons Attribution-ShareAlike 3.0 license" [ĐÃ ĐỌC, MODEL_ZOO.md] | COCO | Mã có; weights CC BY-SA có nghĩa vụ chia sẻ tương tự, cần luật sư | Một giai đoạn (Mask R-CNN keypoint), nhiều người | KP AP: R50-FPN 1x 64,0; 3x 65,5; R101 3x 66,1; X101 3x 66,0 [ĐÃ ĐỌC] | 0,066-0,121 s/ảnh (phần cứng chưa trích; thường là GPU) | PyTorch; ONNX khó |
| **YOLO-NAS-Pose** (Deci/SuperGradients) | Apache-2.0 (repo) [ĐÃ ĐỌC] | **Cấm dùng thương mại**: "You may not use the Software for any commercial use, including in connection with any models used in a production environment" (`LICENSE.YOLONAS-POSE.md`); bản YOLO-NAS còn cấm "managed services or remote access" [ĐÃ ĐỌC] | COCO | **Không** | Một giai đoạn | Không trích được | | |
| **OpenPose** (CMU) | Giấy phép riêng học thuật: "noncommercial research purposes" [ĐÃ ĐỌC] | Như trên | | **Không** nếu không mua; README gửi tới CMU Flintbox [ĐÃ ĐỌC]. Kết quả tìm kiếm ghi phí 25.000 USD/năm và **loại trừ lĩnh vực Sports** [THỨ CẤP, không đọc được Flintbox] | Bottom-up, nhiều người, output BODY_25/COCO-18 | | GPU nặng | |
| **AlphaPose** (SJTU) | "freely available for free non-commercial use"; thương mại phải liên hệ email [ĐÃ ĐỌC] | | | **Không** nếu không có thỏa thuận | Top-down | | | |
| **YOLOv7-pose** | GPL-3.0 [ĐÃ ĐỌC] | Không nêu giấy phép riêng cho weights [ĐÃ ĐỌC] | COCO | GPL-3.0 không có điều khoản mạng (khác AGPL), SaaS phía server thường không kích hoạt nghĩa vụ chia mã, nhưng **phân phối cho CLB (on-prem) thì có**: **[SUY LUẬN]** | Một giai đoạn | Không có số liệu | | |
| **YOLOX-Pose** | YOLOX gốc Apache-2.0 và không có pose [ĐÃ ĐỌC]; fork TI `edgeai-yolox` (có human pose) đã archive/di chuyển | **[CHƯA XÁC MINH]** giấy phép weights fork TI | | **[CHƯA XÁC MINH]** | Một giai đoạn | **[CHƯA XÁC MINH]** | | |
| **PaddleDetection keypoint** (HRNet, ViTPose, PP-TinyPose) | Apache-2.0 **[CHƯA XÁC MINH]** từ trang đã đọc (trang không nêu) | **[CHƯA XÁC MINH]** | COCO/MPII | **[CHƯA XÁC MINH]** | HRNet-w32 76,9-78,3 AP; PP-TinyPose 58,1 AP @128x96 [ĐÃ ĐỌC] | | | Paddle Inference, Paddle-Lite, OpenVINO [ĐÃ ĐỌC] |
| **OpenPifPaf** | **[CHƯA XÁC MINH]**: README nói có giấy phép mở trong file LICENSE và có giấy phép thương mại qua EPFL; tôi không đọc được loại giấy phép | | | **[CHƯA XÁC MINH]** | | | | |

Ghi chú về tốc độ: không có so sánh táo-với-táo. YOLO26n-pose của Ultralytics 40,3 ms/khung CPU ONNX
(phần cứng chưa trích) và RTMPose-m "90+ FPS" (i7-11700) đo trên máy, độ phân giải, cách đo khác nhau.
Cần benchmark trên đúng máy chủ của bạn (mục 7).

### 4.2 Hai ứng viên hàng đầu

**Số 1: họ RTMPose/RTMO qua `rtmlib` (MMPose, Apache-2.0).** Lý do: giấy phép mã rõ, ra COCO-17 đúng thứ tự,
chạy ONNX Runtime thuần CPU không cần torch (có thể bỏ cả torch khỏi image sản xuất), AP trong cùng tầm hoặc
cao hơn YOLO-pose, có cả biến thể top-down (cần detector) và một giai đoạn RTMO (không cần detector,
giống cấu trúc YOLO-pose nhất). Điểm yếu: README không phát biểu rõ giấy phép weights; dữ liệu huấn luyện bản
Body8/AIC+COCO có bộ dữ liệu điều khoản không thương mại (4.3). Giảm rủi ro bằng cách ưu tiên checkpoint
chỉ huấn luyện trên COCO (có config COCO-only) và yêu cầu luật sư xem xét. rtmlib bản thân Apache-2.0 [ĐÃ ĐỌC].

**Số 2: MediaPipe BlazePose (Apache-2.0, giấy phép trên model card).** Lý do: giấy phép và nguồn dữ liệu rõ nhất
(dữ liệu của Google, không dùng COCO/AIC), team đã dùng ở frontend (`live-form-check.tsx`), có thể thống
nhất estimator giữa webcam trực tiếp và server. Điểm yếu lớn: model card nói thẳng là thiết kế cho **một
người** và "Multiple people in an image" nằm ngoài phạm vi. Repo này có sẵn bằng chứng rằng nhảy danh tính
giữa nhiều người là nguồn FP (`PUNCH_DETECTOR_VALIDATION_REPORT.md`: 13 FP do "Multi-person identity jumping").
Do đó MediaPipe chỉ hợp lý nếu có detector người riêng (ví dụ cắt vùng quanh mục tiêu rồi chạy BlazePose),
và nó không có AP COCO để so với hiện tại.

Dự phòng: **ViTPose** (chính xác nhất nhưng nặng, cần detector, cần GPU: **[SUY LUẬN]** từ 85,9M tham số).
Loại: YOLO-NAS-Pose, OpenPose, AlphaPose (cấm thương mại); Detectron2 (weights CC BY-SA, chậm).

### 4.3 Điều khoản dữ liệu huấn luyện (áp cho cả Ultralytics)

- **COCO:** chú thích CC BY 4.0; ảnh lấy từ Flickr, chủ COCO "không sở hữu bản quyền ảnh", dùng ảnh phải theo
  điều khoản Flickr **[THỨ CẤP]** (kết quả tìm kiếm; trang cocodataset.org không mở được qua công cụ). Mọi model
  huấn luyện trên COCO, kể cả YOLO-pose của Ultralytics, cùng chung câu hỏi này. Đây là câu hỏi cho luật sư, không
  phân biệt được giữa ứng viên.
- **AI Challenger** (có trong RTMPose AIC+COCO/Body8, ViTPose): kết quả tìm kiếm ghi "non-commercial scientific
  research and academic teaching" **[THỨ CẤP]**; trang `challenger.ai/terms/data` không truy cập được.
  **[CHƯA XÁC MINH]**.
- **Halpe, PoseTrack, CrowdPose, MPII, sub-JHMDB:** giấy phép dữ liệu chưa xác minh; Halpe có issue GitHub hỏi
  giấy phép chưa được trả lời **[THỨ CẤP]**.
- Hệ quả: pháp lý về "weights huấn luyện trên dữ liệu có điều khoản phi thương mại" là vùng chưa rõ; tôi không
  thể kết luận. Với RTMPose nên hỏi luật sư có chấp nhận checkpoint COCO-only hay không.

---

## 5. Chi phí đổi estimator trong repo này (không triển khai)

### 5.1 Chỗ keypoint đi vào pipeline

1. `process_video.py:244`: `results = model(frame, conf=conf_threshold, verbose=False)` chạy **mỗi khung**
   (`DETECT_EVERY_N_FRAMES = 1`, dòng 71).
2. `process_video.py:245-247`: số người = `len(results[0].boxes)`, đưa vào kiểm soát chất lượng (`multi_person_counts`).
3. `person_tracker.PersonTracker.update(results, ...)` → `_extract_candidates` (dòng 88-132). Cần từ mỗi người:
   box `xyxy`, `conf` (lọc `< 0.20`), 17 điểm `[x_px, y_px, conf]` (`keypoints.data[i]`). Phần còn lại của
   tracker làm việc trên dict trung lập (`box`, `norm_box`, `center`, `area`, `keypoints`, `confidence`) nên chỉ
   `_extract_candidates` phụ thuộc kiểu dữ liệu Ultralytics.
4. `pose_math.parse_yolo_keypoints` chỉ chuẩn hóa pixel → [0,1] (`Point(x,y,conf)`), không phụ thuộc Ultralytics.
5. Mọi thứ phía sau (`ActionPipeline`, rubric, strike events, quality gate) dùng `Point` theo chỉ số COCO-17 (`KP`).

### 5.2 Adapter cần thiết

**A. RTMPose/RTMO (qua rtmlib).** Đầu ra rtmlib là mảng `keypoints (N,17,2)` và `scores (N,17)` (**[SUY LUẬN]** về
chi tiết API; chưa đọc mã rtmlib). Cần:

- Lớp `PoseEstimator.__call__(frame, conf) -> list[PersonDetection]` bọc rtmlib (RTMO: một lần gọi; RTMPose:
  detector + pose). Hai cách nối: (i) giả lập đối tượng có `.boxes`/`.keypoints.data` (rẻ nhất; `test_person_tracker.py:16`
  đã có mock dạng này); (ii) sửa `_extract_candidates` nhận danh sách trung lập (sạch hơn, vài chục dòng).
- Box: RTMPose top-down có box từ detector; RTMO có box của người. Nếu không có box thì suy ra từ keypoints.
- Điểm tin cậy: `conf` hiện là *xác suất hộp người* (YOLO) trộn với *trung bình conf keypoint*
  (`(conf + mean_kps_conf)/2`, dòng 130). RTMPose cho điểm theo từng khớp (SimCC), khác thang và hiệu chuẩn.
  Phải cân lại các ngưỡng đang rải khắp mã: `conf_threshold=0.5` (`process_video.py:93`), `0.20` trong tracker,
  `min_confidence 0.25` (`punch_analyzer.py:97`), `0.25` cho độ dịch thân, `0.3` cho coverage ở `recognize_boxing_video`.
- Hiệu năng: top-down chạy detector mỗi N khung, pose mỗi khung có thể tiết kiệm hơn hiện tại; nhưng `PersonTracker`
  hiện giả định có candidate ở mỗi khung (`DETECT_EVERY_N_FRAMES` đang bằng 1).
- Đóng gói: bỏ `ultralytics` và `torch` khỏi image sản xuất nếu chỉ chạy rtmlib (onnxruntime). Torch vẫn cần cho
  nghiên cứu temporal (`pipeline/temporal_*.py`), nên tách `requirements-research.txt` (**[SUY LUẬN]**).
- Dọn: biến `YOLO_MODEL`, `from process_video import YOLO` trong `worker.py`, CLI `choices`, chuỗi `"yolov8n-pose"`
  ghi cứng (`finding_engine.py:184`, `technique_rubric.py:60`, test) và cách băm weights (~5 script) sang tên/SHA mới.
- Sức lao động ước lượng (1 kỹ sư đã quen mã): adapter + wiring worker/Docker/CLI **2-3 ngày**; hiệu chuẩn lại
  ngưỡng và sửa test **2-3 ngày**; benchmark tốc độ/độ ổn định trên 3-5 video thực **1-2 ngày**. Tổng **khoảng 1-1,5 tuần** cho đường chạy sản xuất, chưa kể dữ liệu nghiên cứu (5.3).

**B. MediaPipe BlazePose.** Cần thêm:

- Ánh xạ 33 → 17 theo chỉ số COCO: mũi, mắt trái/phải, tai trái/phải, vai, khuỷu, cổ tay, hông, gối, cổ chân
  (**[SUY LUẬN]** từ danh sách điểm trên model card; chỉ số cụ thể trong topology MediaPipe cần đối chiếu mã).
  Mất 16 điểm khuôn mặt/tay/bàn chân, nhưng gót và mũi chân là điểm *thêm*, có thể hữu ích cho đòn đá (hiện
  `kick_analyzer.py` dùng 17 điểm; chưa xét dùng điểm thêm).
- Độ tin cậy: `visibility` và `presence` (sigmoid), khác `conf` của YOLO.
- Không có box: suy từ keypoint. Không có phát hiện nhiều người đáng tin cậy: cần detector người ngoài (ví dụ lấy
  box từ detector khác rồi cắt vùng). Nghĩa là thêm một thành phần và một bộ ngưỡng nữa; vì vậy tôi đánh giá khó
  hơn và rủi ro hồi quy cao hơn A.
- Ước lượng: **1,5-2,5 tuần** cho đường chạy sản xuất, chưa kể dữ liệu nghiên cứu.

### 5.3 Tác động tới dữ liệu nghiên cứu

- Tài liệu `AI-SIX-PUNCH-VIDEO-20261006.md` ghi nhận **khoảng trống miền (domain gap)** giữa skeleton nguồn của
  BoxingVI và YOLO trên RGB: ở offset 0, model cũ đúng V4 17/18 (skeleton nguồn) nhưng 13/18 (YOLO RGB); V6 10/12 so với 7/12;
  V10 8/18 so với 7/18; sau huấn luyện B0 trên YOLO chỉ khớp 14/18 V4, 11/12 V6, 8/18 V10; Adam: B0 từ chối cả 19 ứng viên,
  B1 không nhận đúng lớp nào. Tài liệu kết luận hướng tiếp theo là **trích lại nguồn RGB bằng pipeline YOLO thống nhất**.
- Checkpoint hiện có (B0, B1, các checkpoint temporal) và feature `coco17_timestamp_torso_v1` giả định phân phối nhiễu
  của một estimator cụ thể. Đổi sang RTMPose/RTMO/BlazePose nghĩa là: (a) pose cache cũ (băm SHA-256 theo `yolov8n-pose.pt`)
  không dùng được nữa; (b) phải trích lại toàn bộ video với estimator mới; (c) phải huấn luyện/hiệu chuẩn lại và đo lại
  các thang đo (event F1, macro-F1, rejection policy) vì ngưỡng "độ phủ khớp 80% ở ngưỡng pose 0,3" gắn với thang conf của YOLO;
  (d) bằng chứng "regression" đang có (Adam, golden baseline, `benchmark_results/*`) mất giá trị so sánh trực tiếp.
- **Không có lý do tin rằng domain gap tự biến mất** khi đổi estimator: bất kỳ estimator RGB nào khác với bộ tạo skeleton nguồn
  của BoxingVI đều tạo khoảng cách; có thể nhỏ hơn hoặc lớn hơn, chưa đo. Cần chạy lại `audit_rgb_pose_bridge.py` tương đương.
- Cơ hội: vì kế hoạch hiện tại *vừa mới sắp* trích lại dữ liệu bằng YOLO, đổi trước khi trích lại tránh làm hai lần.
  Chi phí của việc đổi muộn là toàn bộ công trích dữ liệu đã làm bằng YOLO.
- Ước lượng nghiên cứu (không gồm gán nhãn mới): trích lại + đo lại cầu nối RGB + huấn luyện lại + so sánh
  **thêm khoảng 1-2 tuần** (tùy số video; `[SUY LUẬN]`, chưa đo thời gian chạy thật).

---

## 6. Tóm tắt phương án

| Phương án | Ưu | Nhược | Công sức thô |
| --- | --- | --- | --- |
| **(a) Mua Ultralytics Enterprise** | Không đổi mã; giữ toàn bộ kết quả đo/dữ liệu nghiên cứu; có hỗ trợ; có cả code, weights, đời YOLO sau này | Giá không công khai (hỏi báo giá); chi phí lặp lại có thể tỷ lệ theo quy mô; **chưa đọc hợp đồng** (SaaS đa khách hàng, bên thứ ba, chuyển nhượng, thời hạn); lệ thuộc nhà cung cấp; AP YOLOv8n-pose thấp hơn các đời sau | Mã: 0. Thương lượng/pháp lý: ước 1-4 tuần **[SUY LUẬN]** |
| **(b) Tuân thủ AGPL-3.0** | Không tốn phí giấy phép | Phải cấp phép AGPL cho "work based on the Program" (§5) và đưa Corresponding Source (gồm script build, §1) nổi bật cho mọi người dùng tương tác qua mạng (§13); phạm vi "tác phẩm phái sinh" mờ: có thể bao cả logic chấm điểm, rubric, ngưỡng (tài sản cốt lõi); đối thủ có quyền dùng lại; CLB nhận bản cài on-prem nhận luôn quyền AGPL; nếu ranh giới "chương trình riêng giao tiếp qua Redis/HTTP" không được công nhận thì rủi ro lan sang NestJS/Next.js (**[SUY LUẬN]**) | Kỹ thuật: vài ngày (tách repo, thông báo, liên kết mã nguồn trong UI). Chiến lược: mất mô hình kinh doanh đóng. Không phù hợp để bán sản phẩm thương mại đóng |
| **(c) Đổi estimator (RTMPose/RTMO, hoặc MediaPipe)** | Giấy phép mã Apache-2.0 rõ; giảm lệ thuộc; có thể bỏ torch khỏi image sản xuất; AP tương đương/cao hơn trong tài liệu | Rủi ro hồi quy chất lượng; dữ liệu nghiên cứu phải trích/hiệu chuẩn lại; còn câu hỏi giấy phép weights/dữ liệu huấn luyện (4.3); không phải miễn phí về mặt pháp lý, chỉ **giảm** rủi ro đã nhận diện | Đường sản xuất 1-2,5 tuần + nghiên cứu 1-2 tuần (mục 5) |

Cách đi thực tế (đề xuất, không phải khuyến nghị pháp lý): song song (1) hỏi báo giá Enterprise để có con số làm
mốc so sánh, (2) làm một spike 2-3 ngày chạy RTMO/RTMPose trên 5-10 video đã có `validation_videos` rồi so
sánh theo cùng chuẩn với `PUNCH_DETECTOR_VALIDATION_REPORT.md`, (3) đưa luật sư các câu hỏi dưới đây. Trong lúc
chờ, chưa bán/triển khai cho khách ngoài cho đến khi có ý kiến pháp lý.

---

## 7. Điều chưa biết cần đo hoặc hỏi

- Tốc độ thực trên máy chủ dự kiến cho: YOLOv8n-pose hiện tại, RTMO-s/m, RTMPose-m + detector, BlazePose.
- AP của `yolov8n-pose` trên cùng chuẩn (không tìm thấy trong tài liệu hiện tại).
- Giấy phép weights của OpenMMLab (ngoài mirror HF); điều khoản dữ liệu AI Challenger/Halpe/PoseTrack/CrowdPose.
- Hợp đồng Enterprise thực tế và giá.
- Giấy phép OpenPifPaf, PaddleDetection, fork YOLOX-Pose của TI (chưa đọc được).
- Giá OpenPose 25.000 USD/năm và ngoại lệ lĩnh vực Sports: chỉ là kết quả tìm kiếm, chưa đọc Flintbox.

---

## 8. Câu hỏi cho luật sư

1. AGPL-3.0 §13 dùng điều kiện "If you modify the Program". Nếu chỉ `pip install ultralytics` và gọi `YOLO(...)`
   (không sửa mã thư viện), công ty có bị coi là "modify" hay chỉ là bên *dùng*? Theo luật Việt Nam và theo
   thông lệ quốc tế, một ứng dụng import thư viện AGPL có là "work based on the Program" không?
2. Worker nhận job qua Redis và trả kết quả qua API; người dùng cuối không kết nối trực tiếp với worker. Trong kiến
   trúc này ai là "users interacting with it remotely through a computer network"? Việc tách worker thành dịch vụ
   riêng có làm thay đổi phân tích không?
3. Nếu bắt buộc mở mã, phạm vi "Corresponding Source" là gì: chỉ `python-worker`, hay cả NestJS/Next.js (giao
   tiếp qua Redis/HTTP)? Rubric, ngưỡng, dữ liệu huấn luyện có nằm trong phạm vi không?
4. Weights `yolov8n-pose.pt` do Ultralytics phát hành: tuyên bố "AGPL-3.0 by default" có hiệu lực pháp lý với weights
   không? Output (tọa độ keypoint, điểm kỹ thuật) có bị ràng buộc không (AGPL §2: output chỉ bị phủ nếu là covered work)?
5. Model temporal tự huấn luyện trên skeleton trích bằng YOLO (và nằm trong luồng nghiên cứu) có bị coi là "trained/fine-tuned
   model" của Ultralytics theo cách họ diễn đạt? Nếu có thì dữ liệu skeleton cần xử lý thế nào (xóa, trích lại bằng estimator khác)?
6. Ultralytics nói dùng nội bộ cho R&D trong công ty cũng cần Enterprise hoặc mở mã. Giai đoạn nghiên cứu hiện tại (chưa
   bán) có rủi ro gì, và nên làm gì cho các tập dữ liệu/mô hình đã tạo?
7. Nếu CLB tự cài (on-prem) hoặc nhận image Docker: AGPL §5/§6 nghĩa vụ phân phối áp dụng thế nào? Hợp đồng bán/giấy phép
   sử dụng cho CLB nên có điều khoản gì?
8. Nếu mua Enterprise: những điều khoản cần thương lượng (SaaS đa khách hàng, số lượng instance, bên thứ ba là CLB,
   chuyển nhượng khi bán công ty, thời hạn, quyền dùng đời YOLO tương lai, bồi thường IP, luật áp dụng và tòa án/trọng tài, thuế nhà thầu nước ngoài)?
9. Với phương án đổi estimator: Apache-2.0 của MMPose/rtmlib có đủ không nếu README OpenMMLab không nêu riêng giấy phép weights?
   Checkpoint huấn luyện trên COCO, AI Challenger, CrowdPose, PoseTrack, Halpe (điều khoản phi thương mại hoặc chưa rõ) có rủi ro
   cho sản phẩm thương mại không? Checkpoint COCO-only có đủ sạch không (COCO: chú thích CC BY 4.0, ảnh theo điều khoản Flickr)?
10. Weights Detectron2 theo CC BY-SA 3.0: nghĩa vụ chia sẻ tương tự có áp vào hệ thống nếu dùng model này không (để loại hẳn hay không)?
11. Dùng MediaPipe nạp từ CDN (`jsdelivr`) ở frontend: Apache-2.0 yêu cầu gì về attribution/NOTICE khi phục vụ cho khách hàng?
    (Ngoài phạm vi: video khuôn mặt/dáng người của học viên, trẻ em, chịu Nghị định 13/2023/NĐ-CP về dữ liệu cá nhân; nên xử lý riêng.)
12. Rủi ro pháp lý khi tiếp tục dùng cả hai estimator (frontend MediaPipe, server YOLO) so với thống nhất?
13. Có nên xin ý kiến bằng văn bản (opinion letter) để dùng làm bằng chứng tuân thủ khi ký hợp đồng với CLB hoặc gọi vốn?

---

## 9. Nguồn

Đã đọc (qua công cụ tóm tắt trang):

- Ultralytics LICENSE (AGPL-3.0): https://raw.githubusercontent.com/ultralytics/ultralytics/main/LICENSE
- Ultralytics licensing: https://www.ultralytics.com/license ; https://www.ultralytics.com/pricing ; https://www.ultralytics.com/legal/agpl-3-0-software-license
- Ultralytics README: https://github.com/ultralytics/ultralytics ; docs: https://docs.ultralytics.com/help/contributing/ , https://docs.ultralytics.com/tasks/pose/ , https://docs.ultralytics.com/models/yolov8/
- Thảo luận GitHub: https://github.com/orgs/ultralytics/discussions/1260
- Trang Siemens: https://www.siemens.com/en-us/products/ultralytics-enterprise-license/
- AGPL §13 và §2 (output): https://opensource.org/license/agpl-v3
- MMPose: https://github.com/open-mmlab/mmpose ; RTMPose: https://github.com/open-mmlab/mmpose/tree/main/projects/rtmpose , https://github.com/open-mmlab/mmpose/blob/main/projects/rtmpose/README.md ; RTMO: https://github.com/open-mmlab/mmpose/blob/main/projects/rtmo/README.md ; LICENSE: https://raw.githubusercontent.com/open-mmlab/mmpose/main/LICENSE
- rtmlib: https://github.com/Tau-J/rtmlib ; mirror weights: https://huggingface.co/Tau-J/RTMPose
- ViTPose: https://github.com/ViTAE-Transformer/ViTPose ; https://huggingface.co/usyd-community/vitpose-base-simple
- MediaPipe: https://github.com/google-ai-edge/mediapipe ; Pose Landmarker: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker ; legacy pose.md: https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/pose.md ; model card (PDF, đã đọc toàn văn): https://developers.google.com/static/ml-kit/images/vision/pose-detection/pose_model_card.pdf
- MoveNet: https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/movenet/README.md ; https://blog.tensorflow.org/2021/05/next-generation-pose-detection-with-movenet-and-tensorflowjs.html
- Detectron2: https://github.com/facebookresearch/detectron2 ; https://github.com/facebookresearch/detectron2/blob/main/MODEL_ZOO.md
- YOLO-NAS: https://github.com/Deci-AI/super-gradients ; https://raw.githubusercontent.com/Deci-AI/super-gradients/master/LICENSE.YOLONAS-POSE.md ; https://raw.githubusercontent.com/Deci-AI/super-gradients/master/LICENSE.YOLONAS.md
- OpenPose: https://github.com/CMU-Perceptual-Computing-Lab/openpose ; https://github.com/CMU-Perceptual-Computing-Lab/openpose/blob/master/LICENSE
- AlphaPose: https://github.com/MVIG-SJTU/AlphaPose ; YOLOv7: https://github.com/WongKinYiu/yolov7 ; YOLOX: https://github.com/Megvii-BaseDetection/YOLOX ; TI fork: https://github.com/TexasInstruments/edgeai-yolox ; PaddleDetection keypoint: https://github.com/PaddlePaddle/PaddleDetection/tree/release/2.8/configs/keypoint ; OpenPifPaf: https://github.com/openpifpaf/openpifpaf

Chỉ thứ cấp hoặc không mở được: Flintbox (OpenPose phí/Sports), cocodataset.org/#termsofuse, challenger.ai/terms/data,
gnu.org (GPL FAQ, văn bản AGPL đầy đủ), TF Hub/Kaggle (MoveNet), Hugging Face `usyd-community` AP 81,1 (con số này đến từ tóm tắt
trang HF và có vẻ khác bảng của repo ViTPose; không dùng).

Từ repo: `python-worker/{requirements.txt,Dockerfile,process_video.py,person_tracker.py,pose_math.py,worker.py}`,
`python-worker/.venv/Lib/site-packages/*.dist-info/METADATA`, `nextjs-frontend/src/components/video/live-form-check.tsx`,
`docs/archive/ai/AI-SIX-PUNCH-VIDEO-20261006.md`, `docs/archive/ai/AI-EXTERNAL-DATASETS-SURVEY-20261006.md`,
`docs/archive/ai/AI-IMPROVEMENT-PLAN-20261006.md`, `docs/archive/ai/worker-reports/PUNCH_DETECTOR_VALIDATION_REPORT.md`.
