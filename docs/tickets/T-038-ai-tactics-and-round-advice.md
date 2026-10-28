# T-038 · AI gợi ý chiến thuật trước trận và lời dặn giữa hiệp, lưu kết quả AI vào database

| | |
| --- | --- |
| **Trạng thái** | Phần A (backend): READY (28/10), làm **sau khi T-037 A merge** vì cùng sửa `bout-analysis.model.ts` và dùng mã lời dặn của T-037. Phần B (màn HLV): DRAFT, chờ T-033 merge |
| **Người nhận** | A: Dan, giao Codex (worktree `D:/test/ai-worktrees/T-038`). B: Hoàng Anh (màn trước trận), Fon (lời dặn trên màn ghi hiệp) |
| **Nhánh** | `feat/T-038-ai-tactics` từ `fight-camp` mới nhất (đã có T-037 A) |
| **Nguồn** | [Nhận xét 27/10, mục 3 và 4](../REVIEW-27-10-FEEDBACK.md#3-ai-gợi-ý-chiến-thuật-cả-trước-và-trong-trận); [T-033](./T-033-opponent-analysis-ui.md) (gợi ý quan sát từ video bằng Gemini, chưa merge); [T-034](./T-034-gemini-punch-eval.md) (độ trễ và lỗi 503 của gói miễn phí) |
| **Phạm vi AI** | Ngoại lệ của [quyết định 16 và 20](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi) (đóng băng phát triển AI), được chủ dự án chấp nhận khi chia việc 27/10 |
| **Migration** | 031 (bảng mới `bout_ai_suggestions`) |

## 1. Bối cảnh

Thầy muốn thấy AI tham gia nhiều hơn, cả trước và trong trận. Hiện có:

- **Trước trận:** ở T-033, AI chỉ gợi ý *quan sát* từ video đối thủ. Lời gọi Gemini nằm ở frontend (`nextjs-frontend/src/lib/services/opponent-video-ai.ts`, chỉ có trên nhánh `feat/T-033-opponent-analysis-ui`), và kết quả chỉ cache dưới dạng file JSON trong thư mục tạm của máy chủ (`CACHE_DIR`). Chiến thuật vẫn do HLV tự viết.
- **Giữa hiệp:** lời dặn sinh từ quy tắc R20–R24, đến T-037 thì thành mã hành động (`advice.nextRound.suggested`).
- **Nhận xét 27/10, mục 4:** kết quả AI phải lưu vào database, không chỉ lưu tạm trên máy chủ.

Nguyên tắc: **AI chỉ đề xuất, HLV quyết.** Không có gợi ý nào của AI được tự ghi vào phân tích đối thủ hay kế hoạch hiệp. HLV phải chọn rồi lưu qua endpoint có sẵn (`PUT /bouts/:id/opponent-analysis`, `PUT /bouts/:id/rounds/:roundNo`).

## 2. Phạm vi phần A (backend)

### A1. Bảng lưu kết quả AI, migration 031

`bout_ai_suggestions`:

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | uuid PK, `gen_random_uuid()` | |
| `bout_id` | uuid NOT NULL, FK `bouts(id) ON DELETE CASCADE` | |
| `kind` | text NOT NULL, CHECK `IN ('PRE_BOUT_TACTICS','BETWEEN_ROUNDS','VIDEO_OBSERVATIONS')` | |
| `round_no` | smallint NULL, CHECK 1–12 | Bắt buộc khi `kind = 'BETWEEN_ROUNDS'`, NULL với loại khác (CHECK) |
| `status` | text NOT NULL, CHECK `IN ('OK','FAILED')` | |
| `error_code` | text NULL | `NOT_CONFIGURED`, `TIMEOUT`, `QUOTA`, `UPSTREAM`, `EMPTY`; NOT NULL khi `FAILED` (CHECK) |
| `model` | text NOT NULL | |
| `input_hash` | text NOT NULL | sha256 của đầu vào đã chuẩn hoá. Dùng làm cache: cùng bout, kind, round, model và hash, đã có dòng `OK` thì trả dòng đó, không gọi lại |
| `output` | jsonb NOT NULL DEFAULT `'{}'`, CHECK object | |
| `latency_ms` | integer NULL | |
| `requested_by_id` | uuid NOT NULL, FK `users(id)` | |
| `decision` | text NULL, CHECK `IN ('ACCEPTED','PARTIAL','REJECTED')` | HLV ghi lại sau khi xem gợi ý |
| `accepted_item_ids` | text[] NOT NULL DEFAULT `'{}'` | |
| `decided_at` | timestamptz NULL | |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

Index `(bout_id, kind, created_at DESC)`. Trigger audit, RLS và grant theo khuôn của bảng `bout_rounds` trong `027_opponent_analysis_and_rounds.sql`, đọc và ghi theo quyền truy cập trận như `bout_rounds`. Preflight yêu cầu ledger có 27 và 30 (T-037); advisory lock `(20260916, 31)`. Thêm vào `manifest.json`, `scripts/migration-files.mjs`, script `db:migrate:031`, `run_sql.mjs --apply-031`, `migrations/README.md` như T-037. Bảng Drizzle `boutAiSuggestions` trong `schema.ts`.

### A2. Client Gemini ở backend

- File mới `nestjs-api/src/bouts/bout-ai.client.ts`, provider `BoutAiClient`. Dùng `fetch` có sẵn của Node, **không cài thư viện**. Đọc `GEMINI_API_KEY` và `GEMINI_BOUT_MODEL` (mặc định `gemini-3.8-flash`) qua `ConfigService`, như `videos.service.ts` đang đọc cấu hình. Thiếu key thì trả lỗi `NOT_CONFIGURED`, không ném exception lúc khởi động: dev và CI không có key vẫn phải chạy được.
- Lấy khuôn từ `opponent-video-ai.ts` của T-033: structured output (`responseMimeType: application/json`, `responseSchema`), một lần thử lại khi gặp 5xx trong cùng hạn chờ, map 429 thành `QUOTA`, timeout thành `TIMEOUT`, JSON hỏng hoặc rỗng thành `EMPTY`. Đọc file đó bằng `git show feat/T-033-opponent-analysis-ui:nextjs-frontend/src/lib/services/opponent-video-ai.ts`.
- Hạn chờ: `PRE_BOUT_TACTICS` 60 s; `BETWEEN_ROUNDS` **12 s**, vì nghỉ giữa hiệp chỉ có 60 s; `VIDEO_OBSERVATIONS` 240 s.
- **Không gửi tên người** (võ sĩ, đối thủ, HLV) hay id lên Gemini. Chỉ gửi nội dung chuyên môn: hạng cân, thế đứng, sải tay, hồ sơ đối thủ (`opponentProfile`), quan sát, chiến thuật, bản ghi hiệp. Nhãn đối thủ trong prompt là "đối thủ"; nhãn võ sĩ là "võ sĩ của ta". Gói miễn phí có thể dùng nội dung gửi lên, nên điều này phải ghi trong JSDoc của client.

### A3. Endpoint

Đặt trong `bouts.controller.ts`, theo khuôn của các endpoint `rounds` (decorator envelope, `@RequirePermissions`, audit context, `randomUUID()` cho request id).

| Endpoint | Quyền | Việc |
| --- | --- | --- |
| `POST /bouts/:id/ai/tactics` | `bout:update` | Gợi ý tối đa 3 chiến thuật từ hồ sơ hai bên, quan sát và chiến thuật đã có. Mỗi gợi ý: `{ id, text (≤140), observationIds (≥1, phải là quan sát có thật), round (null hoặc 1..scheduledRounds), reason (≤200) }`. Gợi ý có `observationIds` sai thì bị lọc bỏ ở server; lọc xong mà rỗng thì `EMPTY`. Trận chưa có quan sát nào: 422 `BOUT_AI_NO_OBSERVATIONS`, không gọi Gemini |
| `POST /bouts/:id/ai/round-advice/:roundNo` | `bout:update` | `roundNo` là hiệp **sắp tới** (2..scheduledRounds), phải bằng hiệp cuối đã ghi + 1, nếu không thì 422 `BOUT_ROUND_OUT_OF_RANGE` (mã có sẵn). Đầu vào: chiến thuật đã xếp, bản ghi các hiệp và `advice` của T-037. Ra tối đa 3 lời dặn `{ text (≤120), tacticId? }`; mỗi lời dặn là **một hành động cụ thể cho hiệp sau**. `tacticId` sai thì bỏ trường đó, không bỏ cả lời dặn |
| `POST /bouts/:id/ai/video-observations` | `bout:update` | Chuyển lời gọi của T-033 về backend: body `{ url, who }`, trả quan sát như T-033. Kiểm URL bằng cùng quy tắc với `isSupportedVideoUrl` của T-033 (chép quy tắc sang backend, có test) |
| `GET /bouts/:id/ai/suggestions?kind=` | `bout:read` | Lịch sử gợi ý của trận, mới nhất trước, tối đa 20 |
| `PATCH /bouts/:id/ai/suggestions/:suggestionId` | `bout:update` | HLV ghi quyết định: `{ decision, acceptedItemIds }`. Id trong `acceptedItemIds` phải có trong `output`. Chỉ ghi được một lần; lần hai trả 409 `BOUT_AI_ALREADY_DECIDED` |

Cả ba POST:

- Kiểm quyền truy cập võ sĩ như `putRound` (`assertWriteAccess`). FIGHTER không gọi được.
- Trạng thái trận: `tactics` và `video-observations` cho phép mọi trạng thái trước `COMPLETED`; `round-advice` dùng `assertCornerStatus` như `putRound`.
- Gọi xong thì **luôn ghi một dòng** `bout_ai_suggestions`, kể cả khi thất bại (`status = 'FAILED'`, `error_code`). Nếu trùng cache thì không ghi dòng mới, và response có `cached: true`.
- Response: `{ suggestion: { id, kind, roundNo, status, errorCode, model, output, cached, createdAt } }`. Gemini lỗi thì vẫn trả **200** với `status: 'FAILED'`, vì không có gợi ý AI không phải lỗi của request. Riêng lỗi validation, quyền và trạng thái mới trả 4xx.

### A4. An toàn của lời dặn giữa hiệp

- Nếu `advice.safety` là `RED` (R24), `output` của `round-advice` luôn có `safety: 'RED'`, và prompt yêu cầu AI không đưa lời dặn tăng cường độ tấn công. Server **không** lọc nội dung chữ. Màn hình (phần B) phải hiện cảnh báo R24 trước mọi lời dặn của AI.
- Prompt cấm nhận định y tế (chấn thương, có nên dừng trận). Việc đó thuộc R24 và bác sĩ của giải.
- Lời dặn AI đi **bên cạnh** `advice.nextRound.suggested` của T-037, không thay nó. Gemini lỗi hoặc quá hạn thì màn hình vẫn có lời dặn theo quy tắc.

### A5. Mã lỗi mới

`BOUT_AI_NO_OBSERVATIONS` (422) và `BOUT_AI_ALREADY_DECIDED` (409), thêm vào `bouts.error.ts` theo khuôn của các hàm lỗi có sẵn ở đó.

## 3. Ngoài phạm vi

- Frontend (phần B). Bỏ lời gọi Gemini ở frontend của T-033 (làm khi T-033 merge, cùng phần B).
- AI xem video trận **đang diễn ra** (đo ở T-039).
- Tự ghi gợi ý vào phân tích đối thủ hay kế hoạch hiệp.
- Hàng đợi, worker, streaming. Lời gọi chạy trực tiếp trong request.

## 4. Tiêu chí nghiệm thu (phần A)

1. `test:db`: 031 áp sau 030; các CHECK chặn được `BETWEEN_ROUNDS` thiếu `round_no`, `FAILED` thiếu `error_code`, `output` không phải object; xoá trận thì xoá luôn gợi ý (cascade); có audit, RLS như `bout_rounds`. Có ca mới trong `scripts/test-migrations.mjs`.
2. Unit test của `BoutAiClient` với `fetch` giả: thành công; 503 rồi thành công (thử lại một lần); 503 hai lần thành `UPSTREAM`; 429 thành `QUOTA`; quá hạn thành `TIMEOUT`; JSON hỏng thành `EMPTY`; thiếu key thành `NOT_CONFIGURED` và `fetch` không được gọi.
3. Unit test cho prompt: body gửi lên **không chứa** tên võ sĩ, tên đối thủ, `opponentName` hay bất kỳ uuid nào. Kiểm bằng dữ liệu giả có tên riêng.
4. `POST …/ai/tactics`: gợi ý có `observationIds` sai bị lọc; ghi đúng một dòng `OK` với `input_hash`; gọi lại với cùng đầu vào thì `cached: true`, không gọi `fetch` lần hai, không thêm dòng.
5. `POST …/ai/round-advice/:roundNo`: `roundNo` khác hiệp cuối đã ghi + 1 thì 422 `BOUT_ROUND_OUT_OF_RANGE`; trạng thái không phải góc đài thì 409 như `putRound`; an toàn đỏ thì `output.safety = 'RED'`; Gemini quá hạn 12 s thì 200, `status: 'FAILED'`, `errorCode: 'TIMEOUT'`, và vẫn ghi một dòng.
6. `PATCH …/suggestions/:id`: ghi được `decision`, `accepted_item_ids` và `decided_at`; lần hai 409 `BOUT_AI_ALREADY_DECIDED`; id không có trong `output` thì 422.
7. Không có `GEMINI_API_KEY` thì app vẫn khởi động, và ba POST trả 200 với `errorCode: 'NOT_CONFIGURED'`.
8. FIGHTER gọi bất kỳ endpoint nào ở trên: 403.
9. `lint`, `build`, `test`, `test:db`, `db:check` không thêm lỗi so với [baseline](./BASELINE.md).

## 5. Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
pnpm --filter nestjs-api test:db
pnpm --filter nestjs-api db:check
```

Không có lệnh nào gọi Gemini thật. Claude sẽ thử với key thật khi review, trên dữ liệu giả.

## 6. Ghi chú cho người thực hiện

- Đọc trước: T-037 (contract `nextRound`), `bouts.controller.ts` dòng 239–380, `bouts.service.ts` `putRound` và `getRounds`, `opponent-video-ai.ts` của T-033 (bằng `git show`), `videos.service.ts` (cách đọc cấu hình và gọi `fetch`).
- Không chạy `db:migrate:*`, không kết nối Supabase, không cài thư viện.
- Thêm `GEMINI_API_KEY=` và `GEMINI_BOUT_MODEL=` vào `nestjs-api/.env.example` nếu file đó có. Không tạo `.env`.

## 7. Phần B (DRAFT)

- **Hoàng Anh, màn phân tích đối thủ (T-033):** nút "AI gợi ý chiến thuật". Mỗi gợi ý có lý do và quan sát làm căn cứ. HLV chọn gợi ý nào thì gợi ý đó thêm vào form chiến thuật như bản nháp, HLV lưu bằng nút lưu sẵn có, rồi app gọi `PATCH` để ghi quyết định. Chuyển gợi ý quan sát từ video sang endpoint backend và xoá `opponent-video-ai.ts`.
- **Fon, màn ghi hiệp (T-037 B):** trong khối "Hiệp sau", nút "AI dặn". Hiện tối đa 3 lời dặn bên dưới các đề xuất theo quy tắc. Chạm chọn một lời dặn thì nó thành mục `CUSTOM` trong kế hoạch hiệp. Quá 12 s thì ẩn khối AI, giữ phần đề xuất theo quy tắc.
