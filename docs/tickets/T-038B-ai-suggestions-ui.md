# T-038 B · Màn HLV dùng gợi ý AI: chiến thuật trước trận, lời dặn giữa hiệp

| | |
| --- | --- |
| **Trạng thái** | READY (29/10). **B2 làm sau T-037 B** (cùng khối "Hiệp sau") |
| **Người nhận** | B1 (màn phân tích đối thủ, máy tính): Hoàng Anh. B2 (màn ghi hiệp, điện thoại): Fon |
| **Nhánh** | B1: `feat/T-038B1-ai-tactics-ui`, tạo từ `feat/T-033-opponent-analysis-ui`. B2: `feat/T-038B2-ai-round-advice-ui`, tạo từ nhánh của T-037 B |
| **Nguồn** | [T-038](./T-038-ai-tactics-and-round-advice.md) (phần A: backend, đã merge 29/10; [review](./T-038-REVIEW.md)), [T-033](./T-033-opponent-analysis-ui.md), [T-037 B](./T-037B-between-round-plan-ui.md) |
| **Phụ thuộc** | Màn phân tích đối thủ (T-033) và màn ghi hiệp (T-010B) chỉ có trên các nhánh chưa merge vào `fight-camp` (xem T-037 B). API mode cần migration 031 đã áp và `GEMINI_API_KEY` trong `.env` backend. Gemini thật chưa trả lời được lần nào (28–29/10, 503 và 429), nên kiểm ở API mode chỉ làm khi Claude báo đã gọi được |

## 1. Contract backend (đã có)

| Endpoint | Dùng ở |
| --- | --- |
| `POST /bouts/:id/ai/tactics` | B1 |
| `POST /bouts/:id/ai/video-observations` (body `{ url, who }`) | B1, thay lời gọi Gemini ở frontend của T-033 |
| `POST /bouts/:id/ai/round-advice/:roundNo` (`roundNo` = hiệp sắp tới) | B2 |
| `PATCH /bouts/:id/ai/suggestions/:suggestionId` (`{ decision, acceptedItemIds }`) | B1, B2 |
| `GET /bouts/:id/ai/suggestions?kind=` | B1 (lịch sử) |

Response của ba POST: `{ suggestion: { id, kind, roundNo, status, errorCode, model, output, cached, createdAt } }`. **Gemini lỗi vẫn trả 200**, với `status: 'FAILED'` và `errorCode` thuộc `NOT_CONFIGURED`, `TIMEOUT`, `QUOTA`, `UPSTREAM`, `EMPTY`. Mỗi mục trong `output` có `id` (`ai1`, `ai2`…) để ghi quyết định. `output.safety = 'RED'` khi R24 đang đỏ.

## 2. Phạm vi

### B1. Màn phân tích đối thủ (Hoàng Anh)

File: `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/opponent-analysis/opponent-analysis-view.tsx`, `lib/actions/bout-analysis.ts`, `lib/services/bout-analysis.ts`, `bout-analysis.demo.ts`, từ điển `bout-analysis.vi.ts`, `bout-analysis.en.ts`.

1. Nút **"AI gợi ý chiến thuật"** ở khối chiến thuật. Chỉ bật khi đã có ít nhất một quan sát; không có thì hiện câu giải thích (backend trả 422 `BOUT_AI_NO_OBSERVATIONS`).
2. Mỗi gợi ý hiện chữ, lý do và các quan sát làm căn cứ, có nhãn "AI đề xuất". Có hai nút: **"Dùng"** thêm gợi ý vào form chiến thuật thành **bản nháp chưa lưu**; **"Bỏ qua"** ẩn gợi ý. HLV lưu bằng nút lưu sẵn có. Sau khi lưu thì gọi `PATCH`: `ACCEPTED` nếu dùng hết, `PARTIAL` nếu dùng một phần, `REJECTED` nếu không dùng gợi ý nào (`acceptedItemIds` rỗng).
3. Chuyển **gợi ý quan sát từ video** sang `POST …/ai/video-observations`. Xoá `lib/services/opponent-video-ai.ts`, và sửa `suggestObservationsFromVideoAction` để gọi backend. Giữ nguyên giao diện hiện có của T-033. Giữ `lib/domain/opponent-video-suggestions.ts` nếu kiểm URL ở client vẫn dùng nó.
4. Quá hạn (60 s với chiến thuật, 240 s với video) hoặc `FAILED` thì hiện câu tiếng Việt theo `errorCode`. Form không bị khoá.

### B2. Màn ghi hiệp (Fon, sau T-037 B)

File: `rounds-view.tsx` (khối "Hiệp sau" của T-037 B), `lib/actions/bout-analysis.ts`, các service và từ điển như trên.

1. Nút **"AI dặn"** trong khối "Hiệp sau". Gọi `POST …/ai/round-advice/{hiệp sắp tới}`. Trong lúc chờ (tối đa 12 s), các đề xuất theo quy tắc vẫn chạm chọn được.
2. Hiện tối đa 3 lời dặn AI, có nhãn "AI", nằm **dưới** đề xuất theo quy tắc. Nếu `output.safety = 'RED'` thì cảnh báo R24 vẫn nằm trên cùng.
3. Chạm một lời dặn AI thì nó thành mục `CUSTOM` trong `nextRoundPlan.instructions` (có `tacticId` nếu AI trả). Tổng số lời dặn được chọn vẫn tối đa 3.
4. Khi lưu hiệp thì gọi `PATCH` với các `ai…` đã chọn.
5. `FAILED`, `TIMEOUT` hay mất mạng: ẩn khối AI, hiện một dòng nhỏ "AI không trả lời kịp", không chặn việc lưu.

### Demo mode (cả B1 và B2)

`bout-analysis.demo.ts` trả gợi ý mẫu cố định cho trận `bout-weighed-in`: 3 chiến thuật dựa trên quan sát có sẵn, 3 lời dặn, có độ trễ giả 1–2 s. Gợi ý mẫu ghi rõ "Gợi ý mẫu (demo)", và không gọi Gemini.

## 3. Ngoài phạm vi

Sửa backend; AI xem video từng hiệp sau trận (T-047); màn võ sĩ.

## 4. Tiêu chí nghiệm thu

1. Demo mode, B1: bấm "AI gợi ý chiến thuật", dùng 1 trên 3 gợi ý rồi lưu. Form có chiến thuật mới; `PATCH` được gọi với `PARTIAL` và đúng một id (kiểm bằng unit test của action, mock service).
2. Demo mode, B2: ghi hiệp 1, bấm "AI dặn", chọn 1 lời dặn AI rồi lưu. Mở lại thì lời dặn đó nằm trong kế hoạch hiệp sau như một mục `CUSTOM`.
3. B2: mock service trả `FAILED`/`TIMEOUT` thì khối AI ẩn và vẫn lưu hiệp được (unit test hoặc test component).
4. B1: `opponent-video-ai.ts` đã xoá; `git grep -n "generativelanguage" nextjs-frontend/src` không còn kết quả (key Gemini chỉ còn ở backend).
5. Không có câu nào cho thấy AI quyết định thay HLV: mọi gợi ý đều cần HLV chạm "Dùng" hoặc chọn.
6. 390 px (B2) và 1280 px (B1): không cuộn ngang; ảnh chụp màn hình trong handover.
7. API mode, chỉ khi Claude đã báo Gemini gọi được: chạy lại tiêu chí 1 và 2 với một trận giả; ghi `status`, `latency` trong handover.
8. `lint`, `typecheck`, `test` của `nextjs-frontend` không thêm lỗi so với nhánh gốc.

## 5. Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```
