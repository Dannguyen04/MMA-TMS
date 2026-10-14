# Fight Camp — Câu hỏi cần trả lời

**Tạo ngày**: 2026-10-13
**Thuộc bộ tài liệu**: [Phạm vi](./SCOPE-FIGHT-CAMP.md) · [Nghiên cứu](./FIGHT-CAMP-DOMAIN-RESEARCH.md) · [Luồng nghiệp vụ](./FIGHT-CAMP-BUSINESS-FLOWS.md) · [Tech spec](./FIGHT-CAMP-TECH-SPEC.md) · [Kiểm thử người dùng](./FIGHT-CAMP-USER-TESTING.md) · **Câu hỏi mở**

## Cách điền

1. Mỗi câu có sẵn **đề xuất mặc định**. Đồng ý thì ghi "Theo đề xuất" vào ô Trả lời.
2. Ghi **nguồn** cho mọi thông tin về quy định: link, ảnh chụp văn bản, tên người đã hỏi. Thông tin không có nguồn thì đánh dấu "chưa xác minh".
3. Trả lời xong thì đổi trạng thái trong bảng tổng hợp thành **Xong**. Chỉ có một phần thì ghi **Một phần**.
4. Điền xong, báo Claude "đã điền câu hỏi mở". Claude sẽ cập nhật các tài liệu ghi ở dòng "Ảnh hưởng tới".

## Bảng tổng hợp

| ID | Câu hỏi | Nhóm | Hạn đề xuất | Người phụ trách | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| Q01 | CLB pilot và trận tháng 12 | Pilot | — | | **Không cần (đồ án)**: thay bằng Q25 |
| Q02 | Ai ghi cân hằng ngày | Pilot | — | | **Xong**: võ sĩ tự ghi (Phạm vi, quyết định 3) |
| Q03 | CLB pilot có bác sĩ / physio không | Pilot | — | | **Không cần (đồ án)**: kiểm thử chạy chế độ không có bác sĩ |
| Q04 | Võ sĩ dưới 18 tuổi | Pilot | Khi tuyển người kiểm thử | | Chỉ nhận người kiểm thử từ 18 tuổi |
| Q05 | Ngưỡng cảnh báo cân | Kiểm thử | Sau buổi kiểm thử | | Tạm dùng 1,0 kg |
| Q06 | Người dùng chính | Nội bộ | — | | **Xong (14/10)**: HLV; ban tổ chức ngoài phạm vi (Phạm vi đã chốt, quyết định 10) |
| Q07 | Module goals 021/022 | Nội bộ | — | | **Xong (13/10)**: chưa merge; `goals.bout_id` để sau đợt đồ án |
| Q08 | Nhánh chính và cách commit tài liệu | Nội bộ | — | | **Xong (sửa 14/10)**: nhánh chính `main`; tài liệu commit trên `fight-camp` rồi đưa lên `main` để cả team thấy (Phạm vi, quyết định 15). Nhánh `docs/fight-camp-scope` thôi dùng |
| Q09 | Nhân lực team | Nội bộ | 16/10 | | Chưa: cần tên người, vai trò, giờ mỗi tuần đến 31/10 |
| Q10 | Dữ liệu và người dùng thật đang có | Nội bộ | 16/10 | | Chưa |
| Q11 | Loại trận và bộ môn đầu tiên | Nội bộ | — | | **Xong (14/10)**: trận đơn, MMA theo Luật VMMAF 2021; Boxing nghiệp dư AIBA là preset thứ hai (Phạm vi, quyết định 1–2) |
| Q12 | Ba quyền còn chờ chốt | Nội bộ | — | | **Xong**: chỉ Admin sửa preset, HLV nhập quy định riêng trên trận; võ sĩ không cập nhật hồ sơ; HLV kết thúc đình chỉ |
| Q13 | Thông tin giải mà CLB pilot tham gia | Quy định | — | | **Không cần (đồ án)**: HLV tự nhập; preset MMA lấy từ Luật VMMAF 2021 |
| Q14 | Hồ sơ y tế ban tổ chức yêu cầu | Quy định | — | | **Không cần (đồ án)**: HLV tự nhập checklist |
| Q15 | Đình chỉ sau KO/TKO của giải | Quy định | — | | **Không cần (đồ án)**: preset AIBA hoặc HLV nhập |
| Q16 | Kiểm tra nước khi cân | Quy định | — | | **Không cần (đồ án)**: trường tùy chọn |
| Q17 | Quyết định 1502/QĐ-UBTDTT | Quy định | — | | Không bắt buộc cho đồ án |
| Q18 | Hệ hạng cân VBF và giải nghiệp dư hiện nay | Quy định | — | | Không bắt buộc cho đồ án |
| Q19 | Quy chế Boxing chuyên nghiệp VBF | Quy định | — | | Không bắt buộc cho đồ án |
| Q20 | Lưu giấy xét nghiệm và dữ liệu sức khỏe | Dữ liệu | — | | **Xong**: không lưu giấy tờ y tế thật; dữ liệu giả hoặc có đồng ý (Phạm vi, quyết định 9) |
| Q21 | Đồng ý của phụ huynh | Dữ liệu | — | | **Không cần**: chỉ nhận người kiểm thử từ 18 tuổi |
| Q22 | Hồ sơ đánh giá tác động và nơi lưu dữ liệu | Dữ liệu | — | | **Hoãn**: chỉ cần nếu đưa ra sử dụng thật sau đồ án; nên trình bày trong báo cáo |
| Q23 | Hạn nộp và bảo vệ đồ án | Đồ án | 16/10 | | **Một phần**: kết thúc 31/10, 2 buổi review; còn thiếu ngày của 2 buổi review |
| Q24 | Yêu cầu của trường và giảng viên hướng dẫn | Đồ án | 16/10 | | **Một phần (14/10)**: giảng viên duyệt phạm vi "Quản lý võ sĩ trước – trong – sau trận"; còn thiếu yêu cầu về báo cáo, kiểm thử, test, phần AI |
| Q25 | Nguồn người kiểm thử | Đồ án | 20/10 | | Chưa: buổi kiểm thử 27–29/10 |

Hạn "23/10" để kịp seed bộ luật giải trong migration 024. "PR 4", "PR 6" theo [Tech spec §11](./FIGHT-CAMP-TECH-SPEC.md#11-thứ-tự-pr).

---

## A. Pilot và HLV

### Q01 · CLB pilot và trận tháng 12

- **Cần biết:** CLB nào chạy pilot, HLV nào phụ trách, võ sĩ nào có trận khoảng tháng 12/2026, camp bắt đầu ngày nào.
- **Vì sao quan trọng:** lộ trình giả định camp pilot bắt đầu 9/11. Không có CLB thì cả lộ trình phải lùi.
- **Đề xuất mặc định:** 1–2 CLB có trận trong tháng 12/2026.
- **Hỏi ai:** các HLV trong danh sách phỏng vấn ([hướng dẫn kiểm thử](./FIGHT-CAMP-USER-TESTING.md)).
- **Ảnh hưởng tới:** [SCOPE – Kế hoạch](./SCOPE-FIGHT-CAMP.md#kế-hoạch-triển-khai), câu 3.

| | |
| --- | --- |
| CLB | |
| HLV phụ trách, liên hệ | |
| Võ sĩ có trận, ngày thi | |
| Ngày bắt đầu camp | |
| Kết quả phỏng vấn (CÓ / KHÔNG / CÓ NẾU…) | |
| Nguồn / ngày hỏi | |

### Q02 · Ai ghi cân hằng ngày

- **Cần biết:** trong camp, ai sẽ nhập số cân mỗi sáng.
- **Vì sao quan trọng:** quyết định màn nào phải tối ưu cho điện thoại trước, và võ sĩ có cần tài khoản đăng nhập không.
- **Đề xuất mặc định:** võ sĩ tự ghi; HLV ghi hộ khi cần.
- **Hỏi ai:** HLV pilot (câu hỏi quyết định trong buổi phỏng vấn).
- **Ảnh hưởng tới:** [Luồng nghiệp vụ F3](./FIGHT-CAMP-BUSINESS-FLOWS.md#f3-ghi-cân-hằng-ngày-và-cảnh-báo), SCOPE câu 4.

> **Trả lời:**
>
> **Nguồn / người trả lời / ngày:**

### Q03 · CLB pilot có bác sĩ hay physio không

- **Cần biết:** CLB có bác sĩ thể thao, physio, hay nơi khám quen không. Nếu có, họ có chịu đăng nhập app để xác nhận không.
- **Vì sao quan trọng:** quyết định CLB chạy chế độ "có bác sĩ" hay "không có bác sĩ" ([Luồng nghiệp vụ §7](./FIGHT-CAMP-BUSINESS-FLOWS.md#7-chế-độ-không-có-bác-sĩ)).
- **Đề xuất mặc định:** không có bác sĩ, chạy chế độ không có bác sĩ.
- **Hỏi ai:** HLV pilot.
- **Ảnh hưởng tới:** cấu hình ban đầu khi triển khai pilot, quyền `suspension:clear`.

> **Trả lời:**
>
> **Nguồn / người trả lời / ngày:**

### Q04 · Võ sĩ dưới 18 tuổi

- **Cần biết:** võ sĩ pilot có ai dưới 18 tuổi không, bao nhiêu người, tuổi nhỏ nhất.
- **Vì sao quan trọng:** cần sự đồng ý của phụ huynh (Q21); cảnh báo ép cân cho trẻ vị thành niên nên chặt hơn.
- **Đề xuất mặc định:** pilot chỉ với võ sĩ từ 18 tuổi. Nếu có võ sĩ nhỏ tuổi, cảnh báo luôn đỏ khi phải giảm cấp tốc trên 5%.
- **Hỏi ai:** HLV pilot.
- **Ảnh hưởng tới:** [Tech spec §5](./FIGHT-CAMP-TECH-SPEC.md#5-cảnh-báo-cân-nặng), Q21.

> **Trả lời:**
>
> **Nguồn / người trả lời / ngày:**

### Q05 · Ngưỡng cảnh báo cân

- **Cần biết:** HLV chấp nhận võ sĩ cao hơn đường cân tham chiếu bao nhiêu kg thì mới cần cảnh báo vàng.
- **Vì sao quan trọng:** dung sai quá nhỏ thì cảnh báo liên tục và HLV sẽ bỏ qua; quá lớn thì cảnh báo vô dụng.
- **Đề xuất mặc định:** 1,0 kg, HLV chỉnh được theo từng trận.
- **Hỏi ai:** HLV pilot; nếu có thì hỏi thêm chuyên gia dinh dưỡng.
- **Ảnh hưởng tới:** [Tech spec §5](./FIGHT-CAMP-TECH-SPEC.md#5-cảnh-báo-cân-nặng) (`tolKg`).

> **Trả lời:**
>
> **Nguồn / người trả lời / ngày:**

---

## B. Quyết định nội bộ

### Q06 · Người dùng chính

- **Cần quyết định:** sản phẩm phục vụ HLV đội tuyển trước, hay ban tổ chức giải trước.
- **Vì sao quan trọng:** hai nhóm cần màn hình và luồng khác nhau. Ban tổ chức có thể là bên trả tiền tốt hơn, nhưng cần quan hệ với giải.
- **Đề xuất mặc định:** HLV đội tuyển.
- **Người quyết định:** chủ dự án.
- **Ảnh hưởng tới:** [SCOPE – Phạm vi mới](./SCOPE-FIGHT-CAMP.md#phạm-vi-mới).

> **Trả lời:** HLV. Ban tổ chức giải nằm ngoài phạm vi, theo phạm vi đã được giảng viên duyệt.
>
> **Người quyết định / ngày:** chủ dự án, sau buổi review với giảng viên; ghi nhận ngày 14/10/2026 ([Phạm vi, quyết định 10](./SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)).

### Q07 · Module goals (migration 021/022)

- **Cần quyết định:** merge module goals như hiện tại, hay giữ lại để thêm `bout_id` trước.
- **Vì sao quan trọng:** quyết định số của migration chế độ không có bác sĩ (023 hay số khác), và có phải viết thêm migration sửa schema goals ngay sau đó không.
- **Đề xuất mặc định:** giữ chưa merge; thêm `bout_id` ở migration 026 rồi merge cùng.
- **Người quyết định:** chủ dự án, tech lead.
- **Ảnh hưởng tới:** [Tech spec §8](./FIGHT-CAMP-TECH-SPEC.md#8-migration), SCOPE câu 5.

> **Trả lời:**
>
> **Người quyết định / ngày:**

### Q08 · Nhánh chính và cách commit tài liệu

- **Cần quyết định:** team tạo nhánh từ `main` hay `ai-feature`. Tài liệu Fight Camp (36 file đổi tên đã stage, 7 tài liệu mới) commit ở đâu.
- **Vì sao quan trọng:** hiện phần tài liệu đang trộn với code goals chưa commit trên nhánh `chore/ai-review-tracker-storage`.
- **Đề xuất mặc định:** nhánh chính là `main`; tách tài liệu sang nhánh `docs/fight-camp-scope` và commit riêng.
- **Người quyết định:** chủ dự án.
- **Ảnh hưởng tới:** [PROJECT-OVERVIEW §7](./PROJECT-OVERVIEW.md#7-đóng-góp).

> **Trả lời:**
>
> **Người quyết định / ngày:**

### Q09 · Nhân lực team

- **Cần biết:** bao nhiêu người làm từ 19/10 đến 27/11, ai làm frontend, ai làm backend, mỗi người bao nhiêu giờ mỗi tuần.
- **Vì sao quan trọng:** kế hoạch có 10 PR trong khoảng 6 tuần. Không đủ người thì phải cắt bớt (ví dụ bỏ job thông báo theo lịch khỏi pilot).
- **Đề xuất mặc định:** không có; cần số liệu thật.
- **Ảnh hưởng tới:** [Tech spec §11](./FIGHT-CAMP-TECH-SPEC.md#11-thứ-tự-pr), [SCOPE – Kế hoạch](./SCOPE-FIGHT-CAMP.md#kế-hoạch-triển-khai).

| Người | Vai trò (FE / BE / cả hai / QA) | Giờ mỗi tuần | Ghi chú |
| --- | --- | --- | --- |
| | | | |
| | | | |

### Q10 · Dữ liệu và người dùng thật đang có

- **Cần biết:** Supabase đang chứa dữ liệu thật hay chỉ dữ liệu thử; có HLV hay võ sĩ nào đang dùng hệ thống không; migration 018–022 đã áp dụng lên database nào.
- **Vì sao quan trọng:** nếu có dữ liệu thật, việc bật chế độ không có bác sĩ và chạy migration mới cần kế hoạch triển khai và sao lưu.
- **Đề xuất mặc định:** chỉ có dữ liệu thử.
- **Tìm ở đâu:** Supabase dashboard; `pnpm db:check` trong `nestjs-api/`; [migrations/README.md](../nestjs-api/migrations/README.md).
- **Ảnh hưởng tới:** [Tech spec §8](./FIGHT-CAMP-TECH-SPEC.md#8-migration).

> **Trả lời:**
>
> **Nguồn / ngày kiểm tra:**

### Q11 · Loại trận và bộ môn đầu tiên

- **Cần quyết định:** (a) trận đơn hay giải nhiều vòng; (b) Boxing, Muay Thai, Kickboxing hay MMA.
- **Vì sao quan trọng:** quyết định template camp, hạng cân, hồ sơ, và độ dài giai đoạn "Trong trận".
- **Đề xuất mặc định:** trận đơn; bộ môn theo CLB pilot, chưa có thì chọn Boxing.
- **Người quyết định:** chủ dự án, sau khi có Q01 và Q13.
- **Ảnh hưởng tới:** SCOPE câu 1 và 2, [Luồng nghiệp vụ F2](./FIGHT-CAMP-BUSINESS-FLOWS.md#f2-lập-camp).

> **Trả lời (a):** trận đơn.
>
> **Trả lời (b):** MMA, theo Luật VMMAF 2021 (bộ quy định Việt Nam duy nhất đã xác minh). Boxing nghiệp dư theo AIBA giữ làm preset thứ hai.
>
> **Người quyết định / ngày:** chủ dự án, 14/10/2026 (theo đề xuất ở Phạm vi, quyết định 1–2).

### Q12 · Ba quyền còn chờ chốt

Nguồn: [Luồng nghiệp vụ §2](./FIGHT-CAMP-BUSINESS-FLOWS.md#2-vai-trò-và-quyền).

| Quyền | Đề xuất mặc định | Trả lời |
| --- | --- | --- |
| HLV có được tạo, sửa bộ luật giải không? | Không, chỉ Admin | |
| Võ sĩ có được tự tải giấy tờ y tế của mình lên không? | Chưa, chờ Q20 | |
| HLV có được kết thúc đình chỉ cần xác nhận không? | Có. Ở chế độ không có bác sĩ thì bắt buộc phải có, nếu không võ sĩ bị chặn mãi | |

**Người quyết định / ngày:**

---

## C. Quy định giải

Điền cho **từng giải** mà CLB pilot sắp tham gia. Có nhiều giải thì sao chép nhóm Q13–Q16.

### Q13 · Thông tin giải

- **Vì sao quan trọng:** đây là dữ liệu để tạo bộ luật giải (ruleset) đầu tiên được đánh dấu "đã xác minh".
- **Tìm ở đâu:** thông báo, điều lệ giải; hỏi ban tổ chức hoặc HLV.
- **Ảnh hưởng tới:** [Tech spec §2.2](./FIGHT-CAMP-TECH-SPEC.md#22-competition_rulesets), [Nghiên cứu §7](./FIGHT-CAMP-DOMAIN-RESEARCH.md#7-việc-cần-xác-minh-với-clb-và-btc-đưa-vào-phỏng-vấn-m0).

| | |
| --- | --- |
| Tên giải, đơn vị tổ chức | |
| Bộ môn; chuyên nghiệp hay nghiệp dư | |
| Ngày thi đấu, địa điểm | |
| Danh sách hạng cân (kg) | |
| Giờ cân so với giờ thi đấu (ví dụ: cân 10:00 hôm trước, thi 19:00) | |
| Dung sai cân, số lần được cân lại | |
| Xử lý khi trượt cân (huỷ, catchweight, phạt) | |
| Nguồn (link / ảnh văn bản / người cung cấp) | |

### Q14 · Hồ sơ y tế ban tổ chức yêu cầu

| Loại giấy tờ | Bắt buộc? | Hiệu lực (bao lâu kể từ ngày cấp) | Nơi cấp chấp nhận | Hạn nộp (trước ngày cân bao nhiêu ngày) |
| --- | --- | --- | --- | --- |
| Giấy khám sức khỏe | | | | |
| Xét nghiệm HBsAg / Anti-HCV / HIV | | | | |
| CT / MRI não | | | | |
| Khác: | | | | |

**Nguồn:**

### Q15 · Đình chỉ sau KO/TKO của giải

- **Vì sao quan trọng:** dùng để seed quy tắc đình chỉ (`suspensionRules`). Hiện chỉ có tham khảo từ AIBA và các bang của Mỹ ([Nghiên cứu §5](./FIGHT-CAMP-DOMAIN-RESEARCH.md#5-đình-chỉ-sau-trận)).

| | |
| --- | --- |
| Số ngày đình chỉ sau KO | |
| Sau TKO | |
| Có tăng mức khi bị KO nhiều lần không (bao nhiêu ngày, trong khoảng nào) | |
| Đình chỉ cấm thi đấu, cấm đối kháng hay cấm cả tập | |
| Ai quyết định và ai theo dõi | |
| Điều kiện được thi đấu lại (giấy tờ gì, ai ký) | |
| Nguồn | |

### Q16 · Kiểm tra nước khi cân

> **Có kiểm tra tỷ trọng nước tiểu hay cách khác không? Ngưỡng bao nhiêu?**
>
> **Nguồn:**

### Q17 · Quyết định 1502/QĐ-UBTDTT

- **Cần biết:** (a) bảng hạng cân **nguyên văn** trong văn bản gốc; (b) quyết định này còn hiệu lực không, hay đã có văn bản thay thế; (c) văn bản có điều nào về số ngày cấm thi đấu sau KO không.
- **Vì sao quan trọng:** bản tóm tắt nhận ngày 11/10 có dấu hiệu chép lệch: thiếu hạng 48 kg, có hạng "Nhẹ dưới 63 kg" chỉ cách hạng sau 0,5 kg ([Nghiên cứu §2](./FIGHT-CAMP-DOMAIN-RESEARCH.md#2-hạng-cân)).
- **Tìm ở đâu:** [Thư viện Pháp luật](https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-1502-QD-UBTDTT-Luat-thi-dau-Boxing-94209.aspx) (đọc trực tiếp, chụp điều khoản), vbpl.vn.

> **(a) Bảng hạng cân nguyên văn, số điều:**
>
> **(b) Còn hiệu lực / văn bản thay thế:**
>
> **(c) Điều về cấm thi đấu sau KO:**
>
> **Nguồn:**

### Q18 · Hệ hạng cân VBF và giải nghiệp dư hiện nay

- **Cần biết:** các giải VBF và giải trẻ toàn quốc 2026 dùng hạng cân World Boxing 2025, AIBA 2002, hay hệ khác.
- **Tìm ở đâu:** điều lệ giải năm 2026; website, fanpage VBF; HLV từng dự giải.

> **Trả lời (danh sách hạng cân):**
>
> **Nguồn:**

### Q19 · Quy chế Boxing chuyên nghiệp VBF

- **Cần biết:** văn bản "Quy chế Pro Boxing VBF 01/2026, 8 chương, 53 điều" mà tài liệu thị trường nhắc tới có tồn tại không. Nếu có: số hiệu, ngày ban hành, và các điều về cân, y tế, đình chỉ.
- **Vì sao quan trọng:** hiện không xác minh được; con số này đang nằm trong [VIETNAM-MARKET-ANALYSIS.md](./VIETNAM-MARKET-ANALYSIS.md).

> **Trả lời:**
>
> **Nguồn:**

---

## D. Dữ liệu và pháp lý

### Q20 · Lưu giấy xét nghiệm và dữ liệu sức khỏe

- **Cần biết:** theo **Luật Bảo vệ dữ liệu cá nhân 2025 (91/2025/QH15)** và **Nghị định 356/2025/NĐ-CP** (hiệu lực từ 01/01/2026, thay Nghị định 13/2023), app cần gì để lưu thông tin sức khỏe của võ sĩ: cân nặng, kết quả xét nghiệm, chấn thương, đình chỉ, mất ý thức sau KO. Cụ thể: nội dung và cách lưu sự đồng ý, ai được xem, lưu bao lâu.
- **Vì sao quan trọng:** Nghị định 356 coi "tình trạng sức khỏe" nói chung là dữ liệu nhạy cảm, không chỉ hồ sơ bệnh án ([Nghiên cứu §8](./FIGHT-CAMP-DOMAIN-RESEARCH.md#8-bảo-vệ-dữ-liệu-cá-nhân)).
- **Đề xuất mặc định cho pilot:** chỉ lưu trạng thái, ngày cấp và ngày hết hạn; **không** đính kèm ảnh giấy xét nghiệm máu. Võ sĩ đồng ý trong app, có lưu thời điểm và phiên bản nội dung, rút lại được.
- **Hỏi ai / tìm ở đâu:** toàn văn Luật 91/2025/QH15 và Nghị định 356/2025/NĐ-CP; người có chuyên môn pháp lý. **Không dùng Nghị định 13/2023 làm căn cứ**: văn bản này đã hết hiệu lực.
- **Ảnh hưởng tới:** [Luồng nghiệp vụ F4](./FIGHT-CAMP-BUSINESS-FLOWS.md#f4-hồ-sơ-y-tế-và-cổng-1), [Tech spec §2.4](./FIGHT-CAMP-TECH-SPEC.md#24-bout_requirements) (`attachment_path`).

> **Yêu cầu bắt buộc tìm được (điều, khoản):**
>
> **Quyết định cho pilot:**
>
> **Nguồn:**

### Q21 · Đồng ý của phụ huynh

Chỉ cần nếu Q04 có võ sĩ dưới 18 tuổi. Tra theo Luật 91/2025/QH15 và Nghị định 356/2025/NĐ-CP, không theo Nghị định 13/2023.

> **Yêu cầu về đồng ý của cha mẹ hoặc người giám hộ (điều, khoản):**
>
> **Cách thu thập trong pilot (giấy ký tay, xác nhận trong app):**
>
> **Nguồn:**

### Q22 · Hồ sơ đánh giá tác động và nơi lưu dữ liệu

- **Cần biết:** (a) trong pilot, ai là bên kiểm soát dữ liệu: CLB hay đội phát triển; (b) cần hồ sơ đánh giá tác động xử lý dữ liệu (DPIA) và chuyển dữ liệu ra nước ngoài (CTIA) nào, mất bao lâu để Cục A05 chấp thuận; (c) cần nhân sự hoặc bộ phận bảo vệ dữ liệu (DPO/DPD) không, có thuê ngoài được không.
- **Vì sao quan trọng:** database hiện đặt ở vùng `ap-northeast-1` (Tokyo). Nghị định 356 không miễn trừ cho startup khi xử lý dữ liệu nhạy cảm, và hồ sơ DPIA/CTIA phải được chấp thuận trước ([Nghiên cứu §8](./FIGHT-CAMP-DOMAIN-RESEARCH.md#8-bảo-vệ-dữ-liệu-cá-nhân)). Nếu chưa xong trước 09/11, pilot không nên nhập dữ liệu sức khỏe thật.
- **Đề xuất mặc định:** tham vấn pháp lý trong tuần này. Trong lúc chờ, cân nhắc đặt database pilot ở vùng Việt Nam, hoặc pilot với dữ liệu bút danh.
- **Hỏi ai:** luật sư hoặc đơn vị tư vấn bảo vệ dữ liệu cá nhân.
- **Ảnh hưởng tới:** [SCOPE – Kế hoạch](./SCOPE-FIGHT-CAMP.md#kế-hoạch-triển-khai), hạ tầng triển khai pilot.

> **(a) Bên kiểm soát dữ liệu:**
>
> **(b) Hồ sơ cần lập, thời gian chấp thuận:**
>
> **(c) DPO/DPD:**
>
> **Quyết định nơi lưu dữ liệu pilot:**
>
> **Nguồn / người tư vấn / ngày:**

---

## E. Đồ án

Nhóm câu hỏi này thêm ngày 13/10, sau khi xác định MMA-TMS là đồ án.

### Q23 · Hạn nộp và bảo vệ đồ án

- **Cần biết:** ngày nộp báo cáo, ngày bảo vệ, các mốc giữa kỳ (nếu có).
- **Vì sao quan trọng:** đồ án kết thúc 31/10; kế hoạch giả định review 1 khoảng 23/10 và review 2 khoảng 30/10. Ngày thật quyết định nội dung demo mỗi sprint.
- **Hỏi ai:** giảng viên hướng dẫn, thông báo của khoa.
- **Ảnh hưởng tới:** [Phạm vi – Kế hoạch](./SCOPE-FIGHT-CAMP.md#kế-hoạch-triển-khai).

| Mốc | Ngày |
| --- | --- |
| Kết thúc đồ án | 31/10/2026 |
| Review 1 với giảng viên | |
| Review 2 với giảng viên | |
| Mốc khác | |

### Q24 · Yêu cầu của trường và giảng viên hướng dẫn

- **Cần biết:** báo cáo cần những chương nào; có bắt buộc kiểm thử với người dùng thật không, bao nhiêu người; có yêu cầu về độ phủ test, tài liệu kiến trúc, hay demo trực tiếp không; phần AI đã làm có được tính vào đồ án không.
- **Vì sao quan trọng:** quyết định mức đầu tư cho kiểm thử người dùng và cách trình bày phần AI đang đóng băng.
- **Hỏi ai:** giảng viên hướng dẫn; mẫu báo cáo của khoa.

> **Trả lời:** (một phần) Giảng viên đã duyệt phạm vi "Quản lý võ sĩ trước – trong – sau trận", giữ nguyên nội dung bản 13/10. Các ý còn lại (chương báo cáo, số người kiểm thử, độ phủ test, phần AI) chưa có câu trả lời.
>
> **Nguồn / ngày:** buổi review với giảng viên; chủ dự án báo lại ngày 14/10/2026.

### Q25 · Nguồn người kiểm thử

- **Cần biết:** 3–5 người cụ thể sẽ kiểm thử, vai trò (HLV, võ sĩ, tập phong trào), cách liên hệ.
- **Vì sao quan trọng:** buổi kiểm thử diễn ra 27–29/10, cần chốt người và lịch trước 20/10. Thay cho Q01.
- **Tìm ở đâu:** [hướng dẫn kiểm thử §1](./FIGHT-CAMP-USER-TESTING.md#1-tuyển-người-kiểm-thử).

| Mã | Vai trò, kinh nghiệm | Nguồn (CLB trường, gym, nhóm Facebook, người quen…) | Đã đồng ý? |
| --- | --- | --- | --- |
| P1 | | | |
| P2 | | | |
| P3 | | | |

---

## Kiểm chứng bản trả lời ngày 13/10 (do Gemini điền)

Bản trả lời nhận ngày 13/10 **chưa được ghi vào các ô ở trên**. Lý do: phần lớn thông tin không kiểm chứng được, và có một số chỗ sai. Bảng dưới là kết quả đối chiếu. Câu nào chưa được người thật xác nhận thì vẫn coi là chưa có câu trả lời.

| Câu | Kết luận | Căn cứ |
| --- | --- | --- |
| Q01 | **Sai một phần, phần còn lại không kiểm chứng được** | Theo [lịch của VMMAF](https://vmmaf.org/thong-bao-dieu-chinh-thoi-gian-va-dia-diem-thi-dau-lion-championship-2026-n637.html), không có sự kiện LION ngày 12/12/2026 (LC37: 21/11, LC38: 19/12). Không tìm thấy CLB "Knockout Zone MMA Gym" hay HLV "Johnny Đặng" trên mạng |
| Q02–Q05 | Không kiểm chứng được | Đều dựa vào CLB và HLV ở Q01 |
| Q06, Q08, Q12 | Trùng đề xuất mặc định | Chỉ có hiệu lực khi chủ dự án xác nhận |
| Q07 | **Sai kỹ thuật** | `goals.bout_id` không thể nằm ở migration 024, vì bảng `bouts` được tạo trong chính 024. Giữ phương án 026 |
| Q09 | **Mâu thuẫn với repo** | Lịch sử git có ít nhất 4 người đóng góp; người commit nhiều nhất không có trong bảng. Số giờ mỗi tuần không kiểm chứng được |
| Q10 | **Phương pháp sai** | `pnpm db:check` chỉ kiểm tra checksum file, không kết nối database ("No database connection was opened"), nên không thể dùng để biết dữ liệu thật |
| Q11 | Quyết định nội bộ | Chờ chủ dự án xác nhận MMA thay Boxing |
| Q13 | **Đúng một phần** | Đúng theo [Luật VMMAF 2021](https://vmmaf.org/images/pdf_file/2021/mau-mma_1618298572.pdf): hạng cân khớp Điều 7, cân trước ngày thi 1 ngày theo Điều 9. Không có trong luật và không tìm thấy nguồn: giờ cân 10:00, dung sai 0, 2 giờ cân lại, phạt 20–50%, quá 2 kg thì huỷ. Ngày 12/12 sai |
| Q14 | Không kiểm chứng được | Luật VMMAF Điều 8 chỉ quy định kiểm tra y tế trước và sau trận, chi tiết theo điều lệ giải. Không có nguồn cho danh mục 4 loại giấy và hạn 10 ngày |
| Q15 | Không kiểm chứng được | Luật VMMAF không có điều nào về đình chỉ. "Quy chuẩn y tế MMA quốc tế áp dụng nội bộ" không phải một văn bản cụ thể |
| Q16 | Phù hợp nhưng chưa xác minh | Luật VMMAF không quy định kiểm tra nước; thực tế từng giải cần người trong nghề xác nhận |
| Q17 | **Sai** | Mâu thuẫn với dữ liệu đã xác minh: năm 2002 AIBA dùng 12 hạng có 63,5 / 67 / 71 kg, không phải 64 / 69 kg. Gọi văn bản là "Luật Quần vợt/Boxing". (b), (c) không dẫn văn bản thay thế hay số điều |
| Q18 | Có dấu hiệu đúng, chưa xác nhận | Giải các đội mạnh 2025 có hạng 63 kg nữ, thuộc hệ IBA. Danh sách 13 hạng nam chưa có nguồn chính thức |
| Q19 | Đúng | Khớp kết quả tra cứu trước đó: chưa tìm thấy văn bản |
| Q20, Q21 | **Căn cứ pháp lý đã hết hiệu lực** | Dựa trên Nghị định 13/2023, đã được thay bằng Luật 91/2025/QH15 và Nghị định 356/2025/NĐ-CP từ 01/01/2026 ([Nghiên cứu §8](./FIGHT-CAMP-DOMAIN-RESEARCH.md#8-bảo-vệ-dữ-liệu-cá-nhân)) |
