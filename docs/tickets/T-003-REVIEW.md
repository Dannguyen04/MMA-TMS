# T-003 Review

- Ngày review: 21/10/2026, Claude.
- Phạm vi: `feat/T-003-bouts-core`, commit code `2898a82`, handover `03fc440`. Nhánh tạo từ `fight-camp` tại `843e935`; `fight-camp` chưa có commit mới, nên merge không xung đột.
- **Kết luận: APPROVED**, không có vấn đề mức "chặn". Có 1 vấn đề "nên sửa" và 2 "gợi ý"; cả ba đưa vào T-006, không cần sửa trên nhánh này.

## Hạn chế của lần review này

- **Không độc lập.** Chính Claude viết T-003 (ngoại lệ do chủ dự án chỉ định, ghi trong handover). Báo cáo này dựa vào việc chạy lại lệnh và đọc lại các điểm rủi ro, không thay được người ngoài. Nên để BE1 hoặc BE2 đọc chéo `bouts.service.ts` và `024_bouts.sql` trước khi bắt đầu T-006, T-007, vì cả hai ticket xây trên module này.
- **Chưa chạy với Supabase.** Migration 024 chỉ được kiểm bằng `test:db` (PostgreSQL tạm). Chưa áp lên Supabase.

## Lệnh đã chạy lại

Chạy trong worktree `D:/test/ai-worktrees/T-003` tại `03fc440`:

```text
$ pnpm --filter nestjs-api lint
exit 0; 40 cảnh báo cũ, không có cảnh báo nào trong src/bouts

$ pnpm --filter nestjs-api build
exit 0

$ pnpm --filter nestjs-api test
 Test Files  6 failed | 47 passed (53)
      Tests  26 failed | 767 passed (793)

$ npx vitest run src/bouts          (trong nestjs-api)
 Test Files  3 passed (3)
      Tests  118 passed (118)

$ pnpm --filter nestjs-api test:db
PASS 024 applies on ledger 23, seeds three presets and wires bouts, requirements and permissions
PASS 024 requires ledger 23 and leaves nothing behind on a collision
(mọi ca khác PASS, exit 0)

$ pnpm --filter nestjs-api db:check
001-024 checksums OK. No database connection was opened.
```

26 test lỗi đúng bằng baseline B1 (`coaching-loop-persistence` 5, `dataset-export-trust-boundary` 21); 6 file lỗi gồm 2 file đó và 4 file spec rỗng của B2. Không thêm lỗi. Mọi con số khớp với output dán trong handover.

## Đối chiếu tiêu chí nghiệm thu

| # | Kết quả | Căn cứ của tôi |
| --- | --- | --- |
| 1 | Đạt | `computeWeightTrack` (`bouts.model.ts`) đúng công thức [Tech spec §5](../FIGHT-CAMP-TECH-SPEC.md#5-cảnh-báo-cân-nặng): `GREY` khi số cân mới nhất cách hôm nay ≥ 3 ngày, `RED` khi còn ≤ A ngày và phần còn phải giảm > L, `YELLOW` theo đường tham chiếu khi còn > A ngày |
| 2 | Đạt | `acuteLossLimitPctFor`: ≥ 12 giờ dùng ngưỡng dài, nên đúng 12 giờ là 8 |
| 3 | Đạt | `academyDateOf` cộng UTC+7 cố định |
| 4 | Đạt | `evaluateGate1`: bỏ qua mục không bắt buộc; mục chưa có vào `missing`; mục có nhưng `validUntil` trước ngày thi (ngày học viện) vào `expiring` |
| 5 | Đạt | `BOUT_TRANSITIONS` chỉ mở các bước của T-003; `FIGHT_WEEK`, `WEIGHED_IN` chỉ sang `CANCELLED`, để T-006 mở tiếp |
| 6–7 | Đạt | `createBout` kiểm tra lịch trước, rồi `assertWriteAccess` theo `coach_fighters` còn hiệu lực |
| 8 | Đạt | Preset có mẫu thì sinh mục `PRESET`; HLV thêm thì `COACH` |
| 9 | Đạt | Kiểm tra trong service, và ràng buộc `uq_bouts_active_per_fighter` đỡ khi hai request chạy song song |
| 10 | Đạt | `enterFightWeek` ném lỗi trước khi ghi; chuyển trạng thái dùng `expectedStatus` |
| 11 | Đạt | Kiểm tra trong service, và khoá ngoại `fk_bout_plan_fighter (training_plan_id, fighter_id)` ở DB |
| 12 | Đạt | `assertReadAccess` đúng bốn vai như `TrainingAccessService`, không import `TrainingModule` |
| 12a–12b | Đạt | `loadWeightTrack` lấy từ `start_date` của plan; `findWeightMeasurements` bỏ bản đã bị supersede; `buildDailyWeightPoints` giữ bản mới nhất mỗi ngày |
| 13 | Đạt | `test:db` như trên; quyền đúng bảng của ticket, FIGHTER có `fighter.measurement:write`, COACH không có |

Các điểm khác đã đọc: preset AIBA có đủ 3 mẫu hồ sơ bổ sung ngày 20/10; RLS bật và revoke `anon`, `authenticated` trên ba bảng; trigger audit trên cả ba bảng (nên mọi thay đổi checklist có lịch sử, đúng F4); PATCH requirement không cho HLV đặt `CONFIRMED`.

## Vấn đề

| # | Mức | Vị trí | Vấn đề | Cách tái hiện | Xử lý |
| --- | --- | --- | --- | --- | --- |
| 1 | Nên sửa | `nestjs-api/src/bouts/bouts.model.ts:252` | Hạng mở ("Trên 120 kg", "Trên 91 kg") nhận mọi giới hạn trong 30–200 kg, kể cả giới hạn thấp hơn hạng liền dưới | Preset VMMAF, `weightClassCode: "120+"`, `weightLimitKg: 100` → tạo được trận hạng "Trên 120 kg" với giới hạn 100 kg | Đưa vào T-006 phần A: với hạng mở, giới hạn phải lớn hơn giới hạn lớn nhất của các hạng còn lại trong preset (422 `LIMIT_OUT_OF_RANGE`), kèm test |
| 2 | Gợi ý | `nestjs-api/src/bouts/bouts.service.ts:268` | Đổi hạng cân không bắt buộc lý do và không ghi vào `history`; F8 yêu cầu "ghi lý do". Ticket T-003 không yêu cầu, nên không tính là lỗi của T-003 | `PATCH /bouts/:id` với `weightClassCode` mới → thành công, `history` không đổi (audit trigger vẫn ghi) | Đưa vào T-006: `reason` bắt buộc khi đổi hạng, ghi một phần tử `history` |
| 3 | Gợi ý | — | Cảnh báo khi tạo trận (võ sĩ còn đình chỉ, đang có trận khác chạy; F1, R4) chưa có. Ngoài phạm vi T-003 vì bảng đình chỉ thuộc migration 025 | — | Đưa vào T-007 |

## Ghi chú khi merge

- **Thứ tự merge với T-026.** `feat/T-026-session-templates-ui` (gồm cả commit backend 028, 029) xung đột với T-003 ở 7 file: `docs/tickets/README.md`, `nestjs-api/migrations/README.md`, `manifest.json`, `package.json`, `run_sql.mjs`, `scripts/migration-files.mjs`, `scripts/test-migrations.mjs`. Đề xuất: merge T-003 trước. Người làm T-026 merge `fight-camp` mới vào nhánh của mình (không rebase), giải xung đột theo kiểu giữ cả hai (024 rồi 028, 029), chạy lại `test:db` và `db:check`, rồi báo review.
- **Áp migration.** Sau khi merge, chủ dự án áp 024 lên Supabase (`db:migrate:024`). Supabase đã có 028 và 029 (áp ngày 20/10); 024 chỉ yêu cầu ledger có 23, nên áp được.
