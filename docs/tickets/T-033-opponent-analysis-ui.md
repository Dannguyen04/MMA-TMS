# T-033 · Màn soạn phân tích đối thủ (quan sát và chiến thuật)

| | |
| --- | --- |
| **Trạng thái** | READY (27/10) |
| **Người nhận** | Codex |
| **Nhánh** | `feat/T-033-opponent-analysis-ui`, tạo từ `sync/T-004-fight-camp` (nhánh demo; `fight-camp` chưa có màn thẻ góc đài và ghi hiệp) |
| **Hạn** | Trong ngày 27/10, để dùng ở buổi trình bày; chậm nhất trước demo cuối 31/10 |
| **Nguồn** | [Luồng nghiệp vụ E2](../FIGHT-CAMP-BUSINESS-FLOWS.md#e2-giáo-án-phân-tích-đối-thủ), R13; [T-010](./T-010-opponent-analysis-and-rounds.md) (backend), [T-010B](./T-010B-corner-card-rounds-ui.md) (thẻ góc đài, ghi hiệp) |

## Bối cảnh

Thẻ góc đài và lời dặn giữa hiệp (T-010B) dựng từ phân tích đối thủ của trận, nhưng chưa có màn nào để HLV soạn phân tích; dữ liệu demo đang dựng sẵn. Backend đã có `PUT /bouts/:id/opponent-analysis` (`nestjs-api/src/bouts/bouts.controller.ts`, body `opponentAnalysisInputSchema` trong `nestjs-api/src/bouts/bout-analysis.model.ts`; từ chối khi trận `COMPLETED` hoặc `CANCELLED`, từ chối chiến thuật không có quan sát căn cứ). Ticket này chỉ làm frontend.

## Phạm vi

1. **Trang mới** `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/opponent-analysis/` (`page.tsx` + `opponent-analysis-view.tsx`), chép khuôn từ `.../[boutId]/rounds/` (`page.tsx`, `rounds-view.tsx`). Một form, hai phần:
   - **Quan sát** (tối đa 6): loại (`STRENGTH` Điểm mạnh / `OPENING` Sơ hở / `HABIT` Thói quen), mô tả (1–300 ký tự), bằng chứng: link (http/https) **hoặc** ghi chú (ít nhất một trong hai), mức chắc chắn (`ONCE` Thấy 1 lần / `REPEATED` Lặp lại nhiều lần). Nút thêm, xoá dòng.
   - **Chiến thuật** (tối đa 5): mô tả dạng "Khi … thì …", hiệp (Mọi hiệp hoặc 1…số hiệp dự kiến), chọn **ít nhất một** quan sát căn cứ (checkbox theo quan sát trong form), yêu cầu cho bạn tập (tuỳ chọn). Xoá một quan sát thì bỏ nó khỏi các chiến thuật.
   - Nút "Lưu phân tích". Lưu xong hiện thông báo thành công và link "Xem thẻ góc đài".
   - Trận `COMPLETED`/`CANCELLED`: hiện chỉ đọc, không có nút lưu.
2. **Giữ dữ liệu không có trên form:** `profile`, `sessionIds` và `id` của chiến thuật, quan sát đã có phải được giữ nguyên khi lưu. Mục mới sinh id khớp `^[a-z0-9_-]{1,20}$` (ví dụ `obs-<n>`, `tac-<n>`, không trùng id đã có). Không gửi `review`, `updatedAt`, `updatedById` (backend dùng `strictObject`).
3. **Hàm thuần** trong `nextjs-frontend/src/lib/domain/opponent-analysis-form.ts`: chuyển dữ liệu form thành body PUT và kiểm tra (≤ 6 quan sát, ≤ 5 chiến thuật, R13, bằng chứng bắt buộc, id duy nhất). Trả lỗi theo từng ô. Test `opponent-analysis-form.test.ts` cùng thư mục.
4. **Service** `nextjs-frontend/src/lib/services/bout-analysis.ts`: thêm `saveOpponentAnalysis(boutId, input, actor)` theo khuôn `upsertBoutRound` (API: `PUT /bouts/:id/opponent-analysis`, map 404/409/422). Bản demo trong `bout-analysis.demo.ts` ghi vào `bout.opponentAnalysis` của `demoCampStore()`, từ chối khi phase `COMPLETED`/`CANCELLED`.
5. **Server action** trong `nextjs-frontend/src/lib/actions/bout-analysis.ts` theo khuôn `recordBoutRoundAction` (`authorizeCoach`, kiểm `canAccessFighter`), gọi `revalidateBoutAnalysisPaths` và thêm path `/opponent-analysis` vào hàm đó.
6. **Lối vào** ở `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/page.tsx`: link "Phân tích đối thủ" hiện ở **mọi** phase trừ `CANCELLED` (khác thẻ ring-side hiện chỉ ở `WEIGHED_IN`/`COMPLETED`). Thêm cùng link ở đầu trang thẻ góc đài.
7. **Chữ giao diện** vào `nextjs-frontend/src/lib/i18n/messages/bout-analysis.vi.ts` và `.en.ts`, không viết cứng.

### Mở rộng 27/10 (chủ dự án yêu cầu: màn chỉ là form nhập thì "sơ sài")

8. **Hồ sơ đối thủ** (E2 phần 1): thành tích, tư thế, phong cách, chiều cao, sải tay, nguồn. Không bắt buộc.
9. **Gắn chiến thuật với buổi tập** (E2 phần 4): mỗi chiến thuật chọn buổi tập của võ sĩ từ ngày bắt đầu camp (`listSessions`, bỏ buổi đã huỷ). Backend đã kiểm buổi tập thuộc võ sĩ (`OPPONENT_SESSION_INVALID`).
10. **Nhãn tự tính trên từng chiến thuật**, tính từ bản nháp bằng chính `buildCornerCard`: thứ tự trên thẻ góc đài, "Căn cứ lặp lại"/"Quan sát 1 lần", "Đã luyện"/"Chưa luyện".
11. **App kiểm tra kế hoạch**, cập nhật khi nhập, hàm thuần `lib/domain/opponent-analysis-insights.ts`. Quy tắc **đề xuất, chờ HLV chuyên môn duyệt**, ngưỡng là hằng số có tên:
    - P1: quan sát loại *Sơ hở* chưa có chiến thuật nào dùng làm căn cứ.
    - P2: quan sát loại *Điểm mạnh* chưa có chiến thuật nào dùng làm căn cứ (chưa có cách phòng).
    - P3: chiến thuật chỉ dựa trên quan sát thấy 1 lần.
    - P4: chiến thuật chưa có buổi tập (R14).
    - P7: chiến thuật chỉ có buổi tập đã xếp lịch, chưa buổi nào `completed`. Nhãn trên màn soạn: "Đã luyện" chỉ khi có ít nhất một buổi đã tập xong; có buổi nhưng chưa tập xong thì "Đã xếp lịch, chưa tập".
    - Cảnh báo P1, P2 có nút "Tạo chiến thuật": tạo chiến thuật đã chọn sẵn quan sát đó làm căn cứ, chữ bắt đầu "Khi đối thủ … thì ". Cảnh báo P3, P4, P7 có nút "Mở chiến thuật".
    - P5: mọi chiến thuật đều gắn hiệp cụ thể mà còn hiệp không có chiến thuật nào.
    - P6: ít hơn `MIN_TACTICS` = 3 chiến thuật (E2: 3–5).
12. **Bảng so số đo** với võ sĩ mình (đề xuất): tư thế, chiều cao, sải tay của hai bên và mức chênh, chỉ hiện khi biết cả hai giá trị. Tô đậm khi C1 khác tư thế hoặc đối thủ đổi tư thế; C2 chênh sải tay ≥ `REACH_GAP_CM` = 5; C3 chênh chiều cao ≥ `HEIGHT_GAP_CM` = 5. Không đưa câu giảng giải chiến thuật và không so số trận (số trận không nói gì về trình độ đối thủ đã gặp).

## Ngoài phạm vi

Đánh giá sau trận (phần 5), màn cho võ sĩ. Sửa backend, migration. Cài thư viện. Sửa `round-advice.ts` ngoài việc import.

## Tiêu chí nghiệm thu

1. Demo mode, đăng nhập "Rafael Costa", mở `/coach/bouts/bout-weighed-in/opponent-analysis`: form nạp đủ quan sát và 4 chiến thuật đang có.
2. Thêm một quan sát mới và một chiến thuật dựa trên nó, lưu: `/coach/bouts/bout-weighed-in/corner-card` hiện chiến thuật mới; các chiến thuật cũ giữ nguyên id (lời dặn giữa hiệp ở `/rounds` vẫn chạy).
3. Chiến thuật không chọn quan sát nào: không lưu được, báo lỗi tại dòng đó. Nút thêm quan sát bị tắt khi đủ 6, thêm chiến thuật bị tắt khi đủ 5.
4. Quan sát không có link lẫn ghi chú: báo lỗi tại dòng đó.
5. Link "Phân tích đối thủ" có ở trang chi tiết một trận đang ở `CAMP` (ví dụ trận của Emma Lindqvist).
6. Test của `opponent-analysis-form.ts` phủ: R13, giới hạn 6/5, bằng chứng, giữ `sessionIds`/`profile`, sinh id không trùng, bỏ trường `review`.
7. Không thêm lỗi so với baseline ở các lệnh dưới.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend exec vitest run src/lib/domain/opponent-analysis-form.test.ts
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```

Handover: `docs/tickets/T-033-HANDOVER.md` theo [TEAM-WORKFLOW §6](../TEAM-WORKFLOW.md#6-handover-bắt-buộc-docsticketst-xxx-handovermd).
