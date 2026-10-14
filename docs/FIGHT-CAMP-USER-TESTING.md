# Fight Camp — Hướng dẫn kiểm thử người dùng

**Cập nhật**: 2026-10-13
**Thuộc bộ tài liệu**: [Phạm vi](./SCOPE-FIGHT-CAMP.md) · [Nghiên cứu](./FIGHT-CAMP-DOMAIN-RESEARCH.md) · [Luồng nghiệp vụ](./FIGHT-CAMP-BUSINESS-FLOWS.md) · [Tech spec](./FIGHT-CAMP-TECH-SPEC.md) · **Kiểm thử người dùng** · [Câu hỏi mở](./FIGHT-CAMP-OPEN-QUESTIONS.md)

Mục tiêu: có bằng chứng cho báo cáo đồ án rằng HLV và võ sĩ dùng được hệ thống. Cụ thể: hoàn thành tác vụ chính, ghi cân nhanh, hiểu cảnh báo, và điểm SUS. Đồ án kết thúc 31/10, nên kiểm thử chỉ gồm một buổi 30 phút có quan sát với mỗi người, trong khoảng 27/10 – 29/10, dùng trận và dữ liệu giả định do team chuẩn bị sẵn.

---

## 1. Tuyển người kiểm thử

**Số lượng:** 3–5 người. Ưu tiên ít nhất 2 người từng là HLV hoặc võ sĩ thi đấu (Boxing, MMA, Muay Thai…). Số còn lại có thể là người tập võ phong trào.

| Nguồn | Cách liên hệ |
| --- | --- |
| CLB võ trong trường, phòng gym nơi thành viên team tập | Hỏi trực tiếp HLV hoặc võ sĩ |
| Khóa tập huấn HLV và trọng tài MMA quốc gia của VMMAF ([thông báo đợt 2/2026](https://vmmaf.org/dang-ky-tap-huan-huan-luyen-vien-trong-tai-mma-quoc-gia-dot-2-nam-2026-ap-dung-theo-luat-thi-dau-amma-n640.html)) | Gặp HLV tại khóa học |
| Nhóm Facebook về MMA, Boxing, Muay Thai | Đăng bài tìm người dùng thử 30 phút (gặp trực tiếp hoặc gọi video), có quà cảm ơn nhỏ |
| Bạn bè, người quen có tập võ | Nhờ giới thiệu thêm HLV |

Lời mời mẫu:

> Nhóm mình đang làm đồ án về app hỗ trợ HLV chuẩn bị cho võ sĩ trước trận: theo dõi cân, hồ sơ và lịch tập. Bọn mình cần 3–5 người dùng thử trong một buổi 30 phút, khoảng 27–29/10, làm vài thao tác trên điện thoại. Không cần trận thật, dùng trận giả định. Dữ liệu chỉ dùng cho đồ án.

## 2. Đồng ý và dữ liệu

- Trước khi bắt đầu, người kiểm thử đồng ý tham gia và cho phép dùng dữ liệu cho đồ án. Trong đợt đồ án, việc đồng ý thực hiện bằng phiếu giấy ký trước buổi kiểm thử.
- Mọi số cân và hồ sơ trong buổi kiểm thử là dữ liệu giả định do team chuẩn bị. **Không** nhập giấy tờ y tế thật: các mục hồ sơ chỉ đánh dấu đã có hoặc chưa, kèm ngày giả định.
- Dùng tên hiển thị tự đặt, không cần tên thật.
- Người kiểm thử được rút lại đồng ý và yêu cầu xoá dữ liệu bất kỳ lúc nào.
- Lý do: dữ liệu sức khỏe là dữ liệu nhạy cảm theo Luật Bảo vệ dữ liệu cá nhân 2025 ([Nghiên cứu §8](./FIGHT-CAMP-DOMAIN-RESEARCH.md#8-bảo-vệ-dữ-liệu-cá-nhân)).

## 3. Chuẩn bị

Với mỗi cặp người kiểm thử (một HLV và một võ sĩ), hoặc một người đóng cả hai vai:

- [ ] Tạo tài khoản HLV và võ sĩ; bật chế độ không có bác sĩ.
- [ ] Tạo trận giả định: preset "MMA – VMMAF 2021", ngày cân sau 6 tuần, hạng cân gần với số cân hiện tại trừ 3–5%.
- [ ] Thêm checklist hồ sơ 3 mục; cố ý để một mục trống.
- [ ] Ghi lại thiết bị người kiểm thử dùng (điện thoại, trình duyệt).

## 4. Buổi kiểm thử có quan sát (27/10 – 29/10)

**Thời lượng** 30 phút. Một người dẫn, một người ghi chép. Người dẫn không giải thích cách làm; nếu người kiểm thử bế tắc quá 2 phút thì ghi là "không hoàn thành" rồi gợi ý để đi tiếp.

**Cách nói khi bắt đầu:** "Bọn mình đang kiểm thử app, không phải kiểm tra anh/chị. Anh/chị cứ vừa làm vừa nói suy nghĩ của mình."

### Tác vụ

| # | Vai | Tác vụ giao cho người kiểm thử | Hoàn thành khi | Đo |
| --- | --- | --- | --- | --- |
| T1 | Võ sĩ | "Ghi số cân sáng nay là 66,4 kg." | Số cân xuất hiện trên biểu đồ | Thời gian (mục tiêu ≤ 30 giây) |
| T2 | HLV | "Tạo một trận mới cho võ sĩ: giải tự đặt, hạng 60 kg, cân ngày …, thi ngày hôm sau." | Trận xuất hiện trong danh sách | Thời gian, số lần sai |
| T3 | HLV | "Giải này yêu cầu thêm giấy điện tâm đồ, hạn 6 tháng. Thêm vào hồ sơ của trận." | Mục mới có trong checklist | Hoàn thành / không |
| T4 | HLV | "Võ sĩ này có kịp cân không? Vì sao?" | Trả lời đúng theo trạng thái cảnh báo | Trả lời đúng / sai |
| T5 | HLV | "Chuyển trận sang tuần thi đấu." (hồ sơ còn thiếu, app sẽ chặn) | Người kiểm thử chỉ ra được mục còn thiếu | Hoàn thành / không |
| T6 | HLV | "Võ sĩ thua KO ở hiệp 2, không mất ý thức. Ghi kết quả." | Đình chỉ được tạo với số ngày | Thời gian |
| T7 | HLV | "Xếp một buổi sparring cho võ sĩ vào tuần sau." (app sẽ chặn) | Người kiểm thử hiểu vì sao bị chặn và đến khi nào | Giải thích đúng / sai |

### Phỏng vấn ngắn sau tác vụ (5 phút)

1. Phần nào khó hiểu nhất?
2. Nếu có trận thật, anh/chị có muốn dùng cái này không? Thay cho cái gì đang dùng?
3. Còn thiếu gì để dùng được thật?

## 5. Phiếu SUS

Người kiểm thử chấm từng câu từ 1 (hoàn toàn không đồng ý) đến 5 (hoàn toàn đồng ý).

| # | Câu | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Tôi nghĩ tôi sẽ muốn dùng hệ thống này thường xuyên | | | | | |
| 2 | Tôi thấy hệ thống phức tạp không cần thiết | | | | | |
| 3 | Tôi thấy hệ thống dễ dùng | | | | | |
| 4 | Tôi nghĩ tôi cần người có kỹ thuật hỗ trợ mới dùng được hệ thống này | | | | | |
| 5 | Tôi thấy các chức năng trong hệ thống được kết nối tốt với nhau | | | | | |
| 6 | Tôi thấy hệ thống có quá nhiều chỗ không nhất quán | | | | | |
| 7 | Tôi nghĩ đa số mọi người sẽ học dùng hệ thống này rất nhanh | | | | | |
| 8 | Tôi thấy hệ thống rất rườm rà, khó thao tác | | | | | |
| 9 | Tôi thấy tự tin khi dùng hệ thống | | | | | |
| 10 | Tôi phải học nhiều thứ trước khi dùng được hệ thống này | | | | | |

**Cách tính điểm:** câu lẻ lấy (điểm − 1), câu chẵn lấy (5 − điểm), cộng 10 câu rồi nhân 2,5. Kết quả từ 0 đến 100; mục tiêu ≥ 68.

## 6. Mẫu ghi chép

```markdown
### [Mã người kiểm thử, ví dụ P1] – [vai: HLV / võ sĩ / cả hai] – [ngày]
- Kinh nghiệm: [HLV / võ sĩ thi đấu / tập phong trào], [số năm]
- Thiết bị: [điện thoại, trình duyệt]
- T1: __ giây | T2: __ giây, __ lần sai | T3: Đạt/Không | T4: Đúng/Sai | T5: Đạt/Không | T6: __ giây | T7: Đúng/Sai
- Điểm SUS: __
- Chỗ vướng (ghi nguyên văn lời người kiểm thử):
- Trả lời phỏng vấn ngắn:
```

## 7. Tổng hợp cho báo cáo

| Người | Vai | T1 (giây) | Tác vụ đạt (/7) | SUS |
| --- | --- | --- | --- | --- |
| P1 | | | | |
| P2 | | | | |
| P3 | | | | |
| **Tổng hợp** | | Trung vị | Tỷ lệ | Trung bình |

Mỗi vấn đề tìm được ghi một dòng: mô tả, bao nhiêu người gặp, mức độ (chặn / gây khó / nhỏ), đã sửa hay chưa. Các vấn đề mức "chặn" phải sửa trước buổi bảo vệ.
