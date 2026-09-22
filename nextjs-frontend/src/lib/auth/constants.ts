/** Hằng số xác thực dùng chung giữa Proxy, Route Handler và Server Action. */

export const ACCESS_TOKEN_COOKIE = "mma_access";
export const REFRESH_TOKEN_COOKIE = "mma_refresh";
export const ACCESS_EXPIRES_COOKIE = "mma_access_expires";
export const THEME_COOKIE = "mma_theme";
/** Chỉ dùng bởi giao diện demo tách biệt; luồng API không chấp nhận mật khẩu dùng chung này. */
export const DEMO_PASSWORD = "mma-demo";

export type ThemePreference = "light" | "dark" | "system";

export function parseTheme(value: string | undefined): ThemePreference {
    return value === "light" || value === "dark" ? value : "system";
}

/** Chế độ demo chỉ được bật rõ ràng và không bao giờ hợp lệ trong production. */
export function isDemoAuthEnabled(): boolean {
    return process.env.NODE_ENV !== "production" && process.env.APP_DATA_MODE === "demo";
}
