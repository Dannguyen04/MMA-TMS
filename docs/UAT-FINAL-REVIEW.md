# UAT cho buổi review cuối 10/11

Nhánh `release/final-review`. UAT kiểm tra luồng mà buổi review sẽ trình diễn: HLV đi từ lúc tạo trận tới lúc cho võ sĩ tập lại sau đình chỉ. Kịch bản gốc là [DEMO-API-MODE-SCRIPT.md](./DEMO-API-MODE-SCRIPT.md). Demo mode phải chạy giống API mode, vì mai trình bày bằng API mode và demo mode là phương án dự phòng.

## Luật đạt

- **Đạt** khi có 3 lượt liên tiếp, 0 bước lỗi, trên cùng một commit. Lượt nào cũng phải không có lỗi console, lỗi trang hay HTTP 5xx.
- Lượt 1 và 2 chạy trên cùng một server, không khởi động lại. Lượt 2 tạo trận mới, nhờ vậy kiểm luôn lỗi "phải restart mới diễn lại được" mà giảng viên nêu ngày 27/10.
- Lượt 3 chạy sau khi khởi động lại server.
- Có một bước lỗi thì sửa, rồi đếm lại từ 0.
- Sau bất kỳ lần sửa code nào, 3 lượt phải chạy lại trên commit mới.

## Cách chạy

```bash
pnpm --filter nextjs-frontend dev
```

```bash
node nextjs-frontend/scripts/uat-demo.mjs --run-label L1 --shots <thư mục ảnh>
```

Script đăng nhập bằng tài khoản demo, đi từng bước dưới đây, chụp ảnh sau mỗi bước. Mỗi bước in một dòng `PASS` hoặc `FAIL`.

## Các bước

| Mã | Màn | Việc | Kết quả mong đợi |
| --- | --- | --- | --- |
| 0 | `/coach/training-plans/new` | Tạo giáo án `fight_camp` cho võ sĩ | Lưu được, giáo án có trong danh sách |
| A1 | `/coach/bouts/new` | VMMAF 2021, 70 kg, 3 hiệp, cân 08:00 hôm nay, thi tối nay | Trận ở trạng thái Đã lên lịch |
| A2 | Trang trận | Gắn giáo án vừa tạo | Trạng thái Trại tập |
| A3 | Trang trận | Ghi kế hoạch ăn giai đoạn trại tập | Lưu được |
| A4 | Trang trận | Vào tuần thi đấu (Cổng 1) | Trạng thái Tuần thi đấu |
| A5 | Trang trận | Cân chính thức 69,5 kg | Hiện "đạt hạng", trạng thái Đã cân |
| B1 | `/rounds` | Ghi hiệp 1 và 2: thua hiệp, mệt; chiến thuật 1 hiệu quả, chiến thuật 2 không | Hai hiệp có nhãn đã ghi |
| B2 | `/corner-card` | Mở thẻ góc đài | Có chiến thuật, không trống |
| C1 | Trang trận | Kết quả: thua KO hiệp 2, mất ý thức dưới 1 phút, 30 ngày | Trạng thái Đã xong |
| R | `/report` | Xem báo cáo, đổi kết luận một chiến thuật, ghi chú, lưu | Có "Đuối sức từ hiệp 1" và chiến thuật kém hiệu quả. Sau khi tải lại: kết luận mới, chiến thuật đó không còn nhãn "App điền sẵn" |
| C2 | `/coach/bouts/suspensions` | Xem đình chỉ | Dòng KO 30 ngày, đang hiệu lực |
| C3 | `/coach/sessions/new` | Xếp buổi đấu tập hôm nay | Bị từ chối, có câu tiếng Việt về đình chỉ |
| C4 | `/coach/bouts/suspensions` | Cho tập lại, có ghi chú | Hiện xác nhận, võ sĩ không còn bị chặn |
| F | Võ sĩ, 390 px | Dashboard, trang trận | Không có màn lỗi |

## Kết quả chốt (9/11 tối, commit `452a91f`)

- **Demo mode** (`frontend-demo-offline`, Minh Trần): H1 và H2 trên cùng server, H3 sau khi khởi động lại. **3/3 lượt, mỗi lượt 17/17** (thêm các bước võ sĩ, bác sĩ, admin). 0 lỗi console/trang/5xx.
- **API mode**: lượt API3 qua 17/17, chi tiết ở mục dưới.
- Lint 0 lỗi, typecheck (API mode) 0 lỗi, unit test 1355 qua, 2 skip.

## API mode đầy đủ 4 vai (9/11 tối, commit `452a91f`)

Script có thêm 3 bước theo vai:
- **F**: 9 màn của võ sĩ;
- **D**: 10 màn của bác sĩ;
- **AD**: 12 màn của admin.

Mỗi màn được mở ở 1440 px và 390 px. Ở API mode, email của từng vai truyền bằng `--fighter-email`, `--doctor-email`, `--admin-email`; mật khẩu gõ ở terminal. Chạy lại riêng một bước bằng `--only`.

**Lượt API3 (backend thật, Supabase của team), võ sĩ Kenji Morita: 17/17, 0 lỗi console/trang/5xx.**

Các lượt trước đó lộ ra 4 lỗi, đã sửa hết:

| Lượt | Lỗi | Nguyên nhân | Sửa |
| --- | --- | --- | --- |
| API2 | `/login` trả 404 | `.next` cũ còn lại sau khi đổi từ demo mode sang API mode | Xoá `.next`. Đã ghi vào run-sheet |
| API2 | Màn login hiện "Validation failed" (tiếng Anh) | Backend trả 422 khi mật khẩu dưới 8 ký tự | `e2b06ac`: báo như sai mật khẩu |
| API2 admin | `/admin/dashboard` sập: 500 và quá thời gian chờ | Supabase còn 984 tài khoản rác `@test.invalid` do spec backend tạo mỗi lần chạy `pnpm test`, nên dashboard đọc `/users` thành nhiều trang cùng lúc | `ea85963`: frontend đọc 2 trang một lúc. Đã xoá rác (chủ dự án đồng ý). Ngăn tái diễn: [T-062](./tickets/T-062-persistence-spec-off-shared-db.md) |
| API2 admin | Vẫn 500 sau khi dọn | Pooler session mode (cổng 5432) chỉ cho 15 kết nối, cả team dùng chung: `max clients reached in session mode` | `DATABASE_URL` đổi sang cổng 6543 (transaction mode). Bật Redis cho thông báo và hàng đợi |

Dữ liệu thật cần xoá sau buổi demo:
- trận `UAT API2 …` và `UAT API3 9-11 xoa sau demo` của Kenji;
- các đình chỉ KO đi kèm.

## Kết quả cuối cùng ở demo mode (9/11, commit `8b90ce6`)

Chạy lại sau khi thêm chế độ ghi giữa hiệp (T-037B) và đồng nhất UI khu bác sĩ. **G1, G2 (cùng server), G3 (sau khi khởi động lại): 3/3 lượt, mỗi lượt 15/15, 0 lỗi console/trang/5xx.** Bước B1 kiểm thêm màn 390 px: không cuộn ngang, không có nút nào dưới 44 px.

## Kết quả trước đó (9/11, commit `216dd47`)

Chạy lại sau khi sửa phần dịch mẫu giáo án: **F1, F2 (cùng server), F3 (sau khi khởi động lại): 3/3 lượt, mỗi lượt 15/15, 0 lỗi console/trang/5xx.**

**API mode (backend thật, Supabase của team), 1 lượt:** võ sĩ Kenji Morita, sự kiện `UAT API 9-11 xoa sau demo`, chạy bằng `--email` (mật khẩu gõ ở terminal). 13/15:
- Bước 0 đến C2, gồm ghi kết quả KO và báo cáo sau trận: đạt.
- C3: Cổng 2 chặn đúng, câu báo khác demo; đã sửa script để nhận cả hai câu.
- C4: chỉ kiểm quy tắc T-049.
- F: bỏ qua vì cần đăng nhập võ sĩ.

Trước lượt này, Supabase chưa có migration 033, nên `/suspensions`, `/readiness`, `/coach/todo` đều trả 500. Chủ dự án đồng ý, Claude đã áp 033 ngày 9/11.

Dữ liệu thật để lại sau lượt API, cần xoá sau buổi demo:
- trận và giáo án `UAT API 9-11 xoa sau demo` của Kenji;
- đình chỉ KO 30 ngày của Kenji;
- đình chỉ Y tế 1 ngày của Aigerim (tạo có chủ ý cho bước C4 ngày 10/11).

## Kết quả lần đạt đầu (9/11, commit `9645e5c`)

Chạy bằng `frontend-demo-offline` (`APP_DATA_MODE=demo`, `NEXT_PUBLIC_VIDEO_PIPELINE=mock`), võ sĩ Minh Trần.

| Lượt | Server | Kết quả | Lỗi console / trang / 5xx |
| --- | --- | --- | --- |
| U1 | Vừa khởi động | 15/15 | 0 |
| U2 | Cùng server với U1, không khởi động lại | 15/15 | 0 |
| U3 | Sau khi khởi động lại | 15/15 | 0 |

**Đạt: 3 lượt liên tiếp.** Lượt U2 tạo trận thứ hai cho cùng võ sĩ trên cùng server mà không lỗi, nên lỗi "phải restart mới diễn lại" (nhận xét 27/10 mục 4) đã hết.

Ghi chú từ các lượt:

- **C3:** ở demo mode, nút lưu bị khoá ngay khi chọn buổi đấu tập, kèm câu "Minh Trần đang bị đình chỉ: buổi đấu tập bị chặn đến hết ngày …". API mode chặn lúc bấm lưu. Cả hai đều là Cổng 2.
- **C4:** ở U1 và U3 đã cho tập lại được đình chỉ TKO đang chờ xác nhận của Diego Alvarez. Ở U2 không còn đình chỉ nào chờ xác nhận, vì U1 đã xác nhận rồi, nên chỉ kiểm được quy tắc T-049.

## Các lượt trước khi đạt (đã sửa)

| Lượt | Bước lỗi | Nguyên nhân | Sửa |
| --- | --- | --- | --- |
| Lượt viết script | C2, C4 | Ở demo mode, đình chỉ từ kết quả trận nằm ở kho khác với trang Đình chỉ | `9ea102d`: demo chỉ còn một kho đình chỉ, tạo cùng lúc ghi kết quả như API |
| Lượt viết script | A6 | Trận mới ở demo mode không có chiến thuật mẫu như API mode | `9b469c0` |
| Lượt viết script | R (phụ) | Lưu đánh giá không báo gì, và mọi chiến thuật mất nhãn "App điền sẵn" | `9b469c0` |
| L1 | B1 | Script tìm nhầm thẻ hiệp: chiến thuật mẫu có nhãn "Hiệp 1" | `9645e5c` (sửa script) |

## Kiểm tra khác trên cùng commit

- `ui:smoke`, `vi`, 1440 và 390 px, 4 vai: 368 trang, 0 lỗi.
- Unit test: 1346 qua, 2 skip. Lint: 0 lỗi. Typecheck (API mode): 0 lỗi.
