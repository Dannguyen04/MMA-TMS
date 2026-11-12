# T-066 Seed demo API mode cho đủ bốn vai trò và mọi tình huống

- Trạng thái: APPROVED 12/11 sau ba lượt review độc lập ([review](./T-066-REVIEW.md)). Ngày: 12/11/2026. Thay cho T-052 (DRAFT, bỏ).
- Phạm vi: `nestjs-api/scripts/demo-seed.mjs` và `nestjs-api/scripts/demo-seed.test.mjs`. Không đổi code app, API, mã lỗi, migration, frontend.
- Người chạy seed lên Supabase: Ken. `agy` và Claude không chạy seed thật, chỉ chạy `--dry-run` và test.

## Bối cảnh

Chủ dự án (12/11): demo tuần sau chạy **API mode** (backend thật), bỏ demo mode. Mọi vai trò có trong luồng demo phải dùng được: Admin, HLV, bác sĩ, võ sĩ. Seed phải phủ mọi tình huống trong [FIGHT-CAMP-BUSINESS-FLOWS.md](../FIGHT-CAMP-BUSINESS-FLOWS.md) F1–F8 và [DEMO-API-MODE-SCRIPT.md](../DEMO-API-MODE-SCRIPT.md).

Query Supabase qua API ngày 12/11 (chỉ GET):

- `GET /academy-settings`: `medicalSupervision = DOCTOR`. Seed không đổi chế độ.
- Seed T-040 chưa từng chạy (không có user `t040.*`).
- Tài khoản demo có sẵn: HLV Rafael Costa `rafael.costa@lotus-combat.test`, bác sĩ Thu Lê `thu.le@lotus-combat.test`, Admin `admin@gmail.com`.
- Dữ liệu thử được dọn trước bằng [T-066-cleanup.sql](./T-066-cleanup.sql) (Ken chạy, xoá mềm).
- Ruleset có sẵn: `MMA – VMMAF 2021` (hạng `70`), `Boxing nghiệp dư – AIBA (tham khảo)` (hạng `48`…`91+`, hồ sơ `HEALTH_CERT`, `INSURANCE`, `FEDERATION_REG`).

Ràng buộc backend đã kiểm trong code, ảnh hưởng cách seed:

- `POST /suspensions`: `startsOn` không được trước hôm nay (`suspensions.model.ts:466-472`). `clearedAt` và ngày kết thúc sớm là lúc gọi API. Vì vậy tình huống cần "hôm qua" phải chạy từ hôm trước (giai đoạn `early`, xem dưới).
- Chế độ `DOCTOR`: võ sĩ chỉ tập được khi có khám `BASELINE` (kèm `vitals`, `assessments`, `scat6`), một phiếu `TRAINING` đủ điều kiện, và clearance cấp từ phiếu đó (`medical.service.ts:114-135`, `createExaminationSchema` `medical.model.ts:296`). Payload BASELINE hợp lệ: xem `test/medical.e2e-spec.ts` và `src/lib/domain/medical-bodies.test.ts` của frontend. Clearance: `POST /fighters/:id/medical-clearances` (`IssueClearanceDto`).
- Kết thúc sớm do CLB ra cần phiếu TRAINING của **chính bác sĩ được phân**, ngày khám từ `startsOn` (`suspensions.service.ts:289`).
- `POST /suspensions` với `issuedBy: 'ORGANIZER'` chỉ cho `reason: 'MEDICAL'` và bắt buộc `issuerReference`.
- Yêu cầu khám `OPEN` chặn tập của võ sĩ đó. Đúng ý demo S8.

## Thiết kế

### Tài khoản và biến môi trường

| Vai trò | Tài khoản | Đăng nhập seed bằng |
| --- | --- | --- |
| Admin | có sẵn | `DEMO_SEED_TOKEN` hoặc `DEMO_SEED_ADMIN_EMAIL` + `DEMO_SEED_ADMIN_PASSWORD` (như cũ) |
| HLV | Rafael, có sẵn, **không tạo** | `DEMO_SEED_COACH_EMAIL` + `DEMO_SEED_COACH_PASSWORD` (mới) |
| Bác sĩ | Thu Lê, có sẵn, **không tạo** | `DEMO_SEED_DOCTOR_EMAIL` + `DEMO_SEED_DOCTOR_PASSWORD` (mới) |
| Võ sĩ | seed tạo, `t040.fighterN@example.com` | `DEMO_SEED_USER_PASSWORD` (như cũ) |

- Bỏ việc tạo `t040.coach@example.com`. `coachId` lấy từ `GET /users?search=<coach email>&role=COACH` (`profile.id`), `doctorId` tương tự với `role=DOCTOR`. Không thấy thì dừng với câu báo tên biến.
- Mỗi võ sĩ: Admin phân Rafael (như cũ) **và** phân Thu (`POST /fighters/:id/doctors`, bỏ qua nếu đã có phân công còn hiệu lực).
- Mỗi võ sĩ (trừ S8 trước khi tạo yêu cầu khám, xem dưới): Thu ghi khám `BASELINE`, rồi phiếu `TRAINING` `ELIGIBLE`, rồi cấp clearance TRAINING từ phiếu đó. Bỏ qua nếu `GET /fighters/:id/medical` đã có phiếu TRAINING hiện hành. Thứ tự: khám trước khi tạo buổi tập của f4.

### Giai đoạn chạy

`--only clearance` đổi thành `--stage early`. Giữ `--only clearance` là bí danh của `--stage early` để lệnh cũ trong tài liệu vẫn chạy.

- `--stage early`: chạy **đúng một ngày trước** buổi demo (D−1). Sớm hơn thì f9 mất mốc `R + 1`, vì lộ trình theo bậc chỉ áp ngày `R` và `R + 1` (`suspensions.model.ts:208-217`). Review độc lập 12/11. Chỉ tạo các võ sĩ có `stage: 'early'` hoặc phần `early` của họ.
- Không có `--stage`: lần chạy chính, **sáng ngày demo**, trước 22:30 giờ học viện (giữ cut-off cũ). Tạo tất cả võ sĩ, và làm phần `main` của các võ sĩ đã có phần `early`.
- Phần `main` của một võ sĩ cần dữ liệu `early` mà không thấy (chưa chạy `early`) thì bỏ qua võ sĩ đó, in cảnh báo nêu tên võ sĩ và lệnh cần chạy hôm trước, chạy tiếp các võ sĩ khác, exit 0.

### Võ sĩ

Giữ f1–f7 như hiện có (chỉ đổi người tạo trận và đình chỉ sang Rafael, thêm bác sĩ và khám). f7 chuyển sang giai đoạn `early`. Thêm f8–f17:

| Key | Tên | Giai đoạn | Dữ liệu | Demo |
| --- | --- | --- | --- | --- |
| f7 | Giang Chờ Xác Nhận Demo | early | Như cũ: `MEDICAL` 1 ngày, `requiresClearance` mặc định | Ngày demo: chờ xác nhận, HLV hoặc bác sĩ bấm "Cho tập lại" |
| f8 | Hải Tập Lại Demo | early + main | early: `KO` 1 ngày, `requiresClearance: true`. main: Rafael `POST /suspensions/:id/clear` với `clearanceNote: 'HLV xác nhận, không có xác nhận y tế'` | Lịch sử HLV xác nhận khi không có giấy; ngày demo là ngày `R`: xếp được `PAD_WORK`, không xếp được `GRAPPLING` |
| f9 | Khoa Theo Bậc Demo | early | `MEDICAL` `CLUB` 14 ngày từ hôm đó; Thu ghi phiếu TRAINING `ELIGIBLE` cùng ngày; Thu `POST /suspensions/:id/end-early` với `examinationId` đó | Ngày demo là `R + 1`: xếp được `GRAPPLING`, không xếp được `SPARRING`. Lịch sử kết thúc sớm có phiếu khám |
| f10 | Lâm Hết Hạn Demo | early | `DQ` 1 ngày, `requiresClearance: false` | Ngày demo: đình chỉ tự hết hạn, không cần xác nhận |
| f11 | Mai Kết Thúc Sớm Demo | main | `MEDICAL` `CLUB` 14 ngày từ hôm nay; Thu ghi phiếu TRAINING `ELIGIBLE` hôm nay (sau khi tạo đình chỉ) | Bác sĩ Thu kết thúc sớm trực tiếp. HLV không thấy nút kết thúc sớm |
| f12 | Nam Ban Tổ Chức Demo | main | `MEDICAL`, `issuedBy: 'ORGANIZER'`, `issuerReference: 'QĐ 12/BTC – Giải MMA mở rộng TP.HCM'`, 30 ngày | HLV gỡ theo văn bản ban tổ chức |
| f13 | Oanh Chờ Khám Demo | main | `MEDICAL` `CLUB` 14 ngày; Rafael `POST /fighters/:id/medical-review-requests` lý do tiếng Việt. Không có phiếu TRAINING nào của Thu từ ngày đình chỉ | Hộp thoại kết thúc sớm chỉ hiện cảnh báo; bảng triage của bác sĩ có yêu cầu mở |
| f14 | Phúc Hồ Sơ Demo | main | Trận AIBA hạng `71`, cân hôm nay + 5, thi hôm nay + 6, chuyển `CAMP`. Hồ sơ để nguyên `MISSING` | Bấm "Vào tuần thi đấu" bị Cổng 1 chặn, lỗi liệt kê 3 mục |
| f15 | Quân Cân Đỏ Demo | main | Trận VMMAF hạng `70`, cân hôm nay + 2, thi hôm nay + 3, tới `FIGHT_WEEK`. Cân hằng ngày tới hôm qua, mới nhất **77 kg** (10 % trên hạn) | Cảnh báo cân đỏ trên dashboard HLV |
| f16 | Sơn Trượt Cân Demo | main | Trận VMMAF hạng `70`, cân một giờ trước, thi ngày mai. Cân chính thức **71,2 kg**, rồi `POST /bouts/:id/catchweight` `{ catchweightKg: 72, note: 'BTC chấp nhận 72 kg' }` | Trận `WEIGHED_IN` có catchweight |
| f17 | Tùng Huỷ Trận Demo | main | Trận VMMAF hạng `70`, cân hôm nay + 20; `POST /bouts/:id/cancel` `{ reason: 'Đối thủ rút' }` | Trận `CANCELLED` với lý do |

Ghi chú:

- Hai trận của một võ sĩ không được cùng mở; mỗi võ sĩ ở trên tối đa một trận.
- Ngày tính bằng `academyDate` / `addDays` có sẵn trong script.
- Mọi bước phải chạy lại được không trùng: kiểm tra bằng GET trước mỗi POST, như code hiện có (`found()` / `stats.existing`). Đình chỉ nhận theo `fighterId` + `reason` + `issuedBy`. Yêu cầu khám nhận theo `status = 'OPEN'`. Phiếu khám nhận theo phiếu TRAINING hiện hành.
- Dòng `--dry-run` liệt kê mọi request ghi, gắn nhãn vai trò `[admin]`, `[coach]`, `[doctor]`.

### Tài liệu

Cập nhật [DEMO-API-MODE-SCRIPT.md](../DEMO-API-MODE-SCRIPT.md), thêm mục "Chuẩn bị dữ liệu": hai lệnh (hôm trước `--stage early`, sáng ngày demo chạy chính), các biến môi trường, bảng võ sĩ → tình huống → vai trò bấm. Không sửa các mục khác.

## Ngoài phạm vi

- Code app, API, frontend, demo mode. Đổi chế độ y tế học viện.
- Dọn dữ liệu cũ (đã có `T-066-cleanup.sql`, Ken chạy tay).
- Test e2e `test/coaching-loop-persistence.spec.ts` ghi user `@test.invalid` vào database thật: ghi lại, ticket riêng.

## Ca kiểm thử

Lớp: `node --test` trên `scripts/demo-seed.test.mjs`, dùng API giả có sẵn trong file (mở rộng cho endpoint mới). API giả phải **giữ trạng thái** (lưu dòng đã tạo, trả lại khi GET) và **từ chối như backend thật** các trường hợp: `startsOn` trước hôm nay → 400; `end-early` mà phiếu không phải của bác sĩ được phân hoặc ngày khám trước `startsOn` → 409; ORGANIZER không có `issuerReference` → 400. Không được mock theo kiểu chấp nhận mọi body.

`now` mặc định của các ca: `2026-11-17T02:00:00Z` (09:00 giờ học viện, ngày demo `D = 2026-11-17`). "Hôm trước" = `2026-11-16T02:00:00Z`.

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| S1–S18 | Các ca hiện có | Vẫn qua. Ca nào phải đổi vì HLV thành Rafael (không còn POST tạo coach) hoặc `--only clearance` thành bí danh thì giữ tên ca, ghi lý do vào handover |
| T1 | Chạy `--stage early` lúc D−1 trên API rỗng, rồi chạy chính lúc D trên cùng API | Lần 1 chỉ ghi cho f7, f8, f9, f10. Lần 2 không tạo lại user nào của f7–f10; có đúng một `POST /suspensions/:id/clear` cho f8 |
| T2 | Chạy chính lúc D trên API rỗng (không chạy early) | Exit 0. stderr nhắc từng võ sĩ f8 và f9 (hoặc nhóm early) cần `--stage early` hôm trước. Không có `POST .../clear` hay `.../end-early` nào. Các võ sĩ còn lại vẫn được tạo |
| T3 | Chạy hai lần liên tiếp `early` (D−1) + chính (D), rồi chạy chính lần nữa | Lần cuối: không có request ghi nào; in `created=0` |
| T4 | Lần chạy chính lúc D, đếm request theo vai trò | Không có `POST /users` với `role: 'COACH'` hay `'DOCTOR'`. Mọi `POST /bouts`, `/suspensions`, `/training-sessions`, `/medical-review-requests`, `.../catchweight`, `.../cancel` chạy bằng token HLV. Mọi `POST .../medical-examinations`, `.../medical-clearances`, `.../end-early` chạy bằng token bác sĩ. Mọi `POST /fighters/:id/doctors` chạy bằng token Admin |
| T5 | Lần chạy chính lúc D: mỗi võ sĩ f1–f17 | Có đúng một phân công Thu còn hiệu lực; có một phiếu `BASELINE`, một phiếu `TRAINING` `ELIGIBLE`, một clearance từ phiếu đó, theo đúng thứ tự BASELINE → TRAINING → clearance. Với f4: các request này đứng trước mọi `POST /training-sessions` của f4 |
| T6 | f9 sau `early` (D−1) | Đình chỉ `MEDICAL` `startsOn = 2026-11-16`; `end-early` gửi `examinationId` là phiếu TRAINING của Thu ghi ngày 2026-11-16; đình chỉ thành `ENDED` |
| T7 | f11 sau lần chạy chính | Đình chỉ `MEDICAL`, `issuedBy` `CLUB` (hoặc không gửi), `startsOn = 2026-11-17`, còn `ACTIVE`; có phiếu TRAINING của Thu ngày 2026-11-17, ghi **sau** khi tạo đình chỉ; không có `end-early` |
| T8 | f12 | Body `POST /suspensions` có `reason 'MEDICAL'`, `issuedBy 'ORGANIZER'`, `issuerReference 'QĐ 12/BTC – Giải MMA mở rộng TP.HCM'`, `days 30` |
| T9 | f13 | Đúng một yêu cầu khám `OPEN`, gửi bằng token HLV. Không có phiếu TRAINING nào của Thu cho f13 có ngày ≥ `startsOn` của đình chỉ f13 |
| T10 | f14 | Trận dùng ruleset AIBA, `weightClassCode '71'`, trạng thái cuối `CAMP`; không có `POST .../fight-week`; không có `PATCH .../requirements/...` |
| T11 | f15 | Số cân mới nhất 77 kg, ngày 2026-11-16; trận `FIGHT_WEEK`, `weighInAt` ngày 2026-11-19 |
| T12 | f16 | `POST .../weigh-in` với `weightKg 71.2`, sau đó `POST .../catchweight` với `catchweightKg 72`; trạng thái cuối `WEIGHED_IN` |
| T13 | f17 | Đúng một `POST .../cancel` với `reason 'Đối thủ rút'`; trạng thái cuối `CANCELLED`. Chạy lại không gọi cancel lần nữa |
| T14 | Thiếu `DEMO_SEED_COACH_PASSWORD` (hoặc `_EMAIL`, hoặc biến bác sĩ), chạy thật | Exit khác 0, stderr nêu đúng tên biến thiếu, không gửi request nào |
| T15 | `GET /users?search=<coach email>&role=COACH` trả rỗng | Exit khác 0, stderr nói không thấy HLV với email đó; không có request ghi nào sau đó |
| T16 | `--stage foo` | Exit khác 0, nêu giá trị cho phép (`early`), không gửi request |
| T17 | `--only clearance` lúc D−1 | Ghi giống hệt `--stage early` (so danh sách dòng request) |
| T18 | `--dry-run` lúc D | Không có request mạng; in đủ các dòng ghi của f1–f17, mỗi dòng có nhãn `[admin]`, `[coach]` hoặc `[doctor]` |
| T19 | Mọi email trong plan, mọi `now` | Võ sĩ: kết thúc `@example.com`. Không có email `@lotus-combat.test` nào được `POST /users` |

## Tiêu chí nghiệm thu

1. Có đủ các ca trên, đúng tên và kết quả mong đợi. Ca nào không làm được thì ghi vào "Câu hỏi" của handover và dừng phần đó.
2. `corepack pnpm --filter nestjs-api test:seed` qua; `node scripts/demo-seed.mjs --dry-run` (lúc trước 22:30) in đủ plan.
3. `corepack pnpm --filter nestjs-api lint` qua.
4. Không sửa file ngoài `scripts/demo-seed.mjs`, `scripts/demo-seed.test.mjs`, `docs/DEMO-API-MODE-SCRIPT.md`, handover.
5. Không chạy seed thật, không gọi database thật.

## Lệnh kiểm tra bắt buộc

```bash
corepack pnpm --filter nestjs-api test:seed
corepack pnpm --filter nestjs-api lint
cd nestjs-api && node scripts/demo-seed.mjs --dry-run
```
