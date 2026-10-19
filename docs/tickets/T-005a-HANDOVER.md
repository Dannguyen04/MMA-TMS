# T-005a Handover

- Nhánh: `feat/T-004-bout-lifecycle-ui` (tạo từ `feat/T-005a-fighter-weigh-in` tại `a001b21`, theo quyết định của chủ dự án ngày 19/10: làm mọi việc trên một nhánh mới)
- Commit thuộc T-005 (phần A và B) và các sửa: `11c11b5`, `a001b21` (Cursor), `71471f4` (ba file đăng ký), `0cbb3d0` (sửa của Pha 1), cộng các sửa dùng chung trong `d8793fa`, `bc41283`
- Trạng thái: IN REVIEW
- Người viết: Claude (Opus 5.5), chủ dự án cho phép sửa code frontend trong phiên 19/10

## Thay đổi

Cursor làm trên Cursor ngày 16–17/10 (`11c11b5` biểu đồ, `a001b21` màn võ sĩ, thẻ HLV, kế hoạch ăn E1). Phiên này kiểm chứng lại, commit ba file đóng cửa đăng ký, rồi sửa những chỗ lệch quy ước:

- `src/app/(auth)/login/page.tsx`, `login/demo-accounts.tsx`, `register/page.tsx` (`71471f4`, nguyên văn Cursor): bỏ link "Continue with an email code", bỏ tài khoản Quang Hồ, `/register` không còn form. Code admissions cũ để nguyên (khu vực đóng băng).
- `register/page.tsx` (`0cbb3d0`): `metadata.title` từ "Sign in" thành "Joining the academy"; "Lotus Combat" thành "Lotus Combat Academy" cho khớp `(auth)/layout.tsx`.
- `components/domain/weigh-in-form.tsx`: dùng `useActionForm` và `ChoiceGroup` (compact, ba cột, dòng cao tối thiểu 44 px), ô kg `autoFocus`, có hậu tố "kg", giữ "(optional)" của câu hỏi ăn uống.
- `components/domain/nutrition-plan-form.tsx`: dùng `useActionForm`; giờ sửa của từng ô đưa vào hint của `Field`.
- `components/domain/weight-status-badge.tsx` bỏ; `WeightStatusBadge` chuyển vào `components/domain/status-badges.tsx` (nhãn, icon, tone).
- `lib/domain/labels.ts`: thêm `WEIGHT_STATUS_LABELS`, `PLAN_ADHERENCE_LABELS`, `NUTRITION_PHASE_LABELS`; bỏ bản khai trùng ở `weight-chart.ts`, `nutrition.ts`, `weight-chart.tsx`.
- `components/domain/weight-chart.tsx`: bọc trong `ChartFigure`, có "Show data table" gồm ngày, cân, tham chiếu và câu trả lời ăn uống bằng chữ, để chấm màu không phải nơi duy nhất mang thông tin.
- `app/(app)/fighter/bout/page.tsx`, `coach/bouts/[boutId]/page.tsx`, `fighter/dashboard/page.tsx`: dùng `PageProps<"/route">`; `Fact` tự viết thay bằng `DescriptionList`.
- `fighter/dashboard/page.tsx`: thẻ cân trên Today chỉ hiện khi có trận đang chạy (T-005 phần A mục 6). Võ sĩ không có trận vẫn ghi cân qua Bout › "Log weight".
- `lib/domain/nutrition.test.ts`: thêm test cho `savedWeightMessage`.
- Sửa dùng chung về sau (`d8793fa`): đường tham chiếu không đi lên trên số cân đầu camp (xem "Lệch so với ticket"); thẻ Weight ghi "No weights logged in this camp yet." thay cho biểu đồ trống; thẻ "Medical file" của võ sĩ hiện trạng thái thật và hạn hiệu lực từng mục (phần này thuộc T-004, ghi ở handover T-004).

## Kiểm chứng việc Cursor đã làm

| Điểm nghi ngờ trong brief | Kết luận | Đã làm |
| --- | --- | --- |
| Trang tự khai `params` / `searchParams` thay vì `PageProps` | Đúng là lệch | Sửa ở ba trang |
| Form dùng `useActionState` và radio thô | Đúng là lệch | Đưa về `useActionForm`, `ChoiceGroup` |
| Ô kg chưa tự focus | Đúng | Thêm `autoFocus` |
| `Fact` chép ở hai trang | Đúng | Dùng `DescriptionList` |
| `ADHERENCE_LABEL` khai hai lần | Đúng (và nhãn trạng thái cân cũng nằm ngoài `labels.ts`) | Gom vào `labels.ts` |
| `line-chart.tsx` thêm `pointColors` | Chỉ đổi hành vi khi `pointColors` có giá trị; `check-in-charts.tsx` và các trang performance không truyền prop này | Giữ. Chưa mở lại trang performance trên trình duyệt (đã đóng băng, không có trong menu) |
| `back` của trang HLV về Today | Đúng | Back về `/coach/bouts` (T-004) |
| `register/page.tsx` sai title, tên học viện | Đúng | Sửa; grep `routes.register` chỉ còn trong `proxy.ts` (trang công khai), "Quang" chỉ còn trong mocks và test admissions (đóng băng, giữ) |
| `recordSelfWeight` ghi `weightKg` lên hồ sơ demo | Cố ý theo context | Giữ |
| `savedWeightMessage` một chữ số thập phân, action gửi `toFixed(1)` | Khớp, nhưng **chưa có test** như brief nói | Thêm test (`nutrition.test.ts`, "saved weight notice") |

Thêm một điểm không có trong brief: thẻ cân trên Today hiện cả khi võ sĩ không có trận, trái T-005 phần A mục 6. Đã sửa.

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (T-005) | Đáp ứng ở đâu |
| --- | --- |
| 1. Võ sĩ của trận đỏ: menu có "Bout", `/fighter/bout` đúng giải, hạng, badge đỏ | `navigation.ts` (Bout sau Today), `fighter/bout/page.tsx`. Với seed mới (phương án a), Minh chưa có trận cho tới khi HLV tạo; trên trình duyệt ngày 19/10: Minh sau khi ghi 66,5 thấy "Lotus Fight Night 18", "60 kg", badge Red (ảnh `05c-saved-red-390.jpg`). Trận đỏ có sẵn trong seed là của Kenji (`bouts.demo.test.ts`, "seeds a red, a yellow and a grey bout") |
| 2. Ghi 66,5 → lưu 66,5, về `/fighter/bout`, badge tính lại | `weight-input.ts` `parseSelfWeight`; `actions/bouts.ts` `recordWeightAction`; trình duyệt: URL `?saved=66.5&status=RED`, "Saved 66.5 kg. Status: Red" |
| 3. Ghi hai lần một ngày → một điểm, là 66,1 | `bouts.demo.ts` `recordMeasurement`; test "keeps one weight per academy day…"; trình duyệt: "Saved 66.1 kg", "66.1 kg · 9.2% remaining" |
| 4. Nhập 0, 250, chữ → lỗi tại ô, không gửi | `weight-input.test.ts`; lỗi trả về theo trường `weightKg` |
| 5. Không có trận → `EmptyState`, vẫn ghi được cân | `fighter/bout/page.tsx`; trình duyệt (fetch HTML, tài khoản Lucas): "No upcoming bout", "You can still log today's weight" |
| 6. 390 px, không cuộn ngang, ≤ 30 giây | Trình duyệt 390 px (ảnh `05a`, `05b`, `05c`): không thấy tràn ngang ở Today, trang ghi cân và trang Bout; luồng: Today → "Log today's weight" → gõ số (ô đã focus) → Save. Không bấm giờ bằng đồng hồ; với ô tự focus và ba lựa chọn một chạm, luồng là ba thao tác |
| 7. API mode gửi đúng `POST /fighters/{profileId}/measurements` `SELF_REPORTED` | `people.test.ts` "posts a self-reported weight…" |
| 8. `weight-chart.test.ts` | Có sẵn từ Cursor, qua |
| 9. Biểu đồ có đường cân, tham chiếu, giới hạn; di chuột, phím mũi tên | `weight-chart.tsx` trên `LineChart` (có điều khiển bàn phím); thêm bảng dữ liệu. Trình duyệt: ảnh `04-camp-linked-1440.jpg`, `07a-checklist-1440.jpg` |
| 10. Dashboard HLV: "Weight alerts" đỏ trước vàng, xám | Trình duyệt: Minh đỏ, Kenji đỏ, Aigerim vàng, Emma xám (ảnh `01-coach-today-1440.jpg` chụp trước khi Minh ghi cân); test "seeds a red, a yellow and a grey bout" |
| 11. Handover ghi đã/chưa đối chiếu backend thật | Chưa đối chiếu: T-003 chưa có trên nhánh, migration 024 chưa áp |

| Tiêu chí E1 (Luồng nghiệp vụ §8) | Đáp ứng ở đâu |
| --- | --- |
| Bỏ qua câu hỏi vẫn lưu cân | `readPlanAnswer` ("treats a blank answer as a skip"); trình duyệt: lần ghi 66.1 không chọn đáp án vẫn lưu |
| Trả lời hai lần một ngày → chỉ còn câu mới | `bouts.demo.test.ts` "replaces yesterday's plan answer…" |
| Trận ở `FIGHT_WEEK` → võ sĩ thấy kế hoạch "Fight week" | `nutritionPhaseFor`; test "blocks fight week while Brain CT is missing, then lets the bout in…" kiểm `nutritionPhaseFor(bout.phase) === "fightWeek"` |
| Không màn nào hiện calo, nước, xông hơi | `nutrition.test.ts` "does not turn a red camp into a calorie…"; không có trường nào như vậy |
| Ghi cân kèm câu trả lời trong khoảng 30 giây | Như tiêu chí 6 |

## Lệnh đã chạy

Chạy trên working tree sạch tại `d92a246`, ngày 19/10/2026.

`pnpm --filter nextjs-frontend lint`

```text
$ eslint
```

`APP_DATA_MODE=api pnpm --filter nextjs-frontend typecheck` (`.env.local` đang demo, xem BASELINE và context)

```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

`pnpm --filter nextjs-frontend test`

```text
 Test Files  80 passed | 1 skipped (81)
      Tests  724 passed | 1 skipped (725)
```

Số test trước phiên: 626 passed, 1 skipped (75 file). Baseline 13/10: 578. Không thêm test bị skip.

## Lệch so với ticket

- Thẻ "Medical file" của võ sĩ đổi từ "Ready / Not ready" sang badge trạng thái thật và hạn hiệu lực (yêu cầu của brief cho T-004).
- Đường tham chiếu (`buildWeightTrack`) không vượt số cân đầu camp. Công thức ở Tech spec §5 cho đường đi **lên** khi cân đầu camp thấp hơn mốc `limit / (1 − L/100)` (ví dụ Linh 59,6 kg, giới hạn 60 kg, ngưỡng 5%: đường vọt lên 63,2 kg rồi mới xuống). Trên màn hình trông như khuyên tăng cân. Đây là thay đổi chỉ ở frontend; backend T-003 làm theo spec sẽ khác. Xem câu hỏi bên dưới.
- Câu trả lời ăn uống ở API mode gọi `PUT /bouts/:id/nutrition-checkins/:date` theo Tech spec §4 (Cursor gọi `POST /nutrition-checkins` kèm `academyDate` trong body).

## Câu hỏi / việc còn mở

- Chủ dự án hoặc người làm T-003 chốt đường tham chiếu khi võ sĩ bắt đầu dưới mốc: giữ công thức gốc, hay chặn ở số cân đầu camp như frontend đang làm.
- Chưa đối chiếu adapter với backend thật (T-003 chưa merge).
- Chưa mở lại các trang performance để nhìn `LineChart` sau thay đổi `pointColors`; code chỉ đổi khi prop được truyền.
