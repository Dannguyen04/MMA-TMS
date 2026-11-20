# Fight Camp: sơ đồ code

Tính năng chuẩn bị trận đấu: danh sách trận của HLV, chi tiết trận (cân nặng, giấy tờ, phân tích đối thủ), cân chính thức, nhập từng hiệp, gợi ý AI giữa hiệp và báo cáo sau trận.

Mọi đường dẫn dưới đây tính từ `src/features/fight-camp/`. Số dòng ghi theo commit lúc viết, nên khi code đổi hãy tìm theo tên hàm.

## Thư mục

| Thư mục | Chứa gì | Quy tắc |
|---|---|---|
| `api.ts` | Kiểu dữ liệu và `campApi`: mọi lời gọi REST của tính năng | Màn hình chỉ gọi API qua `campApi`, không gọi `apiFetch` trực tiếp |
| `screens/` | Màn hình đầy đủ mà route hoặc tab hiển thị | Ghép component, gọi `campApi` và giữ state màn hình |
| `components/` | Khối giao diện riêng của Fight Camp | Nhận dữ liệu qua props, một số tự gọi `campApi` khi lưu |
| `logic/` | Luật và model thuần TypeScript, không có JSX | Dễ test, không gọi mạng |
| `state/` | Hook, store tạm và dữ liệu xem trước (preview) | |
| `i18n/` | Chữ tiếng Việt của tính năng | Không viết chữ thẳng trong màn hình |
| `testing/` | Mock dùng chung cho test | Chỉ test import |

Test nằm ngay cạnh file nó kiểm tra (`x.tsx` đi với `x.test.tsx`).

Giao diện dùng chung cho mọi vai trò (CampShell, thẻ, nút, tab, biểu đồ cân WeightPlot, hiệu ứng lửa của tab) nằm ở `src/shared/ui/`, không nằm ở đây.

## Route → màn hình

| Route (`src/app`) | Màn hình |
|---|---|
| `(coach)/fight-camp/index.tsx` | `screens/coach-camp-screen.tsx` → `CoachCampList` (dòng 24) |
| `(coach)/fight-camp/bout.tsx` | `screens/coach-camp-screen.tsx` → `CoachCampBout` (dòng 75) |

`CoachCampBout` mở các tab: tổng quan, cân nặng, giấy tờ và đối thủ (`screens/bout-detail-tabs.tsx`). Từ đó vào góc đài (`round-screens.tsx` → `CornerScreen`), nhập hiệp (`round-entry-screen.tsx` → `RoundScreen`) và báo cáo (`report-screen.tsx` → `ReportScreen`).

Màn hình phía võ sĩ đang nằm ở `src/screens/fighter/bout/`, và dùng lại `api.ts`, `logic/camp-rules.ts`, `state/camp-preview.ts`, `components/fighter-suspension.tsx` của thư mục này. `screens/fighter-camp-screen.tsx` hiện không có route nào trỏ tới.

## Chức năng → file → API

| Chức năng | File:dòng | Gọi API (`api.ts`) | Endpoint Nest |
|---|---|---|---|
| Danh sách trận của HLV | `screens/coach-camp-screen.tsx:32` | `campApi.list` | `GET /bouts` |
| Mở chi tiết trận | `screens/coach-camp-screen.tsx:95` | `campApi.detail` | `GET /bouts/:id` |
| Án treo giò của võ sĩ | `screens/coach-camp-screen.tsx:99` | `campApi.suspensions` | `GET /suspensions` |
| Biểu đồ cân nặng | `screens/bout-detail-tabs.tsx:138` | `campApi.weightTrack` | `GET /bouts/:id/weight-track` |
| Cân chính thức | `screens/coach-camp-screen.tsx:143` | `campApi.weigh` | `POST /bouts/:id/weigh-in` |
| Đổi sang catchweight | `screens/coach-camp-screen.tsx:149` | `campApi.catchweight` | `POST /bouts/:id/catchweight` |
| Hủy trận | `screens/coach-camp-screen.tsx:152` | `campApi.cancel` | `POST /bouts/:id/cancel` |
| Lưu phân tích đối thủ | `components/opponent-editor.tsx:79` | `campApi.saveAnalysis` | `PUT /bouts/:id/opponent-analysis` |
| Chép phân tích trận trước | `components/opponent-editor.tsx:87` | `campApi.prior` | `GET /bouts/prior-context` |
| Thẻ góc đài | `screens/round-screens.tsx:18` | `campApi.corner` | `GET /bouts/:id/corner-card` |
| Đổi số hiệp | `screens/round-entry-screen.tsx:40` | `campApi.update` | `PATCH /bouts/:id` |
| Tải các hiệp đã lưu | `screens/round-entry-screen.tsx:56` | `campApi.rounds` | `GET /bouts/:id/rounds` |
| Lưu một hiệp | `screens/round-entry-screen.tsx:105` | `campApi.saveRound` | `PUT /bouts/:id/rounds/:roundNo` |
| Gợi ý AI giữa hiệp | `state/use-round-ai.ts:41` | `campApi.roundAdvice` | `POST /bouts/:id/ai/round-advice/:roundNo` |
| Lịch sử gợi ý AI | `state/use-round-ai.ts:57` | `campApi.aiHistory` | `GET /bouts/:id/ai/suggestions` |
| Nhận / bỏ gợi ý AI | `screens/round-entry-screen.tsx:113` | `campApi.decideAi` | `PATCH /bouts/:id/ai/suggestions/:sid` |
| Báo cáo sau trận | `screens/report-screen.tsx:32` | `campApi.report` | `GET /bouts/:id/report` |
| Đánh giá chiến thuật | `screens/report-screen.tsx:59` | `campApi.review` | `PUT /bouts/:id/opponent-analysis/review` |

## Luật nằm ở đâu

- Nhãn trạng thái, định dạng kg và ngày, kiểm tra form phân tích: `logic/camp-rules.ts`.
- Kế hoạch hiệp sau (chọn chiến thuật, chỉ thị): `logic/next-round-plan.ts`.
- Rút gợi ý AI thành dòng, xác định hiệp đích, timeout: `logic/round-ai.ts`.
- Đánh giá chiến thuật và điểm cần cải thiện của báo cáo: `logic/bout-report-model.ts`.
- Lộ trình cân (`referencePath`) do API tính (`nestjs-api/src/bouts/bouts.model.ts`, `buildReferencePath`). App chỉ vẽ nó bằng `WeightPlot` trong `src/shared/ui/camp-ui.tsx`.

## Chế độ xem trước (preview)

Khi không có trận thật, màn hình dùng dữ liệu mẫu ở `state/camp-preview.ts` và `logic/round-advice-preview.ts`. Hiệp nhập ở chế độ này lưu trong `state/preview-round-store.ts`, không gửi lên server.
