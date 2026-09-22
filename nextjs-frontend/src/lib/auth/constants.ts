/** Hằng số xác thực dùng chung giữa Proxy, Route Handler và Server Action. */

export const ACCESS_TOKEN_COOKIE = "mma_access";
export const REFRESH_TOKEN_COOKIE = "mma_refresh";
export const ACCESS_EXPIRES_COOKIE = "mma_access_expires";
export const THEME_COOKIE = "mma_theme";
/** Phiên demo (id người dùng mock); chỉ được đọc khi `isDemoAuthEnabled()`. */
export const DEMO_SESSION_COOKIE = "mma_session";
/** Chỉ dùng bởi giao diện demo tách biệt; luồng API không chấp nhận mật khẩu dùng chung này. */
export const DEMO_PASSWORD = "mma-demo";

export type ThemePreference = "light" | "dark" | "system";

export function parseTheme(value: string | undefined): ThemePreference {
    return value === "light" || value === "dark" ? value : "system";
}

/**
 * Ngoài production, demo là mặc định cho tới khi backend có đủ endpoint; đặt `APP_DATA_MODE=api`
 * để gọi API thật. Production luôn dùng API và không bao giờ bật demo.
 */
export function isDemoAuthEnabled(): boolean {
    return process.env.NODE_ENV !== "production" && process.env.APP_DATA_MODE !== "api";
}
