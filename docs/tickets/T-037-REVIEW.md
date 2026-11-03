# T-037 Review (phần A, backend)

- Ngày review: 28/10/2026, Claude.
- Phạm vi: `feat/T-037-between-round-plan`, `2aa67b8` (code, Codex), `3e3b816` (handover).
- **Kết luận: APPROVED.** Không có vấn đề mức "chặn".

## Lệnh đã chạy lại (tại `3e3b816`)

```text
lint     : chỉ warning (có sẵn ở baseline), exit 0
build    : nest build qua
test     : Test Files  6 failed | 60 passed (66)
                Tests  26 failed | 1048 passed (1074)
           Baseline cùng ngày trên fight-camp: 26 failed | 1023 passed (1049), 6 file lỗi (notifications, coaching-loop, dataset-export). Không thêm lỗi.
src/bouts: Test Files  9 passed (9), Tests 308 passed (308)
test:db  : Migration checks passed: 46 (baseline 45)
db:check : 001-030 checksums OK. No database connection was opened.
```

## Đối chiếu tiêu chí nghiệm thu

| # | Tiêu chí | Kết quả |
| --- | --- | --- |
| 1 | Migration 030: mặc định, CHECK object, chặn chạy lần hai | Đạt. `030_between_round_plan.sql`, ca mới trong `scripts/test-migrations.mjs` |
| 2 | Trọng tâm của HLV đứng đầu, `focus: true` | Đạt. `buildRoundAdvice` sắp theo thứ tự trong `focusTacticIds` trước R21 |
| 3 | Chiến thuật thêm giữa trận, chấm được ở hiệp sau, `addedRound` | Đạt. `putRound` thêm id từ `addedTactics` của các hiệp trước vào tập hợp lệ |
| 4 | Id lạ hoặc trùng thì 422 `BOUT_ROUND_MARK_UNKNOWN` | Đạt, có test trong `bouts.service.spec.ts` |
| 5 | Hiệp cuối có kế hoạch thì 422 `BOUT_NEXT_ROUND_PLAN_LAST_ROUND` | Đạt |
| 6 | `CUSTOM` thiếu `text`, mã chiến thuật thiếu `tacticId` thì 422 | Đạt, `bouts.dto.spec.ts` qua pipe thật |
| 7 | `suggested` đúng bảng và thứ tự, tối đa 5 | Đạt, `bout-analysis.model.spec.ts` |
| 8 | Gửi lại hiệp không có `nextRoundPlan` thì giữ kế hoạch | Đạt. `upsertRound` bỏ qua trường `undefined`, có test trong `bouts.repo.spec.ts` |
| 9 | Test cũ không đổi kỳ vọng ngoài trường mới | Đạt |
| 10 | Không thêm lỗi so với baseline | Đạt |
| A3 | Swagger không làm app sập | Đạt ở mức unit: `z.toJSONSchema` chạy được trên mọi DTO đổi (`bouts.dto.spec.ts`). Chưa khởi động app thật vì worktree không có `.env` |

## Vấn đề

| Mức | Chỗ | Mô tả |
| --- | --- | --- |
| Gợi ý | `bouts.service.ts`, `putRound` | Sửa lại một hiệp cũ có thể bỏ một chiến thuật đã thêm, trong khi hiệp sau đã chấm chiến thuật đó. Khi đó `tacticMarks` của hiệp sau giữ id mồ côi. `buildRoundAdvice` bỏ qua id này nên không lỗi. Để phần B quyết có cần chặn không |
| Gợi ý | `bout-analysis.model.ts` | Ở `buildRoundAdvice`, `nextRoundPlanSchema.parse` chạy trên dữ liệu đã lưu. Dữ liệu cũ hỏng sẽ làm `GET rounds` lỗi 500. Hiện mọi dòng đều qua validate khi ghi nên chưa xảy ra |

## Việc của chủ dự án

- Merge `feat/T-037-between-round-plan` vào `fight-camp`.
- Áp migration 030 lên Supabase (`pnpm --filter nestjs-api db:migrate:030`).
