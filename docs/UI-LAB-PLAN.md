# Kế hoạch UI sinh động: T-042 (3D cơ thể) và T-043 (diễn lại hiệp, UI sinh động)

> Viết 29/10 theo yêu cầu của Hoàng Anh (lead frontend): làm bản thử trước, không qua ticket. Bản thử nằm ở trang `/lab` trong app. Hướng nào được chọn thì làm tiếp theo kế hoạch này.

## 1. Bài toán

Thầy hỏi "khác gì Excel". Landing đã đẹp, nhưng bên trong app phần lớn là bảng và thẻ chữ. Mục tiêu là để **dữ liệu nghiệp vụ hiện lên thành hình**, ở đúng 3 chỗ trong kịch bản demo, thay vì rải hiệu ứng khắp nơi.

Nguyên tắc:

- **Không bịa dữ liệu.** Mọi hình ảnh vẽ từ trường đã có trong `types.ts` và `round-advice.ts`. Dữ liệu hiệp không có vị trí hay đòn trúng, nên replay không dựng cảnh hai võ sĩ di chuyển.
- **Một khoảnh khắc chính mỗi màn.** Phần còn lại chỉ dùng chuyển động để phản hồi thao tác và giải thích trạng thái.
- **Không thêm thư viện.** `three`, `@react-three/fiber`, `gsap` đã có. `OrbitControls` lấy từ `three/examples/jsm`.
- **Có đường lùi.** Khi bật reduced motion hoặc máy không có WebGL thì hiện body map 2D có sẵn (`components/domain/body-map.tsx`).

## 2. Ba khoảnh khắc demo

| # | Màn | Khoảnh khắc | Dữ liệu dùng |
| --- | --- | --- | --- |
| 1 | Sức khoẻ võ sĩ (bác sĩ, võ sĩ) | Model 3D quét từ đầu xuống chân, vùng chấn thương sáng lên theo mức độ | `Injury.bodyRegion`, `status`, `severity` |
| 2 | Xếp buổi tập (HLV) | Chọn "Sparring": vùng chịu tải của buổi trùng vùng bị chặn thì nhấp nháy đỏ, kèm lý do | `TrainingRestriction.blockedRegions`, `loadsRegions` của loại buổi, `clearance-rules.ts` |
| 3 | Báo cáo sau trận (T-041) | Bấm Play: diễn lại R1→R3, chiến thuật lật thẻ hiệu quả/không, sự kiện an toàn, lời dặn hiện ra từng chữ | `RoundRecord[]`, `RoundAdvice` |

## 3. Các bản thử ở `/lab`

| Phần | Bản A | Bản B |
| --- | --- | --- |
| Cơ thể 3D | **Hologram**: nền sân đấu tối, viền phát sáng, vạch quét giống landing | **Lâm sàng**: hình nhân đất sét trên nền sáng, vùng tô màu đặc, nhãn chỉ dẫn |
| Diễn lại hiệp | **Dải thời gian góc đài**: ba cột hiệp, đầu phát chạy ngang, đồng hồ nghỉ 60 s, lời dặn | **Cơ thể qua từng hiệp**: mỗi hiệp một hình nhân nhỏ, dấu choáng/chảy máu/mệt hiện trên người |
| Camp và chỉ số | Dòng thời gian camp theo tuần, có dải đình chỉ và đếm ngược tới ngày đấu | (một bản) |

Toàn bộ code thử nằm trong `src/app/(app)/lab/` và `src/components/lab/`. Không sửa file có sẵn nào, nên xoá thư mục này là bỏ được bản thử.

## 4. Kế hoạch sau khi chọn hướng

### T-042: cơ thể 3D (30/10–3/11)

1. Tách `components/lab/body3d/` thành `components/domain/body-3d/`. Props giữ đúng `BodyMapHighlight[]` của body map 2D để thay vào 7 chỗ đang dùng mà không phải sửa dữ liệu.
2. Thêm `BodyMapAuto`: dùng 3D trên màn rộng khi có WebGL, dùng 2D khi reduced motion, khi in, hoặc khi canvas lỗi.
3. Gắn vào: `doctor/fighters/[fighterId]`, `fighter/health`, `doctor/injuries/[injuryId]` (camera bay tới vùng chấn thương).
4. Gắn vào `clearance-check-panel.tsx` cho khoảnh khắc 2.
5. Viết test cho phần ánh xạ vùng → mesh và tone (logic thuần, chạy được với vitest).
6. Đo: mỗi trang tối đa một `<Canvas>`, `frameloop="demand"` khi đứng yên, tải bằng `next/dynamic` với `ssr: false`.

### T-043: diễn lại hiệp và UI sinh động (3/11–8/11)

1. Đưa replay vào màn báo cáo sau trận của Fon (T-041) và màn hiệp `coach/bouts/[boutId]/rounds`.
2. Nếu muốn có "vùng bị đánh trúng": T-037B (Fon) thêm thao tác chạm vào vùng trên hình khi ghi hiệp, T-037A (Dan) lưu thêm trường `hitRegions: BodyRegion[]`. Cần chốt với hai bạn **trước 31/10**, nếu không thì replay chỉ dùng dữ liệu hiện có.
3. Áp dụng dần: số liệu đếm lên ở stat card, biểu đồ vẽ dần khi cuộn tới, dòng thời gian camp thay bảng lịch trên dashboard HLV.
4. Ngày 9/11 tổng duyệt: kiểm tra reduced motion, điện thoại 375 px, giao diện sáng và tối.

## 5. Rủi ro

| Rủi ro | Cách xử lý |
| --- | --- |
| Máy chiếu ở phòng review yếu, 3D giật | Đã có chế độ nhẹ (29/10, `lib/graphics-tier.ts`): máy yếu tự vào `lite` (dpr 1, không bloom, không MSAA, cuộn thường, không blur). Ép tay bằng `?graphics=lite` trên máy trình chiếu, trình duyệt sẽ nhớ |
| Thầy hỏi dữ liệu replay lấy từ đâu | Mỗi sự kiện trên replay ghi rõ "HLV ghi lúc …", không có hoạt hoạ nào ngoài dữ liệu |
| Hình nhân dựng bằng khối trông "đồ chơi" | Bản A dùng shader viền sáng giống landing, bản B dùng vật liệu đất sét mịn; chọn sau khi xem |

## 6. Đợt 2 (29/10–9/11): đưa vào màn thật

> Chốt 29/10 với Hoàng Anh. Đã có: trang `/lab`, chân dung 3D trên thẻ võ sĩ (`components/fighter-3d/`), skill `mma-3d` và các skill animation của Emil Kowalski trong `.claude/skills/`. Quy ước kỹ thuật nằm trong skill `mma-3d`.

| # | Việc | Ngày | Phụ thuộc | Xong khi |
| --- | --- | --- | --- | --- |
| B0 | Tách nhánh `feat/T-042-043-ui-3d` từ `fight-camp`: chuyển `components/lab/`, `components/fighter-3d/`, `app/(app)/lab/`, `components/domain/fighter-card.tsx`, file này, và chế độ nhẹ (`lib/graphics-tier*`, `components/layout/graphics-tier-mark.tsx`, các file sửa trong `components/landing/`, `app/layout.tsx`, phần `lite` trong `globals.css`). Phần T-032 (`bout-analysis.ts`, `bouts.api.ts`…) ở lại nhánh cũ | 30/10 | Hoàng Anh duyệt commit | Hai nhánh tách bạch, lint và typecheck sạch trên nhánh mới |
| B1 | **Trang nhân vật**: phần đầu hồ sơ võ sĩ (`FighterProfileHeader`, dùng ở hồ sơ HLV và bác sĩ) thành sân khấu có hình 3D lớn xoay được, cùng dáng với thẻ. Chiều cao, sải tay (`reachCm`), cân nặng so với giới hạn hạng cân vẽ thẳng lên hình | 30/10–1/11 | B0 | Mở hồ sơ bất kỳ võ sĩ nào thấy hình đúng giới tính và thế đứng; số đo khớp hồ sơ; có bản 2D khi không có WebGL |
| B2 | **T-042 vào màn thật**: chuyển `lab/body3d` sang `components/fighter-3d/body/`, thêm `BodyMapAuto` nhận đúng props của `BodyMap`. Thay ở 4 màn tổng quan: `doctor/fighters/[id]`, `fighter/health`, `doctor/injuries/[id]`, `fighter/health/injuries/[id]` (camera bay tới vùng chấn thương) và `injury-overview`. Hai form nhập chấn thương giữ 2D | 1/11–4/11 | B0; chọn bản A/B | 5 màn hiện 3D, vùng đúng với dữ liệu; reduced motion và máy không WebGL quay về 2D |
| B2b | Thay hình nhân bằng file `.glb` khi nhận được: hiệu chỉnh lại 21 vùng, dùng chung cho thẻ, hồ sơ và body map | khi có file | file model | Thẻ, hồ sơ, body map cùng một model; vùng bấm trúng đúng chỗ |
| B3 | **Chuyển động toàn app**: chạy skill `improve-animations` và `find-animation-opportunities` để có danh sách, rồi làm các mục đầu: phản hồi khi lưu, danh sách hiện dần, số đếm lên trên stat card, biểu đồ vẽ dần, chuyển cảnh avatar và tên từ danh sách sang hồ sơ | 4/11–6/11 | — | Có báo cáo audit trong `docs/`; các mục ưu tiên cao đã làm; không mục nào vi phạm reduced motion |
| B4 | **Diễn lại hiệp vào màn thật**: chọn bản A/B, đưa vào màn hiệp `coach/bouts/[id]/rounds` và màn báo cáo sau trận của Fon (T-041). Nếu T-037 có lưu `hitRegions` thì hiện vùng bị trúng trên cơ thể | 5/11–8/11 | Chốt với Dan và Fon **trước 31/10**; T-041 | Replay chạy bằng dữ liệu trận thật ở API mode |
| B5 | **Thử trên máy trình chiếu và backend thật** (cùng T-040): đo khung hình, bật `dpr` thấp hoặc tắt 3D nếu giật, chạy lại kịch bản demo | 8/11–9/11 | T-040 | Tổng duyệt 9/11 không giật, không có màn lỗi |

**Cần Hoàng Anh quyết:** bản A (Hologram) hay B (Lâm sàng) cho body map (trước B2), bản A hay B cho replay (trước B4), commit ở B0.
