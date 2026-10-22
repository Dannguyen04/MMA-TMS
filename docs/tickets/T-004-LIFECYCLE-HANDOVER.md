# T-004 Handover

- Nhánh: `feat/T-004-bout-lifecycle-ui` (từ `feat/T-005a-fighter-weigh-in`, không push)
- Commit: `0715f04` (màn HLV, demo store, T-006/T-007 ở demo mode), `d8793fa` (sửa sau khi chạy trình duyệt), `bc41283` (sửa theo code review), `d92a246` (adapter API mode), `3ce182a` (thanh điều hướng và khối thông tin trên điện thoại)
- Trạng thái: IN REVIEW
- Người viết: Claude (Opus 5.5). Chủ dự án cho phép sửa code frontend trong phiên 19/10 và chọn: phạm vi gồm cả "Trong trận" (T-006) và "Sau trận" (T-007) ở demo mode; một nhánh mới cho mọi việc; seed phương án (a); adapter API làm ở P2.
- Cập nhật 22/10: merge `origin/main` (`d40165f`), merge `origin/fight-camp` (`2aeb90b`), dịch màn Trận sang tiếng Việt (commit ngay sau `2aeb90b`). Xem mục [Cập nhật 22/10](#cập-nhật-2210-merge-và-dịch-màn-trận).

## Cập nhật 22/10: merge và dịch màn Trận

File này trước tên là `T-004-HANDOVER.md`. Khi merge `fight-camp`, tên đó thuộc về handover T-004 của Gemini (đã APPROVED và merge), nên handover của nhánh này đổi sang `T-004-LIFECYCLE-HANDOVER.md`.

**Merge `origin/fight-camp` (`2aeb90b`, theo chủ dự án 22/10: "Phần Trận giữ bản của nhánh này, phần còn lại lấy fight-camp, giữ quy tắc T-001").** Có 47 file conflict.

- **Phần Trận giữ bản của nhánh này:**
  - Giữ: màn HLV, trang Trận và màn ghi cân của võ sĩ, domain, store demo, action, biểu đồ cân, badge Trận.
  - Bỏ 11 file chỉ phục vụ bản T-004/T-005 song song trên `fight-camp`: `bout-checklist-card`, `bout-weight-card`, `weight-alerts-card`, `fighter/bout/weigh-in/weigh-in-form`, `bout-weight-cell`, `weight-summary`, `actions/bout-schemas`, `actions/weigh-in`, `domain/weigh-in` (cả test), `mocks/bouts`.
  - Bỏ phần Trận mà `fight-camp` thêm vào `labels.ts`, `types.ts`, `people.ts` (cả test) và `mocks/db.ts`.
  - Mock của Minh giữ "Lotus Fight Night 18", vì seed và test của nhánh dựa vào đó.
- **Phần còn lại lấy bản dịch của `fight-camp`, giữ thay đổi đã merge từ `main`:**
  - Các màn: đăng nhập, đăng ký, đặt lại mật khẩu, form mã email, `Field`, form giáo án, danh sách bài tập của giáo án, trang giáo án, hàng đợi HLV, Today của HLV và võ sĩ, FightHero, action y tế.
  - Các chuỗi `main` mới thêm (journey, phân tích AI trên FightHero, nhóm "Needs a plan", ngữ cảnh đặt mật khẩu) có key mới ở cả hai ngôn ngữ.
- **T-001:**
  - Trang đăng nhập không có link ứng viên, không có tài khoản demo ứng viên; `/register` báo võ sĩ do học viện thêm vào.
  - Hàng đợi HLV không có nhóm ứng viên.
  - Menu admin giữ các hub của T-001; hub "Bouts" giữ tab "Upcoming" và "Suspensions".
- **Màn ứng viên** (`apply/page.tsx`, `application-form`, `application-progress`) giữ bản tiếng Anh của `main`: tuyển võ sĩ đang đóng và `main` đã viết lại luồng này. Dịch để cho T-024.
- **Tài liệu:**
  - `SCOPE-FIGHT-CAMP.md` giữ quyết định 20, 21 của `fight-camp`; dòng góp ý review 2 thành quyết định **22**.
  - `T-004-HANDOVER.md` là bản của `fight-camp`.

**Dịch màn Trận.** Mặc định tiếng Việt, tiếng Anh vẫn chọn được. Giá trị tiếng Anh giữ đúng chữ cũ, nên giao diện tiếng Anh không đổi.

- **Từ điển mới** (`lib/i18n/messages/`):
  - `bout-labels.*`: nhãn enum của phần Trận, `boutLabel.*`.
  - `bout-messages.*`: thông báo của domain và action, 104 key `boutMsg.*`.
  - `bout-detail.*`: trang chi tiết trận, 174 key.
  - `bout-fighter.*`: trang võ sĩ và các thẻ cân, 62 key.
  - `coach-bouts.*`: viết lại, 109 key. Bản cũ là của T-004 Gemini, không còn file nào dùng.
- **Domain:** các hàm trả chữ (`gateSummary`, `describeRule`, `weighInCountdown`, `savedWeightMessage`, `adherenceAlertLine`, `validateBoutSchedule`, `validateNewRequirement`, `validateRequirementUpdate`, `validateOutcome`, `validateSuspension`, `readClearanceNote`, `readPlanAnswer`, `readPlanText`, `readPlanAuthor`, `readDueDays`, `parseKg`, …) nhận thêm tham số cuối `t`, mặc định tiếng Anh. Store demo, adapter và test cũ không phải sửa.
- **Action:** mỗi action trong `lib/actions/bouts.ts` lấy `getTranslator()`; `actions/bouts.test.ts` mock translator như `medical-contract.test.ts`.
- **Badge:** badge Trận (`WeightStatusBadge`, `BoutPhaseBadge`, `RequirementStateBadge`, `Gate1Badge`, `SuspensionStateBadge`) nhận `locale` như các badge khác.
- **Component dùng chung:** `ChartFigure` (nút bảng số liệu, "No data") và `LineChart` (hướng dẫn phím, tooltip) dịch bằng `useT()`. `FormFooter` thêm prop tuỳ chọn `cancelLabel`.

**Còn tiếng Anh:**
- Thông báo lỗi của store demo (`bouts.demo.ts`) và của `services/bouts.ts` không có mã ổn định, ví dụ "This fighter already has a bout in …" hay "Clearance opens after …". Chỉ hiện ở các ca lỗi.
- Chữ hiển thị nhưng nằm ngoài màn Trận: thẻ journey "Getting fight-ready" (`FighterJourney`, từ `main`), nhãn màn chờ chung "Loading page", `bar-chart` và `radar-chart`, nhãn hạng cân (`WEIGHT_CLASS_LABELS`, ví dụ "Featherweight").
- Dữ liệu do người nhập: tên giải, đối thủ, địa điểm, tên hồ sơ, ghi chú.

## Thay đổi

Domain, hàm thuần có test:

- `lib/domain/bout.ts`: `CampBout` thêm các trường của T-003 §2–3 (`coachId`, `rulesetId`, `rulesetName`, `rulesetVerified`, `sport`, `venue`, `weightClassCode`, `weightClassLabel`, `requirementsDueDays`, `fightWeekDays`, `trainingPlanId`, `createdOn`, `notes`, `cancelReason`, `history`), cộng `weighIn`, `outcome` (T-006) và `checklistUnlock` (F5). Bỏ enum `weightClass` cũ. Thêm `CompetitionRuleset`, `BoutRequirement` đủ trường, `Suspension`.
- `lib/domain/bout-rules.ts`: `gate1`, `gateSummary`, `readyForBout`, `requirementsDueOn`, `requirementsOverdue`, `requirementsDueSoon` (F4, 14 ngày), `fightWeekOpensOn`, `canEnterFightWeek`, `acuteLossLimitPct`, `scheduleSummary`, `campStartedOn`, `canTransition`, `canEditSchedule`, `canCancel`, `checklistLocked`, `validateBoutSchedule`, `readWeightClass`, `readDueDays`, `requirementCode`, `validateNewRequirement`, `validateRequirementUpdate`, `suggestedValidUntil`, `requirementsFromTemplates`, `madeWeight`, `canRecordResult`, `validateOutcome`, `methodsFor`.
- `lib/domain/suspension-rules.ts` (T-007): `suggestSuspension` (quy tắc dài nhất khớp, đếm KO trước đó), `suspensionReasonFor` (H3, H6), `suspensionState`, `isSuspensionActive`, `blockingSuspensions` (Cổng 2), `canClearSuspension`, `validateSuspension` (đổi số ngày gợi ý phải có lý do), `readClearanceNote`.
- `lib/domain/weight-input.ts`: `parseKg` dùng chung cho cân sáng, cân chính thức, giới hạn tự nhập; `kgLabel`.
- `lib/domain/labels.ts`: nhãn giai đoạn trận, môn, trạng thái hồ sơ, lý do Cổng 1, lý do huỷ, kiểm tra nước, kết quả, cách thắng, mất ý thức, lý do và trạng thái đình chỉ.
- `lib/domain/bouts-contract.ts`: schema Zod và mapper cho response T-003, body request.
- `lib/mocks/rulesets.ts`: ba preset đúng tên seed backend.

Dữ liệu và service:

- `lib/services/bouts.demo.ts`: store viết lại, giữ trên `globalThis`, seed theo `TODAY_KEY` (cùng mốc với các mock khác). Hàm cho mọi thao tác của T-004, T-006, T-007.
- `lib/services/bouts.ts`: lớp service cho trang và action; demo gọi `bouts.demo.ts`, API gọi `bouts.api.ts`.
- `lib/services/bouts.api.ts`: adapter mỏng theo T-003 §2.
- `lib/services/training.demo.ts`: Cổng 2 khi tạo, sửa, bắt đầu buổi tập.
- `lib/mocks/training.ts`: thêm ba plan `fight_camp` cho trận seed (`tp-kenji-fight-camp`, `tp-emma-nordic-camp`, `tp-linh-fight-camp`), đặt cuối danh sách để buổi tập cũ giữ plan cũ.

Action và trang:

- `lib/actions/bouts.ts`: `createBoutAction`, `updateBoutAction`, `linkCampAction`, `enterFightWeekAction`, `cancelBoutAction`, `addRequirementAction`, `updateRequirementAction`, `removeRequirementAction`, `unlockChecklistAction`, `recordWeighInAction`, `recordResultAction`, `createSuspensionAction`, `clearSuspensionAction`. Mỗi action kiểm `requireRole("coach")` và `canAccessFighter`.
- `lib/routes.ts`: `coach.bouts`, `coach.newBout`, `coach.suspensions`. `navigation.ts`: hub "Bouts" sau "Today", tab "Upcoming" và "Suspensions".
- `app/(app)/coach/bouts/page.tsx`: danh sách trận đang chạy, xếp theo giờ cân; bảng ở `md+`, thẻ xếp chồng ở điện thoại; "Recently finished".
- `app/(app)/coach/bouts/new/`: form tạo trận, kiểm tra ở trình duyệt bằng chính `validateBoutSchedule` trước khi gửi, xem trước số ngày tới cân, khoảng cân – thi, ngưỡng 8%/5%.
- `app/(app)/coach/bouts/[boutId]/`: thông tin trận, hành động theo giai đoạn (gắn camp, vào tuần thi đấu, cân chính thức, kết quả), sửa (F8), huỷ, Cổng 1, checklist (thêm, sửa, bỏ, khoá tuần thi đấu và mở khoá có lý do), kế hoạch ăn, kết quả, đình chỉ, lịch sử.
- `app/(app)/coach/bouts/suspensions/`: danh sách đình chỉ, đình chỉ thủ công, "Clear to train", danh sách "Ready for a new bout" (H7).
- `app/(app)/coach/dashboard/page.tsx`: "All bouts" trên "Weight alerts"; thẻ "Documents due" (F4).
- `app/(app)/fighter/bout/page.tsx`: thẻ "Medical file" có trạng thái thật, hạn hiệu lực, một dòng tóm tắt Cổng 1.

## Seed demo (phương án a)

Ngày D là ngày server khởi động. Roster của Rafael.

| Võ sĩ | Trận | Trạng thái lúc seed | Dùng để |
| --- | --- | --- | --- |
| Minh Trần | Không có | Cân từ D−28 đến D−4 (70,0 → 67,2 kg) | Tạo trận trên sân khấu; xám, ghi 66,5 thành đỏ |
| Kenji Morita | Pacific Invitational 4, VMMAF 56 kg, cân D+3 | `CAMP`, đỏ (62,8 kg, 10,8%), đủ hồ sơ, vào được tuần thi đấu | Tiêu chí 1: trận đỏ, trận đủ điều kiện |
| Aigerim Sadykova | Asian Combat Series 9, AIBA 51 kg, cân và thi cùng ngày D+27 (10 giờ, ngưỡng 5%) | `CAMP`, vàng; mục "Blood test" tuỳ chọn còn thiếu nhưng Cổng 1 vẫn đạt | Thứ tự cảnh báo; mục tuỳ chọn không chặn |
| Emma Lindqvist | Nordic Open 12, Tự nhập 57 kg, cân D+5 | `CAMP`, xám, thiếu "Brain CT", quá hạn nộp | Tiêu chí 1 và 4: Cổng 1 chặn |
| Linh Phạm | Saigon Amateur Night 5, AIBA 60 kg, cân 07:00 và thi 18:00 hôm nay | `FIGHT_WEEK`, xanh | T-006: cân chính thức, kết quả |
| Diego Alvarez | Không có | Đình chỉ thủ công KO trong sparring, D−6 đến D+24, chặn sparring và grappling | T-007: Cổng 2 |

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (T-004) | Đáp ứng ở đâu |
| --- | --- |
| 1. Demo mode, HLV thấy "Bouts", danh sách đủ trận seed với đúng badge cân và Cổng 1 | `navigation.ts`, `coach/bouts/page.tsx`; test "seeds a red, a yellow and a grey bout…", "covers T-004 criterion 1…"; trình duyệt 1440 px (ảnh `02-bouts-list-1440.jpg`): Linh Green/Ready, Kenji Red/Ready, Emma Grey/"1 missing · overdue", Aigerim Yellow/Ready |
| 2. Preset "MMA – VMMAF 2021" 60 kg → trận vào danh sách; "Tự nhập" 63,5 → lưu 63,5 | Trình duyệt: tạo "Lotus Fight Night 18" cho Minh, 60 kg (ảnh `03b`); 63,5: test `bout-rules.test.ts` "stores a custom limit of 63,5 kg as 63.5" và `actions/bouts.test.ts` "creates a scheduled bout and opens it" (`limitKg: 63.5`, nhãn "63.5 kg"); trình duyệt 20/10 ở 390 px: Tariq, "Tự nhập", gõ `63,5` → trang chi tiết "63.5 kg" (ảnh `03-new-bout-custom-preview-390.jpg`) |
| 3. Cân sau thi → lỗi tại trường, không gửi | `prepare` trong `new/bout-form.tsx` chạy `validateBoutSchedule` ở trình duyệt; trình duyệt: "The bout must start after the weigh-in." dưới ô Bout (ảnh `03a`); test action "refuses a bout that starts before its weigh-in…" |
| 4. Thiếu hồ sơ → "Enter fight week" liệt kê mục thiếu, trạng thái không đổi; đủ `PROVIDED` có hạn sau ngày thi → vào tuần thi đấu | Trình duyệt trên trận Minh: "Gate 1 is not met. The bout stays in camp. · Brain CT: missing" (ảnh `07b`); hạn trước ngày thi → "Brain CT: expires before the bout"; hạn hợp lệ → `FIGHT_WEEK`, history có dòng "Camp → Fight week" (ảnh `08`). Test demo store và test action |
| 5. Trận của võ sĩ ngoài roster → 404 | `coach/bouts/[boutId]/page.tsx` gọi `notFound()` khi `!canAccessFighter`; test action "answers a bout outside the roster as not found"; trình duyệt: id giả trả trang 404 "We couldn't find that" (đọc qua HTML, xem "Kiểm tra trình duyệt") |
| 6. `bout-rules.test.ts` có ví dụ T-003 tiêu chí 1, 2, 4 | `bout-rules.test.ts` mục "weight warning (T-003 criterion 1…)", "acute-loss limit snapshot (T-003 criterion 2)", "Gate 1 (T-003 criterion 4…)", cộng tiêu chí 3 và 5 |
| 7. 390 px không cuộn ngang | Trình duyệt 20/10 ở 390 px: Today HLV, `/coach/bouts`, New bout, chi tiết trận (Emma, Tariq), dialog sửa hồ sơ, Suspensions; `scrollWidth` = 390 và không phần tử nào trong `main` vượt mép (trừ dải lọc hàng đợi trên Today, vốn cuộn ngang trong khung riêng). Sửa trong lần này: thanh điều hướng dưới có sáu mục bị gãy hai hàng, nay một hàng (`mobile-nav.tsx`); khối thông tin trận hai cột. Ảnh `*-390.jpg` |
| 8. Handover liệt kê trường adapter và nguồn | Bảng "Adapter API" dưới đây |

### T-006, T-007 ở demo mode (ngoài T-004, theo chủ dự án ngày 19/10)

Chưa có ticket viết sẵn; làm theo Luồng nghiệp vụ F5, F6, F7, H2–H7 và Tech spec §2.5, §6.

| Hành vi | Ở đâu | Kiểm |
| --- | --- | --- |
| Cân chính thức: đạt → `WEIGHED_IN`; trượt → catchweight (giới hạn mới ≥ số cân, có ghi chú) hoặc huỷ "Missed weight"; số cân lưu làm cân của ngày | `recordDemoWeighIn`, `WeighInButton` | Test demo store; trình duyệt: Linh 60,6 kg, catchweight 61, ghi chú (ảnh `10`) |
| Kết quả chỉ ghi từ ngày thi; hỏi mất ý thức khi thua KO/TKO, hỏi đòn vào đầu khi thua TKO; khóa siết chỉ MMA | `canRecordResult`, `validateOutcome`, `ResultButton` | Test; trình duyệt: thua KO hiệp 2, mất ý thức dưới 1 phút (ảnh `11`) |
| Gợi ý đình chỉ theo `suspensionRules` (AIBA 30/90/365, LOC 90/180), đếm KO trước đó kể cả trong sparring; sửa số ngày phải ghi lý do | `suggestSuspension`, `createSuspensionAction` (tính lại ở server) | `suspension-rules.test.ts`; test action; trình duyệt: gợi ý 90 ngày (ảnh `12`) |
| Cổng 2: còn đình chỉ thì không xếp hoặc bắt đầu loại buổi bị chặn; hết hạn mà chưa xác nhận vẫn chặn | `suspensionGate` trong `training.demo.ts` | Test; trình duyệt: xếp sparring cho Linh → "Linh Phạm is suspended: sparring is blocked through 17 Jan 2027." |
| Xác nhận được tập lại chỉ sau ngày cuối, ghi căn cứ | `clearDemoSuspension`, `ClearSuspensionButton` | Test. Chưa bấm trên trình duyệt (seed không có đình chỉ đã hết hạn) |
| Huỷ ở mọi giai đoạn trước kết quả, không tạo đình chỉ (H4) | `cancelDemoBout` | Test; trình duyệt: huỷ trận Aigerim (ảnh `09`) |
| Sẵn sàng nhận trận mới (H7) | `suspensions/page.tsx` | Trình duyệt |

## Adapter API

Viết theo T-003 §2 và Tech spec §2.2–2.4, §4. **Chưa đối chiếu với backend thật**: T-003 chưa có trên nhánh, migration 024 chưa áp. Trước khi có backend, mọi gọi trả 403/404; trang đọc ra danh sách rỗng, action báo "Bouts are not available from the server yet."

| Hàm | Endpoint | Trường gửi / đọc | Nguồn |
| --- | --- | --- | --- |
| `listApiRulesets` | `GET /competition-rulesets` | `id, name, sport, organizer, verified, sourceNote, weightClasses[code,label,limitKg], requirementTemplates[code,label,required,validityDays], fightWeekDays, requirementsDueDays, acuteWindowDays, acuteLossLimitPctLong, acuteLossLimitPctShort, defaultBlockedSessionTypes, restDaysAfterBout` | T-003 §1–2, Tech spec §2.2 |
| `listApiBouts` | `GET /bouts?fighterId=…` (cursor) | `id, fighterId, coachId, rulesetId, eventName, venue, opponentName, weightClassCode, weightLimitKg, catchweightKg, acuteLossLimitPct, requirementsDueDays, weighInAt, boutAt, status, trainingPlanId, cancelReason, notes, createdAt, history[], requirements[]` | T-003 §2, Tech spec §2.3 |
| `getApiBout` | `GET /bouts/:id` | Như trên; `campStartedOn` nếu backend gửi, không thì lấy ngày tạo | T-003 §2–3 |
| `createApiBout` | `POST /bouts` | `fighterId, rulesetId, eventName, venue, opponentName, weightClassCode` hoặc `weightLimitKg` (Tự nhập), `weighInAt, boutAt` | T-003 §2 "Tạo trận" |
| `updateApiBout` | `PATCH /bouts/:id` | `eventName, venue, opponentName, notes, weightClassCode`/`weightLimitKg, weighInAt, boutAt, requirementsDueDays` | T-003 §2, F8 |
| `linkApiCamp` | `POST /bouts/:id/camp` | `trainingPlanId` | T-003 §2 |
| `enterApiFightWeek` | `POST /bouts/:id/fight-week` | 409 trả message của service | T-003 §2 |
| `cancelApiBout` | `POST /bouts/:id/cancel` | `reason` (mã lý do, kèm ghi chú nếu có) | T-003 §2 |
| `addApiRequirement` | `POST /bouts/:id/requirements` | `code, label, required, validityDays` | T-003 §2 |
| `updateApiRequirement` | `PATCH /bouts/:id/requirements/:code` | `status, issuedOn, validUntil, statusReason` | T-003 §2 |
| `removeApiRequirement` | `DELETE /bouts/:id/requirements/:code` | — | T-003 §2 |
| `getWeightTrack` (Cursor) | `GET /bouts/:id/weight-track` | `limitKg, points, latestKg, latestOn, remainingPct, status, referencePath` | T-003 §3 |
| `recordNutritionCheckin` | `PUT /bouts/:id/nutrition-checkins/:date` | `adherence, note` | Tech spec §4 |
| `saveNutritionPlan` (Cursor) | `PUT /bouts/:id/nutrition-plan` | ba ô và `authorName` | Tech spec §4 |

Chưa đối chiếu được: envelope và phân trang thật của `/bouts`; tên trường `campStartedOn` (T-003 chỉ mô tả cách tính); dạng chi tiết của lỗi 409 (danh sách mục thiếu); `rulesetName` và `verified` lấy bằng cách nối với danh sách ruleset vì bout không trả. Cân chính thức, kết quả, đình chỉ (T-006, T-007) chưa có contract nên chỉ chạy ở demo mode.

## Kiểm tra trình duyệt (demo mode, 19/10/2026)

Kịch bản A, 1440 px cho HLV và 390 px cho võ sĩ, theo đúng thứ tự demo:

1. Rafael → Today: "Weight alerts" Kenji đỏ, Aigerim vàng, Emma xám; "Documents due" có Emma; nav có "Bouts".
2. `/coach/bouts`: bốn trận seed, đúng badge.
3. New bout: AIBA hiện "Reference only, not verified with the organiser."; thi trước cân bị chặn tại trường; tạo Minh VMMAF 60 kg → chi tiết trận `SCHEDULED`, toast "Bout created".
4. Link camp plan → `CAMP`, biểu đồ từ 21/9 (ngày plan bắt đầu).
5. Minh (390 px): Today có thẻ cân xám và "Log today's weight"; `/fighter/bout` đúng giải, 60 kg, đếm ngược; ghi `66,5` + "Way off" → "Saved 66.5 kg. Status: Red", câu đỏ nguyên văn, "Last 3 days: 1 way off."; ghi `66.1` → một điểm.
6. Rafael → Today: Minh đỏ đứng đầu.
7. Thêm "Health certificate", "Blood test" (PROVIDED), "Brain CT" (MISSING) → "Enter fight week" bị chặn, liệt kê "Brain CT: missing", vẫn `CAMP`; Brain CT hạn trước ngày thi → vẫn chặn, dòng hạn đỏ.
8. Brain CT hạn hợp lệ → `FIGHT_WEEK`, history thêm dòng, toast "Fight week started".
9. Huỷ trận Aigerim "Opponent withdrew" → `CANCELLED`.

Ngày 20/10, sau các sửa theo review và sửa cho điện thoại, chạy lại bước 1–9 trên web desktop (1440 px) với seed sạch: đúng như trên. Hạn gợi ý của "Health certificate" đi theo ngày cấp khi đổi (3/4 → 8/4/2027). Server log không có lỗi.

Thêm T-006/T-007 trên Linh như bảng ở trên. Kịch bản B: id giả trả trang 404; `?fighter=` của võ sĩ ngoài roster bị bỏ qua trong form; võ sĩ mở `/coach/bouts` bị chuyển về dashboard võ sĩ; Lucas không trận thấy "No upcoming bout"; `?saved=70.0` trên Today của Lucas ra "Saved 70.0 kg." không kèm màu; `?saved=nope` và `?notice=bogus` không hiện gì.

Console: một cảnh báo React về `key` trong `WeightClassField`, đã sửa (`d8793fa`); ngày 20/10 mở lại form, đổi ruleset, tạo trận: console không còn lỗi. Server log không có lỗi.

Ghi chú kỹ thuật: khi khung trình duyệt của phiên bị ẩn, React chờ `requestAnimationFrame` để hiện nội dung stream nên trang đứng ở "Loading page". Kịch bản B được kiểm bằng cách đọc HTML trả về; phần 390 px ngày 20/10 được kiểm bằng cách gọi tay hàm hiện ranh giới Suspense trong console (chỉ để kiểm tra, không đổi code). Không ảnh hưởng người dùng thật.

## Lệnh đã chạy

Chạy trên working tree sạch tại `d92a246`.

`pnpm --filter nextjs-frontend lint`

```text
$ eslint
```

`APP_DATA_MODE=api pnpm --filter nextjs-frontend typecheck`

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

Chạy lại ngày 22/10 sau khi merge `fight-camp` và dịch màn Trận (chưa commit phần dịch lúc chạy): lint không lỗi; `APP_DATA_MODE=api` typecheck "✓ Types generated successfully", `tsc` không lỗi; test:

```text
 Test Files  100 passed | 1 skipped (101)
      Tests  892 passed | 2 skipped (894)
```

Kiểm tra trình duyệt ngày 22/10 (demo mode, desktop, tiếng Việt):
- Màn HLV mở đủ: danh sách trận, tạo trận, chi tiết trận của Kenji và Linh, tab đình chỉ, các thẻ Trận trên Today.
- Đã chạy một lượt trận của Linh: cân chính thức (gửi số sai thì báo lỗi tiếng Việt, gửi 59,6 kg thì hiện "Đạt cân" và chuyển sang "Đã cân"), ghi kết quả Thua · KO, thấy đề xuất đình chỉ 90 ngày.
- Võ sĩ Minh: ghi cân 68,4 kg, Today hiện "Đã lưu 68.4 kg."
- Chuyển cookie `mma_locale=en`: màn ghi cân và chi tiết trận hiện đúng chữ tiếng Anh như trước.
- Console không có lỗi.

Trước phiên: 75 file, 626 passed, 1 skipped. Không có test skip mới. Test mới: `bout-rules.test.ts`, `suspension-rules.test.ts`, `bouts-contract.test.ts`, `actions/bouts.test.ts`, `services/bouts.api.test.ts`; `bouts.demo.test.ts` viết lại theo seed mới; thêm ca ở `navigation.test.ts`, `weight-track.test.ts`, `nutrition.test.ts`.

## Lệch so với ticket

- Store demo riêng (`bouts.demo.ts`) thay vì `mocks/db.ts`, giữ cách Cursor đã làm. Kiểu `CampBout` trong `lib/domain/bout.ts` thay vì `Bout` trong `types.ts`. Tên `event`, `opponent`, `limitKg`, `phase`, `state` giữ như Cursor; adapter map sang tên của T-003.
- Hub "Bouts" có tab "Suspensions" theo Tech spec §9 (T-004 chỉ nói thêm mục "Bouts").
- Huỷ trận dùng `ActionDialog` có lý do bắt buộc, vì cần chọn lý do và ghi chú (kiến trúc nói hành động phá huỷ dùng `ConfirmDialog`; dialog vẫn nói rõ hậu quả và nút màu danger).
- Chuyển thêm checklist khoá ở tuần thi đấu, mở khoá có lý do (F5 bước 2), sửa trận (F8), lịch sử, cảnh báo hồ sơ 14 ngày (F4): các phần P1/P2 của brief đã làm.
- Preset "Tự nhập" đặt môn MMA vì Tech spec không nói môn của preset này.
- Đường tham chiếu chặn ở số cân đầu camp (xem handover T-005a).
- Khi đổi hạng cân trong lúc sửa trận, lịch sử ghi một dòng cùng giai đoạn ("Changed in camp") kèm lý do; T-003 chỉ nói history ghi chuyển trạng thái.

## Câu hỏi / việc còn mở

- Trận Minh tạo trên sân khấu cân sau hai ngày nên hạn nộp hồ sơ (cân − 7 ngày) đã qua: khi còn thiếu "Brain CT", trang hiện "Documents late" màu đỏ. Đúng nghiệp vụ; nếu không muốn thấy trong demo, sửa "Documents due, days before weigh-in" về 0 trong Edit trước khi thêm hồ sơ.
- Checklist rỗng thì Cổng 1 coi như đạt (T-003 tiêu chí 8). Trong demo, thêm hồ sơ **trước** khi bấm "Enter fight week".
- Thanh điều hướng dưới của HLV có sáu mục, mỗi mục khoảng 65 px ở 390 px; nhãn "Clearance" vừa khít. Nếu thêm hub nữa nên gộp.
- Adapter API chưa đối chiếu backend (T-008a phần B).
- Ruleset từ API chưa mang `suspensionRules` vào gợi ý (đợi T-007 backend); gợi ý chỉ chạy ở demo.
- Nhánh này và T-004 của Gemini trên `fight-camp` là hai bản khác nhau của cùng màn. Sau merge `2aeb90b`, bản của nhánh này thay bản của Gemini và trang Trận của võ sĩ do Fon làm (T-005A). Chủ dự án (Dan) cần biết điều này trước khi merge nhánh vào `fight-camp`.
- `docs/DEMO-REVIEW2-SCRIPT.md` ghi nhãn nút tiếng Anh. Giao diện giờ mặc định tiếng Việt: hoặc đổi kịch bản, hoặc chọn English trong menu tài khoản trước khi demo.
- Adapter API (`bouts.api.ts`) chưa nối các endpoint T-006A (cân chính thức, kết quả, khoá checklist) mà backend đã merge ngày 22/10; các phần đó vẫn chỉ chạy ở demo.
