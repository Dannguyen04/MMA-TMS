# T-010 B · Thẻ góc đài, ghi hiệp, phân tích đối thủ, báo cáo (frontend)

| | |
| --- | --- |
| **Trạng thái** | READY (26/10) |
| **Người nhận** | Fon |
| **Hạn** | Đợt 1: 29/10. Đợt 2: nếu còn thời gian trước 30/10 |
| **Phụ thuộc** | T-010 A (đã merge, migration 027 đã áp). Nên làm sau T-011 |
| **Nguồn** | [T-010](./T-010-opponent-analysis-and-rounds.md) mục 2–7 (contract), [review T-010](./T-010-REVIEW.md), [Luồng nghiệp vụ E2, nghiệp vụ 6, 9, 14](../FIGHT-CAMP-BUSINESS-FLOWS.md) |

## Bối cảnh

Backend T-010 đã xong. Thứ tự cắt giảm đã chốt ([danh sách ticket](./README.md)): luôn giữ **thẻ góc đài**; có thể cắt "ghi hiệp trực tiếp" (chỉ ghi lại sau trận). Vì vậy chia hai đợt.

Endpoint (`nestjs-api/src/bouts/bouts.controller.ts`):

| Endpoint | Quyền | Ghi chú |
| --- | --- | --- |
| `GET /bouts/prior-context?fighterId&opponentName` | `bout:read` | Phân tích cũ chép lại được, `improvementPoints` |
| `PUT /bouts/:id/opponent-analysis` | `bout:update` | Ghi cả khối; trả `tacticsWithoutSessions` |
| `PUT /bouts/:id/opponent-analysis/review` | `bout:update` | Chỉ khi `COMPLETED` |
| `GET /bouts/:id/rounds`, `PUT /bouts/:id/rounds/:roundNo` | `bout:read` / `bout:update` | `advice` (R21–R24) khi chưa đủ hiệp |
| `GET /bouts/:id/corner-card` | `bout:read`, FIGHTER 403 | `WEIGHED_IN` hoặc `COMPLETED` |
| `GET /bouts/:id/report` | `bout:read`, FIGHTER 403 | Chỉ `COMPLETED` |

Mã `improvementPoints` dạng `FATIGUE_FROM_ROUND_N` là chuỗi động: đọc `fromRound`, đừng so mã cố định ([review T-010 lượt 2, vấn đề 2](./T-010-REVIEW.md)).

## Phạm vi

### Đợt 1 (bắt buộc)

1. **Thẻ góc đài** `coach/bouts/[boutId]/corner-card/page.tsx`: danh sách chiến thuật theo thứ tự backend trả (không tự sắp), nhãn "Chưa luyện" khi `trained = false`, lọc theo hiệp khi `round` khác null, cảnh báo `acuteLossFlag`. Có bản in A4 (`@media print`, một trang).
2. **Ghi hiệp sau trận** `coach/bouts/[boutId]/rounds/page.tsx`: mỗi hiệp một thẻ (HLV tự chấm thắng/thua, số lần bị đánh ngã, choáng, mệt, dấu chiến thuật `EFFECTIVE`/`INEFFECTIVE`/`NOT_USED`, dấu quan sát `SEEN`/`NOT_SEEN`). Ghi bằng `PUT …/rounds/:roundNo`.
3. Service: thêm hàm API vào `nextjs-frontend/src/lib/services/bouts.ts` và bản demo vào `bouts.demo.ts`, theo khuôn các hàm có sẵn trong hai file đó; Server Action trong `nextjs-frontend/src/lib/actions/bouts.ts` theo khuôn `enterFightWeekAction`.

### Đợt 2 (nếu còn thời gian)

4. **Tab Đối thủ** trên chi tiết trận: soạn hồ sơ, quan sát (≤ 6, cần `evidenceUrl` hoặc `evidenceNote`), chiến thuật (cần ít nhất một quan sát căn cứ), gắn buổi tập; nút "Chép từ trận trước" khi `prior-context` có `copyableAnalysis`.
5. **Lời dặn giữa hiệp** trên màn ghi hiệp: hiện `advice` (`tactics`, `standing` kèm chữ "HLV tự chấm", `safety` RED với câu "Cân nhắc dừng trận, báo bác sĩ của giải"). App không quyết định thay HLV.
6. **Báo cáo trận** `coach/bouts/[boutId]/report/page.tsx` và đánh giá chiến thuật (`PUT …/review`).

## Ngoài phạm vi

Backend. Thành tích thắng–thua. Màn võ sĩ (FIGHTER bị 403 ở thẻ góc đài, ghi hiệp, báo cáo).

## Tiêu chí nghiệm thu

1. Đợt 1: thẻ góc đài đúng thứ tự backend, in ra một trang A4; ghi đủ một trận 3 hiệp ở API mode, đọc lại đúng.
2. Ở 390 px không cuộn ngang (thẻ góc đài và ghi hiệp dùng trên điện thoại ở góc đài).
3. Trận chưa `WEIGHED_IN`: không hiện link thẻ góc đài; lỗi 409 hiện câu tiếng Việt.
4. Chữ qua từ điển `coach-bouts.*.ts`; có test cho hàm thuần chuyển dữ liệu thành nội dung hiển thị.
5. Handover ghi rõ đã làm đợt nào.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```
