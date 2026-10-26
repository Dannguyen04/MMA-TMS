# T-032 · Sửa lỗi thấy khi chạy kịch bản demo 27/10 và Việt hoá các màn hình trong kịch bản

| | |
| --- | --- |
| **Trạng thái** | READY (26/10, tối) |
| **Phần** | Frontend (`nextjs-frontend`). Phần A: 3 lỗi giao diện (bắt buộc, làm trước). Phần B: Việt hoá chữ còn tiếng Anh trên các màn hình trong kịch bản |
| **Người nhận** | Team (dev hoặc Gemini). Claude review |
| **Hạn** | Trước buổi demo sáng 27/10 |
| **Nhánh** | Tạo `fix/T-032-demo-fixes` từ `sync/T-004-fight-camp`; review xong thì merge lại vào `sync/T-004-fight-camp` (nhánh demo). Không đụng `main` |
| **Tài liệu dẫn chiếu** | Kịch bản demo `docs/DEMO-REVIEW-27-10.md` (có trên nhánh `fight-camp`), [T-007](./T-007-suspensions-and-readiness.md), [T-010B](./T-010B-corner-card-rounds-ui.md) |
| **Migration** | Không |

## Bối cảnh

Tối 26/10 Hoàng Anh chạy đủ kịch bản demo của Dan (bước 1.1 đến 5.6) trên `sync/T-004-fight-camp`, chế độ demo (`APP_DATA_MODE=demo`). Các kết quả chính ra đúng kịch bản, nhưng còn 3 chỗ giao diện tự mâu thuẫn hoặc gây hiểu nhầm (phần A), và nhiều chữ tiếng Anh lẫn trong giao diện tiếng Việt (phần B). Giao diện mặc định là tiếng Việt (`DEFAULT_LOCALE = "vi"` trong `src/lib/i18n/config.ts`); tiếng Anh vẫn chọn được trong menu tài khoản, nên mọi khoá i18n mới phải có cả `vi` và `en`.

Mọi đường dẫn bên dưới tính từ `nextjs-frontend/`. Số dòng đúng tại commit `2d119f8`.

## Phần A. Lỗi giao diện (bắt buộc)

### A1. Ô "Kiểm tra cấp phép" báo "Không có xung đột" khi võ sĩ đang bị đình chỉ (kịch bản bước 5.5)

**Hiện tượng.** Ở `/coach/sessions/new`, chọn Linh Phạm (vừa bị đình chỉ vì KO) và loại "Đấu tập": ô bên phải hiện xanh "Không có xung đột với cấp phép y tế của Linh Phạm." Chỉ khi bấm "Lên lịch buổi tập" mới hiện đỏ "Linh Phạm đang bị đình chỉ: buổi đấu tập bị chặn đến hết ngày 25 thg 11, 2026." Trên màn hình cùng lúc có hai thông báo trái nhau.

**Nguyên nhân.** Kiểm tra trực tiếp trong form gọi `previewSessionConflicts` (`src/lib/actions/training.ts`, dòng 631–650). Hàm này chỉ gọi `training.loadSessionClearanceConflicts`, tức chỉ xét cấp phép y tế. Đình chỉ (Cổng 2) chỉ được xét khi lưu, trong `suspensionGate` (`src/lib/services/training.demo.ts`, dòng 671–690).

**Thiết kế.**
- `src/lib/domain/clearance-rules.ts`: thêm `"suspended"` vào `ClearanceConflictCode` (dòng 55–62). Thêm nhánh `case "suspended"` trong `clearanceConflictMessage` (dòng 151), trả câu `training.gate2.suspended` với `name`, `type` (nhãn loại buổi viết thường, như `suspensionGate` đang làm) và `until`. `until` là `training.gate2.through` kèm ngày `endsOn` nếu ngày buổi tập chưa qua `endsOn`; ngược lại là `training.gate2.untilCleared`. Ba khoá này đã có ở cả `training.vi.ts` và `training.en.ts` (dòng 906–908). Thêm vào `ClearanceConflict` các trường cần để dựng câu (ví dụ `fighterName`, `endsOn`), hoặc dựng sẵn câu và để ở `message`. Chọn một cách, ghi vào handover.
- `src/lib/actions/training.ts`, trong `previewSessionConflicts`: sau khi có `conflicts`, lấy `listSuspensions([fighterId])` (`src/lib/services/bouts.ts`, dòng 142; chạy được ở cả chế độ demo và API). Lọc bằng `blockingSuspensions(list, fighterId, type, ngày buổi tập)` (`src/lib/domain/suspension-rules.ts`, dòng 113). Nếu có kết quả thì thêm **một** conflict `{ code: "suspended", severity: "block", type, ... }` lên **đầu** mảng. Ngày buổi tập là `dayKey` của `scheduledAt` mà hàm đang tính.
- Không đổi `suspensionGate`. Khi lưu, đình chỉ vẫn bị chặn như cũ.
- `ClearanceCheckPanel` (`src/components/training/clearance-check-panel.tsx`) không cần sửa: conflict mức `block` tự hiện trong nhóm đỏ, và form tự khoá nút lưu bằng `training.sessionForm.blockedResolve` (`session-form.tsx`, dòng 167–172).

**Nghiệm thu.**
- Đình chỉ Linh (bước 5.1 đến 5.3 của kịch bản), mở `/coach/sessions/new`, chọn Linh và "Đấu tập". Trong khoảng 1 giây, ô "Kiểm tra cấp phép" hiện khung đỏ với câu "Linh Phạm đang bị đình chỉ: buổi đấu tập bị chặn đến hết ngày 25 thg 11, 2026.", không còn dòng xanh "Không có xung đột".
- Cùng võ sĩ đó, chọn "Hồi phục và giãn cơ" (không bị chặn): ô báo "Không có xung đột".
- Võ sĩ không bị đình chỉ (Marcus Hale, loại "Đấu tập"): ô báo "Không có xung đột".
- Test mới: một ca cho `clearanceConflictMessage` với `code: "suspended"` (vi và en), và một ca cho `previewSessionConflicts` trả conflict `suspended` khi có đình chỉ chặn đúng loại buổi.

### A2. Khung "Sẵn sàng nhận trận mới" mâu thuẫn với dòng mô tả (bước 5.4)

**Hiện tượng.** Ở `/coach/bouts/suspensions`, khung bên phải có mô tả "Không có trận nào từ giai đoạn chuẩn bị thi đấu trở đi, và không bị đình chỉ." nhưng lại liệt kê mọi võ sĩ, kể cả người "Đang đình chỉ" và "Đang chuẩn bị thi đấu".

**Nguyên nhân.** `src/app/(app)/coach/bouts/suspensions/page.tsx` (dòng 75–104) cố ý hiện trạng thái của từng võ sĩ. Chỉ phần chữ sai.

**Thiết kế.** Giữ nguyên danh sách và code. Chỉ đổi chữ của hai khoá:

| Khoá | `vi` (`coach-bouts.vi.ts`, dòng 81–82) | `en` (`coach-bouts.en.ts`, dòng 82–83) |
| --- | --- | --- |
| `coachBouts.suspensions.readyTitle` | Khả năng nhận trận mới | Who can take a new bout |
| `coachBouts.suspensions.readyDescription` | Võ sĩ có nhãn "Sẵn sàng" nhận được trận mới. Những người còn lại đang có trận hoặc bị đình chỉ. | Fighters marked Ready can take a new bout. The others have a bout in progress or a suspension. |

Chữ có thể chỉnh lại, miễn mô tả khớp với những gì danh sách hiện ra.

**Nghiệm thu.** Đọc khung trên màn hình, không còn câu nói "chỉ gồm người sẵn sàng" mà danh sách lại có người đang đình chỉ.

### A3. Nút vẫn ghi "Lưu hiệp N" sau khi hiệp đã lưu (bước 4.2)

**Hiện tượng.** Ở `/coach/bouts/<id>/rounds`, sau khi lưu hiệp 1, thẻ Hiệp 1 đã có nhãn "Đã lưu" nhưng nút vẫn ghi "Lưu hiệp 1". Bấm lần nữa thì ghi đè, nên người xem không biết là lưu mới hay sửa.

**Nguyên nhân.** `src/app/(app)/coach/bouts/[boutId]/rounds/rounds-view.tsx`, dòng 502–509, luôn dùng `boutAnalysis.rounds.saveRound`. Component đã nhận prop `existing` (truyền ở dòng 185–193), có giá trị khi hiệp đã lưu.

**Thiết kế.**
- Khi `existing` khác `null` thì nút dùng khoá mới `boutAnalysis.rounds.updateRound`.
- Thêm khoá vào `src/lib/i18n/messages/bout-analysis.vi.ts` ("Cập nhật hiệp {roundNo}") và `bout-analysis.en.ts` ("Update round {roundNo}"), đặt cạnh `saveRound`.

**Nghiệm thu.** Hiệp chưa lưu thì nút ghi "Lưu hiệp N". Lưu xong thì ngay sau khi trang làm mới, nút đổi thành "Cập nhật hiệp N". Nhãn lúc đang lưu vẫn là "Đang lưu…".

## Phần B. Việt hoá các màn hình trong kịch bản

**Phạm vi:** thanh bên của HLV, chi tiết trận, ghi hiệp, trang đình chỉ, form lên lịch buổi tập. Đây là các màn hình xuất hiện trong kịch bản demo.

### B1. Nhãn đọc màn hình của số đếm ở thanh bên

`BADGE_LABELS` trong `src/components/layout/navigation.ts` (dòng 25–30) là chữ tiếng Anh cứng ("unread", "awaiting review", "new", "failed"). Phần tử này có `sr-only` nhưng vẫn lọt vào tên của link, nên đọc thành "Phòng video 3 awaiting review" (thấy được khi kiểm tra cây accessibility).

- Đổi `BADGE_LABELS` thành bảng khoá i18n (ví dụ `Record<NavBadgeKey, MessageKey>`, khoá `shell.badge.notifications` …). Thêm khoá vào `src/lib/i18n/messages/vi.ts` và `en.ts` (nơi đang có `shell.mainNav`), ví dụ "chưa đọc", "chờ duyệt", "mới", "lỗi".
- Sửa hai nơi dùng: `src/components/layout/sidebar-nav.tsx` (dòng 42, trong component đã có `t`) và `src/components/layout/mobile-nav.tsx` (dòng 120).

**Nghiệm thu:** ở giao diện tiếng Việt, tên link thanh bên là "Phòng video 3 chờ duyệt".

### B2. Dữ liệu mẫu chế độ demo

Đây là nội dung HLV tự nhập nên không đi qua bản dịch (`createDemoCopy` cố ý để nguyên chữ người dùng nhập). Phải viết lại thẳng bằng tiếng Việt trong dữ liệu mẫu.

`src/lib/services/bouts.demo.ts`:
- Kế hoạch ăn của trận Linh (dòng 335–337): `camp`, `fightWeek`, `postWeighIn`.
- Ghi chú đình chỉ của Diego (dòng 503): "Knocked out in sparring. Graded return to play with the sports doctor."
- Tên hồ sơ y tế "Health certificate", "Blood test", "Brain CT" trong các `requirements` (dòng 265, 290, 310, 333, 362). Ví dụ "Giấy khám sức khoẻ", "Xét nghiệm máu", "Chụp CT não". Mã hồ sơ được sinh từ tên (`requirementCode`, `src/lib/domain/bout-rules.ts` dòng 328), nên kiểm tra không có chỗ nào tra theo mã cũ như `HEALTH_CERTIFICATE`.
- Rà thêm các chuỗi tiếng Anh khác trong file này có hiện trên các màn hình trong phạm vi (tên giáo án, ghi chú trận…), sửa luôn và liệt kê trong handover.

Địa điểm buổi tập:
- `DEFAULT_LOCATION` trong `src/components/training/session-form.tsx` (dòng 89–98).
- Mọi `location:` trong `src/lib/mocks/training.ts` (dòng 869–1379). Danh sách gợi ý địa điểm của form được lấy từ các buổi đã có (`src/app/(app)/coach/sessions/new/page.tsx`, dòng 82), nên hai nơi phải dùng **cùng** tên.
- Bộ tên đề xuất: "Phòng đánh đứng" (Striking room), "Lồng đấu" (Cage), "Thảm chính" (Main mat), "Khu thể lực" (S&C floor), "Phòng hồi phục" (Recovery room).

Ghi chú gợi ý theo loại buổi tập: `notes` trong `SESSION_PRESETS`, `src/lib/domain/training-templates.ts` (dòng 284–292). Ví dụ "Đồ bảo hộ đủ bộ: mũ, bảo vệ răng, bảo vệ ống quyển, găng đấu tập."

Thư viện bài tập (cùng file `training-templates.ts`, khoảng 36 bài, tên lẫn mô tả): **chỉ làm nếu còn thời gian** sau tất cả mục trên. Nếu làm thì làm hết, không để nửa Anh nửa Việt.

### B3. Test

Cập nhật các test đang so khớp chữ cũ:
- `src/lib/services/bouts.demo.test.ts` (dòng 170–171, 218).
- `src/lib/actions/training.test.ts` (dòng 112).
- `src/lib/domain/coach-todo.test.ts` (dòng 97).
- `src/lib/domain/bout-rules.test.ts` (dòng 130, 149, 293).

Riêng các test của `requirementCode` và `gate1` chỉ dùng tên làm dữ liệu đầu vào, có thể giữ chữ tiếng Anh. Không bắt buộc đổi.

## Ngoài phạm vi

- Màn hình của bác sĩ, admin, võ sĩ.
- Dữ liệu seed của backend (`nestjs-api`) và Supabase. Không chạy migration, không chạy SQL.
- Logic đề xuất đình chỉ, Cổng 1, Cổng 2 khi lưu.
- Ô "Cấp phép y tế" ở form buổi tập vẫn báo "Được tập đầy đủ". Đây là cấp phép của bác sĩ, khác với đình chỉ, nên giữ nguyên.

## Lệnh kiểm tra bắt buộc

Chạy trong `nextjs-frontend` (pnpm chỉ chạy qua corepack):

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
```

`src/lib/i18n/translate.test.ts` có ca "define the same keys in both languages, none empty", nên mọi khoá mới phải có ở cả `vi` và `en`.

Kiểm tay ở chế độ demo:

```powershell
$env:APP_DATA_MODE='demo'; corepack pnpm dev
```

Đăng nhập Rafael Costa, chạy lại kịch bản `docs/DEMO-REVIEW-27-10.md` từ bước 1.1 đến 5.6. Ghi vào handover:
- Ảnh chụp hoặc mô tả cho A1, A2, A3 sau khi sửa.
- Danh sách chữ đã Việt hoá ở phần B.
- Xác nhận không còn chữ tiếng Anh trên các màn hình trong phạm vi.

Sau khi kiểm tay xong phải **khởi động lại dev server** để dữ liệu demo sạch cho buổi demo.

## Ghi chú cho Dan (sửa kịch bản trên `fight-camp`, không phải code)

- Bước 5.2: khi chọn "KO", form hiện thêm câu bắt buộc "Có mất ý thức không?". Ghi rõ chọn "Không" để giữ đề xuất 30 ngày. Nên tích ô "Bị đánh ngã trong trận" để kết quả "Thua · KO" không đi kèm "Bị đánh ngã: Không".
- Bước 5.3: bấm "Xác nhận đình chỉ" chỉ mở hộp thoại; phải bấm thêm "Lưu đình chỉ". Sau đó hiện thông báo "Đã lưu đình chỉ" (khoá `boutMsg.action.suspensionSaved`) và nhãn "Đang đình chỉ".
- Bước 1.3: nếu B2 đổi tên "Brain CT" thì sửa câu chờ đợi "Brain CT · Bắt buộc · Còn thiếu" theo tên mới.
