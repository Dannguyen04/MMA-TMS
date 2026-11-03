# T-038 Review (phần A, backend)

- Ngày review: 28/10/2026, Claude.
- Phạm vi: `feat/T-038-ai-tactics`. Nhánh tạo từ `feat/T-037-between-round-plan` (T-037 chưa merge), đã merge `fight-camp` (`747f374`). Commit của Codex: `d0b45d1` (code), `a0d4575` (handover).
- **Kết luận: APPROVED.** Không có vấn đề mức "chặn". Phải merge **sau** T-037.

## Lệnh đã chạy lại (tại `a0d4575`)

```text
lint     : 0 error (chỉ warning có sẵn)
build    : nest build qua
test     : Test Files  6 failed | 62 passed (68)
                Tests  26 failed | 1113 passed (1139)
           Trên nhánh T-037: 26 failed | 1048 passed. Không thêm lỗi; 65 test mới đều qua.
test:db  : Migration checks passed: 47
db:check : 001-031 checksums OK. No database connection was opened.
```

## Thử với Gemini thật (28/10, dữ liệu giả, gọi `BoutAiClient` từ `dist`)

```text
PRE_BOUT_TACTICS 60006ms {"ok":false,"error":"TIMEOUT"}
BETWEEN_ROUNDS   12010ms {"ok":false,"error":"TIMEOUT"}
```

Cùng lúc đó, `gemini-3.8-flash` trả 503 "This model is currently experiencing high demand" cho lượt đo T-039, và một câu hỏi một từ gửi bằng `curl` treo 90 s không có phản hồi. Riêng `GET /v1beta/models` vẫn trả 200 trong 0,4 s. Vậy nguyên nhân nằm ở phía Google, không phải ở code. Client xử lý đúng: đúng hạn chờ (12 s, 60 s) thì trả `TIMEOUT` và không ném lỗi. **Chưa xác nhận được chất lượng nội dung AI.** Thử lại khi model hết quá tải, trước khi làm phần B.

### Thử lại 29/10 (key thứ hai của chủ dự án, model `gemini-3.5-flash`)

`gemini-3.8-flash` (mặc định trong code) vẫn 429. Lỗi trả về cho biết gói miễn phí chỉ có **20 request/ngày cho mỗi project và mỗi model**, và key thứ hai cũng đã hết hạn mức đó (nhiều khả năng cùng project với key cũ). Đặt `GEMINI_BOUT_MODEL=gemini-3.5-flash` thì chạy được, cùng dữ liệu giả như trên:

```text
PRE_BOUT_TACTICS  9558ms ok: 3 chiến thuật, observationIds đều là quan sát có thật (o1, o3, o2), mỗi cái có lý do
BETWEEN_ROUNDS    6996ms ok: 3 lời dặn; dặn dùng tiếp t2 (EFFECTIVE ở hiệp 1), không nhắc t1 (INEFFECTIVE), dặn giữ sức vì fatigued
```

Lời dặn giữa hiệp về trong 7 s, dưới hạn 12 s. Nội dung bám đúng dữ liệu đầu vào, không bịa quan sát. **Đề xuất cho demo:** đặt `GEMINI_BOUT_MODEL=gemini-3.5-flash` hoặc bật billing, vì 20 request/ngày không đủ cho một buổi tổng duyệt.

## Đối chiếu tiêu chí nghiệm thu

| # | Tiêu chí | Kết quả |
| --- | --- | --- |
| 1 | Migration 031: CHECK, cascade, audit, RLS như `bout_rounds` | Đạt. Trigger audit, `ENABLE ROW LEVEL SECURITY`, `REVOKE ALL … authenticated` giống 027; có ca trong `test-migrations.mjs` (47 ca) |
| 2 | Client: thành công, thử lại 5xx, `QUOTA`, `TIMEOUT`, `EMPTY`, `NOT_CONFIGURED` | Đạt, `bout-ai.client.spec.ts` |
| 3 | Không gửi tên người, không gửi uuid | Đạt, và làm chặt hơn ticket: id quan sát và chiến thuật đổi thành bí danh `o1`, `t1` trước khi gửi, rồi đổi ngược khi nhận; `anonymizeAiInput` thay tên võ sĩ, đối thủ, HLV trong mọi chuỗi kể cả ghi chú; có test |
| 4 | `tactics` lọc `observationIds` sai, cache theo `input_hash` | Đạt. Cache chỉ dùng dòng `OK` (`bouts.repo.ts` `findAiCache`), kiểm lại trong transaction để tránh ghi trùng khi hai request chạy song song |
| 5 | `round-advice`: sai hiệp thì 422, sai trạng thái thì 409, an toàn đỏ, quá hạn 12 s | Đạt, `bout-ai.service.spec.ts`; thử thật ở trên cũng ra `TIMEOUT` sau 12 s |
| 6 | `PATCH` một lần, id lạ thì 422 | Đạt |
| 7 | Không có key thì app vẫn chạy, POST trả `NOT_CONFIGURED` | Đạt ở unit test. Chưa khởi động app thật (worktree không có `.env`) |
| 8 | FIGHTER bị 403 | Đạt, `bouts.controller.spec.ts` |
| 9 | Không thêm lỗi so với baseline | Đạt |

## Vấn đề

| Mức | Chỗ | Mô tả |
| --- | --- | --- |
| Gợi ý | `bouts.service.ts`, constructor | `BoutAiClient` được inject dạng tuỳ chọn (`private readonly ai?`), rồi ném lỗi lúc chạy nếu thiếu. Module đã đăng ký provider nên không lỗi thật; chỉ là cách viết lạ so với các service khác |
| Gợi ý | `decideAiSuggestion` | `decision: 'REJECTED'` vẫn nhận `acceptedItemIds` khác rỗng. Phần B nên gửi mảng rỗng; có thể chặn ở schema sau |
| Gợi ý | `bout-ai.client.ts` | Thử lại khi gặp 5xx ngay lập tức, không chờ. Với gói miễn phí đang quá tải (28/10), lần thử lại gần như chắc chắn cũng nhận 503. Không đổi được nhiều vì hạn 12 s của lời dặn giữa hiệp |

## Việc của chủ dự án

- Merge T-037 trước, rồi đến `feat/T-038-ai-tactics`.
- Áp migration 030, rồi 031, lên Supabase.
- Thêm `GEMINI_API_KEY` (và `GEMINI_BOUT_MODEL` nếu muốn đổi model) vào `.env` của backend. Gói miễn phí có thể dùng nội dung gửi lên; code đã ẩn tên người và id.
