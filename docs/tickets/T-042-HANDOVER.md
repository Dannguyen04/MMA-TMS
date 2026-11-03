# T-042, T-043 Handover

- Nhánh: `feat/T-042-043-ui-3d`    Commit: `15e4243` (code); handover ở commit kế tiếp
- Người làm: Hoàng Anh, cùng Claude trên máy Hoàng Anh
- Trạng thái: IN REVIEW (sửa theo [T-042-REVIEW.md](./T-042-REVIEW.md) ngày 30/10)

## Phạm vi đã làm (để chủ dự án duyệt sau)

T-042 và T-043 chưa có file ticket. Phạm vi lấy từ [nhận xét 27/10, mục 5](../REVIEW-27-10-FEEDBACK.md#5-uiux) và ba plan trên nhánh: `docs/UI-LAB-PLAN.md`, `docs/UI-MOTION-AUDIT.md`, `docs/PLAN-POLISH-3D-I18N.md`.

| Ý của mục 5 | Đã làm | Chưa làm |
| --- | --- | --- |
| Model 3D cơ thể: vùng chấn thương, vùng bị hạn chế | Model cơ thể quét sẵn (CC BY 4.0) cho võ sĩ nam, hình nhân cho võ sĩ nữ và chưa rõ giới tính. Body map 3D trên `fighter/health` và trang chấn thương. Hình võ sĩ trên hồ sơ HLV (chiều cao, sải tay, cân nặng so với giới hạn hạng cân, vùng bị chặn) và trên thẻ võ sĩ | Vùng bị đánh trúng: chờ chốt `hitRegions` (T-037) |
| Diễn lại hiệp, chiến thuật | Khối "Diễn lại trận" trên màn ghi hiệp, chỉ dùng dữ liệu đã ghi (tự chấm, đánh dấu chiến thuật, knockdown, choáng/chảy máu/mệt, lời dặn giữa hiệp) | Vị trí và đòn trúng: dữ liệu không lưu nên không diễn |
| Giao diện sinh động hơn | Hiệu ứng nhấn nút, mở dialog, drawer, toast. Chế độ đồ hoạ `lite` cho máy yếu (tự nhận, ép bằng `?graphics=lite`) | Dòng thời gian fight camp mới ở `/lab` |
| (thêm) Tách tiếng Anh, tiếng Việt | Màn HLV và võ sĩ: chữ trong code, bảng thuật ngữ (`Hạng gà (Bantamweight)`…), dữ liệu demo tiếng Việt | Video và AI (L3), admin (L5); bác sĩ do Fon làm |

Nhánh đã gộp `fix/T-032-demo-fixes` (`aa4556e`), nên diff so với `fight-camp` có cả phần T-032.

## Thay đổi

- `public/models/fighter-body.glb`, `ATTRIBUTION.md`: model cơ thể, nguồn và giấy phép. Tên tác giả hiện dưới mỗi khung 3D (`ModelCredit`).
- `src/components/fighter-3d/body/*`: module body map dùng chung (`regions.ts` 21 vùng, `muscular-model.ts` đo lại tâm và bán kính vùng trên model, `mannequin.ts`, `body-material.ts`, `body-rig.ts`, `body-scene.tsx`, `body-stage.tsx`, `body-map-auto.tsx` tự lùi về `BodyMap` 2D khi không có WebGL hoặc khi in). Nền luôn trong suốt.
- `src/components/fighter-3d/fighter-figure.tsx`, `portrait-studio.ts`, `fighter-portrait.tsx`: hình trên hồ sơ và thẻ. Thẻ dùng **một** renderer WebGL chung vẽ vào canvas 2D của từng thẻ.
- `src/components/replay/*`: dựng dữ liệu diễn lại (`replay-data.ts`, có test) và khối diễn lại.
- `src/lib/graphics-tier.ts`, `globals.css` (biến thể `lite:`, token `--figure-*`, hiệu ứng vào của dialog, drawer, toast), `ui/button.tsx`, `ui/dialog.tsx`, `ui/toast.tsx`, `ui/table.tsx`.
- `src/app/(app)/lab/*`: trang thử nghiệm, `notFound()` ở production.
- i18n: `figure3d.*`, `screens*.ts` (khoảng 700 khoá), hàm nhãn có `locale` trong `lib/domain/labels.ts`, dữ liệu demo tiếng Việt trong `lib/mocks/*`.
- **Sửa theo review (`15e4243`):**
  - N1, `components/dashboard/fighter-profile-header.tsx`: khi có hình, ở dưới `sm` khối tên, trạng thái và nút hành động đứng trước, hình xuống cuối. `fighter-figure.tsx`: hình cao 240 px thay vì 300 px trên điện thoại.
  - N2, `components/domain/fighter-card.tsx`: ảnh trên thẻ cao 160 px thay vì 208 px dưới `sm`.
  - G1, `coach/bouts/[boutId]/rounds/page.tsx`, `rounds-view.tsx`: nút "Thẻ góc đài" chuyển vào `actions` của `PageHeader`, bỏ hàng riêng gây khoảng trống.

## Đối chiếu với review

| Mục review | Xử lý | Bằng chứng |
| --- | --- | --- |
| H1: thiếu handover | File này | — |
| N1: hình đẩy thông tin xuống | Đã sửa | 390×844, `/coach/fighters/f-aigerim-sadykova`: `h1` ở y = 140 (trước khoảng 520), nút "Lên lịch buổi tập" ở y = 349, hình ở y = 401. Cả `full` và `lite`, không cuộn ngang |
| N2: 8 canvas WebGL trên `/coach/fighters` | Giữ cách vẽ, giảm chiều cao ảnh trên điện thoại. 8 canvas là canvas **2D**, không phải WebGL: một renderer WebGL chung (`portrait-studio.ts:80`) vẽ rồi chép vào từng thẻ, chỉ vẽ khi thẻ sắp vào màn hình, trong lúc rảnh | Đo ở 390 px, CPU chậm 4 lần, dev mode: `getContext("2d")` thành công ở cả 8 canvas, 0 canvas WebGL trong DOM. Thời gian long task: `/coach/fighters` 2125 ms (`lite`), 1919 ms (`full`); trang không có hình `/coach/bouts` 1197 / 1359 ms. Phần chênh khoảng 0,6–0,9 s gồm tải model và 8 lần vẽ. Chưa đo trên điện thoại thật |
| G1: khoảng trống trên màn ghi hiệp | Đã sửa | Ảnh 1440 px: nút nằm cùng hàng tiêu đề |
| G2: gộp vào `fight-camp` | Làm ở T-040 phần A | — |
| Chưa kiểm: body map trên trang chấn thương | Đã kiểm | `/fighter/health/injuries/inj-minh-shin` (Minh Trần có chấn thương đã khỏi, nên `fighter/health` không vẽ body map): 1440 và 390 px, `full` và `lite` đều 1 canvas, camera dồn vào cẳng chân phải, không lỗi, không cuộn ngang. Tắt WebGL: 0 canvas, hiện `BodyMap` 2D |

## Lệnh đã chạy

Trên `15e4243` (commit handover chỉ thêm file này):

```text
$ pnpm --filter nextjs-frontend lint
$ eslint

$ APP_DATA_MODE=api pnpm --filter nextjs-frontend typecheck
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully

$ pnpm --filter nextjs-frontend test
 Test Files  107 passed | 1 skipped (108)
      Tests  962 passed | 2 skipped (964)

$ APP_DATA_MODE=api pnpm --filter nextjs-frontend build
✓ Compiled successfully in 11.8s
build exit 0
```

So với review (958 test): thêm 4 test đến từ T-032 khi gộp. Không thêm lỗi so với baseline.

Kiểm bằng mắt (Playwright, demo mode, `vi`): 173 trang của 4 vai trò ở 1440 và 390 px trên `d62aeae`, 0 lỗi console, 0 lỗi 5xx, 0 trang cuộn ngang. Sau `15e4243` kiểm lại các trang trong bảng trên.

## Lệch so với ticket

Không có ticket. Các điểm có chủ đích:
- Thẻ võ sĩ không dùng một canvas WebGL mỗi thẻ (trình duyệt giới hạn khoảng 16 context), mà một renderer chung.
- Võ sĩ nữ dùng hình nhân cho tới khi có model nữ.
- Tên 36 bài tập trong thư viện giữ tiếng Anh vì `training-templates.ts` tra bài tập theo tên.

## Câu hỏi / việc còn mở

- `hitRegions` (T-037): có lưu vùng bị đánh trúng mỗi hiệp không. Có thì body map và replay hiện được vùng bị trúng.
- Fon: `components/medical/restriction-presets.ts` so nhãn tiếng Anh, nên với dữ liệu demo tiếng Việt các nút gợi ý không hiện "đã thêm" khi sửa cấp phép có sẵn.
- N2 chưa đo trên điện thoại thật. Nếu chậm, có thể render sẵn ảnh tĩnh cho thẻ.
