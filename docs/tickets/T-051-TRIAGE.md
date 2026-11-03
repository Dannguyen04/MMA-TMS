# T-051 · Phân loại (Claude, 2/11)

- Nguồn: [T-051](./T-051-mobile-backend-gaps-and-known-issues.md), bản nháp Fon viết ngày 31/10. Mục A và B đã xong, không xét lại.
- Đối chiếu trên `fight-camp` `66c0887` (đã có app mobile của PR #29 trong `reactnative-mobile/`). Migration 023–032 đã áp lên Supabase. Không kết nối database.
- Lệnh đã chạy: `npx tsc --noEmit` trong `reactnative-mobile` cho **41 lỗi** (T-051 ghi 40; lỗi mới là `src/app/_layout.tsx:1` `TS2882`, không tìm thấy `../../global.css`). `npx jest src/api/role-contracts.test.ts src/screens/media/video-upload.test.tsx` cho 2 bài lỗi, 3 bài qua (đúng S1 và S2).
- Trạng thái mỗi mục: **còn đúng** (thiếu thật, phải làm hoặc phải quyết), **đã xong** (code đã có), **sai** (code đã trả lời được câu hỏi hoặc mô tả không đúng code), **không rõ**.
- Cỡ việc: **nhỏ** (một endpoint hoặc một trường, không migration), **vừa** (nhiều file, không migration), **lớn** (có migration hoặc module mới).
- Các màn demo ngày 10/11 trên điện thoại: góc đài của HLV (nhập hiệp và AI dặn giữa hiệp, T-037 B, T-038 B2), báo cáo sau trận (T-041), đình chỉ của võ sĩ (T-048), ghi cân và ăn uống (T-005, T-009 B2), tải video lên.

## Tổng hợp

| Mục | Trạng thái | Việc còn lại | Cỡ | Migration | Chặn demo | Người đề xuất | Nhóm |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C | sai (đã có quy tắc c) | Chủ dự án chốt giữ (c), ghi vào contract | — | Không | Không | Claude ghi tài liệu | Trước 6/11 |
| D | còn đúng (quy ước) | Ghi quy ước báo mã lỗi mới; module `coaching` ném lỗi không có `code` riêng | nhỏ (tài liệu); vừa (coaching) | Không | Không | Claude (tài liệu); Codex (coaching) | Nên có (tài liệu); sau 10/11 (coaching) |
| E | sai một phần (câu 1 và 3 đã trả lời được từ code) | Tách mã lỗi riêng cho AI (tuỳ chọn) | nhỏ | Không | Không | Codex | Sau 10/11 |
| F | sai (đã trả lời được từ code) | Chủ dự án xác nhận danh sách giữ nguyên đến 10/11 | — | Không | Không | Dan trả lời | Trước 6/11 |
| G | sai (danh sách định dạng đã có trong code); câu tiếng Việt của mobile còn sai | Sửa câu lỗi trên mobile | nhỏ | Không | Có, nhẹ (tải video) | Fon | Nên có |
| H | còn đúng | Mobile thêm câu tiếng Việt cho các mã còn thiếu, quan trọng nhất là `TRAINING_SUSPENSION_ACTIVE` | nhỏ | Không | **Có** (đình chỉ chặn buổi tập) | Fon | **Trước 6/11** |
| I | sai một phần (đã có lần Gemini trả lời thật ngày 29/10) | Đặt model và hạn mức Gemini cho `.env` demo, gọi thử một lần ở API mode | nhỏ (cấu hình) | Không | **Có** (AI dặn giữa hiệp) | Dan | **Trước 6/11** |
| J | đã xong | — | — | — | — | — | — |
| J1 | còn đúng (mâu thuẫn trong T-048) | Sửa T-048 dòng 37 theo phương án A; bộ lọc mới ở server để sau | nhỏ (tài liệu); nhỏ (bộ lọc) | Không | Không (mobile đã làm A) | Claude (tài liệu); Ken (bộ lọc, sau) | Trước 6/11 (tài liệu); sau 10/11 (bộ lọc) |
| J2 | đã xong (không cần sửa) | — | — | — | — | — | — |
| K | còn đúng | Chờ T-047 có contract | lớn (T-047) | Có thể | Không | Dan (Codex) | Sau 10/11 |
| L | còn đúng (câu hỏi) | Chủ dự án quyết; đề xuất giữ cách A | nhỏ nếu đổi | Không | Không | Dan quyết | Sau 10/11 |
| M | còn đúng | Bỏ `nextRoundPlan` khỏi dữ liệu băm | nhỏ | Không | Không | Codex (gói AI) | Sau 10/11 |
| N | còn đúng | Kiểm `decision` khớp `acceptedItemIds`, sai trả 422 | nhỏ | Không | Không | Codex (gói AI) | Sau 10/11 |
| O | còn đúng (câu hỏi) | Đề xuất server chặn quyết định trên dòng `FAILED` | nhỏ | Không | Không | Codex (gói AI) | Sau 10/11 |
| P | sai (câu 2 đã trả lời được từ code) | Không | — | — | — | — | — |
| Q | còn đúng | Hạn chế gọi lại Gemini sau lỗi | nhỏ đến vừa | Không | Chỉ khi dùng gói miễn phí | Codex (gói AI) | Sau 10/11 (xem I) |
| R | còn đúng | Thêm `?roundNo=` cho lịch sử gợi ý | nhỏ | Không | Không | Codex (gói AI) | Sau 10/11 |
| S1 | còn đúng | Sửa bài test cũ | nhỏ | — | Không | Fon | Nên có |
| S2 | còn đúng | Sửa bài test theo cách (a) | nhỏ | — | Không | Fon | Nên có |
| S3 | không rõ (lúc lỗi lúc qua) | Chạy `--runInBand` để tái hiện | nhỏ | — | Không | Fon | Sau 10/11 |
| S4 | còn đúng, **ghi chú của T-051 đã cũ** | Chủ dự án quyết giữ hay xoá `components/launch`, `components/auth` | vừa | — | Không | Dan quyết, Fon làm | Sau 10/11 |
| S5 | đã xong | — | — | — | — | — | — |
| T1 | sai (đã trả lời được từ code) | Tuỳ chọn: ghi đơn vị vào schema | nhỏ | Không | Không | Codex (gói AI, nếu tiện) | Sau 10/11 |
| T2 | sai (đã trả lời được từ code) | Không; trên mobile bác sĩ không vào được màn này | — | — | — | — | — |
| U (ngoài phạm vi C–T) | phần lớn mobile đã tự xử lý | U2-b: bỏ hậu tố `" (Reanalysis)"` | nhỏ | Không | Có, nhẹ (danh sách video) | Ken | Nên có |

Đếm mục C–T (25 dòng, tính cả mục con): còn đúng 13 (D, H, J1, K, L, M, N, O, Q, R, S1, S2, S4), sai hoặc sai một phần 8 (C, E, F, G, I, P, T1, T2), đã xong 3 (J, J2, S5), không rõ 1 (S3). G và I vẫn còn việc dù được xếp vào nhóm "sai".

## Chi tiết từng mục

### C. Cân hằng ngày

| | |
| --- | --- |
| Trạng thái | **Sai.** Server đã làm theo phương án (c) |
| Căn cứ | `fighter_measurements` vẫn không có ràng buộc theo ngày (`003_mma_tms_complete_schema.sql:876-877`), `createMeasurement` không kiểm ngày (`fighters.service.ts:193`). Nhưng `GET /bouts/:id/weight-track` đã trả **một điểm mỗi ngày học viện**, lấy số đo mới nhất (`bouts.model.ts:335-356` `buildDailyWeightPoints`, so `measuredAt` rồi `createdAt`), và bỏ số đo đã bị thay (`bouts.repo.ts` `findWeightMeasurements`, `not exists ... supersedes_id`). Đã có test: `bouts.service.spec.ts:1332` "keeps one point per academy day: 66.0 then 65.4 on the same day…" và `bouts.model.spec.ts:227-266` |
| Việc còn lại | Chủ dự án chốt giữ (c). Claude ghi câu "mỗi ngày một điểm, lấy số mới nhất trong ngày theo giờ học viện" vào tech spec. Mobile giữ nguyên cách đang làm |
| Cỡ / migration / chặn demo | Không có việc code / không / không |

### D. Mã lỗi

| | |
| --- | --- |
| Trạng thái | **Còn đúng**, nhưng đây là quy ước làm việc, không phải lỗi |
| Căn cứ | Bộ lọc chung `shared/filters/api-exception.filter.ts:96-101` luôn trả `code`. Lỗi không có `code` riêng thì nhận `VALIDATION_ERROR` hoặc mã mặc định theo HTTP status. Các module bouts, suspensions, training, medical, fighters, videos đều có `code` riêng. Riêng `coaching` (`coaching.controller.ts` 28 chỗ, `coaching.service.ts` 25 chỗ, `movement-review.service.ts` 12 chỗ) ném `ForbiddenException('...')` không có `code`, nên mobile chỉ hiện được câu chung theo status |
| Việc còn lại | (1) Claude thêm vào mẫu handover ở `TEAM-WORKFLOW.md` §6 một dòng "Mã lỗi hoặc enum mới hay đổi tên" để người thực hiện báo mobile. (2) Gắn `code` cho lỗi của `coaching`: để sau 10/11 |
| Cỡ / migration / chặn demo | Nhỏ (tài liệu); vừa (coaching) / không / không |
| Đụng file | `coaching.*`: không trùng với gói AI của bouts |

### E. `BOUT_ROUND_OUT_OF_RANGE` khi gọi AI dặn giữa hiệp

| | |
| --- | --- |
| Trạng thái | **Sai một phần.** Câu 1 và 3 trả lời được từ code; câu 2 là đề xuất |
| Căn cứ | `bouts.service.ts:164-167`: `roundNo` phải ≥ 2, ≤ `scheduledRounds` và đúng bằng hiệp đã lưu cuối cùng + 1. Vậy (1) `roundNo` là hiệp **sắp đánh**; (3) gọi cho hiệp cuối + 1 vướng `roundNo > scheduledRounds` nên trả `BOUT_ROUND_OUT_OF_RANGE`. `PUT /bouts/:id/rounds/:n` dùng cùng mã đó (`bouts.service.ts:562-567`) |
| Việc còn lại | Câu 2 (tách mã `BOUT_AI_ROUND_NOT_READY`): tuỳ chọn. Mobile đã ẩn nút đúng theo điều kiện server, nên trong demo không gặp mã này |
| Cỡ / migration / chặn demo | Nhỏ / không / không |
| Đụng file | `bouts.service.ts`, `bouts.error.ts`, mobile `backend-codes.ts` |

### F. `result.method` và kết quả trận

| | |
| --- | --- |
| Trạng thái | **Sai.** Đã trả lời được từ code |
| Căn cứ | `bouts.model.ts:1013-1023`: `BOUT_RESULTS` và `BOUT_METHODS` đúng như bảng của mobile. Không tách `DECISION`. `recordResultSchema` (`bouts.model.ts:1028-1041`) không có ghi chú riêng cho `OTHER`, chỉ có `notes` chung của trận (tối đa 2000 ký tự) và `injuryNote`. `GET /bouts/:id/report` trả `result`, `method`, `resultRound` nhưng không trả `notes` (`bouts.service.ts:646-676`). Trận gắn với một `fighterId` của học viện và `opponentName`, nên `WIN`/`LOSS` tính theo võ sĩ của học viện |
| Việc còn lại | Dan xác nhận không đổi enum trước 10/11 |
| Cỡ / migration / chặn demo | Không có việc code / không / không |

### G. Định dạng video

| | |
| --- | --- |
| Trạng thái | **Sai** ở câu hỏi (code đã trả lời được); **còn đúng** ở câu tiếng Việt của mobile |
| Căn cứ | `videos.service.ts:23-27`: kiểm theo **MIME** của header `Content-Type`, nhận `video/mp4`, `video/quicktime`, `video/webm`. `VIDEO_TOO_LARGE` (413) so `Content-Length` với `VIDEO_MAX_SIZE_MB`, mặc định 500 MB (`videos.service.ts:41`, `.env.example:20`). `VIDEO_STORAGE_FILE_TOO_LARGE` (413) là khi Supabase Storage từ chối vì vượt giới hạn của project (`videos.service.ts:285-299`); giới hạn này đặt trong Supabase, không có trong code. Mobile: `src/i18n/backend-codes.ts:55` ghi "Chọn tệp MP4 hoặc MOV.", còn `src/i18n/media.ts:40` ghi "MP4, MOV hoặc WebM" |
| Việc còn lại | Fon sửa câu ở `backend-codes.ts:55` cho khớp `media.ts:40`. Dan đọc giới hạn dung lượng file trong Supabase Storage rồi báo Fon, để câu của `VIDEO_STORAGE_FILE_TOO_LARGE` có số cụ thể |
| Cỡ / migration / chặn demo | Nhỏ / không / có, nhẹ: video quay bằng điện thoại thường vượt giới hạn mặc định của Supabase |
| Đụng file | Mobile `backend-codes.ts`: trùng với H |

### H. Danh sách mã lỗi mobile đang dịch

| | |
| --- | --- |
| Trạng thái | **Còn đúng.** Có mã mà HLV hoặc võ sĩ sẽ gặp trên điện thoại nhưng mobile chưa dịch |
| Căn cứ | Mã `BOUT_*` của backend và mobile khớp nhau, không thiếu mã nào. Các mã còn thiếu trên mobile (grep cả `reactnative-mobile/src`): `TRAINING_SUSPENSION_ACTIVE` (409, `training.error.ts:164-174`, kèm `details.suspensions`; ném khi tạo hoặc chuyển trạng thái buổi tập ở `training-session.service.ts:441`, `:472`, và khi tải video huấn luyện ở `coaching.service.ts:216`; mobile gọi cả hai đường: `api/training.ts`, `api/one-tap.ts:41`), `MEASUREMENT_CONTEXT_FORBIDDEN`, `MEASUREMENT_ALREADY_SUPERSEDED` (ghi cân), `FIGHTER_INACTIVE`. Đã có: `SESSION_TYPE_RESTRICTED`, `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED`, `REVIEW_REQUEST_PENDING`, `INVALID_SESSION_STATUS_TRANSITION` (`api/errors.ts`, `session/map-api-message.ts`) |
| Việc còn lại | Fon thêm câu tiếng Việt cho 4 mã trên. Riêng `TRAINING_SUSPENSION_ACTIVE` nên ghi rõ đình chỉ nào chặn buổi (từ `details.suspensions`), vì đây là ý chính của màn đình chỉ khi demo |
| Cỡ / migration / chặn demo | Nhỏ / không / **có**: khi demo đình chỉ, HLV xếp buổi đấu tập cho võ sĩ đang bị đình chỉ thì app chỉ hiện câu chung của lỗi 409 |
| Đụng file | Mobile `backend-codes.ts` (trùng với G, E), có thể cả `api/errors.ts` |

### I. Gemini thật

| | |
| --- | --- |
| Trạng thái | **Sai một phần.** "Chưa từng trả lời thật" không còn đúng |
| Căn cứ | `T-038-REVIEW.md:27-36`: ngày 29/10, với `GEMINI_BOUT_MODEL=gemini-3.5-flash`, `BETWEEN_ROUNDS` trả 3 lời dặn sau 6996 ms. Model mặc định `gemini-3.8-flash` (`bout-ai.client.ts:178`) bị 429; gói miễn phí chỉ có 20 request mỗi ngày cho mỗi model. Thiếu key thì trả `FAILED` + `NOT_CONFIGURED` (`bout-ai.client.ts:189-190`). Thời gian chờ phía server lấy theo `BOUT_AI_TIMEOUTS[kind]`: 12 giây cho `BETWEEN_ROUNDS`, 240 giây cho `VIDEO_OBSERVATIONS` (`bout-ai.client.ts:5-9`). Không có chế độ trả gợi ý mẫu ở server |
| Việc còn lại | Dan đặt `GEMINI_BOUT_MODEL` bằng một model còn hạn mức (hoặc bật billing) trong `.env` của backend dùng cho demo, rồi gọi thử `POST /bouts/:id/ai/round-advice/2` một lần ở API mode trước 6/11. Nếu dùng gói miễn phí thì tổng duyệt 9/11 và review 10/11 nên dùng hai key ở hai project khác nhau, vì mỗi lần HLV bấm "AI dặn" mất một lượt |
| Cỡ / migration / chặn demo | Cấu hình, không có code / không / **có**: màn AI dặn giữa hiệp |

### J, J1, J2. Đình chỉ

| | |
| --- | --- |
| J | **Đã xong.** Mobile trên `fight-camp` đã có `maxAllowedTier`, `gradedReturn` (`reactnative-mobile/src/api/fight-camp.ts:87-89`) và `PENDING` (`api/types.ts:151`, `api/one-tap.types.ts:59`). Thẻ đình chỉ dùng `allowedTodayLine` (`screens/fight-camp/camp-suspension.tsx:16`), không còn dựa vào `maxAllowedTier` |
| J1 | **Còn đúng.** `suspensions.repo.ts:379-389` vẫn như mô tả. Mobile đã làm phương án A: không lọc `active`, chọn trên máy (`camp-rules.ts:85-94`). Riêng T-048 dòng 37 vẫn ghi `listSuspensions({ active: true }, actor)`. Web cũng dùng `active: true` (`coach/sessions/[sessionId]/page.tsx:73`, `lib/domain/bout-rules.ts:292`), nên **không** nên đổi nghĩa `active=true`. Đề xuất: Claude sửa T-048 dòng 37 theo phương án A ngay (tài liệu). Nếu sau này cần thì thêm bộ lọc mới `current=true` (Ken, nhỏ, sau 10/11) |
| J2 | **Đã xong**, không cần sửa |
| Đụng file | Bộ lọc mới: `suspensions.repo.ts`, `suspensions.model.ts`, `suspensions.controller.ts`. Không trùng với gói AI |

### K. T-047

| | |
| --- | --- |
| Trạng thái | **Còn đúng.** T-047 vẫn DRAFT 29/10, chưa có nhánh |
| Căn cứ | `VIDEO_OBSERVATIONS` là loại đã có từ T-038 A: `POST /bouts/:id/ai/video-observations` (`bouts.controller.ts:390`), AI xem video đối thủ **trước trận** để gợi ý quan sát (tối đa 6 mục, `bouts.service.ts:232`). T-047 (xem video từng hiệp sau trận) chưa chốt là dùng lại loại này hay thêm loại mới |
| Việc còn lại | Khi viết T-047 thì trả lời câu của Fon trong phần contract |
| Cỡ / migration / chặn demo | Lớn / có thể có / không (T-047 không có trong demo 10/11) |
| Đụng file | `bouts.service.ts`, `bout-ai.client.ts`, `bout-analysis.model.ts`: trùng với gói AI |

### L. Sửa quyết định của HLV với gợi ý AI

| | |
| --- | --- |
| Trạng thái | **Còn đúng** (câu hỏi) |
| Căn cứ | `bouts.service.ts:269`: đã có `decision` thì trả `BOUT_AI_ALREADY_DECIDED` |
| Đề xuất | Giữ cách A đến sau 10/11: quyết định đầu tiên là dữ liệu thống kê "HLV có dùng gợi ý AI không", cho ghi đè sẽ làm số liệu đó lệch. Nếu chủ dự án muốn cho sửa thì chỉ giữ bản mới nhất, cộng thêm `decidedAt` |
| Cỡ / migration / chặn demo | Nhỏ / không (cột đã có) / không |
| Đụng file | `bouts.service.ts`, `bouts.repo.ts` |

### M. Mã băm cache có `nextRoundPlan`

| | |
| --- | --- |
| Trạng thái | **Còn đúng** |
| Căn cứ | `bouts.service.ts:205-206` đưa mọi khoá của `roundInputSchema` của từng hiệp vào `input`, gồm `nextRoundPlan`; hash tính ở `:216` |
| Việc còn lại | Bỏ `nextRoundPlan` khỏi dữ liệu gửi AI và dữ liệu băm (kiểm trước xem prompt có cần trường này không). Mobile đã tránh được trường hợp này |
| Cỡ / migration / chặn demo | Nhỏ / không / không |
| Đụng file | `bouts.service.ts` (`generateAiSuggestion`) |

### N. `decision` và `acceptedItemIds`

| | |
| --- | --- |
| Trạng thái | **Còn đúng** |
| Căn cứ | `bout-analysis.model.ts:13-16` chỉ kiểm id không trùng; `bouts.service.ts:270-272` chỉ kiểm id có trong danh sách |
| Việc còn lại | Kiểm `ACCEPTED` = đủ mọi id, `PARTIAL` = có ít nhất một id nhưng chưa đủ, `REJECTED` = `[]`; sai thì 422 `VALIDATION_ERROR`. Cần lưu ý lời dặn bị mobile ẩn vì dài quá 140 ký tự: không còn xảy ra vì server đã bỏ lời dặn dài hơn 120 ký tự (mục B) |
| Cỡ / migration / chặn demo | Nhỏ / không / không |
| Đụng file | `bouts.service.ts` (`decideAiSuggestion`), `bout-analysis.model.ts` |

### O. Quyết định trên gợi ý `FAILED`

| | |
| --- | --- |
| Trạng thái | **Còn đúng** (câu hỏi) |
| Căn cứ | `decideAiSuggestion` không kiểm `row.status` |
| Đề xuất | Server trả 409 cho quyết định trên dòng `FAILED` (gợi ý không có gì để chọn). Mobile giữ nguyên: không gửi |
| Cỡ / migration / chặn demo | Nhỏ (có thể dùng lại một mã có sẵn hoặc thêm một mã mới, nếu thêm thì báo Fon) / không / không |
| Đụng file | `bouts.service.ts`, `bouts.error.ts` |

### P. `tacticId` trong lời dặn AI

| | |
| --- | --- |
| Trạng thái | **Sai.** Câu 2 đã có câu trả lời trong code |
| Căn cứ | `PUT /bouts/:id/rounds/:n` đã kiểm `tacticId` của mọi lời dặn trong `nextRoundPlan.instructions` phải thuộc chiến thuật của trận, gồm chiến thuật thêm ở các hiệp trước và trong chính kế hoạch đó. Sai thì trả `BOUT_ROUND_MARK_UNKNOWN` (`bouts.service.ts:568-604`, đoạn `planTactics`). `CUSTOM` được phép có `tacticId` (`bout-analysis.model.ts:129-137`) |
| Việc còn lại | Không. Câu 1 là lựa chọn của mobile: bỏ `tacticId` như đang làm là an toàn. Nếu T-041 cần nối lời dặn với chiến thuật thì giữ `tacticId`, server đã kiểm |

### Q. Không cache kết quả lỗi

| | |
| --- | --- |
| Trạng thái | **Còn đúng** |
| Căn cứ | `findAiCache` lọc `status = 'OK'` (`bouts.repo.ts:436`) |
| Việc còn lại | Cache `FAILED` với `QUOTA`/`UPSTREAM` trong vài phút. Mobile không có nút thử lại và không tự gọi lại, nên trong demo rủi ro thấp |
| Cỡ / migration / chặn demo | Nhỏ đến vừa / không (bảng đã có `created_at`) / chỉ khi demo dùng gói miễn phí (xem I) |
| Đụng file | `bouts.repo.ts`, `bouts.service.ts` |

### R. Lịch sử gợi ý 20 dòng

| | |
| --- | --- |
| Trạng thái | **Còn đúng** |
| Căn cứ | `aiHistoryQuerySchema` chỉ có `kind` (`bout-analysis.model.ts:18`); `listAiSuggestions` `.limit(20)` (`bouts.repo.ts:450`); endpoint ở `bouts.controller.ts:405` (T-051 ghi `:400`) |
| Việc còn lại | Thêm `roundNo` vào query. Với trận demo 3 đến 5 hiệp thì 20 dòng là đủ |
| Cỡ / migration / chặn demo | Nhỏ / không (có thể thêm chỉ mục sau) / không |
| Đụng file | `bout-analysis.model.ts`, `bouts.repo.ts`, `bouts.service.ts`, `bouts.controller.ts` |

### S. Lỗi đã biết phía mobile

| | |
| --- | --- |
| S1 | **Còn đúng.** `role-contracts.test.ts:19` chờ `false`, `role-contracts.ts:22` trả `ADMIN || FIGHTER`. Chạy lại: lỗi. Fon sửa, nhỏ |
| S2 | **Còn đúng.** Chạy lại `video-upload.test.tsx`: lỗi. Fon sửa theo cách (a), nhỏ |
| S3 | **Không rõ.** Chưa chạy toàn bộ jest lại. Fon chạy `--runInBand` |
| S4 | **Còn đúng, nhưng ghi chú cho chủ dự án đã cũ.** PR #29 đã đưa `src/components/launch` và `src/components/auth` trở lại `fight-camp`, nên 26 lỗi đó **không** tự hết khi gộp nhánh. tsc hiện có 41 lỗi: launch 19, auth 8, test dùng API của Node 12, theme 1, cùng một lỗi mới `src/app/_layout.tsx:1` (`global.css` thiếu khai báo kiểu, có từ commit font của PR #29). Chủ dự án chọn giữ hay xoá hai thư mục; lỗi `global.css` sửa nhỏ (thêm khai báo `declare module "*.css"`) |
| S5 | **Đã xong** |

### T. Báo cáo sau trận

| | |
| --- | --- |
| T1 | **Sai.** `lossPct` là phần trăm: `bouts.model.ts:824-826` nhân 100 rồi làm tròn 1 chữ số; `limitPct` lấy từ cột `acute_loss_limit_pct_*` `numeric(4,1)`, mặc định 8,0 và 5,0 (`024_bouts.sql:80-81`). Mobile đang hiện đúng. Ghi đơn vị vào schema: tuỳ chọn |
| T2 | **Sai.** Đã trả lời được từ code: (1) bác sĩ chỉ xem (`bout:result` = ADMIN, COACH; `024_bouts.sql:317`); (2) `assertWriteAccess` (`bouts.service.ts:2107-2115`): ADMIN sửa được mọi trận, COACH chỉ trận của võ sĩ mình được phân công. Trên mobile, `ReportScreen` chỉ mở từ màn trận của HLV (`coach-camp-screen.tsx:188`), bác sĩ không vào được, nên không phải ẩn nút. (3) Không có kế hoạch đổi |

### U. Phase 5 (ngoài phạm vi C–T, ghi để đủ)

| | |
| --- | --- |
| U1 | Mobile đã sửa (`allowedTodayLine`). U1-a (cho `maxAllowedTier` theo `gradedReturn.ceiling`) và U1-b (ràng buộc danh sách chặn phải liền bậc): sau 10/11, Ken, sửa ở `suspensions.model.ts` và `suspensions.service.ts` |
| U2 | U2-a: mobile đã dịch theo mẫu ở `src/i18n/server-text.ts`, không cần backend gấp. U2-b: `coaching.service.ts:399` vẫn nối `" (Reanalysis)"`; nên bỏ hậu tố trước 10/11 (nhỏ, Ken), để danh sách video không hiện chữ tiếng Anh khi demo phân tích lại. U2-c: chỉ ghi để biết |

## Ba nhóm

### Phải xong trước 6/11 (trước khi kiểm API mode)

| Mục | Việc | Người |
| --- | --- | --- |
| I | Đặt model và hạn mức Gemini cho backend demo, gọi thử AI dặn giữa hiệp một lần | Dan |
| H | Thêm câu tiếng Việt cho `TRAINING_SUSPENSION_ACTIVE` (kèm tên đình chỉ), `MEASUREMENT_CONTEXT_FORBIDDEN`, `MEASUREMENT_ALREADY_SUPERSEDED`, `FIGHTER_INACTIVE` | Fon |
| J1 | Sửa T-048 dòng 37 theo phương án A | Claude (tài liệu) |
| C, F | Chủ dự án chốt: cân theo (c), enum kết quả không đổi đến 10/11; Claude ghi vào tech spec | Dan quyết, Claude ghi |

### Nên có trước 10/11

| Mục | Việc | Người |
| --- | --- | --- |
| G | Sửa câu `VIDEO_FORMAT_UNSUPPORTED`; Dan báo giới hạn dung lượng của Supabase Storage | Fon, Dan |
| U2-b | Bỏ hậu tố `" (Reanalysis)"` ở `coaching.service.ts:399` (kiểm web có dựa vào hậu tố này không) | Ken |
| S1, S2, lỗi tsc `global.css` | Sửa test cũ và khai báo kiểu CSS | Fon |
| D (tài liệu) | Thêm dòng "mã lỗi hoặc enum mới" vào mẫu handover | Claude |

### Sau 10/11

| Mục | Việc | Người |
| --- | --- | --- |
| Gói AI của bouts: N, O, M, R, Q, E (và L nếu chủ dự án cho sửa) | Một ticket chung, một nhánh, vì cùng sửa `bouts.service.ts` | Codex |
| T1 | Ghi đơn vị vào schema, làm chung gói AI | Codex |
| J1 (bộ lọc mới) | `current=true` cho `GET /suspensions`, nếu vẫn cần | Ken |
| U1-a, U1-b | `maxAllowedTier` khi tập lại theo bậc; ràng buộc liền bậc | Ken |
| D (coaching) | Gắn `code` cho 65 chỗ ném lỗi trong `coaching` | Codex |
| K | Contract T-047 | Dan (Codex) |
| S3, S4 | Test lúc lỗi lúc qua; giữ hay xoá `launch`, `auth` | Fon (S4 sau khi Dan quyết) |

## Kế hoạch chạy song song

Các nhóm file không trùng nhau:

| Luồng | File chạm | Mục |
| --- | --- | --- |
| Mobile (Fon) | `reactnative-mobile/src/i18n/backend-codes.ts`, `src/api/errors.ts`, `src/api/role-contracts.test.ts`, `src/screens/media/video-upload.test.tsx`, một file khai báo kiểu | H, G, S1, S2, `global.css` |
| Backend coaching (Ken) | `nestjs-api/src/coaching/coaching.service.ts` | U2-b |
| Tài liệu (Claude) | `docs/tickets/T-048-*.md`, `docs/FIGHT-CAMP-TECH-SPEC.md`, `docs/TEAM-WORKFLOW.md` | J1, C, F, D |
| Cấu hình (Dan) | `.env` backend demo (không commit) | I |
| Gói AI của bouts (Codex, sau 10/11) | `bouts.service.ts`, `bouts.repo.ts`, `bouts.error.ts`, `bout-analysis.model.ts`, `bouts.controller.ts`, mobile `backend-codes.ts` nếu có mã mới | E, L, M, N, O, Q, R, T1 |
| Đình chỉ (Ken, sau 10/11) | `suspensions.repo.ts`, `suspensions.model.ts`, `suspensions.service.ts`, `suspensions.controller.ts` | J1 (bộ lọc), U1-a, U1-b |

- **Từ 2/11 đến 6/11:** bốn luồng đầu chạy cùng lúc vì không chung file nào. Không cần phiên agent nào: việc của Fon và Ken đều nhỏ, làm tay nhanh hơn soạn prompt.
- **Sau 10/11:** một phiên Codex làm gói AI của bouts, cùng lúc Ken làm luồng đình chỉ. Hai luồng không chung file. Gói AI có thể thêm mã lỗi (E, O), nên Codex ghi mã mới vào handover, rồi Fon cập nhật `backend-codes.ts` **sau** khi gói AI merge (không làm song song trên file đó). Phiên agent thứ hai (Gemini) để dành cho việc khác; mục D phần coaching không chung file với hai luồng trên nên có thể giao Codex sau khi xong gói AI.
- **Không chạy song song:** K (T-047) với gói AI, vì cùng sửa `bouts.service.ts` và `bout-ai.client.ts`. H, G với bất kỳ việc nào thêm mã lỗi vào `backend-codes.ts`.

## Chủ dự án cần quyết

1. **I:** dùng model nào và key nào cho demo (gói miễn phí 20 request mỗi ngày cho mỗi model, hay bật billing).
2. **C:** giữ quy tắc "nhiều số cân trong ngày, biểu đồ lấy số mới nhất" (đề xuất: giữ, không chặn).
3. **F:** enum `result`/`method` không đổi đến 10/11.
4. **J1:** sửa T-048 theo phương án A, không đổi nghĩa `active=true` (đề xuất: đồng ý; bộ lọc mới để sau).
5. **L:** không cho sửa quyết định của HLV với gợi ý AI (đề xuất: giữ đến sau 10/11).
6. **S4:** giữ hay xoá `reactnative-mobile/src/components/launch` và `src/components/auth` (ghi chú của T-051 cho rằng hai thư mục tự mất khi gộp nhánh; điều này không còn đúng sau PR #29).
7. **U2-b:** bỏ hậu tố `" (Reanalysis)"` trước 10/11 (đề xuất: bỏ, Ken).

## Quyết định của chủ dự án (2/11)

| Câu hỏi | Quyết định |
| --- | --- |
| 1. Model và key Gemini cho demo | Gói miễn phí, `gemini-3.5-flash`, kèm phương án dự phòng: gọi lỗi thì màn hiện gợi ý AI đã lưu sẵn trong database (mục I, Dan) |
| 2. Cân nhiều lần trong ngày | Giữ: biểu đồ lấy số mới nhất trong ngày, không chặn (mục C) |
| 3. Danh sách kết quả và cách kết thúc trận | Giữ nguyên đến 10/11 (mục F) |
| 4. T-048 và `active=true` | Phương án A, giữ nghĩa `active=true`. T-048 mục 2.1 đã sửa 2/11. Bộ lọc mới `current=true` (Ken) để sau 10/11 |
| 5. HLV sửa quyết định đã chọn với gợi ý AI | Không, ít nhất đến sau 10/11 |
| 6. `components/launch`, `components/auth` của mobile | Fon quyết giữ hay xoá; nếu giữ thì Fon sửa lỗi tsc |
| 7. Hậu tố `" (Reanalysis)"` | Bỏ trước 10/11, Ken làm |
| Việc gợi ý AI của trận (E, L, M, N, O, Q, R, T1) | Gộp một ticket cho Codex, làm sau 10/11 |
