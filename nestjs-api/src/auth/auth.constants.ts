/**
 * Supabase Auth error codes (see the Auth error-code reference). They are
 * matched on `AuthError.code`, which @supabase/auth-js populates for HTTP
 * responses; the message text is never parsed.
 *
 * `same_password` means the account already uses the submitted password. It is
 * an outcome of its own and must never be read as proof that an earlier reset
 * completed.
 */
export const SAME_PASSWORD_ERROR_CODE = 'same_password';
export const WEAK_PASSWORD_ERROR_CODE = 'weak_password';

/**
 * Recording that the password was set is a single conditional UPDATE against our
 * own database, so a short bounded retry is worthwhile. It is not a retry of the
 * identity provider call, which cannot be repeated safely.
 */
export const PASSWORD_SET_RETRY_ATTEMPTS = 3;
export const PASSWORD_SET_RETRY_DELAY_MS = 150;

export const PASSWORD_RESET_REDIRECT_URL_KEY = 'PASSWORD_RESET_REDIRECT_URL';
