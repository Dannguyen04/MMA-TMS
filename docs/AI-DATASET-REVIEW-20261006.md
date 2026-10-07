# Bản duyệt AI ngày 2026-10-06

**Đã rà soát 67 task RGB ở mức frame mẫu. Đây là đánh giá của AI, không phải xác nhận HLV.**
Không có mẫu nào được nâng lên gold, không chấm điểm chất lượng kỹ thuật và không
thay nhãn gốc. 4.754 skeleton thiếu RGB tương ứng vẫn chưa thể kiểm chứng bằng hình ảnh.

## Kết quả

| Quyết định sơ bộ | Số task |
| --- | ---: |
| Có kỹ thuật đề xuất để đối chiếu tiếp | 15 |
| Chỉ thấy pha giữ/thu tay/chuyển tiếp | 14 |
| Chưa đủ bằng chứng | 6 |
| Có chuỗi động tác, cần tách event | 2 |
| Ngoài phạm vi solo boxing | 30 |
| HLV thật xác nhận | 0 |

Các ảnh được lấy tối đa 6 frame cách đều trong mỗi task, giải mã tuần tự và giữ
frame index cùng timestamp từ decoder. Đã xem đủ 20 contact sheet chứa 67 task.
Đây **không phải xem liên tục mọi frame**, nên có thể bỏ sót đòn nhanh và không
thể chứng nhận đoạn không có đòn. Nhãn nguồn không in trên ảnh, nhưng đã có trong
ngữ cảnh làm việc trước đó; lượt duyệt này không được coi là duyệt mù độc lập.

## Phát hiện cần xử lý trước khi dùng nhãn để đánh giá mô hình

1. **Adam có dấu hiệu sai căn chỉnh nhãn/thời gian.** Có 7 đề xuất kỹ thuật khác
   gợi ý CSV nguồn. Ví dụ task 0016 (frame 349–364, khoảng 11,63–12,17 giây) cho
   thấy tay duỗi thẳng, trong khi nguồn ghi rear hook. Task 0018 (368–388) cho
   thấy một đòn thẳng, nhưng nguồn ghi lead uppercut. Đây là dấu hiệu cần gán
   nhãn lại, chưa phải kết luận AI chắc chắn đúng về bên tay hay tên đòn.
2. Task Adam 0029–0030, khoảng 16,13–19,90 giây, chứa nhiều động tác ra đòn dù
   chưa có nhãn. Không biến những khoảng này thành background để huấn luyện.
3. Nhiều task chỉ chứa phần cuối đòn trước hoặc động tác mới bắt đầu sát biên.
   Cần xem liên tục để chia theo chu kỳ; không đếm mỗi task thành một đòn.
4. Video có tên referee_gestures chứa hai võ sĩ bắt đầu trao đổi động tác ở cuối.
   Tên file không đủ căn cứ xác định negative. Video cage_striking chuyển sang
   grappling; phạm vi nhãn phải xét từng khoảng và từng người.
5. Các số đo lịch sử trên Adam so với 18 nhãn CSV chỉ là độ khớp với nguồn chưa
   kiểm chứng. Tạm ngưng dùng chúng làm bằng chứng về độ chính xác nhận dạng;
   cần căn chỉnh lại toàn bộ video/annotation rồi đo lại. Phát hiện này không
   chứng minh mô hình tốt hơn và không tự phủ định benchmark skeleton V9/V10.

## Sản phẩm bàn giao

- [67 bản ghi máy đọc được](../python-worker/benchmark_results/ai_visual_review_20261006.json),
  có ID task, nguồn video/SHA-256, frame bằng chứng, quyết định, nhận xét và nhãn đề xuất.
- [Manifest ảnh bằng chứng](../python-worker/test_results/ai_review_20261006/evidence/evidence.json)
  và 20 ảnh ở cùng thư mục; giữ cục bộ, không commit video/ảnh.
- [Ghi chú AI nguồn](../python-worker/review_tools/ai_review_notes_20261006.json).

Mọi bản ghi dùng `AI_REVIEW_PROVISIONAL`, `actorType: AI`,
`humanReviewed: false`, `coachConfirmed: false`, `goldEligible: false`.
`technique` vẫn null; `candidateTechnique` chỉ là nhãn đề xuất, không phải
mục tiêu supervised đã chốt. Không có confidence số vì chưa hiệu chuẩn mức tin cậy.
Ranh giới chưa được duyệt; video nhiều người bị loại khỏi phạm vi solo, không phải
được xác nhận không có đòn. Gói review v2 và bản duyệt người dùng được giữ nguyên.

## Nhận xét từng task

Các mã bốn chữ số bên dưới là phần cuối của sampleId; xem ảnh theo nhóm 4 task.

### adam

| Task | Đánh giá AI | Nhãn đề xuất | Quan sát |
| --- | --- | --- | --- |
| [0000](../python-worker/test_results/ai_review_20261006/evidence/adam_00.jpg) | Chưa đủ bằng chứng | Chưa chốt | Chỉ có một frame tư thế thủ; không đủ để kết luận có hay không có đòn. |
| [0001](../python-worker/test_results/ai_review_20261006/evidence/adam_00.jpg) | Đề xuất kỹ thuật | jab | Tay phía trước duỗi thẳng rồi thu về; phù hợp ứng viên jab. Cần chốt onset/offset từ video liên tục. |
| [0002](../python-worker/test_results/ai_review_20261006/evidence/adam_00.jpg) | Pha chuyển tiếp | Chưa chốt | Hai frame thu tay/về thủ ngay sau đòn; không phải bằng chứng background độc lập. |
| [0003](../python-worker/test_results/ai_review_20261006/evidence/adam_00.jpg) | Đề xuất kỹ thuật | cross | Tay phía sau duỗi thẳng cùng xoay thân và nhấc gót sau; phù hợp ứng viên cross. |
| [0004](../python-worker/test_results/ai_review_20261006/evidence/adam_01.jpg) | Đề xuất kỹ thuật | lead_hook | Đầu khoảng còn giữ/thu đòn thẳng trước; cuối khoảng thấy tay trước vòng ngang. Ranh giới chứa nhiều pha. |
| [0005](../python-worker/test_results/ai_review_20261006/evidence/adam_01.jpg) | Pha chuyển tiếp | Chưa chốt | Bốn frame giữ tư thế tay cong sau đòn vòng; không phải một đòn mới. |
| [0006](../python-worker/test_results/ai_review_20261006/evidence/adam_01.jpg) | Đề xuất kỹ thuật | rear_hook | Đầu khoảng còn tư thế đòn vòng trước; cuối khoảng xoay thân, tay sau cong ngang. Cần tách chu kỳ. |
| [0007](../python-worker/test_results/ai_review_20261006/evidence/adam_01.jpg) | Pha chuyển tiếp | Chưa chốt | Hai frame giữ tay sau cong phía trước, thuộc phần tiếp diễn của đòn trước. |
| [0008](../python-worker/test_results/ai_review_20261006/evidence/adam_02.jpg) | Chưa đủ bằng chứng | Chưa chốt | Phần lớn frame là giữ/thu đòn trước và về thủ; cuối mới hạ người/tay chuẩn bị. Chưa thấy đủ uppercut trong khoảng. |
| [0009](../python-worker/test_results/ai_review_20261006/evidence/adam_02.jpg) | Pha chuyển tiếp | Chưa chốt | Hai frame chuyển trọng tâm, tay thấp; cửa sổ quá ngắn để gán một kỹ thuật hoàn chỉnh. |
| [0010](../python-worker/test_results/ai_review_20261006/evidence/adam_02.jpg) | Đề xuất kỹ thuật | lead_uppercut | Tay phía trước từ thấp đi lên với khuỷu gập, sau đó về thủ; ứng viên lead uppercut, khác bên tay so với gợi ý nguồn. |
| [0011](../python-worker/test_results/ai_review_20261006/evidence/adam_02.jpg) | Pha chuyển tiếp | Chưa chốt | Các frame ở tư thế thủ và chuyển nhẹ; nằm giữa các động tác, chưa xác nhận background. |
| [0012](../python-worker/test_results/ai_review_20261006/evidence/adam_03.jpg) | Đề xuất kỹ thuật | rear_uppercut | Tay phía sau đi lên với khuỷu gập và xoay thân; hình thái uppercut khác gợi ý jab. |
| [0013](../python-worker/test_results/ai_review_20261006/evidence/adam_03.jpg) | Pha chuyển tiếp | Chưa chốt | Các frame chủ yếu giữ tay cong ở cuối uppercut; không thấy pha duỗi thẳng của cross theo gợi ý nguồn. |
| [0014](../python-worker/test_results/ai_review_20261006/evidence/adam_03.jpg) | Pha chuyển tiếp | Chưa chốt | Một frame thuộc pha thu tay; không đủ cho nhãn độc lập. |
| [0015](../python-worker/test_results/ai_review_20261006/evidence/adam_03.jpg) | Chưa đủ bằng chứng | Chưa chốt | Thu tay từ tư thế uppercut rồi về thủ; không thấy rõ một lead hook mới trong sáu frame. |
| [0016](../python-worker/test_results/ai_review_20261006/evidence/adam_04.jpg) | Đề xuất kỹ thuật | jab | Tay trước đi từ thủ ra duỗi thẳng; hình thái đòn thẳng khác gợi ý rear hook. |
| [0017](../python-worker/test_results/ai_review_20261006/evidence/adam_04.jpg) | Pha chuyển tiếp | Chưa chốt | Ba frame giữ tay duỗi; tiếp diễn đòn trước, không tự gán background. |
| [0018](../python-worker/test_results/ai_review_20261006/evidence/adam_04.jpg) | Đề xuất kỹ thuật | cross | Thu đòn thẳng trước rồi tay sau duỗi thẳng cùng xoay thân; khác hình thái uppercut của gợi ý nguồn. |
| [0019](../python-worker/test_results/ai_review_20261006/evidence/adam_04.jpg) | Pha chuyển tiếp | Chưa chốt | Một frame về thủ; không đủ thông tin thời gian. |
| [0020](../python-worker/test_results/ai_review_20261006/evidence/adam_05.jpg) | Đề xuất kỹ thuật | lead_hook | Tay trước quét ngang, khuỷu gập khi thân xoay; khác hình thái uppercut của gợi ý nguồn. |
| [0021](../python-worker/test_results/ai_review_20261006/evidence/adam_05.jpg) | Chưa đủ bằng chứng | Chưa chốt | Thu tay từ đòn vòng rồi bắt đầu chuyển sang động tác tiếp theo sát cuối khoảng; cần mở rộng ngữ cảnh. |
| [0022](../python-worker/test_results/ai_review_20261006/evidence/adam_05.jpg) | Pha chuyển tiếp | Chưa chốt | Đầu khoảng đã ở tư thế tay cong phía trước rồi thu tay; không thấy một jab mới rõ ràng. |
| [0023](../python-worker/test_results/ai_review_20261006/evidence/adam_05.jpg) | Chưa đủ bằng chứng | Chưa chốt | Tư thế thủ chuyển sang hạ người/tay chuẩn bị; chưa thấy đòn thẳng cross hoàn chỉnh. |
| [0024](../python-worker/test_results/ai_review_20261006/evidence/adam_06.jpg) | Đề xuất kỹ thuật | lead_uppercut | Tay phía trước đi lên từ thấp với khuỷu gập; khác hình thái hook của gợi ý nguồn. |
| [0025](../python-worker/test_results/ai_review_20261006/evidence/adam_06.jpg) | Pha chuyển tiếp | Chưa chốt | Giữ rồi thu tay sau động tác đi lên; chưa thấy một rear hook mới như gợi ý nguồn. |
| [0026](../python-worker/test_results/ai_review_20261006/evidence/adam_06.jpg) | Pha chuyển tiếp | Chưa chốt | Một frame chuyển tiếp; không đủ cho nhãn kỹ thuật. |
| [0027](../python-worker/test_results/ai_review_20261006/evidence/adam_06.jpg) | Đề xuất kỹ thuật | rear_uppercut | Tay phía sau đi lên với khuỷu gập và xoay thân; cần xác minh bên tay, khác gợi ý lead uppercut. |
| [0028](../python-worker/test_results/ai_review_20261006/evidence/adam_07.jpg) | Pha chuyển tiếp | Chưa chốt | Tay đang ở cuối động tác đi lên rồi thu về; có thể là phần cuối đòn của khoảng trước, không đếm thêm đòn. |
| [0029](../python-worker/test_results/ai_review_20261006/evidence/adam_07.jpg) | Cần tách nhiều đòn | Chưa chốt | Từ tư thế thủ chuyển sang nhiều động tác tay; khoảng chưa nhãn có chuỗi đòn, cần chia event. |
| [0030](../python-worker/test_results/ai_review_20261006/evidence/adam_07.jpg) | Cần tách nhiều đòn | Chưa chốt | Có nhiều tư thế ra đòn, hạ người và về thủ trước khi thả tay; không dùng toàn khoảng làm background. |

### vid_01_cross_heavybag

| Task | Đánh giá AI | Nhãn đề xuất | Quan sát |
| --- | --- | --- | --- |
| [0000](../python-worker/test_results/ai_review_20261006/evidence/vid_01_cross_heavybag_00.jpg) | Đề xuất kỹ thuật | cross | Một người tập bao; thấy đòn thẳng kèm xoay thân/gót sau. Ứng viên cross, cần kiểm tra toàn chu kỳ và bên tay. |
| [0001](../python-worker/test_results/ai_review_20261006/evidence/vid_01_cross_heavybag_00.jpg) | Đề xuất kỹ thuật | cross | Thấy tay duỗi về phía bao rồi thu, sau đó quay mặt về máy; cần tách đòn khỏi phần trình bày. |
| [0002](../python-worker/test_results/ai_review_20261006/evidence/vid_01_cross_heavybag_00.jpg) | Chưa đủ bằng chứng | Chưa chốt | Phần lớn là tư thế thủ/trình bày; cuối khoảng bắt đầu bước và chuyển động. Sáu frame chưa loại trừ đòn nhanh. |
| [0003](../python-worker/test_results/ai_review_20261006/evidence/vid_01_cross_heavybag_00.jpg) | Đề xuất kỹ thuật | jab | Có tư thế tay trước duỗi về bao và thu về; ứng viên jab, không gán cross chỉ dựa tên file. |
| [0004](../python-worker/test_results/ai_review_20261006/evidence/vid_01_cross_heavybag_01.jpg) | Đề xuất kỹ thuật | cross | Cuối khoảng có đòn thẳng cùng xoay thân và chân sau; cần xem dày frame để phân biệt bên tay. |
| [0005](../python-worker/test_results/ai_review_20261006/evidence/vid_01_cross_heavybag_01.jpg) | Pha chuyển tiếp | Chưa chốt | Đoạn cuối 0,13 giây chủ yếu giữ/thu tay sau đòn trước; không phải action mới hoặc negative đã xác nhận. |

### vid_02_referee_gestures

| Task | Đánh giá AI | Nhãn đề xuất | Quan sát |
| --- | --- | --- | --- |
| [0000](../python-worker/test_results/ai_review_20261006/evidence/vid_02_referee_gestures_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Chuyển cảnh toàn sân sang trọng tài và võ sĩ; nhiều người, không phải bài solo boxing. |
| [0001](../python-worker/test_results/ai_review_20261006/evidence/vid_02_referee_gestures_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Trọng tài ra hiệu rồi đổi góc máy; không có người tập solo được chỉ định. |
| [0002](../python-worker/test_results/ai_review_20261006/evidence/vid_02_referee_gestures_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Trọng tài đi/ra hiệu giữa sàn; đây là bối cảnh thi đấu, không gán động tác tay thành đòn boxing. |
| [0003](../python-worker/test_results/ai_review_20261006/evidence/vid_02_referee_gestures_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Trọng tài di chuyển trong sàn, võ sĩ xuất hiện ở mép; không phù hợp contract một người. |
| [0004](../python-worker/test_results/ai_review_20261006/evidence/vid_02_referee_gestures_01.jpg) | Ngoài phạm vi solo | Chưa chốt | Trọng tài dang tay ra hiệu; có nguy cơ nhầm chuyển động tay với đòn. |
| [0005](../python-worker/test_results/ai_review_20261006/evidence/vid_02_referee_gestures_01.jpg) | Ngoài phạm vi solo | Chưa chốt | Cuối khoảng hai võ sĩ tiến lại gần và bắt đầu trao đổi động tác; tuyệt đối không coi cả video là negative theo tên file. |

### vid_03_fighter_walkout

| Task | Đánh giá AI | Nhãn đề xuất | Quan sát |
| --- | --- | --- | --- |
| [0000](../python-worker/test_results/ai_review_20261006/evidence/vid_03_fighter_walkout_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Cảnh giới thiệu một võ sĩ, chỉ thấy thân trên và đồ họa che phần dưới; không đủ quan sát toàn thân cho bài solo. |
| [0001](../python-worker/test_results/ai_review_20261006/evidence/vid_03_fighter_walkout_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Đứng nhìn quanh trong cảnh giới thiệu; khung hình cắt chân và đồ họa che thân dưới. |
| [0002](../python-worker/test_results/ai_review_20261006/evidence/vid_03_fighter_walkout_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Cảnh thân trên, nhìn quanh; không phải mẫu bài tập solo boxing. |
| [0003](../python-worker/test_results/ai_review_20261006/evidence/vid_03_fighter_walkout_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Cúi đầu/nhìn xuống trong cảnh giới thiệu, không quan sát chân; chưa dùng làm negative theo frame thưa. |
| [0004](../python-worker/test_results/ai_review_20261006/evidence/vid_03_fighter_walkout_01.jpg) | Ngoài phạm vi solo | Chưa chốt | Đổi góc/cỡ cảnh khi di chuyển gần lồng; thiếu ngữ cảnh tập luyện và toàn thân. |
| [0005](../python-worker/test_results/ai_review_20261006/evidence/vid_03_fighter_walkout_01.jpg) | Ngoài phạm vi solo | Chưa chốt | Giơ tay lên cao trong cảnh giới thiệu; không gán thành uppercut từ cử động tay đơn thuần. |

### vid_04_cage_striking

| Task | Đánh giá AI | Nhãn đề xuất | Quan sát |
| --- | --- | --- | --- |
| [0000](../python-worker/test_results/ai_review_20261006/evidence/vid_04_cage_striking_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Hai võ sĩ đối kháng, có động tác ra đòn; cần tracking theo người và nhãn đa tác nhân. |
| [0001](../python-worker/test_results/ai_review_20261006/evidence/vid_04_cage_striking_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Hai người trao đổi đòn, trọng tài đi ngang che khuất; không phù hợp solo single-label. |
| [0002](../python-worker/test_results/ai_review_20261006/evidence/vid_04_cage_striking_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Hai người di chuyển và trao đổi động tác, trọng tài che một phần; không xác định một actor cố định. |
| [0003](../python-worker/test_results/ai_review_20261006/evidence/vid_04_cage_striking_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Chuyển từ đứng sang ôm/nhấc người và ngã; nhiều loại động tác ngoài sáu lớp boxing. |
| [0004](../python-worker/test_results/ai_review_20261006/evidence/vid_04_cage_striking_01.jpg) | Ngoài phạm vi solo | Chưa chốt | Hai người grappling dưới sàn; không thuộc bài solo boxing đứng. |
| [0005](../python-worker/test_results/ai_review_20261006/evidence/vid_04_cage_striking_01.jpg) | Ngoài phạm vi solo | Chưa chốt | Grappling dưới sàn, trọng tài và đổi góc máy gây che khuất; cần taxonomy/pipeline riêng. |

### vid_05_ground_grappling

| Task | Đánh giá AI | Nhãn đề xuất | Quan sát |
| --- | --- | --- | --- |
| [0000](../python-worker/test_results/ai_review_20261006/evidence/vid_05_ground_grappling_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Hai người ôm/khống chế sát nhau, một người thấp/quỳ; không tách được pose solo. |
| [0001](../python-worker/test_results/ai_review_20261006/evidence/vid_05_ground_grappling_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Grappling cận thân với nhiều khớp che nhau; không dùng sáu nhãn đòn đứng. |
| [0002](../python-worker/test_results/ai_review_20261006/evidence/vid_05_ground_grappling_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Khống chế thân và chuyển tư thế; đối tượng chồng hình. |
| [0003](../python-worker/test_results/ai_review_20261006/evidence/vid_05_ground_grappling_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Hai người chuyển từ thấp/đứng sang ngã xuống sàn; cần nhãn grappling riêng. |
| [0004](../python-worker/test_results/ai_review_20261006/evidence/vid_05_ground_grappling_01.jpg) | Ngoài phạm vi solo | Chưa chốt | Khống chế trên sàn, cơ thể chồng lấn; ngoài phạm vi solo boxing. |
| [0005](../python-worker/test_results/ai_review_20261006/evidence/vid_05_ground_grappling_01.jpg) | Ngoài phạm vi solo | Chưa chốt | Grappling trên sàn và đổi góc quay; không gán background của bài solo chỉ vì không thấy đòn đứng. |

### vid_06_post_fight

| Task | Đánh giá AI | Nhãn đề xuất | Quan sát |
| --- | --- | --- | --- |
| [0000](../python-worker/test_results/ai_review_20261006/evidence/vid_06_post_fight_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Người di chuyển gần camera, cắt thân và camera đổi hướng; không có bài tập solo. |
| [0001](../python-worker/test_results/ai_review_20261006/evidence/vid_06_post_fight_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Đi lại trong sàn, có trọng tài/người khác xuất hiện; không phải đoạn tập luyện được định nghĩa. |
| [0002](../python-worker/test_results/ai_review_20261006/evidence/vid_06_post_fight_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Nhiều người và đổi góc máy; hoạt động ngoài bài tập solo boxing. |
| [0003](../python-worker/test_results/ai_review_20261006/evidence/vid_06_post_fight_00.jpg) | Ngoài phạm vi solo | Chưa chốt | Đi lại/đưa tay gần mặt giữa nhiều người; không đủ căn cứ gán kỹ thuật ra đòn. |
| [0004](../python-worker/test_results/ai_review_20261006/evidence/vid_06_post_fight_01.jpg) | Ngoài phạm vi solo | Chưa chốt | Di chuyển giữa nhiều người, camera quay theo; ngoài phạm vi thu thập solo. |
| [0005](../python-worker/test_results/ai_review_20261006/evidence/vid_06_post_fight_01.jpg) | Ngoài phạm vi solo | Chưa chốt | Nhiều người đứng quanh, khớp bị che và cắt khung; không dùng làm mẫu kỹ thuật solo. |
