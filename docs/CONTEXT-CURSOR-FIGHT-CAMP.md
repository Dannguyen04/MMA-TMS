# Context cho Claude — Fight Camp, 19/10/2026

File này thay ngữ cảnh cũ. Đọc trước khi viết ticket, review, hoặc đề xuất việc mới. Chủ dự án chốt trong phiên Cursor ngày 16–17/10 và nhắc lại ngày 19/10.

Nguồn nghiệp vụ vẫn là [SCOPE-FIGHT-CAMP.md](./SCOPE-FIGHT-CAMP.md), [FIGHT-CAMP-BUSINESS-FLOWS.md](./FIGHT-CAMP-BUSINESS-FLOWS.md) và [FIGHT-CAMP-TECH-SPEC.md](./FIGHT-CAMP-TECH-SPEC.md). File này ghi những gì đã làm và những gì chủ dự án đã nói thêm, để không quay lại sản phẩm cũ.

## Quyết định đã thống nhất

Sản phẩm không còn huấn luyện người muốn trở thành võ sĩ. Không có đơn đăng ký, không có ứng viên tự nộp hồ sơ, không có HLV đánh giá người lạ rồi admin duyệt thành võ sĩ.

Học viện chỉ tập cho võ sĩ đã được tuyển. HLV tạo võ sĩ trực tiếp. Võ sĩ đăng nhập bằng tài khoản được cấp.

Bài toán duy nhất là **quản lý võ sĩ trước, trong và sau một trận**:

1. **Trước trận.** Tạo trận, camp, cân mỗi ngày, cảnh báo xanh / vàng / đỏ / xám, checklist hồ sơ (Cổng 1).
2. **Trong trận.** Tuần thi đấu, cân chính thức, ghi kết quả. Phần này là T-006, chưa làm.
3. **Sau trận.** Đình chỉ, Cổng 2, được tập lại. Phần này là T-007, chưa làm.

Dinh dưỡng đi cùng kiểm soát cân (E1 / T-009), không phải thực đơn tính calo. App chỉ lưu chữ HLV hoặc chuyên gia gõ, và câu võ sĩ trả lời khi ghi cân. Không có màn dinh dưỡng cho bác sĩ.

## Những gì không được kéo lại

- Luồng applicant: `/register` dạng form mã email, tài khoản demo Quang Hồ, chữ “Apply to train”, “Continue with an email code”.
- Vai `GUEST` như một cửa sản phẩm. Code admissions cũ vẫn nằm trong repo vì [Phạm vi](./SCOPE-FIGHT-CAMP.md#giữ-gộp-đóng-băng) nói đóng băng, không xoá. Menu đã ẩn từ T-001. Chủ dự án muốn cửa công khai đóng hẳn.
- Không xoá module admissions, route `/coach/admissions`, `/admin/admissions`, action mã email, hay test của chúng, trừ khi chủ dự án nói xoá. URL cũ vẫn mở được. Đó là đúng docs. Không đưa chúng lại vào menu hay trang đăng nhập.
- Không thêm calorie, nước, sauna, hay app tự kê chế độ ăn.
- Không sửa `FightHero`, `weightCheck`, `FAST_CUT_KG_PER_WEEK`. Thẻ camp và thẻ sẵn sàng trên Today là hai số khác nhau, cố ý. Camp dùng catchweight của trận. Thẻ sẵn sàng vẫn dùng hạng cân trên hồ sơ.
- Không làm T-006, T-007, T-010, màn bác sĩ kê ăn, backend, migration, trong đợt frontend này.
- Không commit `nextjs-frontend/.env.local`. Không push nếu chủ dự án chưa yêu cầu. Commit do agent tạo không kèm `Co-authored-by`.

## Đã làm trên frontend

Làm trên Cursor, bám plan “T-005 trước, rồi dinh dưỡng trên cùng các màn”. Không sửa file plan. Chỉ frontend. Copy trên UI là tiếng Anh.

Hai nhánh, cả hai tạo từ `origin/fight-camp` (`efb293d`). Chưa push.

| Nhánh | Commit | Nội dung |
| --- | --- | --- |
| `feat/T-005b-weight-chart` | `11c11b5` | `weightChartData`, test, chấm trên `LineChart` có sẵn |
| `feat/T-005a-fighter-weigh-in` | `a001b21` | Gồm commit biểu đồ, cộng màn võ sĩ, thẻ HLV, thực đơn, câu hỏi khi ghi cân |

Working tree của `feat/T-005a-fighter-weigh-in` còn **chưa commit** ba file đóng cửa đăng ký:

- `nextjs-frontend/src/app/(auth)/login/page.tsx` — bỏ đoạn “Applying to train… Continue with an email code”.
- `nextjs-frontend/src/app/(auth)/login/demo-accounts.tsx` — bỏ Quang Hồ. Còn Minh Trần, Rafael Costa, Dr. Thu Lê, Nora Whitfield.
- `nextjs-frontend/src/app/(auth)/register/page.tsx` — không còn form. Tiêu đề “Fighters are added by the academy”. Giải thích học viện chỉ tập võ sĩ HLV đã đưa vào, có link về đăng nhập.

`nextjs-frontend/.env.local` đang `APP_DATA_MODE=demo` để tự bấm luồng camp. File bị gitignore. Trước đó chủ dự án muốn API mode. Muốn trả lại thì sửa thành `APP_DATA_MODE=api` rồi khởi động lại `pnpm dev`. Next không ghi đè biến đã set trong process bằng `.env.local`.

Local `main` là `bd1e727` (docs đã merge). Làm tiếp trên `fight-camp`, không trên `main`.

### Hành vi đã có

- Võ sĩ: nav **Bout** ngay sau Today. `/fighter/bout`, `/fighter/bout/weigh-in`. Thẻ cân trên Today, trước FightHero.
- Ghi cân: `POST /fighters/:id/measurements` với `{ weightKg, measurementContext: "SELF_REPORTED" }`. Demo ghi vào cùng store mà biểu đồ đọc. Trước migration 024, API trả 403 không phải lỗi frontend.
- Ô cân: `30`–`200` kg, một số thập phân, nhận `66,5` và `66.5`. `0`, trống, chữ, hai số thập phân, ngoài khoảng đều không ghi. Nút Save cao 44px.
- Câu “Did yesterday follow the plan?” là tuỳ chọn: On plan / Slightly off / Way off, ghi chú tối đa 200 ký tự. Bỏ qua vẫn lưu cân. Ghi chú mà không chọn đáp án thì không lưu. Một câu trả lời cho một ngày học viện; trả lời lại thì thay câu cũ. `academy_date` là hôm qua. Chấm màu nằm trên điểm cân của ngày trả lời.
- Cảnh báo vàng hoặc đỏ thêm “Last 3 days: N way off.” chỉ khi N > 0. Đếm `WAY_OFF` có `loggedOn` trong 3 ngày học viện gần nhất.
- Câu đỏ, nguyên văn: “Talk with the sports doctor or a nutrition specialist, and consider another weight class.”
- Thực đơn trên trận có ba ô chữ: camp, fight week, sau cân chính thức. Mỗi ô có người viết và giờ sửa. Võ sĩ chỉ thấy giai đoạn hiện tại: `SCHEDULED`/`CAMP` → camp; `FIGHT_WEEK` → fight week; `WEIGHED_IN` → sau cân; `COMPLETED`/`CANCELLED` → không hiện. Ô trống thì xoá giai đoạn đó. Chữ không đổi thì giữ nguyên người viết và giờ.
- HLV: trang `/coach/bouts/:id` có biểu đồ và form ba giai đoạn. Dashboard có “Weight alerts”: trận đang chạy, đỏ rồi vàng rồi xám. Không có cảnh báo thì ẩn thẻ. Xanh không hiện trong danh sách.
- Không có trận đang chạy: EmptyState “No upcoming bout”, vẫn ghi được cân, xong về dashboard.
- API mode: danh sách trận trả `[]` cho đến khi T-003/T-004 có. Ghi dinh dưỡng gặp 403/404 thì câu “not available from the server yet”.
- Biểu đồ dùng `LineChart` sẵn, không thêm thư viện. `pointColors` tô từng điểm cân. Chuỗi Reference không tô adherence.

Trạng thái cân nằm ở `buildWeightTrack` (`nextjs-frontend/src/lib/domain/weight-track.ts`). Giới hạn = catchweight nếu có, không thì hạn hạng. Không có cân, hoặc cân mới nhất cách hôm nay từ 3 ngày học viện, thì xám. Trong cửa sổ cấp (mặc định 7 ngày tới cân) mà phần trăm còn lại lớn hơn 8 thì đỏ. Ngoài cửa sổ mà cân vượt đường tham chiếu quá 1 kg thì vàng. Còn lại xanh. Đường tham chiếu chỉ để nhìn, không phải đơn thuốc.

Demo camp, seed theo ngày server đọc store lần đầu:

- `b-minh-lotus` — Minh Trần, đỏ khi seed, catchweight 60 kg, đối thủ Arman Petrosyan, Lotus Fight Night 18, giai đoạn `CAMP`.
- `b-kenji-pacific` — Kenji Morita, vàng, Pacific Invitational 4.
- `b-emma-nordic` — Emma Lindqvist, xám, Nordic Open 12, đối thủ trống nên “Opponent TBA”.

Store demo là singleton trong bộ nhớ. Tắt server là mất các lần ghi trong phiên test. Ngày 17/10, sau khi test, Minh đang 66.1 kg, đỏ, 9.2% còn lại, “Last 3 days: 3 way off”. Lucas Ferreira không có trận; một lần ghi 70.0 kg đã cập nhật `weightKg` trên hồ sơ demo. Emma được thử lưu thực đơn rồi xoá lại cho trống.

FightHero của Minh vẫn đếm tới fight night trên hồ sơ (khoảng 40 ngày vào 17/10, Lotus Fight Night 18 ngày 26/11). Thẻ camp đếm tới ngày cân của trận demo (2 ngày tại thời điểm test). Đừng “sửa” cho hai số này trùng nhau.

## Đã kiểm tra

Trên commit `a001b21`, trước ba file đăng ký chưa commit:

- `pnpm --filter nextjs-frontend lint`
- `pnpm --filter nextjs-frontend typecheck`
- `pnpm --filter nextjs-frontend test` — 75 file, 626 passed, 1 skipped

Ba file đóng cửa đăng ký chưa được chạy lại lint, typecheck, test.

Trình duyệt, demo mode, ngày 17/10:

- Điện thoại 390px: Minh ghi cân, từ chối `0`, nhận `66,5` khi bỏ câu hỏi, ghi đè cùng ngày bằng `66.1` và Way off, không tràn ngang, chỉ hiện thực đơn camp, hồ sơ y tế 2 of 3.
- Biên đã bấm và đều đúng: trống, khoảng trắng, `29.9`, `30`, `200`, `200.1`, `250`, chữ, hai số thập phân, số âm, dấu phẩy có cách, ghi chú không đáp án, ghi chú 201 ký tự, đáp án lạ, ghi chú đúng 200 ký tự, `64.5` ra xanh 7.0% và ẩn câu đỏ. `?saved=999` và `?saved=nope` không bịa thông báo. `?saved=66.5&status=BLUE` chỉ hiện “Saved 66.5 kg.”
- Lucas: không trận, ghi cân về Today, “Saved 70.0 kg.” không kèm màu.
- Khi Minh xanh, cảnh báo HLV chỉ còn Kenji vàng rồi Emma xám. Tên dài 81 ký tự và thực đơn 2.001 ký tự bị chặn. Tên trống thì lấy tên HLV. Chữ không đổi thì giữ giờ cũ. Khoảng trắng xoá ô. Id trận giả báo không tìm thấy.
- Võ sĩ mở URL của HLV, bác sĩ mở URL ghi cân, đều về trang của đúng vai. Nav bác sĩ không có dinh dưỡng hay admissions.
- `/login` không còn Quang Hồ và không còn link mã email. `/register` hiện câu học viện không nhận đơn.
- Detector Impeccable trên các trang mới trả `[]`. Có bản 4.6.0 qua `npx impeccable update`. Không chạy update trong phiên đó. Chưa có `PRODUCT.md`. Không chặn phần mở rộng đã khoanh này.

## Việc Claude nên làm tiếp

- Coi admissions là khu vực đóng băng. Ticket mới không mở lại tuyển người. Nếu review ba file chưa commit, đối chiếu với quyết định ở đầu file này, không yêu cầu trả form đăng ký.
- T-005 và phần UI của E1 đang nằm trên `feat/T-005a-fighter-weigh-in`, chưa vào `fight-camp`, chưa push. Review khi chủ dự án đưa vào review. Ba file đăng ký cần được tính vào diff nếu chủ dự án commit chúng.
- T-003, T-004 vẫn là việc backend và màn trận đầy đủ. Frontend camp hiện chạy bằng demo store vì các ticket đó chưa có trên nhánh này. API mode sẽ không hiện trận cho đến khi contract `/bouts` có thật.
- T-006, T-007, T-009 backend (migration 026), T-010 vẫn theo danh sách ticket. UI dinh dưỡng E1 đã làm trước trên demo. Backend T-009 không được đổi quy tắc đã khoá ở mục “Hành vi đã có”.
- Review 2 trong docs là 20/10, demo cuối 31/10. Đừng đề xuất thêm bề mặt ngoài trận.
