import { Big_Shoulders, Public_Sans } from "next/font/google";

/** Kiểu chữ của khu Bác sĩ (giống bản thiết kế đã duyệt), có bộ ký tự tiếng Việt. */
// Next không có số đo dựng font dự phòng cho Big Shoulders, nên tắt adjustFontFallback để khỏi cảnh báo
// và tự khai báo font dự phòng dạng chữ hẹp.
export const shoulders = Big_Shoulders({
  variable: "--f-shoulders",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Arial Narrow", "Roboto Condensed", "system-ui", "sans-serif"],
});
export const publicSans = Public_Sans({ variable: "--f-public", subsets: ["latin", "vietnamese"] });