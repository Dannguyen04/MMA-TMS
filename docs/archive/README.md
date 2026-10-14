# Lưu trữ tài liệu

**Chuyển vào đây ngày**: 2026-10-11

Các tài liệu trong thư mục này **không còn dẫn dắt công việc hiện tại**. Chúng được chuyển vào đây khi dự án thu hẹp về Fight Camp ([SCOPE-FIGHT-CAMP.md](../SCOPE-FIGHT-CAMP.md)), và được giữ lại làm lịch sử: lý do của các quyết định cũ, số liệu thí nghiệm, cách chạy lại khi cần.

File được chuyển bằng `git mv`, nên lịch sử vẫn xem được bằng `git log --follow <file>`. Link trong các file đã được sửa theo vị trí mới.

| Thư mục | Nội dung | Vì sao lưu trữ |
| --- | --- | --- |
| [ai/](./ai/) | 24 tài liệu AI: spec AI coaching v1, kế hoạch, nhật ký thí nghiệm ngày 05–07/10, quyết định nhãn, rà soát giấy phép pose, trạng thái nâng cấp | Nghiên cứu AI đang đóng băng |
| [ai/worker-reports/](./ai/worker-reports/) | 5 báo cáo kiểm định từ `python-worker/` (detector đấm/đá, tracking, phạm vi chuyển động, temporal AI) | Như trên |
| [ai/examples/](./ai/examples/) | Manifest mẫu của dataset temporal | Như trên |
| [specs/](./specs/) | Master Specification v1 (baseline) và v2 | Đã được v3 thay thế ([v3](../MMA-TMS-MASTER-SPECIFICATION-v3.md) vẫn ở `docs/`) |
| [FE-FIGHTER-COACH-FLOWS.md](./FE-FIGHTER-COACH-FLOWS.md) | Luồng Fighter/Coach cho frontend, ảnh chụp ngày 27/09 | Lỗi thời (chỉ đến migration 011–012); thay bằng [BUSINESS-FLOWS.md](../BUSINESS-FLOWS.md) và [frontend-architecture.md](../../nextjs-frontend/docs/frontend-architecture.md) |
| [handovers/](./handovers/) | Bàn giao FE/Mobile: tiếp nhận võ sĩ, phân công bác sĩ, baseline, clearance | Admissions và cổng Doctor đầy đủ đang đóng băng |
| [superpowers/](./superpowers/) | Plan và spec landing page 3D (24/09) | Không thuộc phạm vi hiện tại |

## Trạng thái AI khi đóng băng

Tóm tắt từ [AI-SIX-PUNCH-VIDEO-20261006.md](./ai/AI-SIX-PUNCH-VIDEO-20261006.md), [AI_UPGRADE_STATUS.md](./ai/AI_UPGRADE_STATUS.md) và [AI_RESEARCH_RESULTS.md](./ai/AI_RESEARCH_RESULTS.md):

- **Phạm vi nghiệm thu chốt ngày 06/10:** nhận diện 6 loại đòn đấm trên video (jab, cross, lead/rear hook, lead/rear uppercut), trả `unknown` khi không đủ bằng chứng. Nhận diện loại đòn không đồng nghĩa với chấm chất lượng kỹ thuật.
- **Kết quả:** đã chạy 24 lượt cross-validation và 2 lượt refit, **chưa đạt nghiệm thu**. F1 sáu lớp trên tập chẩn đoán V9/V10 là 0,54 / 0,45. Trên video Adam, B0 từ chối cả 19 ứng viên, còn B1 nhận 5 và cả 5 đều sai.
- **Worker đang chạy** vẫn dùng model cũ; không có model mới nào được đưa vào production.
- **Muốn tiếp tục:** bắt đầu từ [AI-TEMPORAL-IMPLEMENTATION.md](./ai/AI-TEMPORAL-IMPLEMENTATION.md) (thiết kế, contract, lệnh chạy), [AI-DATA-COLLECTION-PROTOCOL.md](./ai/AI-DATA-COLLECTION-PROTOCOL.md) (thu thập và gán nhãn với HLV) và [AI-CLUB-DATA-PLAN-20261006.md](./ai/AI-CLUB-DATA-PLAN-20261006.md).
