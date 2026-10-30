# Plan chỉnh sửa: model 3D trên thẻ võ sĩ và tách bạch tiếng Anh, tiếng Việt

> Viết ngày 30/10 theo yêu cầu của Hoàng Anh. Số liệu đo trên nhánh `feat/T-042-043-ui-3d` ở demo mode. Script Playwright mở mọi trang trong menu của bốn vai trò, cộng một cấp trang chi tiết, tổng 163 trang mỗi ngôn ngữ.

## 1. Thẻ võ sĩ chưa hiện model

**Nguyên nhân.** `PortraitStudio` (`components/fighter-3d/portrait-studio.ts`) vẫn vẽ hình nhân thủ thế dựng bằng code (`createFigureGeometry`), chưa đọc file `.glb`. Lúc trước chọn vậy để thẻ giữ dáng thủ thế; không phải lỗi hiển thị.

**Cách sửa (P1).**
1. Studio nạp `fighter-body.glb` một lần cho cả trang (dùng chung `muscularModelFrom` với body map) và giữ một geometry duy nhất. Vóc dáng từng võ sĩ thể hiện bằng `scale` (chiều cao, độ đậm người), không dựng geometry mới cho mỗi người.
2. Võ sĩ nam vẽ model thật. Võ sĩ nữ vẽ hình nhân tư thế chữ A trong `body/mannequin.ts`, để cả danh sách cùng một tư thế. Đổi lại thì thẻ không còn thể hiện thế đứng, nhưng thế đứng vẫn ghi bằng chữ trên thẻ.
3. Màu dùng token `figure-*` như body map; vòng sàn theo màu tình trạng sức khoẻ giữ nguyên.
4. Trong lúc file tải lần đầu, thẻ để trống như hiện nay. Lần sau trình duyệt lấy từ cache.

**Xong khi.** Ảnh chụp `/coach/fighters` ở theme sáng và tối thấy model thật trên thẻ võ sĩ nam. Rê chuột vẫn xoay được. Chế độ `lite` vẫn mượt (đo lại như lần trước). Test `figure-params` và `body-models` vẫn qua.

## 2. Tiếng Anh lẫn trong giao diện tiếng Việt

### Số liệu

| Khu vực | Viết cứng trong code | Dữ liệu demo | Câu ghép từ mẫu (AI, số liệu) | Nhãn enum `labels.ts` | Tổng |
| --- | --- | --- | --- | --- | --- |
| Võ sĩ | 94 | 42 | 36 | 7 | 179 |
| HLV | 154 | 113 | 137 | 14 | 421 |
| Bác sĩ | 285 | 119 | 182 | 21 | 615 |
| Admin | 287 | 90 | 221 | 6 | 604 |

Chế độ tiếng Anh gần như sạch: 84 dòng tiếng Việt, phần lớn là tên người (giữ nguyên), còn lại vài tên luật thi đấu trong dữ liệu ("Boxing nghiệp dư – AIBA (tham khảo)", "Tự nhập").

Ví dụ: tiêu đề "FIGHTER PROFILE", "No bout scheduled", "Body & fight profile" (code); badge "Healthy", "Monitoring", "Restricted" và tên hạng cân (`labels.ts`); tên buổi tập "Heavy bag — power & volume rounds" và nhận xét của HLV (`lib/mocks/training.ts`); câu giải thích của AI "The model detected 107 strikes…" (ghép trong code, có số); trang video, bác sĩ và admin gần như còn nguyên tiếng Anh.

### Nguyên tắc

- **Chọn tiếng Việt thì toàn bộ chữ của app là tiếng Việt**, trừ danh sách cho phép: tên người, tên giải đấu, đơn vị đo, và (tuỳ quyết định ở mục 4) thuật ngữ môn thi đấu.
- **Chọn tiếng Anh thì toàn bộ là tiếng Anh**, trừ tên người và dữ liệu người dùng tự nhập.
- **Dữ liệu demo** mô phỏng điều người dùng nhập, nên không đi qua bản dịch. Vì buổi demo dùng tiếng Việt, viết lại dữ liệu demo bằng tiếng Việt, giống cách T-032 B2 đã làm cho dữ liệu trận.

### Các đợt

| Đợt | Phạm vi | Ai làm | Trước khi |
| --- | --- | --- | --- |
| L0 | Chốt bảng thuật ngữ (mục 4) | Hoàng Anh | Bắt đầu L1 |
| L1 | Màn của HLV và võ sĩ có trong kịch bản demo: chữ viết cứng trong code, `labels.ts` (badge sức khoẻ, cấp phép, hạng cân, thế đứng, môn), header hồ sơ, thẻ võ sĩ, Today. **Không đụng** các file T-032 đang sửa (thanh bên, chi tiết trận, ghi hiệp, đình chỉ, form buổi tập, `bouts.demo.ts`, `lib/mocks/training.ts`, `training-templates.ts`) | Claude, trên nhánh 3D hoặc nhánh mới từ đó | 3/11 |
| L2 | Dữ liệu demo tiếng Việt cho buổi tập, nhận xét HLV, mục tiêu, video và cảnh báo AI (`lib/mocks/*`) | Sau khi T-032 merge (trùng file `training.ts`) | 5/11 |
| L3 | Video và phân tích AI (T-018): câu ghép từ mẫu đổi sang khoá từ điển có tham số | Dev hoặc Gemini theo ticket T-018 | 7/11 |
| L4 | Bác sĩ (T-017, T-023): **Fon** đang làm màn bác sĩ nên làm luôn khi dựng | Fon | Theo Fon |
| L5 | Admin (T-019, T-024), rồi T-025: test chặn chữ Anh mới, `locale` bắt buộc | Sau demo | — |

**Kết quả L0, L1 (30/10, làm xong, cùng nhánh):** bảng thuật ngữ chốt theo đề xuất (`screens.vi.ts`: "Hạng gà", "Thế thuận"…, hồ sơ ghi "Hạng gà (Bantamweight)"). Ở khu HLV và võ sĩ, không tính trang video, số dòng tiếng Anh do code tạo giảm từ **306 xuống 39**; 39 dòng còn lại là đơn vị (min, /min), câu tóm tắt AI của phần video (L3), chữ nằm trong file T-032 ("Fight camp", "for {tên}") và nhãn hạn chế do bác sĩ nhập. Dữ liệu demo tiếng Anh (142 dòng) chờ L2. Chế độ tiếng Anh không đổi (so ảnh chụp chữ trước và sau). Khoá mới nằm trong `screens*.ts` (khoảng 700 khoá).

**Kết quả L2 (30/10, làm xong, cùng nhánh):** dữ liệu demo trong `lib/mocks/` (`training.ts`, `ai.ts`, `ai-generation.ts`, `medical.ts`, `people.ts`, `platform.ts`) viết lại bằng tiếng Việt. Dữ liệu tiếng Anh còn hiện ở khu HLV: 106 → 6 dòng, khu võ sĩ: 40 → 0. Toàn bộ chữ tiếng Anh còn lại ở khu HLV và võ sĩ (không tính trang video) là 36 dòng: tên giải, đơn vị "min" (`format.ts`), và nội dung các file T-032 đang sửa (tên bài tập mẫu, "Fight camp", "for {tên}", ghi chú đình chỉ). `location:` trong `training.ts` giống hệt bản T-032 để merge không xung đột. Giữ tiếng Anh có chủ đích: tên 36 bài tập trong thư viện (`training-templates.ts` tra theo tên), tên người ("Dr. Thu Lê"), tên đòn Jab/Cross/Hook/Teep, `bloodType: "Not recorded"`. Lưu ý cho Fon: nút gợi ý hạn chế ở form cấp phép của bác sĩ (`components/medical/restriction-presets.ts`) so nhãn tiếng Anh, nên với dữ liệu tiếng Việt các nút không còn hiện "đã thêm" khi sửa cấp phép có sẵn; nên dịch nhãn gợi ý trong file đó cho khớp.

Sau mỗi đợt, chạy lại script đo (`lang-audit`) và ghi số còn lại vào bảng trên. **L1 xong khi** các trang của HLV và võ sĩ trong kịch bản đo ra 0 dòng ngoài danh sách cho phép.

## 3. Những việc còn sót (ngoài hai mục trên)

| # | Việc | Vì sao quan trọng | Hạn |
| --- | --- | --- | --- |
| S1 | **Chốt `hitRegions` với Dan và Fon** (T-037: có lưu vùng bị đánh trúng mỗi hiệp không) | Replay chỉ hiện được vùng bị trúng nếu dữ liệu có lưu | 31/10 |
| S2 | **Model 3D cho võ sĩ nữ** (cùng quy cách: `.glb`, tư thế chữ A, khoảng 1,65 m, mặt hướng +Z, giấy phép CC0/CC BY) | Hiện võ sĩ nữ đang dùng hình nhân trung tính | Khi có file |
| S3 | **Commit và push T-032.** Phần T-032 ở thư mục chính vẫn chưa commit; nhánh `fix/T-032-demo-fixes` chưa có trên remote | Mất máy là mất việc; nhánh 3D phải merge sau T-032 | Ngay |
| S4 | **Thứ tự merge:** T-004/T-010B → T-032 → `feat/T-042-043-ui-3d` vào `fight-camp` | Nhánh 3D dựng trên T-032 | Trước 5/11 |
| S5 | **Khoảnh khắc 2 của plan cũ chưa làm:** cơ thể 3D trong ô kiểm tra cấp phép khi xếp buổi tập (vùng chịu tải trùng vùng bị chặn thì nhấp nháy) | Một trong ba khoảnh khắc demo; `clearance-check-panel.tsx` đang bị T-032 sửa nên phải chờ | Sau S3 |
| S6 | **Chạy demo bằng gì:** bản production chặn demo mode, mà dev mode nặng. Hoặc xong T-040 rồi demo bằng bản production nối backend thật, hoặc demo bằng dev mode với `MOCK_LATENCY_MS=0` và `?graphics=lite` | Quyết định ảnh hưởng tới lag lúc trình chiếu | 5/11 |
| S7 | **Trang `/lab`** đang mở cho mọi vai trò, kể cả bản production | Là trang thử nghiệm; nên ẩn khỏi production hoặc chỉ cho chủ dự án | Trước 9/11 |
| S8 | Lỗi nhỏ có sẵn: "{count} phác đồ" chưa thay số (màn chấn thương của võ sĩ); `/admin/exercises` tràn ngang ở 390 px | Lộ ra khi trình chiếu trên điện thoại | L1 |
| S9 | `docs/tickets/README.md` ở thư mục chính ghi T-015, T-016 "chờ merge", trong khi đã merge từ 25/10 | Tài liệu lệch thực tế | Khi rảnh |

## 4. Cần Hoàng Anh quyết

1. **Thuật ngữ môn thi đấu ở giao diện tiếng Việt.** Giữ tiếng Anh như dân võ hay nói (Bantamweight, Southpaw, Orthodox, Sparring) hay dịch hết (Hạng gà, Thuận tay trái, Thuận tay phải, Đấu tập)? Đề xuất: **dịch nhãn, giữ tiếng Anh trong ngoặc ở lần xuất hiện đầu** (ví dụ "Hạng gà (Bantamweight)") trên hồ sơ, còn badge và bảng thì chỉ dùng tiếng Việt.
2. **Thẻ võ sĩ nữ** dùng hình nhân tư thế chữ A (đề xuất, cùng tư thế với cả danh sách) hay giữ hình thủ thế nữ hiện có?
3. **Ai làm L1:** Claude làm thẳng (đề xuất, vì đụng nhiều màn của nhánh 3D) hay viết ticket cho dev?

## 5. Lộ trình UI P0–P3 (31/10, Claude làm theo yêu cầu của Hoàng Anh)

Nhánh `feat/ui-foundation` (P0) và `feat/ui-p1-p3` (P1–P3, tạo từ P0). Thứ tự merge: T-032 → `feat/T-042-043-ui-3d` → `feat/ui-foundation` → `feat/ui-p1-p3`.

| Mức | Việc | Trạng thái |
| --- | --- | --- |
| P0 | `nextjs-frontend/DESIGN.md` ("Fight Night"), test chặn chữ Anh viết cứng mới (`hardcoded-english.test.ts`, đếm theo file, chỉ được giảm), `pnpm ui:smoke` | Xong |
| P1 | Màn lỗi và 404 song ngữ; tab hồ sơ võ sĩ lỗi thì header và tab vẫn còn | Xong |
| P1 | Form hỏi trước khi rời trang có thay đổi chưa lưu (`useActionForm`, tắt bằng `guardUnsaved: false`); chặn gửi trùng và lỗi tại ô đã có sẵn | Xong |
| P1 | Cơ thể 3D trong ô kiểm tra cấp phép khi xếp buổi tập (vùng bị chặn mà buổi tập tác động thì đỏ, nhấp nháy) | Xong |
| P1 | Dòng thời gian camp trên trang chi tiết trận (buổi tập theo ngày, loại, trạng thái; tuần thi đấu; cân; đình chỉ) | Xong |
| P1 | Replay hiện vùng bị đánh trúng | Chờ chốt `hitRegions` (T-037) |
| P1 | Song ngữ: video/AI (L3), admin (L5), tuyển sinh, đăng nhập, phần còn lại | Xong. Chữ Anh viết cứng 1808 → 933, ngoài khu bác sĩ còn 3 chuỗi cố ý giữ |
| P2 | Manifest và icon: cài ra màn hình chính điện thoại | Xong. Chưa có service worker để dùng offline |
| P2 | In / Lưu PDF (shell tự ẩn khi in), Tải CSV (danh sách võ sĩ, cân nặng của trận) | Xong |
| P2 | Ctrl+K tìm nhanh trang và võ sĩ (không dấu vẫn tìm được) | Xong |
| P2 | Kiểm tra WCAG 2.1 AA bằng axe (`ui:smoke --axe`) trên 342 trang | Xong, còn 2 lỗi `<dl>` ở trang chấn thương của bác sĩ |
| P3 | Giải thích thuật ngữ tại chỗ: tuần thi đấu, giảm cân cấp tính, đình chỉ | Xong |
| P3 | Theme tối: `ui:smoke --theme dark` 171 trang ở 390 px | Không lỗi |
| P3 | Model 3D 714 KB, đã nén `KHR_mesh_quantization`; nén thêm (meshopt/Draco) cần thư viện giải nén mới | Giữ nguyên |

**Cho Fon (khu bác sĩ):**
- `doctor/injuries/[injuryId]`: một `<dl>` chứa `<div>` bọc `<div>` bọc `<dt>`/`<dd>` (axe `definition-list`, `dlitem`).
- `components/medical/restriction-presets.ts` so nhãn tiếng Anh.
- 933 chuỗi tiếng Anh viết cứng còn lại hầu hết nằm ở khu bác sĩ (`hardcoded-english.baseline.json`).
- Nhãn `painLabel` ("Worst imaginable") và `ApplicationStatusBadge` có hai bộ chữ tiếng Anh khác nhau, nên các trang chỉ truyền `locale` khi là tiếng Việt.

**Chưa làm:** dùng offline, cập nhật giao diện trước khi server trả lời, tin nhắn lỗi của server action ở `lib/actions/video.ts`, `admin.ts`, `care-team.ts`, `admissions.ts`, `training.ts` vẫn tiếng Anh.
