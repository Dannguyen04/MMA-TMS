/**
 * Nhật ký chỉ dành cho bản dev (splash, mạng, khoá xoay). Bản release không in gì,
 * để logcat của người dùng không lộ URL API hay chi tiết lỗi.
 */
const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : false;

export const devLog: (...args: unknown[]) => void = isDev
  ? (...args) => console.log(...args)
  : () => {};
