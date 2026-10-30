import type { enScreensApp } from "./screens-app.en";

/**
 * Vietnamese dictionary for app-wide states and tools.
 * Matches all keys and placeholders of `enScreensApp`.
 */
export const viScreensApp = {
    "screens.camp.title": "Dòng thời gian camp",
    "screens.camp.description": "Mọi buổi tập từ đầu camp tới ngày thi đấu, theo đúng những gì đã ghi.",
    "screens.camp.weekLabel": "Tuần camp",
    "screens.camp.week": "{week}/{weeks}",
    "screens.camp.countdownLabel": "Thi đấu",
    "screens.camp.daysToBout": "còn {n} ngày",
    "screens.camp.daysToBout.one": "ngày mai",
    "screens.camp.boutToday": "hôm nay",
    "screens.camp.boutOver": "đã xong",
    "screens.camp.fightWeek": "Tuần thi đấu",
    "screens.camp.weighIn": "Cân",
    "screens.camp.bout": "Thi đấu",
    "screens.camp.today": "Hôm nay",
    "screens.camp.legendUpcoming": "Sắp tới",
    "screens.camp.legendMissed": "Bỏ lỡ hoặc huỷ",
    "screens.camp.legendSuspension": "Đình chỉ",
    "screens.camp.counts": "{done} đã tập · {upcoming} sắp tới · {missed} bỏ lỡ",
    "screens.camp.listToggle": "Xem danh sách {n} buổi",
    "screens.camp.listToggle.one": "Xem buổi tập",
    "screens.camp.suspensionLine": "Đình chỉ {from} – {to}",
    "ux.error.title": "Trang này chưa tải được",
    "ux.error.description": "Có lỗi khi tải dữ liệu. Bạn thử lại nhé — nếu vẫn lỗi, hãy báo quản trị viên.",
    "ux.error.sectionTitle": "Phần này chưa tải được",
    "ux.error.sectionDescription": "Phần còn lại của trang vẫn dùng được. Thử tải lại phần này.",
    "ux.error.reference": "Mã tham chiếu {digest}",
    "ux.error.retry": "Thử lại",
    "ux.error.home": "Về trang Hôm nay",
    "ux.unsaved.confirm": "Bạn có thay đổi chưa lưu. Vẫn rời trang này?",
    "ux.notFound.title": "Không tìm thấy trang này",
    "ux.notFound.description": "Có thể nội dung đã bị xoá, hoặc thuộc về võ sĩ không do bạn phụ trách.",
    "ux.notFound.rootTitle": "Trang này không có trên sàn đấu",
    "ux.notFound.rootDescription": "Trang có thể đã chuyển chỗ, hoặc bạn không có quyền xem. Hồ sơ không do bạn phụ trách sẽ được ẩn.",
    "ux.notFound.rootBack": "Về trang của tôi",
    "ux.notFound.metaTitle": "Không tìm thấy trang",
    "ux.notFound.home": "Về trang Hôm nay",
} satisfies Record<keyof typeof enScreensApp, string>;
