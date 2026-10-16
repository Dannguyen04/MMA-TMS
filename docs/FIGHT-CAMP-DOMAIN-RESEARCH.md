# Fight Camp — Nghiên cứu nghiệp vụ: cân, hồ sơ, đình chỉ

**Cập nhật**: 2026-10-11
**Thuộc bộ tài liệu**: [Phạm vi](./SCOPE-FIGHT-CAMP.md) · **Nghiên cứu** · [Luồng nghiệp vụ](./FIGHT-CAMP-BUSINESS-FLOWS.md) · [Tech spec](./FIGHT-CAMP-TECH-SPEC.md) · [Kiểm thử người dùng](./FIGHT-CAMP-USER-TESTING.md) · [Câu hỏi mở](./FIGHT-CAMP-OPEN-QUESTIONS.md)

**Kết luận chính:** không có một bộ quy định duy nhất mà app có thể hard-code. Hạng cân, giờ cân, số ngày đình chỉ và hồ sơ y tế khác nhau giữa các giải và tổ chức, và nhiều con số trong tài liệu thị trường chưa có văn bản gốc. App phải lưu các quy định này thành **bộ luật (ruleset) cấu hình theo từng giải**, đánh dấu rõ cái nào đã xác minh và cái nào chưa.

Tài liệu này dành cho PO và dev khi thiết kế luồng cân, Cổng 1 và Cổng 2. Đây không phải tư vấn y tế: mọi ngưỡng dưới đây chỉ dùng để app **cảnh báo** và nhắc HLV trao đổi với người có chuyên môn, không dùng để kê chế độ ăn hay chế độ giảm nước.

---

## 1. Quy định tại Việt Nam: tìm được gì, chưa tìm được gì

| Nội dung | Kết quả tra cứu | Mức tin cậy |
| --- | --- | --- |
| Quy chế Boxing chuyên nghiệp VBF "01/2026, 8 chương, 53 điều" (trích từ [VIETNAM-MARKET-ANALYSIS.md](./VIETNAM-MARKET-ANALYSIS.md) §3.3) | Không tìm thấy văn bản gốc hay tin chính thức nào | **Chưa xác minh**, không dùng làm căn cứ |
| Luật thi đấu Boxing nghiệp dư, Quyết định 1502/QĐ-UBTDTT ngày 25/09/2002 ([Thư viện Pháp luật](https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-1502-QD-UBTDTT-Luat-thi-dau-Boxing-94209.aspx)) | Team gửi bản tóm tắt ngày 11/10: 12 hạng cân, võ sĩ phải qua kiểm tra y tế trước giải/trận, thua KO khi không tiếp tục được sau khi trọng tài đếm đến 10. Bản tóm tắt **không** có số ngày cấm thi đấu sau KO của chính quyết định này (con số 28–45 ngày trong đó là "chuẩn quốc tế", không phải điều khoản của 1502) | Tóm tắt thứ cấp; bảng hạng cân có dấu hiệu chép lệch (xem §2); văn bản năm 2002 có thể đã được thay |
| Quy chế bảo đảm y tế cho VĐV đội tuyển, [Quyết định 44/2005/QĐ-UBTDTT](https://luatvietnam.vn/y-te/quyet-dinh-44-2005-qd-ubtdtt-ban-hanh-quy-che-bao-dam-y-te-cho-van-dong-vien-cac-doi-tuyen-the-thao-20814-d1.html) | Quy định khám định kỳ (khám lâm sàng nội, ngoại khoa, kiểm tra y học – sư phạm) cho VĐV đội tuyển và CLB chuyên nghiệp tập trung | Văn bản năm 2005, không nói về điều kiện thi đấu |
| Điều kiện cơ sở tập quyền anh, [Thông tư 20/2011/TT-BVHTTDL](https://moit.gov.vn/van-ban-phap-luat/van-ban-phap-quy/thong-tu-quy-dinh-ve-dieu-kien-hoat-dong-cua-co-so-the-thao-.html) | Quy định cơ sở vật chất, thiết bị, nhân sự của nơi tập; không quy định hồ sơ võ sĩ | Không liên quan trực tiếp |
| LION Championship (MMA), Luật thi đấu Võ thuật tổng hợp của VMMAF | [Luật thi đấu Võ thuật tổng hợp, VMMAF, QĐ 01/QĐ-LĐVTTHVN ngày 01/02/2021](https://vmmaf.org/images/pdf_file/2021/mau-mma_1618298572.pdf) (đã đọc toàn văn, 30 điều) áp dụng cho mọi giải MMA tại Việt Nam. Điều 6: hệ chuyên nghiệp từ 18 tuổi. Điều 8: ban tổ chức kiểm tra y tế trước và sau trận, **chi tiết theo điều lệ từng giải**. Điều 9: giải một ngày thì cân **trước ngày thi đấu 1 ngày**; giải nhiều ngày thì cân đầu mỗi ngày thi, xong ít nhất 6 giờ trước trận đầu. Luật **không** có quy định về dung sai cân, phạt khi trượt cân, danh mục hồ sơ y tế hay đình chỉ sau KO. Lịch LION 2026 theo [thông báo của VMMAF ngày 06/05/2026](https://vmmaf.org/thong-bao-dieu-chinh-thoi-gian-va-dia-diem-thi-dau-lion-championship-2026-n637.html): LC37 ngày 21/11 tại Bắc Ninh, LC38 ngày 19/12 tại Cung TT Quần Ngựa, Hà Nội | Luật chung đã xác minh; điều lệ riêng của từng sự kiện LION chưa thấy công khai |

**Hệ quả:** các ví dụ hồ sơ từng ghi trong tài liệu phạm vi (xét nghiệm HBsAg/HCV/HIV, CT não, khám tại weigh-in) vẫn là giả thuyết lấy từ tài liệu thị trường. Danh sách hồ sơ phải lấy từ thông báo của chính ban tổ chức mỗi giải mà CLB pilot tham gia.

## 2. Hạng cân

Hạng cân thay đổi theo tổ chức và theo thời gian, nên app không thể dùng `weightClassEnum` (FLYWEIGHT, BANTAMWEIGHT…) hiện có làm căn cứ cho trận.

| Hệ thống | Hạng cân (kg) | Nguồn |
| --- | --- | --- |
| World Boxing, nam (từ 2025) | 50, 55, 60, 65, 70, 75, 80, 85, 90, +90 | [DT Next](https://www.dtnext.in/news/sports/bfi-adopts-world-boxings-new-weight-classes-818552) |
| World Boxing, nữ (từ 2025) | 48, 51, 54, 57, 60, 65, 70, 75, 80, +80 | Như trên |
| Danh sách trong tài liệu thị trường (gán cho VBF) | 48, 51, 54, 57, 60, 63.5, 67, 71, 75, 80, 86, 92, +92 | Giống hệ IBA cũ; chưa rõ VBF hiện dùng hệ nào |
| QĐ 1502/QĐ-UBTDTT (2002), nghiệp dư, **suy ra** | 48, 51, 54, 57, 60, 63.5, 67, 71, 75, 81, 91, +91 | Đây là 12 hạng AIBA dùng năm 2002, ví dụ ở [Giải vô địch châu Á 2002](https://en.wikipedia.org/wiki/2002_Asian_Amateur_Boxing_Championships); AIBA đổi hệ hạng cân năm 2003. Bản tóm tắt team gửi ghi "Bán ruồi dưới 51 … Nhẹ dưới 63, Trên nhẹ dưới 63,5": thiếu hạng 48 kg, có một hạng chỉ rộng 0,5 kg, và tên lệch một bậc so với AIBA, nên nhiều khả năng bị chép lệch. Cần đối chiếu điều khoản gốc |
| VMMAF (mọi giải MMA, gồm LION), Điều 7 | 12 hạng theo khoảng: 42–44, 44–48, 48–52, 52–56, 56–60, 60–65, 65–70, 70–77, 77–84, 84–93, 93–120, trên 120 kg. Các hạng LION thấy trên báo (52, 56, 60, 65, 70, 77, 84) khớp với cận trên của các khoảng này | [Luật thi đấu Võ thuật tổng hợp, VMMAF, QĐ 01/QĐ-LĐVTTHVN ngày 01/02/2021](https://vmmaf.org/images/pdf_file/2021/mau-mma_1618298572.pdf). Luật không chia hạng theo giới tính |

**Hệ quả:** mỗi ruleset có danh sách hạng cân riêng. Trận lưu **giới hạn cân bằng kg tại thời điểm tạo trận** (snapshot), để việc sửa ruleset sau này không làm đổi trận cũ.

## 3. Cân chính thức và kiểm tra nước

- **ONE Championship** ([trang chính thức](https://www.onefc.com/martial-arts)): võ sĩ phải qua kiểm tra nước tiểu (tỷ trọng nước tiểu ≤ 1.025) rồi mới được cân, trong khung 24–48 giờ trước sự kiện, cửa sổ thử 3 giờ. Trượt cân thì có thể đàm phán trận catchweight nếu hai võ sĩ chênh nhau trong khoảng 105% và người trượt mất một phần tiền thưởng.
- **Boxing chuyên nghiệp nói chung:** buổi cân thường diễn ra khoảng 24 giờ trước trận và có khám nhanh (nhịp tim, huyết áp, thị lực). Thông tin này chỉ có trên blog tổng hợp ([fight100.vn](https://fight100.vn/luat-boxing/)), cần xác nhận với BTC.
- **Giải nghiệp dư nhiều ngày:** thường cân vào sáng mỗi ngày thi đấu. Theo nguồn ở mục 4, khi chỉ còn khoảng 6 giờ để hồi phục thì mức giảm cấp tốc an toàn thấp hơn hẳn.

**Hệ quả:** trận phải lưu **thời điểm cân** và **thời điểm thi đấu** riêng. Khoảng cách giữa hai mốc này quyết định ngưỡng cảnh báo ở mục 4. Ô "kiểm tra nước" là trường tùy chọn của bước cân chính thức, vì chỉ một số giải áp dụng.

## 4. Giảm cân cấp tốc: giới hạn khuyến nghị

Nguồn chính: Reale, R. (2018), *Acute Weight Management in Combat Sports*, [GSSI Sports Science Exchange #183](https://www.gssiweb.org/sports-science-exchange/article/acute-weight-management-in-combat-sports-pre-weigh-in-weight-loss-post-weigh-in-recovery-and-competition-nutrition-strategies). Tác giả này cũng viết bài trên IJSPP 2017 về chiến lược giảm cân cấp tốc ([ACU Research Bank](https://acuresearchbank.acu.edu.au/item/88q7v/acute-weight-loss-strategies-for-combat-sports-and-applications-to-olympic-success)).

| Khoảng từ lúc cân đến lúc thi đấu | Mức giảm cấp tốc tối đa (% khối lượng cơ thể) | Ghi chú |
| --- | --- | --- |
| Trên 12 giờ (cân hôm trước) | 8% | Với VĐV đủ nước, đủ dinh dưỡng; không nên đạt 5–8% chỉ bằng mất nước |
| Khoảng 6 giờ trở xuống (cân sáng ngày thi) | 5% | Trong đó không quá 3% bằng mất nước |

Các điểm khác từ cùng nguồn:

- **Thứ tự can thiệp:** giảm chất trong ruột trước, rồi glycogen, cuối cùng mới đến nước trong cơ thể.
- **Bù nước sau cân:** uống 125–150% lượng dịch đã mất, bắt đầu bằng 600–900 mL ngay sau khi cân. Ưu tiên dung dịch có natri cao như ORS.
- **Phương pháp:** đổ mồ hôi chủ động trong buổi tập tốt hơn xông hơi. Nếu xông hơi thì dùng hơi khô. Cắt giảm quá mức có thể gây hậu quả nghiêm trọng, kể cả tử vong.

Tổng quan của Barley, Chapman & Abbiss (2019), [The Current State of Weight-Cutting in Combat Sports](https://pmc.ncbi.nlm.nih.gov/articles/PMC6572325), *Sports* 7(5):123:

- 60–80% VĐV đối kháng cho biết có ép cân. Tỷ lệ cao nhất ở boxing và MMA.
- Đã ghi nhận mức giảm hơn 5% khối lượng trong 24 giờ trước khi cân.
- Giảm khoảng 5% trong dưới 24 giờ làm giảm khả năng thi đấu cường độ cao lặp lại.
- Chưa có xét nghiệm nước nào đủ chính xác để dùng tin cậy khi mất nước cấp tính.
- Nghiên cứu về rủi ro sức khỏe còn rất mỏng.

**Hệ quả (cách app dùng các con số này):**

1. Quy tắc cảnh báo chỉ dựa trên **phần trăm còn phải giảm** so với giới hạn hạng cân, đối chiếu với **thời gian còn lại** và **khoảng cách cân – thi đấu** của trận. Công thức nằm trong [Tech spec §5](./FIGHT-CAMP-TECH-SPEC.md#5-cảnh-báo-cân-nặng).
2. App **không** gợi ý chế độ ăn, chế độ hạn chế nước hay xông hơi. Khi cảnh báo đỏ, app chỉ hiện: "Mức còn phải giảm vượt ngưỡng khuyến nghị. Trao đổi với bác sĩ hoặc chuyên gia dinh dưỡng, cân nhắc đổi hạng cân."
3. Các ngưỡng 8% và 5% được lưu thành cấu hình của ruleset (`acuteLossLimitPct`), không hard-code, để bác sĩ của CLB có thể siết lại.
4. Nguồn không đưa ra tốc độ giảm cân dài hạn an toàn theo tuần, nên app không đặt ngưỡng theo tuần. Đường cân mục tiêu chỉ để HLV nhìn xu hướng.

## 5. Đình chỉ sau trận

Số ngày đình chỉ khác nhau theo nơi, và con số "KO 60–90 ngày, TKO 30–45 ngày" trong tài liệu thị trường không khớp với một quy định cụ thể nào.

| Nơi áp dụng | KO | TKO | Quy định khác | Nguồn |
| --- | --- | --- | --- | --- |
| Illinois (Mỹ) | Tối thiểu 45 ngày (đòn vào đầu) | Tối thiểu 30 ngày | Mọi võ sĩ phải nghỉ 15 ngày sau mỗi trận; có thể cấm đối kháng trong lúc đình chỉ; truất quyền thi đấu thì tối thiểu 45 ngày | [Ill. Admin. Code tit. 68 §1370.200](https://www.law.cornell.edu/regulations/illinois/Ill-Admin-Code-tit-68-SS-1370.200) |
| Georgia (Mỹ) | 60 ngày lần đầu; KO lần hai có thể yêu cầu CT, điện tim | 30 ngày, trừ khi bác sĩ ringside quyết định khác | Công nhận đình chỉ của các ủy ban khác thuộc ABC | Kết quả tìm kiếm trích Ga. Comp. R. & Regs. 85-1-.04; trang gốc chặn truy cập, chưa đọc trực tiếp |
| Boxing nghiệp dư theo luật AIBA (qua hướng dẫn y tế của Boxing Scotland, 2018) | Tối thiểu 30 ngày. KO lần 2 trong 90 ngày: 90 ngày kể từ lần 2. KO lần 3 trong 12 tháng: 1 năm | Tính như KO nếu trọng tài dừng trận vì đòn mạnh vào đầu (RSC) | Bác sĩ ringside phân loại chấn động: không mất ý thức tối thiểu 30 ngày, mất ý thức dưới 1 phút tối thiểu 90 ngày, trên 1 phút tối thiểu 180 ngày. **Cấm cả tập lẫn đối kháng** trong thời gian hạn chế. KO trong buổi tập cũng áp dụng, HLV có trách nhiệm báo. Muốn thi đấu lại phải có xác nhận bằng văn bản của hội đồng y tế quốc gia, hoặc bác sĩ thần kinh / y học thể thao | [BSL Generic Medical Guidance as per the AIBA Technical & Competition Rules](https://www.boxingscotland.org/version2/wp-content/uploads/2018/02/BSL-Generic-Medical-Advice.pdf), mục 2.3 |
| Boxing chuyên nghiệp Anh (BBBofC) | 28–45 ngày (thông lệ) | — | — | Kết quả tìm kiếm, chưa mở trang gốc. Đây có thể là nguồn của con số "28–45 ngày" trong bản tóm tắt 1502 |
| Việt Nam (VBF, QĐ 1502) | Chưa tìm thấy điều khoản | Chưa tìm thấy | QĐ 1502 yêu cầu kiểm tra y tế trước thi đấu | Tóm tắt do team cung cấp |
| Việt Nam, MMA (VMMAF 2021) | **Không quy định** | **Không quy định** | Giám sát y tế được đề nghị dừng trận khi võ sĩ chấn thương (Điều 13, 27) | [Luật thi đấu Võ thuật tổng hợp, VMMAF, QĐ 01/QĐ-LĐVTTHVN ngày 01/02/2021](https://vmmaf.org/images/pdf_file/2021/mau-mma_1618298572.pdf) |

**Hệ quả:**

1. Đình chỉ trong ruleset là **danh sách quy tắc** (`suspensionRules`), không phải vài con số cố định, vì luật AIBA tăng mức theo số lần KO trong một khoảng thời gian và theo mức chấn động. Khi ghi kết quả, app **gợi ý** số ngày bằng quy tắc nặng nhất khớp với lịch sử của võ sĩ. HLV (hoặc bác sĩ) **xác nhận hoặc sửa**, và lý do sửa được lưu lại.
2. Để đếm được "KO lần 2 trong 90 ngày", app phải đếm cả **KO trong buổi tập**. Đình chỉ tạo thủ công có lý do `KO` (không gắn trận) cũng được tính vào lịch sử.
3. Ngoài đình chỉ do KO/TKO, mọi trận đều tạo **thời gian nghỉ bắt buộc** nếu ruleset có `restDaysAfterBout > 0` (Illinois: 15 ngày).
4. Mức chặn của Cổng 2 đi theo ruleset. Illinois "có thể cấm đối kháng", nên mặc định chặn `SPARRING`. AIBA cấm "cả tập lẫn đối kháng", nên preset AIBA chặn mọi loại buổi tập trừ `RECOVERY` và `PHYSICAL_THERAPY`. HLV có thể chặn thêm cho từng lần đình chỉ.
5. Kết thúc đình chỉ do KO cần **căn cứ bằng văn bản**: AIBA yêu cầu xác nhận của hội đồng y tế hoặc bác sĩ thần kinh / y học thể thao. App ghi căn cứ dạng chữ khi bấm "được tập lại" (đồ án không lưu ảnh giấy tờ y tế), và ghi rõ khi không có giấy.
6. Ruleset tạo sẵn (preset) phải ghi rõ "tham khảo, chưa xác minh với BTC" cho đến khi có văn bản của giải.

## 6. Tóm tắt: phát hiện và quyết định thiết kế

| Phát hiện | Quyết định |
| --- | --- |
| Không có bộ luật VN chuẩn, công khai | Ruleset cấu hình theo giải, có cờ `verified` và ghi chú nguồn |
| Hạng cân khác nhau theo tổ chức | Trận lưu `weightLimitKg` snapshot; không dùng `weightClassEnum` cho trận |
| Ngưỡng giảm cấp tốc phụ thuộc khoảng cân – thi đấu | Trận lưu `weighInAt` và `boutAt`; ngưỡng 8% hoặc 5% chọn theo khoảng này |
| Đình chỉ khác nhau, cần quyết định của người có thẩm quyền | Gợi ý từ ruleset, HLV/bác sĩ xác nhận, lưu lý do sửa |
| AIBA tăng mức đình chỉ theo số lần KO và mức chấn động, tính cả KO khi tập | Quy tắc đình chỉ là danh sách có điều kiện; app đếm lịch sử KO của võ sĩ, kể cả KO ngoài trận |
| Rủi ro sức khỏe khi ép cân, bằng chứng còn mỏng | App chỉ cảnh báo và chuyển cho chuyên môn, không kê chế độ |
| Hồ sơ y tế khác nhau theo giải | Checklist hồ sơ là dữ liệu của ruleset; trận sinh checklist từ đó |

## 7. Việc cần xác minh với CLB và BTC (đưa vào phỏng vấn M0)

Với đồ án (quyết định 13/10), các mục dưới đây **không còn chặn tiến độ**: quy định riêng của giải do HLV tự nhập trên trận. Chúng vẫn có ích nếu tìm được nguồn, để bổ sung preset.

- [ ] Giải mà CLB pilot sắp tham gia: tên, đơn vị tổ chức, bộ môn, hạng cân, giờ cân so với giờ thi đấu.
- [ ] Danh sách hồ sơ y tế BTC yêu cầu, thời hạn hiệu lực của từng loại, hạn nộp.
- [ ] Quy định đình chỉ sau KO/TKO của giải đó (nếu có), và ai theo dõi việc này.
- [ ] Có kiểm tra nước (tỷ trọng nước tiểu) hay không.
- [x] Tóm tắt Quyết định 1502/QĐ-UBTDTT (team gửi ngày 11/10).
- [ ] Đối chiếu bảng hạng cân trong điều khoản gốc của QĐ 1502 (nghi chép lệch, xem §2), và kiểm tra quyết định này còn hiệu lực hay đã có văn bản thay thế.
- [ ] VBF và các giải nghiệp dư hiện nay (ví dụ giải trẻ toàn quốc 2026) dùng hạng cân World Boxing 2025, AIBA 2002 hay hệ khác.
- [ ] Giải nghiệp dư Việt Nam có áp dụng quy tắc đình chỉ kiểu AIBA (30 / 90 ngày / 1 năm) hay không, ai theo dõi.

## 8. Bảo vệ dữ liệu cá nhân

**Kết luận:** từ 01/01/2026, khung pháp lý là **Luật Bảo vệ dữ liệu cá nhân 2025 (Luật số 91/2025/QH15)** và **Nghị định 356/2025/NĐ-CP**. Nghị định 356 thay thế Nghị định 13/2023/NĐ-CP. App Fight Camp xử lý dữ liệu sức khỏe nên **không được hưởng miễn trừ dành cho startup**, và dữ liệu đang lưu ở nước ngoài. Với đồ án, chỉ dùng dữ liệu giả hoặc dữ liệu của người kiểm thử đã đồng ý; nếu sau này đưa ra sử dụng thật thì cần tham vấn pháp lý **trước khi nhập dữ liệu thật**. Mục này là tóm tắt nghiên cứu, không phải tư vấn pháp lý.

Nguồn: [EY – Tin nhanh Pháp lý tháng 3/2026 về Nghị định 356/2025/NĐ-CP](https://www.ey.com/content/dam/ey-unified-site/ey-com/vi-vn/technical/tax/documents/ey-vietnam-legal-alert-march-2026-decree-no356-2025-nd-cp-providing-detailed-guidance-for-implementation-of-personal-data-protection-law-viet.pdf) (đã đọc toàn văn bản tin); toàn văn [Nghị định 356/2025/NĐ-CP](https://thuvienphapluat.vn/van-ban/Quyen-dan-su/Nghi-dinh-356-2025-ND-CP-huong-dan-Luat-Bao-ve-du-lieu-ca-nhan-687428.aspx) (chưa đọc trực tiếp, trang chặn truy cập tự động).

| Quy định (theo bản tin EY) | Áp dụng cho app |
| --- | --- |
| Dữ liệu nhạy cảm gồm "tình trạng sức khỏe" nói chung, không chỉ hồ sơ bệnh án | Cân nặng trong camp, chấn thương, đình chỉ, mất ý thức sau KO, hồ sơ khám **đều có thể là dữ liệu nhạy cảm**, không riêng giấy xét nghiệm |
| Sự đồng ý phải rõ ràng, kiểm chứng được (lưu thời điểm và nội dung đồng ý); không được đặt sẵn "đồng ý" | App cần màn xin đồng ý lưu lại thời điểm và phiên bản nội dung; không có ô tick sẵn |
| Hồ sơ đánh giá tác động xử lý dữ liệu (DPIA) và chuyển dữ liệu xuyên biên giới (CTIA) chuyển sang **tiền kiểm**: Cục A05, Bộ Công an xem xét trong 15 ngày | Phải có hồ sơ được chấp thuận trước khi xử lý; cần tính vào lộ trình pilot |
| Miễn trừ DPO và DPIA/CTIA cho doanh nghiệp nhỏ, startup (5 năm từ 01/01/2026) **không áp dụng** nếu trực tiếp xử lý dữ liệu nhạy cảm | App không được miễn trừ: cần nhân sự hoặc bộ phận bảo vệ dữ liệu (có thể thuê ngoài) và hồ sơ DPIA |
| Chuyển dữ liệu nhạy cảm phải có biện pháp bảo mật, mã hóa hoặc ẩn danh | Áp dụng cho mọi bản sao, export, backup |

**Vị trí lưu trữ hiện tại:** database Supabase của dự án đặt ở vùng `aws-0-ap-northeast-1` (Tokyo), theo cấu hình `nestjs-api/.env` kiểm tra ngày 13/10/2026. Dữ liệu của võ sĩ Việt Nam lưu ở đây là **chuyển dữ liệu ra nước ngoài**, cần hồ sơ CTIA.

**Hệ quả cho sản phẩm:**

1. Nếu đưa ra sử dụng thật sau đồ án: tham vấn pháp lý về vai trò của từng bên (CLB hay đội phát triển là bên kiểm soát dữ liệu), hồ sơ DPIA/CTIA, và thời gian chờ A05.
2. Phương án giảm rủi ro cần cân nhắc: đặt database ở vùng Việt Nam hoặc tự host trong nước; hoặc pilot chỉ với dữ liệu bút danh, chưa nhập hồ sơ y tế thật.
3. Màn xin đồng ý của võ sĩ (lưu thời điểm, phiên bản, cho phép rút lại) là việc bắt buộc của M1, không phải tùy chọn.
4. Quyết định cũ "không lưu ảnh giấy xét nghiệm máu" vẫn giữ, nhưng chưa đủ: các trường còn lại vẫn là dữ liệu nhạy cảm.
5. Quy định về dữ liệu của người chưa thành niên phải tra theo Luật 91/2025 và Nghị định 356, không theo Nghị định 13.
