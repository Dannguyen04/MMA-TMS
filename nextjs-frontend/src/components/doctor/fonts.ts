import { Big_Shoulders, Public_Sans } from "next/font/google";

/** Kiểu chữ của khu Bác sĩ (giống bản thiết kế đã duyệt), có bộ ký tự tiếng Việt. */
export const shoulders = Big_Shoulders({ variable: "--f-shoulders", subsets: ["latin", "vietnamese"], weight: ["600", "700", "800"] });
export const publicSans = Public_Sans({ variable: "--f-public", subsets: ["latin", "vietnamese"] });
