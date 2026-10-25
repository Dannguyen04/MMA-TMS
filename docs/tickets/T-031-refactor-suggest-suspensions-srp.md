# T-031 · Tách `suggestSuspensions` theo nguyên tắc đơn trách nhiệm (SRP)

| | |
| --- | --- |
| **Trạng thái** | BACKLOG (25/10). Chưa xếp lịch. Làm trước khi thêm loại quy tắc đình chỉ mới, hoặc lần tới có người phải sửa R27 |
| **Phần** | Backend, refactor thuần: **không đổi hành vi, không đổi API, không migration** |
| **Người nhận** | Chưa giao. Theo [quy định làm việc](../WORKING-RULES-CLAUDE-AGY.md): Claude soạn prompt, `agy` code, một lượt |
| **Nhánh** | Làm trên nhánh đang checkout khi tới lượt (hiện là `User_Feature`) |
| **Ước lượng** | 0,5 đến 1 ngày |
| **Tài liệu dẫn chiếu** | [T-007](./T-007-suspensions-and-readiness.md) mục 7 (R27), [T-007-HANDOVER](./T-007-HANDOVER.md) Round E và Round G, [Luồng nghiệp vụ R27, F7, H3, H4, H6](../FIGHT-CAMP-BUSINESS-FLOWS.md) |
| **Lệnh kiểm tra** | `pnpm --filter nestjs-api lint`, `build`, `test` (baseline 26 lỗi), `test:db`, `db:check` |

## Bối cảnh

`suggestSuspensions` (R27, tự tạo đình chỉ khi ghi kết quả trận) nằm ở `nestjs-api/src/suspensions/suspensions.model.ts`, dòng 599 đến 884 ở commit `10edbf9`, kèm hai hàm phụ `buildExplanation` (dòng 510) và `countPriorKoTkoFromDates` (dòng 569). Hàm chạy đúng và có 18 test, nhưng một hàm đang giữ **nhiều lý do để đổi**, nên lần nào thêm một kiểu quy tắc cũng phải sửa cùng một thân hàm, và phải đọc cả 290 dòng mới chắc mình không làm hỏng nhánh khác (G1, lỗi võ sĩ thắng bị đình chỉ `DQ`, sinh ra đúng vì vậy).

Các trách nhiệm đang dồn vào một chỗ:
1. **Chuẩn hóa đầu vào.** Hai kiểu chữ ký: một object (`SuggestSuspensionsParams`) hoặc **bảy tham số rời** (`rulesArg`, `restDaysArg`, `priorCountArg`, `coachInputArg`, `todayArg`, `extraArg`), kèm một khối `if/else` để gộp hai kiểu thành các biến cục bộ.
2. **Phân loại sự kiện.** Thua KO, thua TKO do đòn vào đầu, `DQ`.
3. **Kiểm tra đầu vào của HLV** (`suspensionDays`, `suspensionOverrideReason` không được gửi khi không có đình chỉ).
4. **Đọc và lọc quy tắc** của bộ luật (`suspensionRuleSchema.safeParse`, quy tắc sai bị bỏ qua im lặng).
5. **Đếm lần KO/TKO trước đó**, với **bốn dạng** đầu vào `priorKoTkoCount`: số, hàm `(withinDays) => số`, mảng chuỗi ngày, mảng `{ startsOn, boutId }`.
6. **Khớp quy tắc** (lý do, `priorCount`, `withinDays`, `loc`) và chọn quy tắc nặng nhất.
7. **Quyết định số ngày:** ngày gợi ý hay ngày HLV nhập, khi nào bắt buộc lý do.
8. **Dựng từng đình chỉ:** KO/TKO, `DQ`, nghỉ bắt buộc, kèm ngày bắt đầu và kết thúc.
9. **Dựng câu giải thích** (có đoạn `rulesetName.toLowerCase().includes('aiba')` để chọn nhãn: logic trình bày lẫn trong logic nghiệp vụ).

Dữ liệu thực tế cho thấy phần thừa:
- Code production gọi đúng **một** lần, `bouts.service.ts` (`applyResultSuspensions`, khoảng dòng 1284), bằng kiểu object, với `priorKoTkoCount` là mảng các dòng đình chỉ (`{ startsOn, boutId, ... }`).
- Kiểu **bảy tham số rời** chỉ được dùng trong **một** test (`suspensions.model.spec.ts`, "supports positional argument invocation matching the prompt description", khoảng dòng 1006). Nó là hệ quả của cách viết prompt giao việc ở Round E, không phải nhu cầu thật.
- Dạng `priorKoTkoCount` là **hàm** không có test hay nơi gọi nào dùng. Dạng số (`0`) và mảng chuỗi ngày chỉ có trong test.

## Mục tiêu

Mỗi hàm chỉ có một lý do để đổi, `suggestSuspensions` còn lại là bộ điều phối ngắn, thêm một kiểu quy tắc mới thì chỉ thêm một hàm và một dòng gọi. **Đầu ra y hệt trước khi sửa** với mọi đầu vào hợp lệ.

## Thiết kế gợi ý

Tên là gợi ý, đều là hàm nội bộ của module (không đổi API công khai). Người thực hiện được chọn tên khác nếu có lý do, nhưng không được đổi chữ ký `suggestSuspensions(params)` ở bước 5 dưới đây ngoài việc bỏ kiểu bảy tham số rời.

| Hàm | Một trách nhiệm | Vào, ra |
| --- | --- | --- |
| `classifyBoutResult(event)` | Phân loại: `'KO'`, `'TKO'`, `'DQ'` hay không có đình chỉ do trận | `event` → `{ koTkoReason: 'KO' \| 'TKO' \| null, isDisqualified: boolean }`. `isDisqualified` chỉ đúng khi `result = LOSS` và `method = DQ` (đã sửa ở G1: giữ nguyên) |
| `checkCoachInputAllowed(koTkoDue, coachInput)` | Chặn `suspensionDays` và `suspensionOverrideReason` khi không có đình chỉ KO/TKO | → `ok` hoặc lỗi `SUSPENSION_DAYS_NOT_ALLOWED` / `SUSPENSION_OVERRIDE_NOT_ALLOWED` |
| `parseSuspensionRules(raw)` | Đọc quy tắc bộ luật bằng `suspensionRuleSchema` | → `SuspensionRule[]` (quy tắc sai vẫn bị bỏ qua; xem "Điểm cần quyết") |
| `countPriorKoTko(priors, withinDays, boutDate, excludeBoutId)` | Đếm đình chỉ KO/TKO trước đó trong `withinDays` ngày trước ngày thi | **Một** dạng đầu vào: `readonly { startsOn: string; boutId?: string \| null }[]`; trả số |
| `matchSuspensionRules(rules, { reason, loc, priorCountFor })` và `pickHeaviestRule(rules)` | Khớp quy tắc theo lý do, `priorCount`, `withinDays`, `loc`; chọn quy tắc có `minDays` lớn nhất | → quy tắc hoặc `null` |
| `resolveSuspensionDays(suggestedDays, coachInput)` | Số ngày cuối cùng và lý do ghi đè | → `{ days, overrideReason }` hoặc `SUSPENSION_DAYS_REQUIRED` / `SUSPENSION_OVERRIDE_REASON_REQUIRED` |
| `buildKoTkoSuspension(...)`, `buildDisqualificationSuspension(...)`, `buildMandatoryRest(...)` | Mỗi hàm dựng một loại đình chỉ (reason, `startsOn = today`, `endsOn = endsOnFor(today, days)`, `requiresClearance`, `blockedSessionTypes`) | → `SuggestedSuspension` (chưa có `explanation`) hoặc `null` |
| `explainSuspension(proposal, matchedRule, presetLabel)` | Câu giải thích hiển thị cho HLV | Văn bản như hiện nay. `presetLabel` do bên gọi truyền vào; bỏ đoạn đoán `aiba` từ tên bộ luật trong hàm này (xem "Điểm cần quyết") |
| `suggestSuspensions(params)` | **Điều phối**: gọi các hàm trên theo thứ tự rồi gom kết quả | Chữ ký object duy nhất (`SuggestSuspensionsParams`). Không còn khối gộp hai kiểu đầu vào |

Nên đặt các hàm mới trong một file riêng cùng thư mục (ví dụ `suspension-rules.ts`), và `suspensions.model.ts` chỉ **re-export** `suggestSuspensions` và các kiểu để không đổi đường dẫn import của `bouts.service.ts`. Tách luôn các nhóm khác của `suspensions.model.ts` (hiện hơn 900 dòng: trạng thái, schema yêu cầu, lọc phân trang, `planConflicts` của R28, schema phản hồi) là việc **ngoài ticket này**.

## Việc phải làm

1. **Đóng băng hành vi trước khi sửa.** Thêm một test dạng bảng (viết trực tiếp giá trị mong đợi trong spec, không dùng file snapshot) chạy `suggestSuspensions` bản hiện tại trên ma trận đầu vào và ghi lại đầu ra: thua `KO` / `TKO` có và không đòn vào đầu / thắng, hoà, không kết quả, `DQ` thắng và thua; bộ luật AIBA, bộ luật rỗng (VMMAF), bộ luật chỉ có quy tắc `DQ`; `priorKoTkoCount` rỗng, một lần trong 90 ngày, hai lần trong 365 ngày, một lần ngoài cửa sổ, một lần của chính trận này (phải bị loại); `loc` `NONE`, `UNDER_1_MIN`, `OVER_1_MIN`, `UNKNOWN`; có và không `restDaysAfterBout`; HLV nhập đúng ngày gợi ý, khác có và không lý do, nhập khi không có đình chỉ. Khoảng 40 ca. Các test hiện có (18 ca ở `describe('suggestSuspensions (R27)')`) vẫn giữ.
2. Refactor theo bảng trên, **từng hàm một**, chạy test sau mỗi hàm.
3. Bỏ kiểu bảy tham số rời, bỏ hai dạng `priorKoTkoCount` không dùng (số, hàm). Sửa test "supports positional argument invocation…" thành kiểu object hoặc xoá nó (nó kiểm một API đã bỏ). Các test hiện truyền `priorKoTkoCount: 0` hoặc mảng chuỗi ngày thì đổi sang mảng `{ startsOn, boutId }` (mảng rỗng thay cho `0`).
4. `bouts.service.ts`: nếu `priorKoTkoCount` vẫn nhận mảng dòng đình chỉ thì không cần đổi; nếu có đổi thì chỉ trong `applyResultSuspensions`, không đụng chỗ khác của file.
5. Đo: `suggestSuspensions` còn không quá khoảng 40 dòng; không hàm mới nào quá khoảng 40 dòng.

## Ngoài phạm vi
- Đổi bất kỳ quy tắc nghiệp vụ, mã lỗi, trường phản hồi, hay nội dung câu giải thích.
- `planConflicts` (R28), `classifyReadiness` (R32) và các nhóm khác trong `suspensions.model.ts`.
- Dịch câu giải thích sang tiếng Việt (câu hiện là tiếng Anh, frontend hiện nguyên văn) — là việc riêng.
- Thêm kiểu quy tắc đình chỉ mới.

## Điểm cần quyết (hỏi chủ dự án trước khi làm)
1. **Quy tắc sai trong `suspension_rules`** hiện bị bỏ qua **im lặng** (`safeParse` thất bại thì bỏ). Giữ như vậy, hay báo lỗi cấu hình bộ luật? Giữ nguyên là mặc định của ticket (không đổi hành vi).
2. **Nhãn "AIBA preset"** trong câu giải thích đang suy từ tên bộ luật có chứa chữ `aiba`. Mặc định: bên gọi (`applyResultSuspensions`) truyền `presetLabel` có sẵn, kết quả giống hệt hôm nay; nếu muốn thay bằng một cột/ trường nhãn riêng của bộ luật thì là ticket khác.

## Tiêu chí nghiệm thu
1. Ma trận ~40 ca ở bước 1 và 18 ca R27 hiện có đều qua **trước và sau** refactor, với cùng giá trị mong đợi.
2. Không còn chữ ký bảy tham số rời, không còn dạng `priorKoTkoCount` kiểu số hay hàm; `grep` không còn `rulesArg`, `restDaysArg`, `priorCountArg`, `coachInputArg`, `todayArg`, `extraArg`.
3. `suggestSuspensions` là bộ điều phối ngắn; mỗi hàm mới có test riêng (đầu vào biên của đúng trách nhiệm đó), ví dụ `pickHeaviestRule` với hai quy tắc cùng `minDays`, `countPriorKoTko` với đình chỉ đúng ngày biên `withinDays`, `resolveSuspensionDays` ba ca.
4. `lint` exit 0, `build` exit 0, `test` chỉ còn 26 lỗi baseline (số test qua tăng), `test:db` và `db:check` không đổi.
5. `git diff` không chạm `recordResult`, `updateBout`, `resolveWeightClass`, `cancelBout`, và không đổi `bouts.service.ts` ngoài `applyResultSuspensions` (nếu có).

## Ghi chú cho người thực hiện
- Đọc `docs/tickets/T-007-HANDOVER.md` mục Round E và Round G để biết vì sao hàm có hình dạng hiện tại, nhất là G1 (`DQ` chỉ khi `LOSS`).
- Không dùng `@Optional()`, `?.` hay `typeof ... === 'function'` để chiều theo mock: lỗi cấu hình sẽ im lặng ở đường ghi kết quả trận (bài học của Round G).
- Gặp điều chưa rõ thì ghi vào mục "Câu hỏi" của handover và dừng, không đoán.
