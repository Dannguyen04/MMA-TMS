# Quyết định nhãn Adam — 2026-10-06

Theo chỉ định của chủ dự án: **chốt nhãn Adam gốc**.

Nguồn chính là `adam_gt.csv` tại commit mirror
`96f3a7d0716040682381fb63f80afac96f74cfa6`, SHA-256:
`e7df3f784466f311a84b7d7d6aa6449e7eea5f9c3f91a1d512281b41769fdefb`.

Áp dụng cho toàn bộ 18 dòng gốc, bao gồm cả các dòng AI trước đó đánh giá chưa
rõ. Giữ nguyên nhãn và ranh giới frame inclusive; code chỉ đổi end thành end + 1
khi dùng interval half-open. Không tự sửa/xóa điểm chồng ranh giới. Khoảng ngoài
18 annotation vẫn chưa có nhãn; không thêm gợi ý Gemini hoặc tự gán background.

Các đề xuất AI/Gemini chỉ là tham khảo, không ghi đè nhãn Adam. Bất đồng giữ
trong báo cáo lịch sử để truy nguyên. Không loại bốn mẫu uppercut vì hai AI bất
đồng: quyết định chọn nguồn gốc thay thế đề xuất đó. Đây là quyết định chọn nguồn
nhãn của dự án, không phải chứng nhận HLV đã duyệt.

## Dataset đã cập nhật

Manifest hiện hành:
`python-worker/test_results/provisional_dataset/20261006_adam_source_v1/manifest.json`.

| Thành phần | Số mẫu |
| --- | ---: |
| Skeleton upstream | 4.754 |
| Adam theo đủ 18 annotation gốc, qua kiểm tra pose | 18 |
| Nhãn AI video bao cát, giữ từ vòng trước | 3 |
| Tổng | 4.775 |
| Train / validation / calibration / observed diagnostic | 3.681 / 199 / 595 / 300 |

Adam tiếp tục nằm trong train. Trọng số loss phần video bổ sung giữ 0,25;
4.754 skeleton upstream dùng trọng số 1. Nguồn Adam trong manifest ghi
`UPSTREAM_IMPORTED_UNVERIFIED`, `SOURCE_SELECTED_BY_USER`, kèm ID dòng và hash CSV.
Các cờ coachConfirmed/goldEligible/productionEligible vẫn false.

Builder mặc định áp dụng quy tắc này. Loader đối chiếu các mẫu Adam với CSV đã
khóa hash và từ chối nhãn, ranh giới hoặc provenance sai. Đã dùng lại pose local
sau khi kiểm tra hash video/output, không gọi Gemini hoặc trích YOLO lại.
6 kiểm thử đạt; nạp thực tế và đối chiếu đủ 18 target/interval với nguồn.

[Bằng chứng và 18 bản ghi](../python-worker/benchmark_results/adam_source_selection_20261006.json).
Sau lượt chốt nhãn, đã huấn luyện đầy đủ 3 seed × 40 epoch theo yêu cầu tiếp theo.
Checkpoint mới chọn seed 20261007, epoch 37; xem
[kết quả huấn luyện](AI-TRAINING-RESULTS-20261006.md). Checkpoint 3 epoch trước
thuộc phiên bản nhãn cũ. Dataset và kết quả cũ được giữ để truy nguyên;
`modelRetrained=false` trong báo cáo chốt nguồn là trạng thái lịch sử lúc tạo nó.
