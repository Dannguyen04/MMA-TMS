# T-037 · Đổi chiến thuật giữa hiệp và lời dặn cho hiệp sau

| | |
| --- | --- |
| **Trạng thái** | Phần A (backend): READY (28/10). Phần B (màn ghi hiệp trên điện thoại): DRAFT, viết sau khi phần A có contract chạy được |
| **Người nhận** | A: Dan, giao Codex (`codex exec`, worktree `D:/test/ai-worktrees/T-037`). B: Fon |
| **Nhánh** | `feat/T-037-between-round-plan`, tạo từ `fight-camp` mới nhất |
| **Nguồn** | [Nhận xét 27/10, mục 2](../REVIEW-27-10-FEEDBACK.md#2-trong-trận-diễn-biến-giữa-các-hiệp-phải-thực-tế-hơn); [Luồng nghiệp vụ, nghiệp vụ 9, R20–R24](../FIGHT-CAMP-BUSINESS-FLOWS.md); [T-010](./T-010-opponent-analysis-and-rounds.md) (backend ghi hiệp, đã merge) |
| **Phụ thuộc** | T-010 phần A (đã merge, migration 027 đã áp lên Supabase). Phần B nối vào màn ghi hiệp của [T-010B](./T-010B-corner-card-rounds-ui.md) |
| **Migration** | 030 (thêm một cột vào `bout_rounds`). Số 026 giữ cho T-009, 028 và 029 đã dùng ở nhánh T-026 |

## 1. Bối cảnh

Thầy nhận xét ở buổi review 27/10: lời dặn giữa hiệp phải nói rõ **hiệp sau làm gì**, và HLV phải **đổi được chiến thuật** cho hiệp sau. Hiện tại backend chỉ làm được hai việc. Thứ nhất, nó ghi hiệu quả của từng chiến thuật (`tacticMarks`). Thứ hai, nó trả `advice` trong `GET /bouts/:id/rounds` (`buildRoundAdvice`, `nestjs-api/src/bouts/bout-analysis.model.ts:224`), gồm danh sách chiến thuật xếp lại theo R21, R22, thế trận R23 và cảnh báo an toàn R24. Ba thứ còn thiếu:

1. HLV chưa chọn được chiến thuật trọng tâm cho hiệp sau. Thứ tự đang do quy tắc R21 tự quyết.
2. HLV chưa thêm được chiến thuật mới giữa trận. Chiến thuật chỉ đến từ phân tích đối thủ soạn trước trận.
3. Lời dặn chưa thành câu hành động. App chỉ trả dữ liệu xếp hạng, mỗi màn tự diễn giải.

Nguyên tắc giữ nguyên: app đề xuất, HLV quyết. Lựa chọn của HLV luôn đứng trước thứ tự app tự xếp.

## 2. Phạm vi phần A (backend)

### A1. Kế hoạch cho hiệp sau, lưu cùng bản ghi hiệp

- **Migration 030**: thêm cột `bout_rounds.next_round_plan jsonb NOT NULL DEFAULT '{}'`, kèm ràng buộc `ck_bout_rounds_next_round_plan CHECK (jsonb_typeof(next_round_plan) = 'object')`. Làm theo khuôn của `027_opponent_analysis_and_rounds.sql`: preflight yêu cầu ledger có 27 và chưa có 30, kiểm cột chưa tồn tại, advisory lock `(20260916, 30)`, ghi `migration_history`. Thêm checksum vào `manifest.json`, tên file vào `scripts/migration-files.mjs`, script `db:migrate:030` trong `package.json` theo dạng `db:migrate:027`, nhánh `--apply-030` trong `run_sql.mjs`, và một mục mô tả trong `migrations/README.md`.
- `nestjs-api/src/database/schema.ts`: thêm cột `nextRoundPlan` vào `boutRounds` (dòng 4591), kiểu `NextRoundPlan`.
- `bout-analysis.model.ts`: thêm `nextRoundPlanSchema` và trường tuỳ chọn `nextRoundPlan` trong `roundInputSchema`:

```ts
nextRoundPlanSchema = z.strictObject({
  focusTacticIds: z.array(analysisIdSchema).max(2).default([]),
  addedTactics: z.array(z.strictObject({
    id: analysisIdSchema,
    text: z.string().trim().min(1).max(140),
    observationIds: z.array(analysisIdSchema).max(3).default([]),
  })).max(2).default([]),
  instructions: z.array(z.strictObject({
    code: instructionCodeSchema,      // xem A2, thêm 'CUSTOM'
    tacticId: analysisIdSchema.optional(),
    text: z.string().trim().min(1).max(140).optional(),
  })).max(3).default([]),
});
```

  `CUSTOM` bắt buộc có `text`. `USE_TACTIC`, `STOP_TACTIC` và `RECHECK_OPPONENT` bắt buộc có `tacticId`. Viết hai điều này bằng `.superRefine`.
- `bouts.service.ts`, `putRound` (dòng 390): kiểm thêm, trong cùng transaction đang có:
  - `nextRoundPlan` có nội dung mà `roundNo` là hiệp cuối (`roundNo === bout.scheduledRounds`): 422 `BOUT_NEXT_ROUND_PLAN_LAST_ROUND`.
  - Id ở `focusTacticIds` và `instructions[].tacticId` phải là chiến thuật đã biết: chiến thuật trong `opponentAnalysis.tactics`, chiến thuật trong `addedTactics` của các hiệp **trước** hiệp này, hoặc chiến thuật trong `addedTactics` của chính request. Sai thì 422 `BOUT_ROUND_MARK_UNKNOWN` (mã có sẵn).
  - Id trong `addedTactics` không được trùng id của chiến thuật hay quan sát đã có. `observationIds` phải là quan sát có trong `opponentAnalysis.observations`. Sai thì 422 `BOUT_ROUND_MARK_UNKNOWN`.
  - `tacticMarks` của một hiệp được chấm cả chiến thuật thêm ở các hiệp trước (hiện tại bị 422 vì chỉ đối chiếu `opponentAnalysis.tactics`).
- `bouts.error.ts`: thêm `'BOUT_NEXT_ROUND_PLAN_LAST_ROUND'` vào union của `boutAnalysisInvalid` (dòng 346). Không tạo hàm lỗi mới.
- `bouts.repo.ts` (`upsertRound`, dòng 417) ghi `nextRoundPlan`. Gửi lại hiệp mà không có `nextRoundPlan` thì **giữ nguyên** kế hoạch đã lưu, giống cách các trường tuỳ chọn khác đang làm. Codex phải kiểm cách `upsertRound` hiện xử lý trường thiếu và làm cùng kiểu.
- `roundResponseSchema` (dòng 314) và `toRoundResponse`: trả thêm `nextRoundPlan` (không có thì `{ focusTacticIds: [], addedTactics: [], instructions: [] }`).

### A2. Lời dặn thành câu hành động, kèm lựa chọn của HLV

Mở rộng `buildRoundAdvice` và `roundAdviceSchema`. Không đổi chữ ký hàm theo hướng phá vỡ chỗ gọi: tham số mới, nếu có, là tham số cuối và tuỳ chọn.

1. **Chiến thuật thêm giữa trận** (gộp từ `addedTactics` của mọi hiệp đã ghi) được đưa vào danh sách xếp hạng như một chiến thuật bình thường, với `trained: false`, `basis` tính như R20 theo `observationIds`, `round: null`, `partnerBrief: null`, và trường mới `addedRound: <số hiệp đã thêm>`. Chiến thuật từ phân tích đối thủ có `addedRound: null`.
2. **Trọng tâm của HLV**: lấy `nextRoundPlan` của hiệp **cuối cùng đã ghi**. Chiến thuật có id trong `focusTacticIds` được thêm `focus: true` và đưa lên đầu danh sách, giữ thứ tự HLV chọn. Các chiến thuật còn lại theo thứ tự R21, R22 như hiện tại, và có `focus: false`. Chiến thuật trọng tâm đã bị "Bỏ" vẫn đứng đầu nhưng giữ `dropped: true`, để màn hình cảnh báo được.
3. **Trường mới `advice.nextRound`**:

```ts
nextRound: {
  roundNo: number,                 // hiệp cuối đã ghi + 1
  suggested: Instruction[],        // app đề xuất, theo bảng dưới
  plan: NextRoundPlan | null,      // HLV đã chọn ở hiệp cuối đã ghi; null nếu chưa chọn gì
}
```

`suggested` sinh **chỉ từ các quy tắc đã có (R21–R24)**, theo thứ tự sau, tối đa 5 mục:

| Thứ tự | Điều kiện (đã có trong `buildRoundAdvice`) | Mục đề xuất |
| --- | --- | --- |
| 1 | `safety` là `RED` (R24) | `{ code: 'SAFETY_CHECK' }` |
| 2 | Chiến thuật vừa chuyển sang `dropped` ở hiệp cuối đã ghi: `dropped` khi tính đủ các hiệp, nhưng chưa `dropped` khi bỏ hiệp cuối ra (R21) | `{ code: 'STOP_TACTIC', tacticId }` |
| 3 | Tối đa 2 chiến thuật đầu danh sách đã xếp (sau bước 2 ở trên), không `dropped`, không có `note` | `{ code: 'USE_TACTIC', tacticId }` |
| 4 | Chiến thuật có `note: 'OPPONENT_MAY_HAVE_CHANGED'` (R22) | `{ code: 'RECHECK_OPPONENT', tacticId }` |
| 5 | `standing.kind` là `NEED_WINS` (R23) | `{ code: 'MUST_WIN_ROUND' }` |
| 5 | `standing.kind` là `HARD_TO_WIN_ON_POINTS` (R23) | `{ code: 'HARD_TO_WIN_ON_POINTS' }` |

`instructionCodeSchema = z.enum(['SAFETY_CHECK','STOP_TACTIC','USE_TACTIC','RECHECK_OPPONENT','MUST_WIN_ROUND','HARD_TO_WIN_ON_POINTS','CUSTOM'])`. Backend chỉ trả mã. Câu chữ (ví dụ "Hiệp 3: dùng …") do frontend dịch. **Không** thêm mã gợi ý "đi tìm knock-out" hay mã nào khuyến khích đánh liều khi đang thua: R24 chỉ cảnh báo, và app không quyết thay HLV.

Hằng ngưỡng ở đầu file (`INEFFECTIVE_STREAK_TO_DROP` …) giữ nguyên.

### A3. Swagger

Cập nhật DTO trong `bouts.dto.ts` để Swagger hiện đúng `nextRoundPlan`, `nextRound`, `focus`, `addedRound`. Sau khi sửa phải khởi động được app: T-032 từng làm backend không chạy được vì JSON Schema của Swagger. Kiểm bằng `pnpm --filter nestjs-api build` và test hiện có của DTO.

## 3. Ngoài phạm vi

- Frontend, màn điện thoại (phần B).
- AI viết lời dặn (thuộc T-038). T-038 sẽ thêm mục do AI đề xuất **bên cạnh** `suggested`, không thay nó.
- Đổi ngưỡng R21–R24, đổi `buildCornerCard` hay `GET /bouts/:id/corner-card`.
- Ghi kết quả trận (R25), báo cáo trận.

## 4. Tiêu chí nghiệm thu (phần A)

1. `test:db`: 030 áp ngay sau 027; cột mới có mặc định `{}` cho dòng cũ; ràng buộc object chặn được `'[]'::jsonb`; chạy 030 lần hai thì bị preflight chặn. Có ca mới trong `scripts/test-migrations.mjs`, đặt cạnh ca 027 (dòng 873).
2. `PUT /bouts/:id/rounds/1` với `nextRoundPlan.focusTacticIds` là một chiến thuật có trong phân tích: lưu được; `GET /bouts/:id/rounds` trả `advice.nextRound.plan` đúng như đã gửi, và chiến thuật đó đứng đầu `advice.tactics` với `focus: true`, kể cả khi điểm R21 của nó thấp hơn chiến thuật khác.
3. Thêm chiến thuật mới ở hiệp 1 (`addedTactics`), rồi chấm nó trong `tacticMarks` của hiệp 2: lưu được. Chiến thuật đó có trong `advice.tactics` với `addedRound: 1` và `trained: false`.
4. Id lạ trong `focusTacticIds`, `instructions[].tacticId` hoặc `addedTactics[].observationIds`, hoặc id trong `addedTactics` trùng id đã có: 422 `BOUT_ROUND_MARK_UNKNOWN`, không ghi gì.
5. `nextRoundPlan` có nội dung ở hiệp cuối: 422 `BOUT_NEXT_ROUND_PLAN_LAST_ROUND`.
6. `CUSTOM` thiếu `text`, hoặc `USE_TACTIC` thiếu `tacticId`: 422 (lỗi validation).
7. `suggested` theo đúng bảng ở A2. Có unit test trong `bout-analysis.model.spec.ts` cho từng dòng của bảng, và ca kết hợp: an toàn đỏ, một chiến thuật vừa bị bỏ, đang cần thắng. Kết quả phải là `SAFETY_CHECK`, `STOP_TACTIC`, `USE_TACTIC` …, `MUST_WIN_ROUND`, đúng thứ tự, không quá 5 mục.
8. Gửi lại hiệp mà không có `nextRoundPlan` thì kế hoạch đã lưu không mất.
9. Test hiện có của `buildRoundAdvice`, `putRound`, `getRounds` vẫn qua mà không sửa kỳ vọng, trừ chỗ thêm trường mới (`focus`, `addedRound`, `nextRound`). Ca nào phải sửa kỳ vọng thì ghi vào handover.
10. `lint`, `build`, `test`, `test:db`, `db:check` không thêm lỗi so với [baseline](./BASELINE.md). Handover ghi số test trước và sau.

## 5. Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
pnpm --filter nestjs-api test:db
pnpm --filter nestjs-api db:check
```

## 6. Ghi chú cho người thực hiện

- Đọc trước: `bout-analysis.model.ts` (cả file), `bouts.service.ts` dòng 390–460, `bouts.repo.ts` dòng 413–440, `027_opponent_analysis_and_rounds.sql`, ca 027 trong `scripts/test-migrations.mjs`.
- Không chạy `db:migrate:*`, không kết nối Supabase. Chủ dự án tự áp 030.
- Không cài thư viện.

## 7. Phần B (DRAFT): màn ghi hiệp trên điện thoại, Fon

Sau khi phần A merge. Hai việc chính: (1) trên màn ghi hiệp của T-010B, sau khi ghi xong một hiệp, hiện khối "Hiệp sau". Khối này có các đề xuất `suggested` để HLV chạm chọn, tối đa 3, chọn được tối đa 2 chiến thuật trọng tâm, thêm được một chiến thuật mới bằng một dòng chữ, và có ô lời dặn tự do. (2) Thẻ góc đài và lời dặn hiện chiến thuật trọng tâm ở đầu. Giới hạn: chọn bằng chạm, không bắt buộc gõ chữ; dùng được ở 390 px. Ticket chi tiết viết khi phần A đã chạy được.
