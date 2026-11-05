# T-056 Dữ liệu demo đủ các tình huống đình chỉ

- Trạng thái: APPROVED 04/11 ([review](./T-056-REVIEW.md)). Ngày: 04/11/2026. Phụ thuộc: T-050, T-053 (DONE trên nhánh).
- Phạm vi: chỉ dữ liệu demo của `nextjs-frontend` (`APP_DATA_MODE=demo`). Không đổi backend, API, mã lỗi, migration, giao diện.
- Khác T-052: T-052 là script seed cho Supabase (backend), vẫn DRAFT. T-056 chỉ là mock của frontend.

## Bối cảnh

Chủ dự án (04/11): demo chỉ có một đình chỉ chờ xác nhận, nên không trình bày rõ được nghiệp vụ F7 ([FLOWS:604–616](../FIGHT-CAMP-BUSINESS-FLOWS.md)).

Dữ liệu hiện có ([mocks/suspensions.ts](../../nextjs-frontend/src/lib/mocks/suspensions.ts)) chỉ có bốn đình chỉ: KO đang hiệu lực (Marcus), TKO chờ xác nhận (Diego), KO vừa xác nhận và đang tập theo bậc (Linh), nghỉ bắt buộc (Tariq). Thiếu hẳn:

- đình chỉ `MEDICAL` (lý do duy nhất kết thúc sớm được);
- đình chỉ do ban tổ chức ra (`issuedBy ORGANIZER`), là trường hợp duy nhất HLV được gỡ;
- phiếu khám TRAINING hợp lệ để bác sĩ kết thúc sớm. Mọi phiếu demo trong [mocks/medical.ts](../../nextjs-frontend/src/lib/mocks/medical.ts) không có `scope`, nên `filterEarlyEndExaminations` luôn trả rỗng;
- lịch sử: kết thúc sớm có phiếu khám, HLV xác nhận khi không có giấy y tế, đình chỉ tự hết hạn.

Tài khoản demo: HLV `u-rafael-costa` (`c-rafael-costa`), bác sĩ `u-thu-le` (`d-thu-le`) ([demo-session.ts:19-20](../../nextjs-frontend/src/lib/auth/demo-session.ts)).

## Thiết kế

Giữ nguyên năm tình huống cũ (ghi ở đầu `buildMockSuspensions`). Thêm các dòng dưới; ngày tính theo `TODAY_KEY` bằng `addDaysToDate`, như code hiện có. Dòng mới dùng id người dùng thật (`u-rafael-costa`, `u-thu-le`).

| Id | Võ sĩ | Đình chỉ | Mục đích demo |
| --- | --- | --- | --- |
| `susp-medical-club-exam` (S6) | Hoàng Long `f-hoang-long` | `MEDICAL`, `CLUB`, `startsOn -3`, `endsOn +10`, `requiresClearance false` | Bác sĩ Thu kết thúc sớm bằng phiếu khám có sẵn. HLV không thấy nút kết thúc sớm |
| `susp-medical-organizer` (S7) | Bảo Nguyễn `f-bao-nguyen` | `MEDICAL`, `ORGANIZER`, `issuerReference "QĐ 12/BTC – Giải MMA mở rộng TP.HCM"`, `startsOn -5`, `endsOn +25`, `requiresClearance false` | HLV bấm "Gỡ theo ban tổ chức", nhập văn bản gỡ |
| `susp-medical-club-pending` (S8) | Sofia Kowalski `f-sofia-kowalski` | `MEDICAL`, `CLUB`, `startsOn -2`, `endsOn +12`, `requiresClearance false` | Bác sĩ chưa có phiếu sau ngày đình chỉ: hộp thoại chỉ hiện cảnh báo và link "Ghi phiếu khám". Có một yêu cầu khám `OPEN` do HLV Rafael gửi |
| `susp-history-early-end` (H1) | Marcus Hale `f-marcus-hale` | `MEDICAL`, `CLUB`, `startsOn -120`, `endsOn -95`, kết thúc sớm ngày `-110` bởi `u-thu-le`, `earlyEndExaminationId` trỏ tới phiếu H1, `clearanceNote` có thật | Lịch sử kết thúc sớm có căn cứ |
| `susp-history-no-medical` (H2) | Tariq Haddad `f-tariq-haddad` | `TKO`, `CLUB`, `startsOn -200`, `endsOn -171`, `requiresClearance true`, xác nhận ngày `-169` bởi `u-rafael-costa`, `clearanceNote "HLV xác nhận, không có xác nhận y tế"` | Lịch sử HLV xác nhận khi không có giấy |
| `susp-history-dq` (H3) | Tariq Haddad | `DQ`, `CLUB`, `startsOn -90`, `endsOn -84`, `requiresClearance false` | Đình chỉ không cần xác nhận tự hết hạn |

Dữ liệu kèm theo:

1. **Phân công.** Thêm `c-rafael-costa` vào `coachIds` của Hoàng Long, Bảo, Sofia, và thêm ba võ sĩ này vào `fighterIds` của coach Rafael. Thêm `d-thu-le` vào `doctorIds` của Sofia và Sofia vào `fighterIds` của bác sĩ Thu. Hai chiều phải khớp (đã có test trong `integrity.test.ts`).
2. **Phiếu khám.**
   - S6: một phiếu của `d-thu-le` cho Hoàng Long, ngày `-1`, `scope "TRAINING"`, `outcome "fit"`, `validUntil +30`, tóm tắt ghi khám lại sau đình chỉ.
   - H1: một phiếu của `d-thu-le` cho Marcus, ngày `-111`, `scope "TRAINING"`, `outcome "fit_with_restrictions"`.
   - S8: **không** thêm phiếu nào của Thu cho Sofia từ ngày `startsOn` của S8.
3. **Yêu cầu khám (S8).** Seed `medicalReviewRequests` (hiện là `[]` ở [db.ts:127](../../nextjs-frontend/src/lib/mocks/db.ts)) một dòng: Sofia, `requestedById "u-rafael-costa"`, `requesterRole "COACH"`, `status "OPEN"`, `requestedAt` ngày `-2`, lý do bằng tiếng Việt.
4. Cập nhật chú thích đầu `buildMockSuspensions` thành danh sách đủ các tình huống.

Nếu một lựa chọn trên làm hỏng một kịch bản demo đang có (ví dụ storyline trong `integrity.test.ts`), ghi vào "Câu hỏi" của handover và đề xuất võ sĩ khác, không tự đổi kịch bản cũ.

## Ngoài phạm vi

- Giao diện, từ điển, service (`suspensions.demo.ts`, `medical.demo.ts`).
- Lỗ hổng đã biết của service demo: `endSuspensionEarly` không kiểm phiếu khám có tồn tại và hợp lệ không. Ghi lại, không sửa trong ticket này.
- Id cũ `u-coach-rafael` trong các dòng hiện có.
- Seed Supabase (T-052).

## Ca kiểm thử

Lớp: unit trên seed (`buildMockSuspensions`, `db()` hoặc các mảng mock) và service demo có thật (không mock). `today = TODAY_KEY`, `now = MOCK_ANCHOR_ISO`. File mới: `nextjs-frontend/src/lib/mocks/t056-demo-suspensions.test.ts`.

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| M1 | `suspensionStatusOn` cho từng id S6, S7, S8, H1, H2, H3 | S6, S7, S8: `ACTIVE`. H1, H2, H3: `ENDED` |
| M2 | Năm tình huống cũ | Trạng thái không đổi: Marcus `susp-active-ko` `ACTIVE`, Diego `AWAITING_CLEARANCE`, Linh `ENDED` có `gradedReturn.ceiling 3`, Tariq `susp-mandatory-rest` `ACTIVE`; Emma không có đình chỉ nào |
| M3 | `filterEarlyEndExaminations(exams, S6, { doctorId: "d-thu-le", now })` | Đúng 1 phiếu, là phiếu S6 |
| M4 | Như M3 cho S8 | Mảng rỗng |
| M5 | S7 | `reason "MEDICAL"`, `issuedBy "ORGANIZER"`, `issuerReference` khác rỗng |
| M6 | `accessibleFighterIds` của HLV Rafael và bác sĩ Thu (đúng cách `suspensions-page.test.ts` dựng user) | Rafael có Hoàng Long, Bảo, Sofia. Thu có Hoàng Long, Sofia, Marcus |
| M7 | `endSuspensionEarly(S6, { examinationId: <phiếu S6>, note }, bác sĩ Thu)` trên db demo | Trả về `status "ENDED"`, `gradedReturn.ceiling 3`, `earlyEndExaminationId` là phiếu S6 |
| M8 | `endSuspensionEarly(S6, { examinationId, note }, HLV Rafael)` | Lỗi 403 `FORBIDDEN` |
| M9 | `endSuspensionEarly(S7, { liftReference: "CV 30/BTC", note }, HLV Rafael)` | `status "ENDED"`, `liftReference "CV 30/BTC"` |
| M10 | H1 | `earlyEndExaminationId` trỏ tới một phiếu có trong seed: Marcus, `d-thu-le`, `scope "TRAINING"`, kết luận `fit` hoặc `fit_with_restrictions`, ngày khám nằm giữa `startsOn` và `clearedAt` |
| M11 | H2 | `requiresClearance true`, `clearedById "u-rafael-costa"`, `clearanceNote` chứa "không có xác nhận y tế" |
| M12 | H3 | `reason "DQ"`, `requiresClearance false`, `clearedAt null` |
| M13 | `medicalReviewRequests` của seed | Đúng một dòng `OPEN` cho Sofia, người gửi `u-rafael-costa`, vai trò `COACH` |
| M14 | Gọi `createExamination` của `medical.demo.ts` cho Sofia bằng bác sĩ Thu (`scope "TRAINING"`, `outcome "fit"`, ngày hôm nay), rồi chạy `filterEarlyEndExaminations` cho S8 | Trước: 0 phiếu. Sau: 1 phiếu. Yêu cầu khám M13 chuyển `RESOLVED` |
| K1 | Toàn bộ test hiện có, gồm `integrity.test.ts`, `suspensions-page.test.ts`, T-050, T-053, T-054 | Qua. Ca nào phải đổi vì seed mới thì giữ tên ca, ghi lý do vào handover |

Các ca M7–M9 và M14 ghi vào db demo dùng chung. `mocks/db.ts` không có hàm reset (chỉ có `seedData`, `db`). Test phải cô lập db theo cách các test demo hiện có làm, ví dụ `services/suspensions.test.ts`, để không ảnh hưởng test khác.

## Tiêu chí nghiệm thu

1. Có đủ các ca trên, đúng tên và đúng kết quả mong đợi.
2. `lint`, `typecheck`, `test` của `nextjs-frontend` qua; số test không giảm.
3. Không sửa file ngoài `src/lib/mocks/` và file test mới, trừ test hiện có phải đổi theo K1.

## Lệnh bắt buộc

`pnpm --filter nextjs-frontend lint` ; `pnpm --filter nextjs-frontend typecheck` ; `pnpm --filter nextjs-frontend test`

Không chạy dev server (chủ dự án, 04/11).

## Lượt sửa 1 (04/11, sau review độc lập)

Review độc lập lượt 1: CHANGES REQUESTED, không có vấn đề chặn.

1. **Câu chuyện của Marcus mâu thuẫn.** Phiếu H1 (ngày -111) và ghi chú H1 nói về gãy xương bàn tay. Nhưng ca gãy đó (`inj-marcus-hand`) mới xảy ra 11 ngày trước. Sửa: phiếu H1 và ghi chú H1 thành một đợt sốt siêu vi đã khỏi (hết sốt, xét nghiệm ổn), kết luận `fit_with_restrictions`, tăng dần cường độ. Không nhắc tới tay hay xương.
2. **Buổi tập "đã hoàn thành" nằm trong thời gian đình chỉ.** Hoàng Long, Bảo và Sofia có buổi đã hoàn thành sau `startsOn`. Sửa: cho S6, S7, S8 bắt đầu **hôm nay** (`startsOn 0`); giữ nguyên độ dài (S6 tới `+13`, S7 tới `+30`, S8 tới `+14`). Phiếu S6 dời về hôm nay, giờ trước thời điểm neo (`clampPastToday`). Yêu cầu khám S8 cũng đặt hôm nay.
3. **Phiếu S6 ghi sai thời điểm.** Đổi "Khám lại sau đình chỉ" thành "Khám lại trong thời gian đình chỉ".
4. **Sofia thiếu bối cảnh lâm sàng.** Lý do của yêu cầu khám S8 nêu rõ vấn đề: đau vai trái sau buổi grappling, cần khám trước khi cho tập lại. Không thêm chấn thương mới.
5. **Chú thích cũ.** Sửa các chú thích số cũ ở `suspensions-page.test.ts`, `readiness-page.test.ts` và trong test T-056.
6. **Tác dụng phụ đã biết, ghi vào handover.** Đây là hành vi đúng của F7. Đình chỉ `MEDICAL` chuyển `tp-sofia-camp` và `tp-hoang-camp` sang `rehab`. Các buổi đã xếp của ba võ sĩ trong thời gian đình chỉ chuyển sang `pending` (chờ xếp lại).

Ca thêm (lớp unit trên seed):

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| M15 | Buổi tập trong seed (`db().trainingSessions`) của Hoàng Long, Bảo, Sofia | Không có buổi nào `status "completed"` có ngày (theo `academyDateOf`) từ `startsOn` của đình chỉ S6, S7, S8 tương ứng. Phải lỗi trên seed lượt 1 |
| M16 | Phiếu H1 (`summary`, `recommendations`, các `note` của `assessments`) và `clearanceNote` của H1 | Không chứa "gãy", "xương" hay "bàn tay". Phải lỗi trên seed lượt 1 |
| M1, M3, M4, M7, M10, M14 | Như cũ, với ngày mới | Kết quả mong đợi không đổi |

## Lượt sửa 2 (04/11, Claude chạy lại lúc 13:23)

Claude chạy lại `vitest` lúc 13:23: 2 ca lỗi. Lúc `agy` chạy (10:36) thì cả hai qua, nên đây là lỗi phụ thuộc giờ chạy.

1. **M15 lỗi:** `f-sofia-kowalski có 1 buổi completed từ startsOn 2026-11-04: s-sofia-grappling-today`. Buổi tập hôm nay tự thành "đã hoàn thành" khi đồng hồ qua giờ của buổi đó, dù Sofia đang bị đình chỉ. Trên demo thật cũng sẽ thấy mâu thuẫn này. Sửa ở dữ liệu demo hoặc ở chỗ seed tính trạng thái buổi tập hôm nay, theo nguyên nhân gốc (`agy` tìm). Buổi của võ sĩ đang bị đình chỉ không được thành `completed`, ở bất kỳ giờ nào trong ngày.
2. **K1 lỗi:** `expected [ …(10) ] to have a length of 11 but got 10`. K1 phải kiểm đúng 10 đình chỉ trong seed (`buildMockSuspensions()`), không phụ thuộc thứ tự chạy hay giờ chạy.

Ca thêm:

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| M17 | Dựng seed với thời điểm neo giả lần lượt là 00:30, 12:00 và 23:30 giờ học viện của cùng một ngày (dùng cơ chế neo sẵn có trong `mocks/time.ts`, ví dụ `__mmaMockAnchorMs`; không mock hàm cần kiểm) | Ở cả ba giờ, M15 và K1 đều qua |

## Lượt sửa 3 (04/11, Claude review lượt sửa 2)

Giữ phần sửa dữ liệu trong `seedData()`: buổi tập hôm nay của võ sĩ có đình chỉ đang hiệu lực mà đồng hồ đã gán `completed` hoặc `missed` thì đưa về `scheduled` trước `applySuspensionSideEffects`.

Hoàn tác các thay đổi hạ tầng ngoài tỷ lệ của lượt 2:

1. **`mocks/time.ts`: hoàn tác toàn bộ.** Mốc neo giữ là hằng số. `__mmaMockAnchorMs` vẫn đặt bằng `??=` như cũ, không có `Object.defineProperty`, không `export let`.
2. **`db()` trong `mocks/db.ts`: trả lại như cũ.** Giữ `seedFingerprint`, giữ so sánh fingerprint, giữ `structuredClone(seedData())`. Bản lượt 2 bỏ clone, nên khi dữ liệu demo bị sửa thì các mảng hằng của module (`mockSystemSettings`, `mockCoachFeedback`, …) cũng bị sửa theo.
3. **`mocks/training.ts`: bỏ `buildMockTrainingSessions`.** `seedData()` quay lại `mockTrainingSessions.map((s) => ({ ...s }))`; vòng sửa trạng thái chỉ sửa trên các bản sao này.
4. **M17 dùng cơ chế neo sẵn có, không đổi `time.ts`.** Với mỗi giờ: `vi.resetModules()`, xoá `globalThis.__mmaMockDb`, đặt `globalThis.__mmaMockAnchorMs` bằng mốc giả, rồi `await import()` lại các module mock và rule. Sau test, khôi phục giá trị anchor cũ.

Ca thêm:

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| M18 | Sửa `db().settings` hoặc một buổi trong `db().trainingSessions` (ví dụ đổi `status`), rồi đọc hằng tương ứng của module (`mockSystemSettings`, `mockTrainingSessions`) | Hằng của module không đổi. Phải lỗi trên bản lượt 2 |
| M17 | Như lượt 2, theo cách làm ở mục 4 | Như lượt 2 |

## Lượt sửa 4 (04/11, sau review độc lập lượt 2)

Review độc lập lượt 2: CHANGES REQUESTED.

1. **Chặn: K1 và M17 gõ cứng số buổi `pending`** (Hoàng Long 10, Bảo 8, Sofia 11). Lịch tập chỉ sinh tới `LAST_DAY = 14`, nên số buổi đổi theo thứ trong tuần. Giả đồng hồ ngày 05/11 thì K1 và M17 lỗi ("expected length 8 but got 9"). Sửa: bỏ số gõ cứng, thay bằng bất biến. Trong khung đình chỉ đang hiệu lực của S6, S7, S8, mọi buổi mà `isSessionBlockedBySuspension` trả `true`: (a) không có buổi nào `scheduled` hay `completed`; (b) có ít nhất một buổi `pending`.
2. **Nên sửa: vòng đặt lại trong `seedData()` đụng cả loại được phép tập.** Ví dụ ngày 07/11: buổi `recovery_mobility` hôm nay của Marcus từ `completed` thành `scheduled`. Sửa: chỉ đặt lại buổi mà `isSessionBlockedBySuspension(session, susp)` (`lib/domain/suspension-rules.ts:281`) trả `true`.
3. **Gợi ý: thứ tự giờ của S6, S7, S8.** `createdAt` và `updatedAt` là `${today}T08:00:00.000Z` (15:00 giờ học viện), muộn hơn phiếu S6 (08:00) và yêu cầu khám của Sofia (08:30). Sửa: tạo đình chỉ lúc 07:00 giờ học viện hôm nay bằng `pastToday(7, 0)` (`mocks/time.ts:114`).
4. **Gợi ý: chú thích số cũ còn sót.** `suspensions-page.test.ts:143` và tên ca B4-1, `readiness-page.test.ts:220`. Sửa lời chú thích và mô tả, giữ nguyên mã ca.
5. **Ghi nhận, không sửa.** Bảo mới vào CLB 12 ngày mà có đình chỉ của ban tổ chức bắt đầu hôm nay thì hơi khó tin, nhưng không sai quy tắc. Handover ghi thêm tác dụng phụ của vòng đặt lại: buổi bị chặn hôm nay của Marcus chuyển `cancelled`, của Tariq chuyển `pending`.

Ca thêm hoặc đổi:

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| K1 | Seed tại mốc neo hiện tại | Đúng 10 đình chỉ, và bất biến ở mục 1 đúng cho S6, S7, S8 |
| M17 | Mốc neo giả lúc 12:00 giờ học viện của bảy ngày liên tiếp (thứ Hai tới Chủ nhật), cộng thêm 00:30 và 23:30 của một ngày | Ở mọi mốc, M15 và K1 đều qua. Phải lỗi ít nhất ở một mốc trên test lượt 3 |
| M19 | Mốc neo giả mà buổi `recovery_mobility` hôm nay của Marcus (`s-marcus-recovery-today`) đã `completed` trong `mockTrainingSessions` (ví dụ 07/11 lúc 23:30) | Trong `db()`, buổi đó vẫn `completed`. Phải lỗi trên code lượt 3 |
