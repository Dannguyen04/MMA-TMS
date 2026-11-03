/// <reference types="jest" />
import { campText } from "./fight-camp";

// Phase 5 G: the 354 Fight Camp strings moved out of src/screens/fight-camp, frozen as they were
// before the move (no wording change). Templates are checked by calling them with markers.
const PLAIN: string[] = [
"chưa đặt",
"Được tập một phần",
"Được tập",
"Chưa được tập",
"số nguyên không âm",
"số dương",
"Đã lên lịch",
"Trong trại tập",
"Tuần thi đấu",
"Đã cân chính thức",
"Đã kết thúc",
"Đã huỷ",
"Hiệu quả",
"Không hiệu quả",
"Chưa dùng",
"Nhập số kg, tối đa một chữ số sau dấu phẩy.",
"Cân nặng phải từ 30 đến 200 kg.",
"Hồ sơ thi đấu đang khoá trong tuần thi đấu và sau khi cân. Cần ghi lý do mở khoá trước khi sửa.",
"Tối đa 6 quan sát và 5 chiến thuật.",
"Mỗi quan sát cần có nội dung.",
"Mỗi quan sát cần đường dẫn hoặc ghi chú bằng chứng.",
"Đường dẫn bằng chứng phải bắt đầu bằng http:// hoặc https://.",
"Mỗi chiến thuật cần có nội dung.",
"Chọn ít nhất một quan sát làm căn cứ cho mỗi chiến thuật.",
"Hiệp áp dụng phải nằm trong số hiệp của trận.",
"Đã xác nhận",
"Đã cung cấp",
"Còn thiếu",
"Chưa hợp lệ",
"Hết hạn",
"Đánh gió",
"Đánh đích",
"Đánh bao",
"Đối luyện",
"Vật / khoá siết",
"Thể lực và sức mạnh",
"Phục hồi",
"Vật lý trị liệu",
"Sắp áp dụng",
"Đang đình chỉ",
"Chờ xác nhận tập lại",
"Đã kết thúc",
"Hạ đo ván (KO)",
"Hạ đo ván kỹ thuật (TKO)",
"Truất quyền thi đấu",
"Nghỉ bắt buộc",
"Y tế",
"Khác",
"Nhẹ, không gắng sức",
"Gắng sức, không đánh",
"Kỹ thuật không va chạm",
"Va chạm có kiểm soát",
"Đối kháng toàn phần",
"Hôm nay",
"Chờ bác sĩ xác nhận được tập lại",
"Trạng thái đình chỉ: Chưa rõ",
"Tập đầy đủ",
"Lý do",
"Bắt đầu",
"Ngày hết thời hạn",
"Đình chỉ này đã kết thúc.",
"Cần xác nhận cho tập lại; chưa thể chốt ngày trở lại.",
"Cân nặng chính thức",
"Chưa có giới hạn",
"kg",
"Giới hạn cân ở góc phải · 30–200 kg · 1 số thập phân",
"Đang tải dữ liệu…",
"Quay lại",
"Dữ liệu mẫu",
"Chưa có số cân. Ghi cân hôm nay để bắt đầu theo dõi.",
"Chấm: số cân đã ghi · Nét đứt: lộ trình / giới hạn",
"Trận thi đấu",
"Cân chính thức, chuẩn bị góc đài và ghi hiệp.",
"Xem bản mẫu giao diện",
"Không tải được danh sách",
"Chưa có trận thi đấu",
"Các trận của võ sĩ bạn phụ trách sẽ xuất hiện tại đây.",
"Đối thủ: ",
"Chưa xác định",
"Giới hạn",
"Mở chi tiết trận",
"Tải thêm trận",
"Tải lại danh sách",
"Chi tiết trận",
"Cân chính thức",
"Kết quả cân",
"Xác nhận huỷ trận",
"Thẻ góc đài",
"Ghi chú và ghi hiệp",
"Lời dặn giữa hiệp",
"Phân tích đối thủ",
"Báo cáo trận",
"Không đạt cân",
"Nguyễn Thành Long",
"Ghi cân chính thức",
"Giới hạn mới không được thấp hơn số cân chính thức.",
"Xác nhận huỷ trận",
"Lý do huỷ cần ít nhất 3 ký tự.",
"Đã huỷ trận",
"Giữ trận, quay lại",
"Võ sĩ",
"Đấu với",
"Đối thủ chưa xác định",
"Cân chính thức",
"Thi đấu",
"Địa điểm",
"Chưa xác định",
"Giới hạn",
"Số hiệp",
"Chưa đặt",
"Chưa đủ hồ sơ để vào tuần thi đấu",
"Mục bắt buộc phải được cung cấp hoặc xác nhận và còn hạn đến ngày thi đấu.",
"Võ sĩ đang có đình chỉ",
"Buổi tập thuộc loại bị chặn không thể xếp lịch trong thời gian đình chỉ.",
"Chưa tải được trạng thái đình chỉ",
"Giảm cân cấp tốc vượt ngưỡng",
"Giảm ",
"%; ngưỡng theo bộ luật là ",
"Ghi cân chính thức",
"Mở thẻ góc đài",
"Ghi chú và ghi hiệp",
"Thẻ góc đài và ghi hiệp mở sau khi cân chính thức đạt hoặc hoàn tất catchweight.",
"Phân tích đối thủ",
"Hồ sơ thi đấu",
"Chưa có mục hồ sơ.",
"Võ sĩ",
"Chưa thực hiện được",
"Thử tải lại",
"Trạng thái mẫu để xem giao diện",
"Tuần thi đấu",
"Đã cân",
"Kết thúc",
"Kiểm tra nước",
"Không áp dụng",
"Đạt",
"Không đạt",
"Ghi chú (tuỳ chọn)",
"Giảm cân cấp tốc vượt ngưỡng",
"Kiểm tra cảnh báo trước khi tiếp tục ghi cân.",
"Cân chính thức",
"kg",
"Đạt cân chính thức",
"Kiểm tra nước không đạt",
"Giới hạn",
"Trạng thái trận",
"Giảm cân cấp tốc vượt ngưỡng",
"Giảm ",
"%; ngưỡng theo bộ luật là ",
"Về chi tiết trận",
"Đã ghi cân chính thức",
"HLV muốn xử lý thế nào?",
"Trận vẫn ở Tuần thi đấu cho đến khi HLV chọn thoả thuận catchweight hoặc huỷ trận.",
"Huỷ trận",
"Giới hạn đã thoả thuận",
"Không thấp hơn số cân chính thức ",
"kg.",
"Ghi chú thoả thuận (tuỳ chọn)",
"Trận sẽ chuyển sang trạng thái đã huỷ sau khi xác nhận.",
"Lý do huỷ trận",
"Từ 3 đến 500 ký tự",
"Đang theo lộ trình",
"Cao hơn lộ trình",
"Vượt giới hạn",
"Chưa ghi cân",
"Đã qua cân chính thức",
"Trận của tôi",
"Lịch thi đấu và số cân theo ngày.",
"Không tải được trận",
"Thử tải lại",
"Chưa có trận sắp tới",
"Bạn vẫn có thể ghi số cân hôm nay.",
"Ghi cân hôm nay",
"Ghi cân hôm nay",
"Hôm qua chưa có số cân. Ghi số cân hôm nay để tiếp tục theo dõi.",
"Cần số cân hôm nay để cập nhật tiến độ tuần thi đấu.",
"Số cân hôm nay",
"kg",
"Báo HLV để thống nhất bước tiếp theo trước buổi cân chính thức.",
"Còn ",
"% để chạm giới hạn",
"Sửa cân hôm nay",
"Ghi cân hôm nay",
"Hồ sơ thi đấu chưa đủ",
"Trận chưa vào được tuần thi đấu cho đến khi đủ hồ sơ.",
"Đối thủ",
"Chưa xác định",
"Cân chính thức",
"Thi đấu",
"Địa điểm",
"Chưa xác định",
"Giới hạn",
"Hồ sơ thi đấu",
"Chưa có mục hồ sơ thi đấu.",
"Xem trạng thái đình chỉ",
"Không tìm thấy hồ sơ võ sĩ. Hãy đăng nhập lại.",
"Về trận của tôi",
"Về trang chủ",
"Lưu số cân đã sửa",
"Lưu cân hôm nay",
"Sửa cân hôm nay",
"Ghi cân hôm nay",
"Chưa tải được thông tin trận",
"Thử tải lại",
"Chưa kiểm tra được số cân hôm nay",
"Cần kiểm tra trước khi lưu để mỗi ngày chỉ có một số cân.",
"Thử tải lại",
"Ghi số cân bạn vừa đo. Đây là cân tự ghi, không thay thế buổi cân chính thức của HLV.",
"Mỗi ngày chỉ giữ một số cân. Lưu số mới sẽ thay số đã ghi hôm nay.",
"Cân nặng hôm nay",
"Chưa có trận sắp tới. Số cân vẫn được lưu vào hồ sơ của bạn.",
"Chưa ghi được cân",
"Đã ghi cân trong bản mẫu",
"Đã lưu số cân hôm nay",
"Đã ghi cân hôm nay",
"Trạng thái đình chỉ",
"Thông tin từ hồ sơ học viện, chỉ đọc.",
"Không tải được hồ sơ",
"Thử tải lại",
"Chưa có bản ghi đình chỉ",
"Không có đình chỉ nào trong hồ sơ được trả về.",
"Tải thêm bản ghi",
"Buổi tập cụ thể còn phụ thuộc hồ sơ y tế và các đình chỉ khác.",
", hôm nay",
" · hôm nay",
"Chưa tải được trạng thái đình chỉ. Thử lại",
"Chưa tải được trạng thái đình chỉ · Thử lại",
"Xem lịch sử đình chỉ",
"và ",
"đình chỉ khác",
"Lý do: ",
"và ",
"đình chỉ khác",
"Số trận thắng",
"Số trận thua",
"Số trận hoà",
"Chiều cao (cm)",
"Tầm với (cm)",
"Đã lưu phân tích đối thủ",
"Hồ sơ chỉ đọc",
"Không sửa phân tích khi trận đã kết thúc hoặc bị huỷ. Đánh giá chiến thuật nằm ở báo cáo trận.",
"Chép trận trước, thay bản đang soạn",
"Chưa có phân tích trận trước để chép.",
"Đã chép vào bản đang soạn. Bấm lưu để ghi thay đổi.",
"Hồ sơ đối thủ",
"Chưa xác định đối thủ",
"Tư thế",
"Chưa rõ",
"Thuận phải",
"Thuận trái",
"Đổi thế",
"Lối đánh",
"Chưa rõ",
"Đánh đứng",
"Vật",
"Địa chiến",
"Toàn diện",
"Nguồn hồ sơ (tuỳ chọn)",
"Quan sát có căn cứ",
"/6 quan sát",
"Quan sát ",
"Điểm mạnh",
"Sơ hở",
"Thói quen",
"Nội dung quan sát",
"Số lần quan sát",
"Một lần",
"Lặp lại",
"Đường dẫn bằng chứng",
"Ghi chú bằng chứng",
"Cần ít nhất đường dẫn hoặc ghi chú bằng chứng.",
"Mốc thời gian trong video (tuỳ chọn)",
"Ví dụ 02:14",
"Thêm quan sát",
"Chiến thuật và buổi tập",
"/5 chiến thuật",
"Hiệp áp dụng",
"Mọi hiệp",
"Quan sát làm căn cứ (chọn ít nhất một)",
"Quan sát chưa có nội dung",
"Không chọn",
"Làm căn cứ",
"Buổi tập đã luyện",
"Không gắn",
"Gắn buổi tập",
"Chưa tải buổi tập. Chiến thuật chưa gắn buổi tập sẽ hiện “Chưa luyện”.",
"Dặn bạn tập (tuỳ chọn)",
"Tải thêm buổi tập để gắn chiến thuật",
"Thêm chiến thuật",
"Chưa lưu được phân tích",
"Lưu phân tích đối thủ",
"Hiệu quả",
"Không hiệu quả",
"Chưa dùng",
"Đã luyện",
"Chưa luyện",
"Không tải được dữ liệu",
"Tải lại",
"Đối thủ: ",
"Chưa xác định",
"kg · ",
"hiệp",
"Góc đài với ghế và khăn",
"Giảm cân cấp tốc vượt ngưỡng",
"HLV cần lưu ý cảnh báo khi chuẩn bị góc đài.",
"Chiến thuật theo hiệp",
"Tất cả",
"Mọi hiệp",
"Quan sát lặp lại",
"Quan sát một lần",
"Chưa luyện",
"Đã gắn buổi tập",
"Đối luyện: ",
"Chưa có chiến thuật cho hiệp này",
"Ghi chú và ghi hiệp"
];
const TEMPLATES: [number, string][] = [
[1, ". Có thể ghi từ ⟨0⟩"],
[
1,
"Còn thiếu: ⟨0⟩"
],
[
1,
"Hết hạn trước ngày thi đấu: ⟨0⟩"
],
[
1,
"Chưa đủ hồ sơ thi đấu nên chưa vào được tuần thi đấu.⟨0⟩ Bổ sung hồ sơ rồi thử lại."
],
[
1,
"Chưa đến ngày cân chính thức⟨0⟩. Số đã nhập được giữ lại."
],
[
1,
"Từ ⟨0⟩"
],
[
1,
"⟨0⟩ chưa được tập loại nào"
],
[
1,
"⟨0⟩ được tập tất cả các loại"
],
[
2,
"⟨0⟩ được tập: ⟨1⟩"
],
[
1,
"Đang tập lại theo bậc, tập đầy đủ từ ⟨0⟩"
],
[
1,
"Đang đình chỉ đến ⟨0⟩"
],
[
1,
"Sắp đình chỉ từ ⟨0⟩"
],
[
1,
"Tập đến nhóm ⟨0⟩"
],
[
1,
"Tập đến nhóm ⟨0⟩"
],
[
1,
"Dự kiến sau ngày ⟨0⟩ nếu không có hạn chế khác."
],
[
3,
"Biểu đồ cân: ⟨0⟩ lần ghi. Mới nhất ⟨1⟩ kg. Giới hạn ⟨2⟩ kg."
],
[
1,
"Thoả thuận ⟨0⟩"
],
[
1,
"Xác nhận ⟨0⟩"
],
[
1,
"Đã xác nhận ⟨0⟩"
],
[
1,
"Còn thiếu: ⟨0⟩."
],
[
1,
"Hết hạn trước ngày thi đấu: ⟨0⟩."
],
[
1,
"⟨0⟩/500 ký tự"
],
[
2,
"Vượt ⟨0⟩ kg⟨1⟩"
],
[
1,
"Thoả thuận ⟨0⟩"
],
[
1,
"Giới hạn ⟨0⟩ mới"
],
[
1,
"Số cân gần nhất⟨0⟩"
],
[
1,
" · giới hạn ⟨0⟩ kg"
],
[
1,
"Còn thiếu: ⟨0⟩."
],
[
1,
"Hết hạn trước ngày thi đấu: ⟨0⟩."
],
[
1,
"Hôm nay đã ghi ⟨0⟩ kg"
],
[
1,
"⟨0⟩ (một phần)"
],
[
4,
"Bậc ⟨0⟩, ⟨1⟩: ⟨2⟩. ⟨3⟩"
],
[
2,
"⟨0⟩: nhập ⟨1⟩."
],
[
1,
"⟨0⟩ chưa hợp lệ."
],
[
1,
"Bỏ quan sát ⟨0⟩"
],
[
1,
"Chiến thuật ⟨0⟩"
],
[
1,
"Hiệp ⟨0⟩"
],
[
1,
"Bỏ chiến thuật ⟨0⟩"
],
[
1,
"Hiệp ⟨0⟩"
],
[
1,
"Hiệp ⟨0⟩"
]
];

const values = Object.values(campText).flatMap((group) => Object.values(group as Record<string, unknown>));
describe("Phase 5 G: Fight Camp i18n keeps every string unchanged", () => {
  it("plain strings: same multiset as before the move", () => {
    const got = values.filter((v): v is string => typeof v === "string").sort();
    expect(got).toEqual([...PLAIN].sort());
  });
  it("template strings: same text with the same placeholders", () => {
    const fns = values.filter((v): v is (...a: unknown[]) => string => typeof v === "function");
    const got = fns.map((f) => f(...Array.from({ length: 8 }, (_, i) => `⟨${i}⟩`))).sort();
    expect(got).toEqual(TEMPLATES.map(([, t]) => t).sort());
    expect(got).toHaveLength(40);
  });
});
