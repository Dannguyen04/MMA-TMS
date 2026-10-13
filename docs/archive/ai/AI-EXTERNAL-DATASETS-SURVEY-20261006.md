# Khảo sát dataset công khai cho nhận diện 6 loại đòn đấm trên video

Ngày 2026-10-06. Mục tiêu: tìm RGB video có nhãn đòn theo thời gian (start/end),
tốt nhất có đoạn không ra đòn, thông tin lead/rear hoặc thế thủ, và giấy phép dùng
được khi bán cho CLB. Bối cảnh và lý do cần dữ liệu mới nằm ở
[AI-SIX-PUNCH-VIDEO-20261006.md](./AI-SIX-PUNCH-VIDEO-20261006.md) và
[AI-IMPROVEMENT-PLAN-20261006.md](./AI-IMPROVEMENT-PLAN-20261006.md).

Không tải dataset hay video nào. Chỉ đọc trang web, README, paper, metadata API.

## 0. Cách đọc báo cáo và giới hạn bằng chứng

- **[ĐỌC]** = đã mở đúng URL nguồn trong phiên này và thấy thông tin.
- **[TÌM]** = chỉ thấy trong kết quả tìm kiếm hoặc trang trung gian, chưa đọc nguồn gốc.
- **[SUY]** = suy luận của người khảo sát, chưa có bằng chứng trực tiếp.
- Công cụ tải trang trả về bản tóm tắt do mô hình nhỏ tạo ra. Chuỗi trong dấu
  ngoặc kép bên dưới là chuỗi công cụ trả về như trích dẫn; chưa đối chiếu từng
  ký tự với trang gốc, trừ khi ghi rõ. Trước khi dùng cho quyết định pháp lý, người
  có thẩm quyền cần mở lại trang gốc.
- Không tải được hoặc không đọc được:
  - OpenReview (ShadowPunch): trang chỉ trả màn hình xác minh trình duyệt, cả trang
    forum lẫn PDF. Mọi thông tin ShadowPunch bên dưới chỉ là [TÌM] từ snippet.
  - Trang Kaggle HTML của Olympic Boxing: chỉ trả tiêu đề. Dùng được API metadata
    của Kaggle (đọc được giấy phép, dung lượng, danh sách file một phần).
  - Entropy/MDPI (403) và bản PMC: PMC đọc được nội dung dataset; MDPI thì không.
  - Google Drive của BoxingVI: không mở. Nhóm đã tải ở lượt trước (xem tài liệu SIX-PUNCH).
  - arXiv PDF của BoxMAC (404) vì paper đã bị rút; chỉ đọc được bản HTML v1 và trang abs.
  - Giấy phép Kinetics, UCF101, HMDB51: không xác minh được trong phiên này.

## 1. Kết luận ngắn

1. **Không có dataset công khai nào đáp ứng đủ bốn điều kiện cùng lúc:** RGB tải được,
   nhãn sáu lớp lead/rear theo khoảng thời gian, có đoạn không ra đòn, và giấy phép
   cho phép thương mại. Điều này là kết luận từ phạm vi tìm kiếm của phiên này, không
   phải chứng minh không tồn tại.
2. **Ứng viên thực tế nhất để huấn luyện lại là chính BoxingVI, nhưng lấy RGB** (liên kết
   YouTube) rồi trích lại bằng YOLO. Nhãn đã khớp 100% taxonomy sáu lớp. Rủi ro:
   không có giấy phép rõ, video YouTube có thể mất, chưa có đoạn nền.
3. **Olympic Boxing (Kaggle) là nguồn duy nhất tải thẳng được có "khoảng không ra đòn"
   do trọng tài gán**, nhưng taxonomy khác (trái/phải tay x đầu/thân/đỡ/trượt, không
   có jab/cross/hook/uppercut) và giấy phép **chỉ phi thương mại**. Hợp để kiểm tra
   phát hiện sự kiện và tỉ lệ dương giả, không hợp để huấn luyện sáu lớp.
4. **BoxMAC thực tế không dùng được:** paper bị rút khỏi arXiv, không có liên kết dữ
   liệu, không giấy phép.
5. **ShadowPunch** (shadowboxing, nhãn mức frame, có keypoint) có vẻ khớp bài toán nhất
   theo mô tả, nhưng **chưa xác minh được** taxonomy, giấy phép, cách truy cập. Đây là
   việc cần người mở trang OpenReview kiểm tra đầu tiên.
6. **Bộ nghiệm thu độc lập vẫn phải tự thu** như kế hoạch
   [AI-DATA-COLLECTION-PROTOCOL.md](./AI-DATA-COLLECTION-PROTOCOL.md). Dữ liệu ngoài
   chỉ bổ sung một phần (xem mục 5).
7. **Cờ giấy phép riêng cho pipeline hiện tại:** repo Ultralytics (YOLOv8-Pose) khai
   AGPL-3.0 theo GitHub API. Nếu bán sản phẩm cho CLB, cần xem lại giấy phép
   thương mại của Ultralytics hoặc đổi bộ ước lượng pose. Việc này ngoài phạm vi
   khảo sát dataset nhưng ảnh hưởng thẳng đến "dùng được thương mại".

## 2. Bảng so sánh nhanh

| Dataset | RGB lấy được? | Nhãn đòn có start/end? | Đoạn không ra đòn | Lead/rear hoặc stance | Số võ sĩ trong cảnh | Giấy phép dữ liệu | Thương mại |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BoxingVI | Chỉ link YouTube | Có (frame) | Không gán | Có trong tên lớp | Một (chọn tay) | Không khai (repo `license: null`) | Không có quyền rõ |
| Olympic Boxing (Kaggle) | Tải trực tiếp (cần tài khoản Kaggle) | Có (frame, bbox) | Có, suy ra từ frame không nhãn | Không (chỉ trái/phải tay) | Hai | "Other": phi thương mại | Không |
| BoxMAC | Không có đường truy cập | Mức frame, đa nhãn | Có ("no action") | Có (stance, lead/rear) | Hai | Không khai, paper bị rút | Không xác định |
| ShadowPunch | Chưa xác minh | Mức frame (theo mô tả) | Chưa rõ | Chưa rõ | Một (theo mô tả) | Chưa xác minh | Chưa xác minh |
| BoxMind (BoxingWeb/Studio) | Không phát hành | Có (start/end) | Có (suy ra) | Có (lead/rear, mapping từ stance) | Hai | Không khai | Không có quyền |
| BoxComm | URL + timestamp, bản "processed" trên HF | Tự động, không người gán | Suy ra | Chưa rõ | Hai | HF: phi thương mại | Không |
| Zenodo IMU 14965635 | Không có video | Có (IMU) | Không | Có | Một | CC BY 4.0 | Có |
| Kinetics, UCF101, HMDB51 | YouTube/tải theo nhà cung cấp | Không (nhãn cả clip) | Không | Không | Tùy clip | Chưa xác minh | Chưa xác minh |
| NTU RGB+D (A50 punch/slap) | Form xin truy cập | Không | Không | Không | Hai | Học thuật, cấm thương mại, cấm derivative | Không |

## 3. Chi tiết từng dataset

### 3.1 BoxingVI (baseline so sánh)

- **Link:** https://github.com/Bikudebug/BoxingVI. **Paper:** Kumar et al. 2025,
  arXiv:2511.16524 (https://arxiv.org/abs/2511.16524). [ĐỌC]
- **Giấy phép/điều khoản:**
  - GitHub API: `license: null` (không có file LICENSE; URL `/blob/main/LICENSE` trả 404). [ĐỌC]
  - Paper: "The dataset include YouTube video links, temporal demarcation of punches
    and punch category labels. It doesn't directly include any copyrighted
    material." Ảnh minh họa dùng "under the Fair Use Policy of YouTube". [ĐỌC, qua tóm tắt]
  - Giấy phép arXiv "non-exclusive distribution" áp cho bài báo, không áp cho dữ liệu. [ĐỌC]
  - Kết luận: **unknown cho nhãn và skeleton; không có quyền nào cho video** (video thuộc
    chủ kênh YouTube). Không có cơ sở nói thương mại được.
- **Truy cập:** Google Drive (tác giả) có `Annotation_files` (.xlsx), `Skeleton_data`,
  `RGB_videos`; README còn thư mục `RGB_videos`. Theo paper, RGB thực chất là bảng link
  YouTube, và nhóm đã xác nhận ở lượt trước rằng metadata RGB là bảng liên kết, không
  phải MP4 do tác giả đóng gói. [ĐỌC repo + paper; tài liệu SIX-PUNCH]
- **Quy mô:** 6.915 clip, 20 video YouTube, 18 vận động viên (11 nam, 7 nữ), train 5.513
  (S1-S15), validation 1.402 (S16-S20). Giờ video: không nêu. [ĐỌC]
  Lưu ý: nhóm đếm 5.451 hàng nhãn trong 10 bảng đã tải, lệch với 6.915 của paper;
  chưa rõ vì sao (có thể chỉ tải một phần, chưa điều tra). [SUY]
- **Nội dung video:** shadow boxing, đánh bao cát, video hướng dẫn đánh bao; camera đơn,
  cố định. [ĐỌC]
- **Pose gốc:** AlphaPose, COCO-17; theo dõi người chọn ở frame đầu bằng độ dịch tâm
  khối nhỏ nhất. [ĐỌC]
- **FPS:** paper nói 30 fps; đo của nhóm cho V4/V6 là 24000/1001 và V10 là 25 fps
  (SIX-PUNCH). Mâu thuẫn, ưu tiên số đo của nhóm. [ĐỌC]
- **Taxonomy:**

| Nhãn nguồn | Lớp của ta |
| --- | --- |
| Jab | jab |
| Cross | cross |
| Lead Hook | lead_hook |
| Rear Hook | rear_hook |
| Lead Uppercut | lead_uppercut |
| Rear Uppercut | rear_uppercut |

- **Lead/rear:** nằm trong tên lớp. Paper không định nghĩa rõ cách xác định (chỉ nói
  suy từ bất đối xứng khung xương theo thế thủ) và không có cột stance riêng. [ĐỌC]
- **Một hay hai võ sĩ:** một võ sĩ chính; tác giả tự nêu thiếu cảnh nhiều người và tương
  tác đối thủ. [ĐỌC]
- **Định vị thời gian:** có start/end theo frame. **Đoạn không ra đòn không được gán**;
  paper nêu rõ nền/không-đòn không được chú thích. [ĐỌC]
- **Vấn đề đã biết:** khoảng cách estimator (AlphaPose so với YOLO), mất nhãn nền,
  nghi ngờ nhất quán nhãn ở V10 (SIX-PUNCH, IMPROVEMENT-PLAN), liên kết YouTube có
  thể chết, không có mô tả quy trình/độ đồng thuận người gán. [ĐỌC]
- **Việc import:** lấy lại 20 video theo bảng link; xác nhận lại fps và căn frame với
  bảng nhãn; chạy YOLO một người cho từng video; **tự sinh khoảng nền từ khoảng trống
  chỉ khi có người duyệt** (kế hoạch hiện hành đã cấm coi khoảng chưa gán là nền).

### 3.2 Olympic Boxing (Stefański et al.)

- **Link:** https://www.kaggle.com/datasets/piotrstefaskiue/olympic-boxing-punch-classification-video-dataset
  (có nhãn) và https://www.kaggle.com/datasets/piotrstefaskiue/olympic-boxing-video-dataset-unlabeled
  (không nhãn). Mã: https://github.com/piotr-stefanski/boxing-fight-video-analysis
  (license MIT cho mã, không áp cho dữ liệu). [ĐỌC README + API GitHub]
- **Paper chính cho dữ liệu:** Stefański, Kozak, Jach, "Boxing Punch Detection with
  Single Static Camera", Entropy 26(8):617, 2024 (doi 10.3390/e26080617). Bản đọc được:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC11353713/. Bài 2023 về phân loại đòn
  (ICCCI) chưa đọc.
- **Giấy phép (đọc từ API metadata của Kaggle):** tên giấy phép "Other (specified in
  description)", mô tả: "The data is for use in non-commercial settings: in academic
  institutions for teaching and research purposes and in non-profit research
  organizations." Cả hai bộ (có nhãn và chưa nhãn) giống nhau. [ĐỌC]
  Một kết quả tìm kiếm nói "CC BY 4.0"; **không khớp với metadata Kaggle, bỏ qua**.
  Bản HF phái sinh cũng ghi "non-commercial/academic use only". **Không thương mại.**
- **Truy cập:** tải từ Kaggle (cần tài khoản/API token). Bộ có nhãn 3,34 GB (API) gồm
  các thư mục `task_kam2_gh…`, mỗi thư mục một MP4 + `annotations.json`; danh sách
  file chỉ đọc được trang đầu (9 thư mục, ~947 MB trong trang đó). [ĐỌC]
  Định dạng JSON thực tế (CVAT?) **chưa kiểm**; paper nói gán bằng CVAT. [ĐỌC paper]
- **Quy mô:** 4 camera GoPro Hero8 sau 4 góc võ đài, Full HD, 50 fps, một giải đấu
  khoảng 4 giờ, 2021 tại Szczyrk (Ba Lan), hạng thiếu niên/cadet/junior; mặt đã làm mờ.
  Paper Entropy: 28 clip, 312.774 frame được gán, trong đó 11.345 frame (~3,62%) có
  đòn và 301.429 không đòn; nhãn nhị phân "punch/not punch" kèm bbox vùng đòn,
  người gán là trọng tài có giấy phép. [ĐỌC PMC]
  Số clip/đòn của bộ phân loại: chưa rõ từ nguồn gốc. Bản HF phái sinh có 2.278 clip
  8 lớp (tổng ~1.563 s). [ĐỌC HF] Bài FACTS (arXiv 2412.16454) nói dùng 8.000 clip từ bộ
  này, chưa rõ khác biệt so với 2.278. [ĐỌC, qua tóm tắt]
- **Taxonomy (8 lớp, tên theo FACTS/HF):**

| Nhãn nguồn | Lớp của ta |
| --- | --- |
| head_left_hand (LHHP) | không ánh xạ (đòn tay trái vào đầu; có thể là jab, cross, hook hoặc uppercut) |
| head_right_hand (RHHP) | không ánh xạ |
| body_left_hand (LHBP) | không ánh xạ |
| body_right_hand (RHBP) | không ánh xạ |
| miss_left_hand (LHMP), miss_right_hand (RHMP) | không ánh xạ; là đòn ném trượt, vẫn là sự kiện "đòn" |
| block_left_hand, block_right_hand | không ánh xạ; không rõ nhãn gắn cho người ra đòn hay người đỡ [chưa xác minh] |

- **Lead/rear, stance:** không có. Nhãn là trái/phải theo giải phẫu của tay; stance
  không được gán. Có thể suy stance từ pose (chân nào đứng trước), chỉ là [SUY].
- **Số võ sĩ, track:** hai võ sĩ, camera tĩnh. Có bbox vùng đòn (paper) nhưng
  **không thấy bằng chứng về track theo từng võ sĩ hay danh tính đỏ/xanh**. [ĐỌC, một phần]
- **Định vị thời gian và đoạn nền:** có nhãn theo frame; phần frame không nhãn là
  "not punch" theo paper Entropy. Trước khi gán, bộ lọc "clash detection" đã loại các
  tình huống hai võ sĩ đứng xa nhau, nên **nền ở đây chỉ gồm khoảng gần nhau**
  (clinch, đỡ, đẩy nhau...), không có footwork xa. [ĐỌC]
- **Góc quay:** bốn góc cạnh võ đài, cao ngang tripod 1,8 m; ba trọng tài đứng quanh
  võ đài làm cơ sở bố trí. Khác hẳn điện thoại tự quay một người. [ĐỌC]
- **Vấn đề đã biết:** cực kỳ mất cân bằng (3,62% frame có đòn); che khuất giữa hai võ sĩ
  và trọng tài; video thi đấu thiếu niên, trọng lượng nhẹ, tốc độ đòn khác người lớn
  [SUY]; không có hook/uppercut/jab/cross.
- **Việc import:** tải; đọc `annotations.json` (xác nhận schema); trích pose bằng YOLO
  nhiều người; **ghép track với từng võ sĩ** (ID ổn định, không bị đổi chỗ khi clinch)
  rồi quy nhãn bbox về người ra đòn; ánh xạ nhãn chỉ ở mức "có đòn / không đòn" và
  "tay trái / tay phải"; trích lại khoảng nền từ frame không nhãn.

### 3.3 BoxMAC

- **Link:** https://arxiv.org/abs/2412.18204 (bản HTML v1 https://arxiv.org/html/2412.18204v1).
  Tác giả: Shashikanta Sahoo. [ĐỌC]
- **Tình trạng paper:** trang abs ghi v2 (2025-02-17) **bị rút** vì vấn đề tác giả,
  tác giả nói "a revised version is forthcoming". PDF trả 404. Không có liên kết mã
  hay dữ liệu. [ĐỌC]
- **Giấy phép/điều khoản:** paper không có tuyên bố giấy phép hay truy cập. **Unknown.**
- **Truy cập:** không có đường tải, không có form xin. [ĐỌC]
- **Quy mô theo bản v1:** 15 võ sĩ chuyên nghiệp, >60.000 frame, 2.314 clip video,
  25 fps, mỗi video ~4 phút; clip tạo bằng cách gộp các frame liên tiếp cùng hành động
  (8-40 frame); 85 lớp video. Nhóm số này không tự nhất quán; không thể kiểm. [ĐỌC]
- **Camera:** bốn camera PTZ quanh võ đài trong nhà. [ĐỌC]
- **Taxonomy (13 lớp, đa nhãn theo frame):**

| Nhãn nguồn | Lớp của ta |
| --- | --- |
| jab | jab |
| cross | cross |
| lead hook | lead_hook |
| rear hook | rear_hook |
| lead uppercut | lead_uppercut |
| rear uppercut | rear_uppercut |
| stance, slip, block, guard, duck, clinching | không ánh xạ (có thể là nền/bỏ qua cho nhiệm vụ này) |
| no action | nền (chưa kiểm chất lượng) |

- **Lead/rear, stance:** có tên lớp lead/rear và nhãn "stance"; paper nhắc orthodox/southpaw. [ĐỌC]
- **Hai võ sĩ, track:** hai võ sĩ, nhãn đa nhãn trên cả khung hình; **không có bbox hay
  track từng người**; chính paper nêu hạn chế "không xác định hành động của từng cầu
  thủ". [ĐỌC] Nếu có dữ liệu, mỗi frame có nhãn "ai đánh" chưa rõ.
- **Vấn đề:** bản đã rút; baseline chỉ dùng ảnh (VGG, ResNet, ViT) và ConvLSTM, baseline tốt nhất ViT
  73,9%. Không nên dựa vào khi chưa có bản sửa. [ĐỌC]
- **Việc import (nếu sau này có):** liên hệ tác giả; gán nhãn đòn cho từng võ sĩ
  (tự gán track); chuyển nhãn frame sang khoảng.

### 3.4 ShadowPunch (chưa xác minh)

- **Link:** https://openreview.net/forum?id=Jq8HYNZG9s ("ShadowPunch: fast actions
  spotting benchmark", Aleksandr Simonyan, Nikolay Falaleev). **Không mở được**
  (màn hình xác minh). [TÌM]
- **Theo snippet:** "open dataset for video event spotting focused on fast-paced events
  in shadowboxing videos captured at high frame rates", có "accurate frame-level
  annotations for diverse punch types alongside pose keypoint annotations"; hai nhánh
  baseline: từ ảnh trực tiếp và pose rồi phát hiện sự kiện. [TÌM]
- **Chưa biết:** số video/giờ, số lớp và tên lớp, có lead/rear không, giấy phép, link
  tải, tên estimator/định dạng keypoint, có nền không. "Event spotting" thường là nhãn
  điểm thời gian (một frame mỗi đòn) chứ không phải khoảng [SUY].
- **Vì sao đáng ưu tiên kiểm:** shadowboxing, một người, có RGB tốc độ cao và keypoint,
  nhãn mức frame; gần nhất với tình huống của ta. Nếu RGB phát hành được, có thể trích
  lại bằng YOLO.
- **Hành động:** người dùng mở trang bằng trình duyệt, ghi lại abstract, supplementary,
  link dữ liệu, giấy phép.

### 3.5 BoxMind (BoxingWeb, BoxingStudio)

- **Link:** https://arxiv.org/abs/2601.11492 (đọc HTML v1). [ĐỌC]
- **Dữ liệu:** BoxingWeb 50 hiệp (150 phút), 10,9 nghìn sự kiện đòn nguyên tử, video
  phát sóng 640x360 đến 1920x1080; BoxingStudio 30 hiệp sparring bốn góc 60 fps của đội
  tuyển quốc gia (Trung Quốc); BoxingWeb-Full 651 trận, 1.909 hiệp, 119 giờ. [ĐỌC]
- **Taxonomy và độ khớp:** kỹ thuật Straight/Hook/Uppercut x tay Lead/Rear (suy từ
  trái/phải theo stance) x tầm xa x mục tiêu Head/Torso x hiệu quả. Nhãn start = tay rời
  tư thế thủ, end = tay về vị trí trung tính, do HLV gán. [ĐỌC]
  So với sáu lớp của ta: Hook và Uppercut khớp trực tiếp với lead/rear. Straight lead
  khớp jab và Straight rear khớp cross, vì thế **schema này hoàn toàn quy được về sáu
  lớp** [SUY, dựa vào định nghĩa quyền Anh thông thường].
- **Truy cập/giấy phép:** bản đọc không có tuyên bố phát hành dữ liệu, không link tải,
  không giấy phép. **Unknown; coi là không phát hành.** [ĐỌC]
- **Hai võ sĩ, broadcast, nhãn do chuyên gia.** Lợi thế: schema đúng ý ta; trở ngại:
  không có dữ liệu. Đề nghị: viết thư xin dữ liệu, chấp nhận khả năng bị từ chối.

### 3.6 BoxComm

- **Link:** https://gouba2333.github.io/BoxComm/; HF https://huggingface.co/datasets/gouba2333/BoxComm-Dataset;
  paper arXiv:2604.04419; mã Apache-2.0. [ĐỌC]
- **Dữ liệu:** 445 trận World Boxing Championships 2025, 77,8 giờ, 52 nghìn câu bình
  luận, 260 nghìn sự kiện đòn, ≥25 fps và 720p. [ĐỌC]
- **Điều khoản (trích từ thẻ HF qua công cụ):** "We do not redistribute raw videos.
  We instead release original video URLs, timestamps, commentary annotations,
  category labels, punch-event labels, evaluation files, prompts, and reconstruction
  scripts for non-commercial academic research." Ghi chú: cây thư mục của cùng thẻ
  vẫn liệt kê thư mục `videos/` (24,9 GB); không rõ trùng khớp. Paper nói video dùng
  "strictly under the fair use doctrine for non-commercial academic research".
  **Không thương mại.** [ĐỌC]
- **Nhãn đòn là tự động**, không phải người gán: mô hình Causal TCN phát hiện + VideoMAEv2
  kết hợp TCN phân loại, track bằng PHALP, mesh bằng CameraHMR. Nhãn nhận loại đòn dạng
  "straight/hook..." và bên, mục tiêu; chưa rõ có jab/cross/uppercut riêng. Không có
  số liệu độ chính xác sự kiện. [ĐỌC]
- **Đánh giá:** nhãn tự động nên **không dùng làm chuẩn nghiệm thu**; dùng làm pseudo-label
  hoặc nguồn nền khó thì cần người duyệt. Skeleton đi kèm là dạng mesh (CameraHMR),
  chưa rõ có COCO-17. [ĐỌC một phần]

### 3.7 Dữ liệu IMU (không có RGB)

- **Zenodo 14965635** (PLOS ONE 20(5): e0322490, 2025; https://doi.org/10.5281/zenodo.14965635):
  giấy phép "Creative Commons Attribution 4.0 International (CC-BY-4.0)"; sáu CSV IMU 200 Hz
  ở hai cổ tay; **không có video** trong bản Zenodo. 8 võ sĩ ưu tú (5 orthodox, 3 southpaw)
  làm 320 đòn shadowboxing, 14 loại; có video 60 fps đồng bộ trong nghiên cứu nhưng
  không được phát hành ở đó. [ĐỌC Zenodo; TÌM cho thông tin paper]
  Giá trị: thương mại được, nhưng không dùng được để huấn luyện từ RGB. Có thể dùng
  làm kiểm tra vật lý (độ dài đòn, phân bố tốc độ), nhãn lead/rear ở mức đòn.
- **Zenodo 22299415** (lực đạp + IMU, 27 võ sĩ, 1.013 đòn, jab/cross/lead hook/rear hook): CC BY 4.0;
  không video. Không liên quan trực tiếp. [ĐỌC]
- **SPAR** (arXiv 2609.30753): IMU + đế đo áp lực, 17 người, 4.713 đòn, sáu loại; không
  video; không nêu phát hành. [ĐỌC]

### 3.8 Các nguồn khác đã xem và loại

| Nguồn | Điều đã xác minh | Lý do loại |
| --- | --- | --- |
| Feiz et al. (CVPRW 2025) https://hosseinfeiz.github.io/physpose/ | Hơn 20 phút sparring ưu tú nhiều camera; mesh/keypoint; trang ghi "Coming Soon"; paper nêu CC BY 4.0 (tóm tắt) [ĐỌC] | Chưa phát hành; không nhãn đòn |
| FACTS (arXiv 2412.16454) | 8.000 clip tám lớp quyền Anh, dẫn xuất từ Olympic Boxing; trang nói dữ liệu đấu kiếm ở "anonymous link"; không nêu phát hành bộ quyền Anh [ĐỌC, qua tóm tắt] | Trùng nguồn Olympic, phi thương mại, không phát hành rõ |
| Kinetics-400/600/700 | Có lớp "punching bag", "punching person (boxing)" (K400 và K700 đều có) [ĐỌC danh sách lớp]; clip ~10 s; tải qua CVDF [ĐỌC] | Nhãn cả clip, không có thời điểm; giấy phép không xác minh được |
| UCF101, HMDB51 | Có lớp BoxingPunchingBag, BoxingSpeedBag (UCF101) và punch (HMDB51) [TÌM] | Nhãn cả clip, không localization; giấy phép chưa xác minh |
| NTU RGB+D (A50 punch/slap) https://rose1.ntu.edu.sg/dataset/actionRecognition/ | "released for academic research only, and are free to researchers from educational or research institutes for non-commercial purposes"; cấm "redistribution, derivation or generation of a new dataset from this dataset, and commercial usage" [ĐỌC] | Hai người, một lớp punch chung, cấm thương mại và derivative |
| Roboflow Universe (BoxingHub, Boxing Punch Detection...), Mendeley MMA fighter detection (5.106 ảnh UFC), Ultralytics MMA | Ảnh có bbox, không video, không nhãn thời gian [TÌM] | Không phục vụ nhận diện loại đòn theo thời gian |
| TUHAD (Taekwondo) | Chuỗi poomsae tám kỹ thuật, 10 chuyên gia, 1.936 mẫu [TÌM] | Taekwondo, không phải quyền Anh |

Chưa tìm thấy dataset Muay Thai/kickboxing/MMA với nhãn đòn theo thời gian được công
khai trong phạm vi các truy vấn đã chạy. [Kết luận tìm kiếm có giới hạn]

## 4. Model pretrained skeleton (COCO-17) có thể fine-tune

| Mục | Đã xác minh |
| --- | --- |
| MMAction2 | Giấy phép Apache-2.0 (GitHub API). Mô hình skeleton: PoseC3D, STGCN, STGCN++, AGCN; bộ dữ liệu: NTU60/120 XSub (2D, 3D), FineGYM, UCF101, HMDB51, Kinetics400. Checkpoint ở `download.openmmlab.com`. https://mmaction2.readthedocs.io/en/latest/model_zoo/skeleton.html [ĐỌC] |
| PoseC3D | SlowOnly-R50, 48 frame; FineGYM và NTU60 train từ đầu; UCF101 và HMDB51 khởi tạo từ trọng số K400; K400 top-1 47,4% (UCF101 86,8%, HMDB51 69,6%). Có hướng dẫn tự huấn luyện `custom_dataset_training.md` (đổi `load_from`, `num_classes`, file pkl). [ĐỌC] |
| STGCN++ | Chỉ có checkpoint NTU60 XSub 2D và 3D trong MMAction2. [ĐỌC] |
| pyskl | Apache-2.0; không còn bảo trì ("not currently maintained by the developer"); có sẵn skeleton 2D dạng HRNet và nhiều thuật toán (ST-GCN, ST-GCN++, PoseConv3D, DG-STGCN, AAGCN, MS-G3D, CTR-GCN). https://github.com/kennymckormick/pyskl [ĐỌC] |
| Pose gốc | Skeleton đã trích sẵn dùng HRNet-w32 (COCO); tài liệu liệt kê 17 điểm "cho CoCo" nhưng không khẳng định rõ cho từng bộ dữ liệu. [ĐỌC] |

Nhận xét:

- **Giấy phép mã là Apache-2.0, nhưng giấy phép trọng số chưa rõ.** Trọng số huấn luyện
  từ NTU RGB+D chịu điều khoản NTU (không thương mại, cấm derivative); trọng số từ
  K400/FineGYM phụ thuộc giấy phép dữ liệu chưa xác minh. Cần xem lại trước khi gửi
  sản phẩm. [SUY, từ điều khoản NTU đã đọc]
- **Các checkpoint này là bộ phân loại cả clip, không phát hiện sự kiện thời gian**,
  và nhãn đầu ra không có sáu lớp đòn. Lợi ích có thể là khởi tạo biểu diễn chuyển động.
  PoseC3D K400 có thể đã thấy "punching bag" và "punching person (boxing)" nhưng mức
  độ giúp phân biệt jab/cross chưa từng được đo. [SUY]
- **Khoảng cách chính của dự án là khác biệt bộ ước lượng pose** (xem SIX-PUNCH, kiểm
  tra RGB và skeleton), không phải kiến trúc. Dùng model pretrained trên HRNet sẽ
  thêm một khoảng cách nữa so với YOLOv8n-Pose, nên **ưu tiên thấp** cho đến khi có RGB
  mới và baseline TCN trên dữ liệu YOLO. Plan hiện hành đã xếp PoseC3D là đối chứng
  sau A0-A3; giữ nguyên.
- Cờ riêng về runtime: Ultralytics khai AGPL-3.0 (GitHub API). [ĐỌC]

## 5. Xếp hạng

### (a) Cho huấn luyện

| Hạng | Nguồn | Lý do | Điều kiện/cờ |
| --- | --- | --- | --- |
| 1 | BoxingVI, lấy RGB và trích YOLO | Cùng taxonomy, đã có nhãn, nhóm đã kiểm tra nhãn khớp bảng gốc; sửa trực tiếp khoảng cách estimator | Giấy phép dữ liệu không khai; video YouTube; chưa có nền |
| 2 | ShadowPunch (nếu xác minh) | Shadowboxing một người, nhãn frame, có keypoint | Chưa mở được; cần kiểm taxonomy, RGB, giấy phép |
| 3 | BoxMind hoặc BoxMAC (nếu tác giả cấp) | Schema đúng ý (lead/rear, có nền) | Hiện không có dữ liệu |
| 4 | Olympic Boxing | Chỉ để học "có đòn/không đòn" và tay trái/phải trên hai võ sĩ; có nền do trọng tài gán | Phi thương mại; không có sáu lớp; hai võ sĩ |
| 5 | BoxComm | Nhiều đòn, bốn góc phát sóng | Nhãn tự động, phi thương mại, URL |
| Không dùng | Zenodo IMU, SPAR, Kinetics/UCF/HMDB, NTU | Không có RGB đòn theo thời gian hoặc điều khoản cấm | IMU CC BY chỉ để tham chiếu vật lý |

### (b) Cho nghiệm thu độc lập

- **Không có nguồn ngoài nào đủ làm bộ nghiệm thu sáu lớp.** Điều kiện của kế hoạch
  (video/võ sĩ/góc quay độc lập, tính cả `unknown`, đòn bỏ sót và dự đoán dư) đòi hỏi
  nhãn sáu lớp và ranh giới sự kiện; chỉ BoxingVI (và có thể ShadowPunch) có nhãn như vậy.
- **Hạng 1: bộ do nhóm tự thu** theo
  [AI-DATA-COLLECTION-PROTOCOL.md](./AI-DATA-COLLECTION-PROTOCOL.md): điện thoại, một người,
  có đoạn nền do người duyệt, giữ riêng khỏi huấn luyện.
- **Hạng 2: BoxingVI bị giữ riêng** (ví dụ video của S16-S20 theo split tác giả) sau khi
  huấn luyện lại không dùng chúng. Nhãn chưa có nền; nghiệm thu chỉ phân loại có ranh giới
  và phát hiện sự kiện (không đo FP/phút trên nền). Chưa rõ ánh xạ giữa S1-S20 của
  paper và V1-V10 của nhóm; **phải xác lập trước khi chia**. Nó cũng không "độc lập" về
  phong cách quay so với dữ liệu huấn luyện cùng nguồn YouTube. [SUY]
- **Hạng 3: Olympic Boxing** chỉ làm bài kiểm tra bổ trợ cho (i) tỉ lệ dự đoán dư/dương
  giả trên các khoảng "không đòn" hai võ sĩ gần nhau, (ii) độ bền của tracking/pose
  khi che khuất. Không cho điểm sáu lớp. Phi thương mại không cản việc kiểm tra nội bộ
  nhưng cản việc đưa dữ liệu hoặc mô hình huấn luyện từ nó vào sản phẩm. [SUY]

## 6. Việc import cần làm cho từng nguồn

| Nguồn | Việc cần làm |
| --- | --- |
| BoxingVI | Lấy video từ bảng link; xác nhận fps (24000/1001, 25 hay 30) và căn frame; chạy YOLO một người, giữ mặt nạ/độ tin cậy; đối chiếu lại với skeleton gốc bằng bộ kiểm tra RGB-bridge đã có; xin người duyệt đoạn nền; tự lưu bản sao bằng chứng (hash, URL, ngày) vì link có thể chết |
| Olympic Boxing | Tạo tài khoản Kaggle, tải; đọc `annotations.json` (xác nhận schema, bbox/thời gian); YOLO nhiều người + tracker; ghép track với bbox nhãn; quy nhãn về nhị phân "đòn/không đòn" và tay trái/phải; cắt nền theo frame không nhãn; ghi rõ không dùng khoảng ở xa vì bị loại từ trước |
| BoxMAC/BoxMind | Email tác giả xin dữ liệu và điều khoản; nếu có: gán nhãn theo từng võ sĩ (track), đổi nhãn frame/đa nhãn sang khoảng |
| ShadowPunch | Mở OpenReview; nếu có RGB: đổi nhãn điểm thành khoảng bằng quy tắc đã đóng băng (không tự chọn offset); ánh xạ lớp sang sáu lớp; trích YOLO |
| BoxComm | Chỉ xem xét nếu cần nguồn nền hoặc pseudo-label; phải tái dựng video từ URL; map nhãn tự động; bắt buộc người duyệt mẫu |
| PoseC3D/ST-GCN++ | Chuyển skeleton YOLO sang pkl của MMAction2 (17 điểm, kích thước ảnh, nhãn); kiểm tra thứ tự khớp trái/phải; chỉ làm sau A0-A3 |

## 7. Khuyến nghị bước tiếp theo

1. **Người dùng mở OpenReview ShadowPunch** và ghi lại taxonomy, số video, fps, link,
   giấy phép. Đây là lead tốt nhất chưa xác minh.
2. **Lấy lại RGB của BoxingVI** theo bảng link YouTube, trích YOLO, chạy kiểm tra
   RGB-bridge nhiều đoạn hơn 96 trường hợp; ghi rõ video nào còn truy cập.
3. **Gửi email xin dữ liệu** cho tác giả BoxMind (và BoxMAC khi có bản sửa), kèm câu
   hỏi về giấy phép thương mại. Đồng thời hỏi tác giả Kaggle Olympic Boxing về
   khả năng cấp phép thương mại, nếu muốn dùng nó trong sản phẩm.
4. **Không chi thời gian cho Kinetics/UCF/HMDB/NTU** hay checkpoint PoseC3D tại thời
   điểm này.
5. **Kiểm tra pháp lý giấy phép Ultralytics (AGPL-3.0)** cho runtime YOLO trước khi bán.
6. **Bộ nghiệm thu vẫn phải tự thu.** Tập dữ liệu ngoài chỉ bổ trợ.

## 8. Nguồn đã đọc

- BoxingVI: https://github.com/Bikudebug/BoxingVI, https://arxiv.org/abs/2511.16524,
  https://arxiv.org/html/2511.16524v1, https://api.github.com/repos/Bikudebug/BoxingVI
- BoxMAC: https://arxiv.org/abs/2412.18204, https://arxiv.org/html/2412.18204v1
- Olympic Boxing: https://github.com/piotr-stefanski/boxing-fight-video-analysis,
  https://api.github.com/repos/piotr-stefanski/boxing-fight-video-analysis,
  https://www.kaggle.com/api/v1/datasets/view/piotrstefaskiue/olympic-boxing-punch-classification-video-dataset,
  https://www.kaggle.com/api/v1/datasets/view/piotrstefaskiue/olympic-boxing-video-dataset-unlabeled,
  https://pmc.ncbi.nlm.nih.gov/articles/PMC11353713/,
  https://huggingface.co/datasets/NealBeans/BoxingDataset,
  https://arxiv.org/html/2412.16454v1
- BoxMind: https://arxiv.org/html/2601.11492v1. BoxComm: https://arxiv.org/html/2604.04419,
  https://github.com/gouba2333/BoxComm, https://huggingface.co/datasets/gouba2333/BoxComm-Dataset
- IMU: https://zenodo.org/doi/10.5281/zenodo.14965635, https://zenodo.org/records/22299415,
  https://arxiv.org/html/2609.30753
- Pose chiến đấu nhiều người: https://arxiv.org/html/2504.08175v1, https://hosseinfeiz.github.io/physpose/
- Kinetics: https://raw.githubusercontent.com/open-mmlab/mmaction2/main/tools/data/kinetics/label_map_k400.txt,
  https://raw.githubusercontent.com/open-mmlab/mmaction2/main/tools/data/kinetics/label_map_k700.txt,
  https://github.com/cvdfoundation/kinetics-dataset
- NTU: https://rose1.ntu.edu.sg/dataset/actionRecognition/
- Model: https://mmaction2.readthedocs.io/en/latest/model_zoo/skeleton.html,
  https://raw.githubusercontent.com/open-mmlab/mmaction2/main/configs/skeleton/posec3d/README.md,
  https://raw.githubusercontent.com/open-mmlab/mmaction2/main/configs/skeleton/posec3d/custom_dataset_training.md,
  https://raw.githubusercontent.com/open-mmlab/mmaction2/main/configs/skeleton/stgcnpp/README.md,
  https://raw.githubusercontent.com/open-mmlab/mmaction2/main/tools/data/skeleton/README.md,
  https://raw.githubusercontent.com/kennymckormick/pyskl/main/README.md,
  https://api.github.com/repos/open-mmlab/mmaction2,
  https://api.github.com/repos/kennymckormick/pyskl,
  https://api.github.com/repos/ultralytics/ultralytics
- Chỉ qua tìm kiếm (không đọc nguồn): ShadowPunch (OpenReview), UCF101/HMDB51, TUHAD, Roboflow, Mendeley MMA.
