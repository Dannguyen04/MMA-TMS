# Bàn giao FE và Mobile — tiếp nhận Fighter, phân công bác sĩ, baseline và clearance

**Đối tượng:** Claude phụ trách FE (`nextjs-frontend/`) và Claude phụ trách Mobile (`reactnative-mobile/`), thực hiện theo phần dành cho từng nền tảng. Backend dependencies do Claude backend xử lý. **Antigravity** phụ trách kiểm thử/review theo phạm vi người dùng giao, không thay Claude triển khai tính năng. [User; pipeline AGENTS.md]

Đây là tài liệu công việc cần làm, **không phải xác nhận client đã hoàn thành**. Hai bước khám/cấp clearance còn thiếu trên giao diện; API có sẵn không đồng nghĩa bác sĩ đã thao tác được. [User; backend handover]

## 1. Nguồn và phạm vi

Đọc instruction nền tảng trước khi code: `nextjs-frontend/AGENTS.md` yêu cầu hướng dẫn Next.js cài trong `node_modules/next/dist/docs/`; `reactnative-mobile/AGENTS.md` yêu cầu Expo v57 docs. Không đổi framework/dependencies để né tích hợp. [Instructions]

Nguồn dùng chung:

- `docs/MMA-TMS-MASTER-SPECIFICATION-v3.md`, §05.1b, §05.10.1, §05.12; quyết định mới nhất của người dùng ưu tiên hơn mô tả cũ.
- `nestjs-api/docs/prompts/baseline-review-fixes-CLAUDE-PROMPT.md`, đặc biệt §6.1 notification và §6.2 auth email xác minh/đặt password sau duyệt đã chốt.
- `nestjs-api/docs/prompts/fighter-onboarding-baseline-ANTIGRAVITY-HANDOVER.md`, mapping examination/details/SCAT6 và các giới hạn hiện hành.
- Contracts thật: `nestjs-api/src/medical/{medical.model,scat6.model,medical.constants,medical.controller,medical-assignment.controller}.ts`, `src/auth/{auth.model,auth.controller}.ts`, `src/fighter-admissions/`, `src/shared/contracts/notification.contract.ts`. Kiểm tra diff/Swagger cập nhật khi bắt đầu tích hợp, không dùng payload tự đoán.

In scope: giao diện onboarding sau activation, nhắc/phân công bác sĩ, khám baseline + nhập SCAT6 theo contract được phép, cấp clearance, đọc lại, lỗi và điều hướng. Nối các form injury/recovery còn thiếu liên quan `injuryId`. Rà màn admission hiện có và giải thích activation. [User]

Ngoài scope: AI/video/finding review, huấn luyện mô hình, tạo Training Plan/Goal mới, thay đổi auth/state machine ngoài luồng email xác minh đã chốt, tự đổi chính sách baseline chưa hoàn thành. Giữ nguyên các tính năng/quyền ngoài scope. [User]

## 2. Hành trình cần hiển thị

**Admin tạo Fighter:** tạo thành công → chờ phân công bác sĩ → chờ khám baseline → chờ clearance/không đủ điều kiện/có hạn chế/đủ điều kiện theo backend → bắt đầu tập khi được phép. [User]

**Admission:** nhập email → nhập mã OTP từ email → nộp hồ sơ không cần password → chờ HLV kiểm tra → PASS → Admin duyệt → thiết lập password một lần → kích hoạt Fighter → chờ phân công bác sĩ → khám baseline → clearance → tập. FAIL/REJECTED có trạng thái riêng, không đưa vào khám onboarding trước PASS. HLV kiểm tra đầu vào không tự trở thành HLV huấn luyện. [User xác nhận; Spec §05.1b]

Không hardcode “giai đoạn 7/8/9” như state mới trong DB. Dùng nhãn nghiệp vụ và dữ liệu admission/assignment/clinical thật. Không chờ người dùng bấm bắt đầu tập rồi mới giải thích `EXAMINATION_REQUIRED`. Hiển thị bước kế tiếp và người chịu trách nhiệm ngay trên màn hồ sơ/onboarding liên quan. [User]

- Admin: thiếu doctor assignment → action “Phân công bác sĩ”. Có assignment → hiển thị bác sĩ/bước khám tiếp theo.
- Fighter: “Đang chờ Admin phân công bác sĩ” hoặc “Đang chờ khám baseline”, theo dữ liệu được phép đọc. Không cho Fighter tự ghi kết quả khám.
- Doctor: từ danh sách Fighter được phân công, mở hồ sơ → tạo baseline → đọc lại → cấp clearance phù hợp.
- Coach: thấy tình trạng eligibility được phép, không được ghi clinical thay bác sĩ.

[User; Spec §05.10.1]

Không giả định `details:null` đồng nghĩa chưa khám với mọi người: hồ sơ cũ có cơ chế tương thích. Eligibility do backend quyết định; UI không tự suy từ điểm SCAT6 hoặc từ sự tồn tại clearance bất kỳ. Nếu contract thiếu dữ liệu cần phân biệt một trạng thái, bàn giao gap cho backend, không bịa thêm API/field. [Migration 016; backend handover]

## 3. Notification và phân công bác sĩ

Backend đã thêm notification giao bác sĩ (spec §05.12 trigger A7, migration 017). Phát sau activation hoàn tất lần đầu hoặc khi Admin tạo user FIGHTER, nếu Fighter chưa có Doctor phân công hiệu lực; gửi Admin có `fighter.doctor:assign`. Event activation cũ (A6) chỉ nhắc giao HLV; không coi nó đã giải quyết việc giao bác sĩ. [Code doctor-assignment-reminder.service.ts, notification.contract.ts]

Shape (inbox REST/SSE hiện có):

```json
{
  "type": "FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED",
  "title": "Assign a Doctor",
  "message": "A new Fighter needs an assigned Doctor for the baseline examination before training.",
  "target": { "type": "FIGHTER", "id": "<fighterId>" }
}
```

Không có `data`. Một lần mỗi Fighter (dedupe `fighter:<fighterId>:doctor-assignment-required`). `target.id` là `fighterId` (hồ sơ Fighter), không phải `userId`. Migration 017 chưa áp dụng lên DB nào; trước khi áp dụng, event này không được tạo.

FE/Mobile bổ sung hiển thị event trong inbox/bell theo cơ chế sẵn có; mở đúng Fighter và bước giao bác sĩ. Nếu client chưa có nền tảng inbox phù hợp, nêu dependency và bổ sung phần hiển thị/điều hướng tối thiểu trong phạm vi, không tạo notification giả từ UI. Nhắc một lần theo event, không tự lập timer nhắc lặp. [User]

Khi mở notification, refetch trạng thái: người khác đã phân công thì hiển thị kết quả hiện tại, không đưa lại form trống hoặc ghi assignment trùng. Kiểm tra quyền/action bằng session hiện tại; notification không cấp quyền. Không đưa bệnh án vào notification preview. [Spec §05.10.1, §05.12]

Tái sử dụng routes hiện có:

- GET `/fighters/:id/doctors`: danh sách assignment theo contract.
- POST `/fighters/:id/doctors`: chọn bác sĩ hợp lệ, gửi payload đúng DTO; không yêu cầu nhập UUID tay như một thao tác người dùng thông thường.
- GET `/doctors/:id/fighters`: roster Doctor.

[Code medical-assignment.controller.ts]

## 4. Đăng ký email xác minh, đặt mật khẩu một lần — đã chốt

Thực hiện trên cả FE và Mobile: màn bắt đầu admission chỉ nhập email → gửi xác minh theo contract backend → xác minh thành công và có session ứng viên → xem/nộp hồ sơ → HLV PASS, Admin duyệt → mở email thiết lập password → nhập/xác nhận password một lần → hoàn tất activation. Không còn yêu cầu password ở bước đăng ký admission mới; không sinh password giả phía client. [User xác nhận]

Hai email khác mục đích phải có copy rõ ràng: đầu tiên “Xác minh email để nộp hồ sơ”, sau duyệt “Thiết lập mật khẩu để kích hoạt tài khoản võ sĩ”. Nội dung email do template Supabase quyết định, không do client. Giới hạn đã biết: email thiết lập lần đầu và quên mật khẩu dùng chung template recovery, nên màn đặt mật khẩu trên client phải tự nêu đúng ngữ cảnh. Không gọi việc thiết lập lần đầu là “quên mật khẩu”. Chức năng quên mật khẩu của tài khoản đã có vẫn giữ. Sau activation hiển thị bước giao bác sĩ/khám, không báo có thể tập ngay. [User]

Chỉ hiển thị hồ sơ đã nộp sau xác minh email; trước xác minh dùng thông báo chung, không tiết lộ email có tài khoản/hồ sơ. Có hồ sơ đang mở thì dẫn tới hồ sơ đó, không tạo trùng. FAILED/REJECTED có lịch sử và hành động nộp lại theo backend. Không coi xác minh email là approval hoặc activation. [Spec §05.1b; User]

Contract backend (đã triển khai, chưa kiểm chứng trên Supabase thật). Dùng **mã số OTP**, không magic link, nên bước xác minh không có deep link/callback: [Code auth.controller.ts, auth.model.ts]

| Route | Body | Thành công | Lỗi |
| --- | --- | --- | --- |
| POST `/auth/admission/email-code` (public, 5/phút) | `{ "email" }` | 200 `data: { requested: true }`, giống nhau với mọi email | 422 `VALIDATION_ERROR`; 429 |
| POST `/auth/admission/verify-email` (public, 10/phút) | `{ "email", "token" }`, token là 6–10 chữ số | 200 `data: { user: { id, authSubject, email, role: "GUEST" }, session: { accessToken, refreshToken, expiresAt, expiresIn, tokenType } }`, cùng shape `/auth/login` | 401 `INVALID_CREDENTIALS` (mã sai/hết hạn/đã dùng, hoặc tài khoản không phải GUEST active); 409 `USER_ALREADY_EXISTS`; 502 `AUTH_PROVIDER_UNAVAILABLE`; 422; 429 |

Tiếp theo: lưu session như sau `/auth/login`, refresh qua `/auth/refresh` → `POST /fighter-admissions/applications` với bearer. Sau APPROVED: link trong email recovery → `POST /auth/reset-password { tokenHash, newPassword }` (lần đầu với tài khoản không mật khẩu; response có `admissionActivationReady`) → `POST /fighter-admissions/activation`. Gửi lại mã = gọi lại `email-code`; provider có rate limit riêng. Không dùng `/auth/register` bỏ password; route đó chỉ giữ cho client cũ. Không đưa mã/token vào log/analytics.

Giữ đăng nhập và password của tài khoản cũ; hồ sơ/activation link đang xử lý không bị ép quay về đầu. Đồng bộ transition với backend, không tự xóa password hay tạo identity mới để đạt UI “một lần”. Client không hardcode bypass `PASSWORD_SET` hoặc gọi activation sớm. [User; Code admission-activation.contract.ts]

Không mật khẩu vẫn có identity Supabase và user GUEST. Gửi email thành công chưa phải đăng nhập thành công; chỉ tải/nộp hồ sơ sau xác minh và bootstrap public user thành công theo contract backend. Ứng viên quay lại trước khi duyệt đăng nhập lại bằng hai route mã email ở trên, không bắt nhập password chưa thiết lập. Nếu xác minh trả lỗi (kể cả khi mã đã bị tiêu thụ), backend đã sign out session đó: hiển thị lỗi và cho xin mã mới, không gửi lại mã cũ, không tự tạo user mới; xác minh lại trả về cùng tài khoản. Tài khoản FIGHTER/COACH/DOCTOR/ADMIN nhận 401 qua đường mã email, cần dẫn sang đăng nhập mật khẩu. Chi tiết schema/Supabase và kiểm thử ở backend prompt §6.2.1. [Code users/auth; User luồng đã chốt]

## 5. Khám baseline — dữ liệu thật, đọc lại được

Route tạo: POST `/fighters/:id/medical-examinations`. Dùng actor/session bác sĩ, Fighter từ roster được phân công. Backend vẫn là nơi kiểm tra quyền. [Code medical.controller.ts]

Form gồm:

- Contract kết luận hiện hành: `scope`, `decision`, `examinedAt`, `reason`, `restrictions` khi phù hợp, `validUntil`, `supersedesId`/`reviewRequestIds` khi có nghiệp vụ tương ứng.
- `examinationType: BASELINE`, `vitals`, `assessments`, `recommendations`, `followUpDate`, `scat6` theo schema cuối cùng.
- Vitals: cân nặng, nhịp tim nghỉ, huyết áp tâm thu/tâm trương, nhiệt độ, SpO2, hydration, có đơn vị.
- Hạng mục khám dựa presets hiện có, bao gồm tim mạch, thần kinh, cơ-xương; từng kết quả/ghi chú. Không tự mặc định NORMAL hoặc coi trường chưa nhập là đã khám.

[User; Code medical.model.ts; nextjs-frontend/src/components/medical/examination-presets.ts]

Mapping rõ enum: UI web hiện có loại khám chữ thường; backend dùng uppercase. Không gửi `baseline` thay `BASELINE`, `normal` thay `NORMAL` hoặc `good` thay `GOOD`. Tái sử dụng mapper/service layer, không rải mapping trong nhiều màn. [Code medical.model.ts; nextjs-frontend/src/lib/domain/types.ts]

SCAT6 dùng schema backend và bảng đối chiếu trong handover; giữ đúng formVersion, performed/not-performed, trial/list/timing và câu trả lời gốc. Điểm authoritative lấy từ server; không cho sửa tổng điểm và không tự suy clearance. Lỗi field hiển thị tại section tương ứng, giữ dữ liệu người dùng đã nhập. [User; Code scat6.model.ts, scat6.scoring.ts]

Giao diện thao tác tiếng Việt; nội dung đánh giá chuẩn tiếng Anh. Backend hiện lưu dữ liệu theo vị trí trên form giấy. Full nội dung câu hỏi/word lists chưa được nhúng khi thiếu quyền số hóa theo nguồn BJSM/CISG; không thay bằng bộ câu hỏi tự sáng tác, không gọi màn nhập kết quả là đã hoàn tất full SCAT6 số hóa. Bàn giao rõ dependency này. [User; backend handover]

Giữ draft trong phiên form, không POST examination rỗng rồi lưu dần từng section. Gửi một payload hợp lệ; pending chặn double-submit. Khi timeout chưa rõ kết quả, đọc lại dữ liệu trước khi gửi lại để tránh nhân đôi. Không lưu bệnh án vào log/analytics hoặc browser storage không có thiết kế được duyệt. [User feedback; Spec §05.10.1]

Đọc lại qua GET `/fighters/:id/medical-examinations`, `/fighters/:id/medical`, `/fighters/:id/medical/history`. Hiển thị `details`, điểm và version, dữ liệu thiếu/legacy rõ ràng. Nếu history dùng shape khác dossier, dùng mapper riêng theo contract thực tế; không cast chung rồi bỏ mất fields. `MIGRATION_BASELINE` là snapshot migration, không phải lần khám baseline. [Code medical.repo.ts; Migration 011,016]

## 6. Clearance, injury và recovery

Khám và cấp clearance là hai thao tác. Sau khám thành công, giữ examinationId trả về và đọc lại kết luận trước khi cấp giấy. POST `/fighters/:id/medical-clearances` dùng examination thật/cùng Fighter/current, clearanceType đúng enum. Cấp giấy lỗi không xóa hay tạo lại examination; chỉ retry bước cấp giấy. [Code medical.model.ts, medical.service.ts]

`restrictions` thuộc examination có `ELIGIBLE_WITH_RESTRICTIONS`; `examinationId` thuộc cấp clearance; `injuryId` thuộc recovery plan hoặc path treatment. Không bắt cả ba trường ở mọi form và không tạo injury giả cho baseline. Không gửi `{}`/array rỗng để vượt validation. [User feedback; Code medical.model.ts]

Recovery: chọn injury thật của Fighter, gửi `injuryId`, `title`, `startDate` và milestones đúng DTO. Khi chưa có injury, hiển thị hướng dẫn tạo injury hợp lệ, không tự tạo record nền. Giữ quy tắc kế thừa/hạn chế clearance của backend. [Code medical.model.ts]

Thêm `EXAMINATION_REQUIRED` vào types/parsers/i18n; không âm thầm lọc bỏ lý do. UI giải thích cần hoàn tất khám baseline hoặc kết luận TRAINING phù hợp theo trạng thái trả về, tránh kết luận mọi hồ sơ cũ phải khám lại. Không xem `eligible:false,reasons:[]` là đủ điều kiện nếu gặp backend cũ chưa sửa. [Backend review; User]

## 7. Phần dành cho FE Web

Khảo sát và tái sử dụng:

- `src/lib/domain/medical-bodies.ts`, `medical-contract.ts`, `medical-mappings.ts`.
- `src/lib/services/medical.api.ts`, `medical-features.ts`; tách rõ demo/API, không fallback demo che lỗi server.
- `src/components/medical/examination-decision-form.tsx`, `examination-form.tsx`, `examination-presets.ts`, `issue-clearance-form.tsx`, các trang Doctor tương ứng.
- `src/lib/services/notifications.ts`, bell/inbox, notification metadata/actions hiện có.

Hoàn thiện form baseline API mode và màn đọc lại; mapping `details` không còn bị bỏ qua. Bổ sung task phân công bác sĩ trong UI Admin hiện hữu; deep link notification mở đúng hồ sơ. Giữ route/layout/auth conventions theo phiên bản Next.js của repo. [User; các file trên]

## 8. Phần dành cho Mobile

Khảo sát và tái sử dụng:

- `src/api/medical.ts`, `src/api/admissions.ts`, `src/api/errors.ts`.
- `src/app/(doctor)/examinations/`, `clearance/`, `injuries/`, `recovery/`; dossier/history screens.
- `src/screens/admissions/staff-detail.tsx`, applicant screens; `src/i18n/blocked.ts`; `src/components/medical/`.

Thay DisabledForm/blocked page của các thao tác clinical trong phạm vi bằng form thật, API mutations và màn đọc lại. Chỉ gỡ blocked copy khi tính năng đã nối xong; các màn AI giữ nguyên. Form dài chia section, cuộn đến lỗi, không làm mất câu trả lời khi bàn phím/điều hướng thay đổi. [User; các file trên]

Màn HLV đầu vào hiển thị hồ sơ được phép, tiêu chí và PASS/FAIL qua admission API, không cần job/finding. Màn Admin chọn coach/doctor thật theo quyền, action đúng state. Trạng thái sau activation chỉ rõ bước giao bác sĩ/khám thay vì kết thúc ở thông báo kích hoạt thành công. [User; Spec §05.1b]

## 9. Bàn giao và nghiệm thu

Claude FE/Mobile mỗi nền tảng tự review và bàn giao: Summary of Changes, Self-Review Notes, Expectations & Test Criteria; route/file đổi, contract đã dùng, dependencies còn thiếu, việc chưa kiểm chứng. Không nhận backend đã có API là bằng chứng giao diện dùng được. Không sửa production backend từ lượt client; gửi gap cụ thể cho Claude backend. [User; pipeline]

Các tình huống cần bàn giao cho Antigravity, chỉ viết/chạy test khi được giao phạm vi đó:

- Cả hai nhánh tạo Fighter hiển thị bước tiếp theo; đúng Admin nhận và mở notification; assignment đã có không bị ghi trùng.
- Doctor được assign tạo baseline, xem lại vitals/assessments/SCAT6/điểm; Doctor khác/Admin không ghi thay được.
- Restricted thiếu dữ liệu có lỗi field; không lưu dở; double-submit/timeout không nhân đôi.
- Examination thành công nhưng clearance thất bại: hồ sơ vẫn còn, retry đúng bước; injury/recovery không dùng ID Fighter khác.
- Không đủ điều kiện tập hiển thị lý do trước thao tác; 409 vẫn được xử lý khi dữ liệu thay đổi sau khi tải màn.
- Hồ sơ cũ không details vẫn đọc được; record có partial/not-performed không bị hiển thị thành bình thường hoặc hoàn tất toàn bộ.
- Admission PASS/FAIL/activation action đúng state; thông tin của applicant không lộ staff notes.
- Admission mới không nhập password trước duyệt; hai email có mục đích rõ; verification không tự kích hoạt Fighter; sau duyệt đặt password một lần. Callback hết hạn/đã dùng/resend và hồ sơ/tài khoản legacy được xử lý đúng contract.
- Cả web và mobile gọi API thật, không demo; không có kết luận test pass nếu chưa thực thi.

[User; backend contracts; Rules testing-quality.md]

Auth email xác minh/đặt mật khẩu sau duyệt đã được chốt và contract backend đã có (§3, §4); chưa kiểm chứng trên Supabase sandbox và migration 017 chưa áp dụng, nên kiểm thử tích hợp phải ghi rõ môi trường. Điểm còn mở: ngoại lệ SCAT6 chưa thực hiện và quyền nhúng full nội dung SCAT6. Các điểm này không chặn notification, assignment, auth và form clinical độc lập; không tự biến thành chính sách đã được duyệt.
