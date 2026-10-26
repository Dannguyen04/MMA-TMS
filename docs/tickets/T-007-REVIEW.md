# T-007 Review (phần A, backend)

- Ngày review: 26/10/2026, Claude.
- Phạm vi: 3 commit code của Ken trên `origin/User_Feature` (`5d7e8ce`, `740134b`, `10edbf9`, 25/10), handover 7 vòng (A–G). Migration 025.
- **Kết luận: APPROVED.** Không có vấn đề mức "chặn".

## Nhánh

Ken làm trên `User_Feature` (đã merge `main`) rồi merge vào `main` qua PR #26 (26/10 00:06). Claude không merge `User_Feature`; Claude cherry-pick 3 commit lên `fight-camp` (đã có T-029) thành `feat/T-007-suspensions` (`bbce3bb`). Hai xung đột:

- `bouts.service.ts`, `recordResult`: ghép logic T-010 lượt 2 (R26, tự điền review) với thay đổi của Ken (`const updatedRow = await this.repo.updateBout(…)` rồi `applyResultSuspensions` trong cùng giao dịch).
- `docs/tickets/README.md`: giữ bản `fight-camp`.

## Lệnh đã chạy lại (tại `bbce3bb`)

```text
lint     : không có lỗi
build    : qua
test     : Test Files  6 failed | 58 passed (64)
                Tests  26 failed | 1021 passed (1047)   (26 = baseline B1)
test:db  : Migration checks passed: 45. PostgreSQL stopped after tests.
db:check : 001-027 checksums OK. No database connection was opened.
```

## Đối chiếu

- Migration 025: có ca trong `test-migrations.mjs` (tăng từ 43 lên 45 nhóm kiểm), checksum, `manifest.json`, `migration-files.mjs`, README migrations.
- Đình chỉ tự tạo khi ghi kết quả (R27): test preset AIBA (KO đầu 30 ngày, KO lặp 90 ngày), TKO đánh đầu, VMMAF thiếu `suspensionDays` → 422, DQ. Qua sau khi ghép với T-010.
- Cổng 2 trong training (`TRAINING_SUSPENSION_ACTIVE`), xử lý lịch xung đột (R28), `GET /readiness` (R32): có module và test riêng.
- Mục "Bổ sung 26/10": vòng D đã thêm `SUSPENSION_AWAITING_CLEARANCE`, `TRAINING_CONFLICTS_WITH_SUSPENSION` vào thẻ Việc cần làm.
- Claude chưa đọc từng dòng handover (970 dòng); dựa vào test, mục lệch và câu hỏi của vòng cuối (không có).

## Vấn đề

| # | Mức | Vị trí | Vấn đề | Xử lý |
| --- | --- | --- | --- | --- |
| 1 | Nên sửa | Quy trình | Ken merge `User_Feature` vào `main` (PR #26) trước review, không qua `fight-camp`. `main` giờ có T-029, T-007 bản chưa ghép T-010 lượt 2 | Đồng bộ ở T-011: merge `fight-camp` vào `main` sau khi T-007 merge |
| 2 | Nên sửa | Migration 025 | Cần chủ dự án áp lên Supabase trước khi chạy T-007 ở API mode | Dan áp `db:migrate:025` |
| 3 | Gợi ý | `R31` trong `GET /readiness` | Chưa thấy dùng `computeWeightFeasibility` | Ghi cho T-031 hoặc làm sau |
