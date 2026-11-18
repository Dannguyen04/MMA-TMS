# Bản release cho buổi review cuối 10/11

Nhánh `release/final-review`, tạo ngày 9/11 từ `origin/fight-camp` `1befea2`. Chủ dự án chốt: gộp cả ba nhánh UI còn mở, thêm màn báo cáo sau trận, chỉ push nhánh release, không merge vào `fight-camp` hay `main`. Dan merge sau buổi review.

## Đã gộp

| Nhánh | Nội dung | Xung đột |
| --- | --- | --- |
| `feat/ui-p1-p3` | P0–P3 UI: màn lỗi và 404, chặn rời trang khi chưa lưu, Ctrl+K, in/CSV, manifest, dịch video, admin, tuyển sinh | 0 |
| `feat/T-009-nutrition-ui` | Kế hoạch ăn theo giai đoạn (B1), chấm màu trên biểu đồ cân (B3) | 1 dòng import, giữ cả hai |
| `feat/website-platform` (fogit-hd, 9/11) | Giao diện workspace "variant B", dịch thêm admin, health, demo flow, select mới, ticket T-058–T-061 | 54 file |

**Cách giải 54 file của `website-platform`.** Hai nhánh cùng dịch một màn nhưng dùng hai bộ khoá khác nhau. Ví dụ `screens.admin.meta.roles` so với `screens.misc.adminPages.roles.title`.

- 48 file chỉ khác ở phần dịch (admin, tuyển sinh, video, thư viện bài tập): giữ bản `ui-p1-p3`, vì đã có test chặn chữ Anh viết cứng phủ.
- `app-shell.tsx`: lấy khung `WorkspaceSidebar` của Fon, thêm Ctrl+K và các class in của `ui-p1-p3`.
- `globals.css`: giữ cả khối in lẫn token variant B. Khi in, ẩn thanh bên mới, bỏ lề trái, nền trắng.
- Dashboard admin: chữ của `ui-p1-p3`, đặt trong khung `workspace-editorial` của Fon.
- `(auth)/layout` và `not-found`: khoá dịch của `ui-p1-p3`, màu chữ và kiểu tiêu đề 404 của Fon.
- `design.md` (Fon) trùng tên với `DESIGN.md` trên Windows. Đã chuyển sang `nextjs-frontend/docs/design-workspace-b.md`, có link từ `DESIGN.md`.
- Sau khi gộp, các khoá chỉ màn của Fon dùng thì không còn chỗ gọi nên đã xoá: `admin-body`, `admin-forms`, `screens.misc.adminPages.*`, `shell.notFound/missing/error.title/retry`.

Chủ dự án chốt giữ giao diện variant B của Fon cho buổi demo.

## Thêm mới

- **Màn báo cáo sau trận** (T-041, nghiệp vụ 14), tại `/coach/bouts/[boutId]/report`. Gồm:
  - kết quả trận;
  - điểm cần luyện cho camp sau;
  - chiến thuật kèm số hiệp hiệu quả, có sửa và lưu được kết luận;
  - quan sát không thấy lại trong trận;
  - giảm cân cấp tốc.

  Demo mode dùng cùng công thức R29, R30 với backend: chép `evaluateTactics`, `buildImprovementPoints`, và các kết luận tự động lưu lúc ghi kết quả.
- **Khối "Hiệp sau" (T-037 B)**, trên màn ghi hiệp, cho nhận xét 27/10 mục 2:
  - Ngay dưới cảnh báo an toàn, HLV chạm chọn tối đa 3 lời dặn: đề xuất của app (kiểm tra an toàn được chọn sẵn) hoặc tự gõ.
  - HLV chọn tối đa 2 chiến thuật trọng tâm và thêm tối đa 2 chiến thuật mới.
  - Thẻ góc đài có nhãn "Trọng tâm" và "Thêm ở hiệp n". Mọi nút chạm cao tối thiểu 44 px.
  - Chưa làm "chế độ ghi giữa hiệp" (chỉ mở hiệp đang ghi, mặc định 4 chạm).
- **Phần của Fon** (chủ dự án giao ngày 9/11):
  - T-048: võ sĩ xem đình chỉ, mức được tập, lộ trình tập lại và buổi "Chờ xếp lại" trên điện thoại.
  - Khu bác sĩ: hết tràn ngang ở 390 px, sửa lỗi a11y `<dl>`, chữ viết cứng ở 3 màn từ 64 xuống 0.
  - T-058 đến T-061: lệnh đọc phụ gặp 403 hoặc lỗi mạng không còn làm cả trang hiện khung lỗi. Mỗi ticket có mục "Điều tra 9/11".
- **Demo mode giống API mode:**
  - Chỉ còn một kho đình chỉ, đình chỉ tạo cùng lúc ghi kết quả.
  - Hộp thoại kết quả hỏi số ngày đình chỉ.
  - Trận mới có chiến thuật mẫu.
  - Kết luận chiến thuật được chốt lúc ghi kết quả.
- **Sửa lỗi gặp khi rà soát:**
  - In và lưu PDF ra nền màu, do khung mới của Fon.
  - Tiêu đề "Việc cần làm" bị xuống dòng ở 1440 px.
  - Trang hồ sơ võ sĩ hiện khung lỗi khi dịch vụ video không trả lời.
  - Hai test chập chờn khi máy bận: test chặn chữ Anh, và các test nạp cả kho demo.
  - Câu gợi ý giai đoạn trên form giáo án còn tiếng Anh.
  - Kịch bản demo bước C4 sai so với T-049.

## Kiểm tra

| Lệnh | Kết quả |
| --- | --- |
| Frontend lint | 0 lỗi |
| Frontend typecheck (`APP_DATA_MODE=api`) | 0 lỗi |
| Frontend test | 1346 qua, 2 skip |
| `ui:smoke` (`vi`, 1440 và 390 px, 4 vai) | 368 trang, 0 lỗi |
| UAT demo mode | 3/3 lượt liên tiếp trên commit cuối, mỗi lượt 15/15; API mode 1 lượt 13/15, 2 bước không phải lỗi app ([UAT-FINAL-REVIEW.md](./UAT-FINAL-REVIEW.md)) |
| Frontend build (API mode) | Qua, có route `/coach/bouts/[boutId]/report` |
| Backend lint, build | 0 lỗi, qua |
| Backend test | Chỉ lỗi baseline B1 (cần Redis, Supabase), B2 (file spec rỗng). Nhánh không đụng `nestjs-api/` |
| `db:check` | Checksum 001–033 OK |
| `test:db` | Không chạy được: máy chưa cài PostgreSQL 18. Không có migration mới |
| Coverage (đo tạm bằng `@vitest/coverage-v8`, không thêm vào repo) | `lib/domain` (quy tắc nghiệp vụ) 92,7% dòng, 81,5% nhánh. Toàn frontend 33,7% dòng: page và component được kiểm bằng smoke và UAT |
| Code trùng | Script so cửa sổ 8 dòng trên các file đã đổi: đã gom đoạn kiểm quyền lặp trong `lib/actions/bout-analysis.ts`. Còn lại là màn lỗi của T-030 và trang `/lab` (chỉ cho dev) |
| Review độc lập (agent) | 4 lỗi nên sửa, đã sửa hết |

UAT: xem [UAT-FINAL-REVIEW.md](./UAT-FINAL-REVIEW.md).

## Database

Ngày 9/11, Supabase của team chưa có migration 033 (T-050), dù bảng ticket ghi là đã áp. Hậu quả là `GET /suspensions`, `/readiness`, `/coach/todo` trả 500 (`column "issued_by" does not exist`). Chủ dự án đồng ý, Claude chạy `db:migrate:033` một lần: "Applied 033 successfully". Không áp migration nào khác.

## Lưu ý khi chạy

- Không chạy `next build` khi `next dev` đang chạy trong cùng thư mục. Build xoá `.next`, server dev mất cache rồi crash (Turbopack panic, gặp ngày 9/11).
- Demo mode dự phòng không cần backend: đặt `APP_DATA_MODE=demo` và `NEXT_PUBLIC_VIDEO_PIPELINE=mock`. `.env.local` hiện đặt pipeline `api`, nên khi backend tắt thì các màn video báo lỗi.

## Gộp màn bác sĩ mới của Fon (10/11)

`origin/feat/website-platform` ở `59d7661` (2 commit: `2727090`, `59d7661`, tạo từ `fight-camp` `1befea2`), gộp `--no-ff` theo yêu cầu của chủ dự án.

Fon cũng đã bỏ khung riêng của bác sĩ: mọi vai, kể cả bác sĩ, dùng chung `AppShell`. Khung của chủ dự án vì thế được giữ nguyên.

Cách giải 28 file xung đột:

| Nhóm | Bên được giữ |
| --- | --- |
| `app/(app)/doctor/**`, `components/doctor/**`, 4 file `components/medical/examination-*` | Fon. Các trang chuyển sang `components/doctor/views/*`. Bản restyle `7578683` và phần màn hình của `681935a` bị thay |
| `app/(app)/layout.tsx`, `navigation.ts`, `navigation.test.ts` | Fon: nav bác sĩ hai nhóm (Hằng ngày / Hồ sơ y tế), badge từ bảng phân loại, `hiddenNav` ẩn Bệnh án khi tính năng tắt |
| `app-shell.tsx` | Khung của chủ dự án (giữ `print:`) cộng prop `hiddenNav` của Fon |
| `en.ts`, `vi.ts` | Khoá nav của cả hai bên |

Test bỏ, vì code chúng kiểm đã không còn: `doctor/status-cards.test.ts` (hàm tone của bản restyle), `doctor/body3d/materials.test.ts` (Fon đổi vật liệu thân 3D ở theme sáng), `doctor/examinations/t059-partial-read.test.ts`. Baseline `hardcoded-english` được làm mới, vì màn bác sĩ của Fon viết cứng tiếng Việt.

Claude sửa sau khi gộp, chỉ trong `doctor.css`: 4 màn tràn ngang ở 390 px.
- `.yt-page` có cột `minmax(0, 1fr)`.
- `.yt-segs` cuộn ngang bên trong.
- Bảng nằm thẳng trên trang không còn lấn lề.

Việc còn mở, báo Fon:
- **T-059:** đã đưa lại vào `components/doctor/views/examinations-view.tsx` cùng ngày: phiếu khám đọc riêng từng võ sĩ, một võ sĩ lỗi chỉ để trống phần đó và báo; tất cả lỗi thì hiện khung lỗi có nút Tải lại; danh sách võ sĩ lỗi thì ẩn bộ lọc. 6 test của T-059 chạy trên view mới.
- Màn bác sĩ viết cứng tiếng Việt và đặt `lang="vi"`, nên không dịch theo ngôn ngữ người dùng.

## Rà soát API mode và hiệu năng (10/11)

Kết quả trên bản production (`next build` + `next start`, API mode, Supabase của team):

| Kiểm | Kết quả |
| --- | --- |
| `ui:smoke` 4 vai, 1440 và 390 px (mới có chế độ API: `--coach-email` …, mật khẩu hỏi trên terminal) | 182 trang, 0 lỗi (5xx, console, màn lỗi, tràn ngang). Tải trang trung vị 1,5 giây, chậm nhất màn tổng quan HLV 5,4 giây |
| UAT API đủ kịch bản, võ sĩ Kenji | 17/17, 0 lỗi console/trang/HTTP |
| Lint, typecheck, test frontend | Sạch, 1366 test qua |

Hiệu năng:
- Đo bằng `API_TIMING_LOG=1` (mới, in từng lời gọi backend kèm thời gian).
- `next dev` chậm hơn production nhiều: mỗi lời gọi 1–2 giây, so với khoảng 100 ms. Run-sheet đổi sang chạy bản production.
- `authenticatedApiRequest` nay chỉ gọi một lần cho mỗi GET giống nhau trong cùng một lần render (`cache` của React). Trước đó trận của từng võ sĩ bị đọc hai lần, bộ luật đọc nhiều lần.
- Còn chậm, phải sửa ở backend (báo Ken/Dan):
  - Màn tổng quan HLV đọc riêng từng võ sĩ, khoảng 40 request, vì `/training-sessions` và `/bouts` bắt buộc `fighterId` và mỗi lần chỉ nhận một `status`.
  - Pool database chỉ có `max: 10` (`nestjs-api/src/database/database.module.ts`).
  - Cách sửa: thêm endpoint đọc theo cả đội, hoặc nhận nhiều trạng thái trong một lần gọi, hoặc tăng pool.

Màn bác sĩ dịch theo ngôn ngữ người dùng:
- 1.945 khoá mới trong `doctor-*.{en,vi}.ts`. Chữ viết cứng trong khu bác sĩ giảm từ 913 xuống 60 (baseline).
- Còn lại: khoảng 76 câu kiểm lỗi SCAT6 (zod) vẫn là tiếng Việt khi chọn tiếng Anh. 10 component y tế cũ vốn đã viết cứng tiếng Anh.
- Sửa kèm: `clearance-validity` in tiếng Việt khi chọn tiếng Anh, và `describeDaysUntil` tiếng Anh in "sau 5 ngày".

Dữ liệu Supabase, bổ sung qua API bằng script seed (không chạy SQL). Script và nhật ký nằm ngoài repo, trên máy chủ dự án:
- **Đã tạo:**
  - Phiếu khám ban đầu và giấy phép tập cho Minh, Aigerim, Kenji; Lucas thêm giấy phép tập.
  - Chấn thương cũ đã khỏi cho Minh và Aigerim.
  - Giáo án cho Minh và Aigerim, mỗi giáo án 4 bài tập.
  - 8 buổi tập trong tuần này và tuần sau cho mỗi người. Kenji bị đình chỉ KO chặn mọi buổi.
  - 8 lần cân cho mỗi người.
  - Trận của Aigerim 26/12 với Daria Volkova, đã vào trại, có kế hoạch ăn.
- **Đã dọn:** 3 giáo án nháp UAT của Kenji, buổi tập treo ngày 9/11, trận rác "asdasdasfasdasf" của Minh.
- **Không dọn được qua API:**
  - Các trận UAT đã COMPLETED và đình chỉ KO của Kenji. Đình chỉ loại CLB không kết thúc sớm được; muốn xoá phải dùng SQL hoặc sửa backend.
  - Lượt UAT ngày 10/11 (`UAT API-1011-prod`) cũng tạo thêm một trận như vậy cho Kenji.
- **Không làm:** tạo 8 võ sĩ và 2 HLV chỉ có trong demo mode. Việc này là tạo tài khoản thật trên database chung, cần chủ dự án quyết.
