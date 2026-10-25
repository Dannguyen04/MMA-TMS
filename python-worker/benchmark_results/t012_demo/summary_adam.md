# T-012 — Tóm tắt sự kiện đấm

Video: test_results/external/boxe_ml/96f3a7d0716040682381fb63f80afac96f74cfa6/adam.mp4
Detector: legacy_fsm_v1
Ghép một-một với nhãn, dung sai ±3 khung; tên nhãn là tham chiếu thủ công.

| # | Thời điểm | Impact frame | Tay | Nhãn khớp (ID, khoảng khung) |
| --- | --- | --- | --- | --- |
| 1 | 00:00.4 | 13 | right | Không khớp |
| 2 | 00:00.8 | 24 | left | 0 (1–39) |
| 3 | 00:04.5 | 134 | left | 2 (93–139) |
| 4 | 00:06.5 | 194 | right | 4 (192–240) |
| 5 | 00:08.4 | 252 | right | Không khớp |
| 6 | 00:08.6 | 259 | left | 5 (243–286) |
| 7 | 00:12.1 | 364 | left | 9 (349–364) |
| 8 | 00:12.4 | 373 | right | 10 (368–388) |
| 9 | 00:13.4 | 402 | left | 11 (390–404) |
| 10 | 00:14.3 | 428 | right | 12 (424–435) |
| 11 | 00:17.2 | 517 | left | Không khớp |
| 12 | 00:17.8 | 533 | right | Không khớp |
| 13 | 00:18.5 | 555 | right | Không khớp |

Tổng phát hiện: 13.
Số nhãn bắt được: 8/18 (44.4%).
Không khớp một-một: 5; nằm ngoài mọi nhãn (±3 khung): 3.

Kết quả chỉ đếm sự kiện đấm, không chấm kỹ thuật hay phân loại đòn
