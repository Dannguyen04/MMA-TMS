import { useCallback, useRef, useState } from "react";
import Toast from "react-native-toast-message";

import { isApiError } from "@/api";
import { ot } from "@/i18n/one-tap";

export type WriteOutcome = "ok" | "forbidden" | "offline" | "conflict" | "failed";

export function classify(e: unknown): Exclude<WriteOutcome, "ok"> {
  if (isApiError(e) && (e.status === 403 || e.code === "FORBIDDEN")) return "forbidden";
  if (isApiError(e) && (e.status === 0 || e.code === "NETWORK_ERROR")) return "offline";
  if (isApiError(e) && e.status === 409) return "conflict";
  return "failed";
}

/** Toast lỗi mạng: "Không gửi được." + "Thử lại" (chạm toast để gửi lại). */
export function showRetryToast(onRetry: () => void) {
  Toast.show({
    type: "error",
    text1: ot.offline,
    text2: ot.retry,
    position: "top",
    autoHide: true,
    visibilityTime: 6000,
    onPress: () => {
      Toast.hide();
      onRetry();
    },
  });
}

/**
 * Gửi 1 thao tác ghi: khóa + spinner khi đang gửi; thành công không toast; 403 → thông báo quyền (do màn hiện);
 * mạng → toast "Không gửi được." + "Thử lại"; lỗi khác → toast chung.
 */
export function useWrite(forbiddenText: string) {
  const [sending, setSending] = useState(false);
  const [forbidden, setForbidden] = useState("");
  const busy = useRef(false);
  const run = useCallback(
    async function go<T>(fn: () => Promise<T>, onOk?: (v: T) => void): Promise<WriteOutcome> {
      if (busy.current) return "failed";
      busy.current = true;
      setSending(true);
      setForbidden("");
      try {
        const v = await fn();
        onOk?.(v);
        return "ok";
      } catch (e) {
        const kind = classify(e);
        if (kind === "forbidden") setForbidden(forbiddenText);
        else if (kind === "offline") showRetryToast(() => void go(fn, onOk));
        else if (kind === "failed") Toast.show({ type: "error", text1: ot.failed, position: "top" });
        return kind;
      } finally {
        busy.current = false;
        setSending(false);
      }
    },
    [forbiddenText],
  );
  return { sending, forbidden, setForbidden, run };
}

/** Lý do gửi lên: đúng nhãn chip; "Khác" → chữ đã nhập (cắt khoảng trắng). */
export function reasonValue(chip: string | null, other: string): string {
  if (!chip) return "";
  return chip === ot.other ? other.trim() : chip;
}

/** requestId (UUID v4) cho POST movement-evidence (chống gửi trùng). */
export function uuid4(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Mất mạng: đóng sheet để toast "Thử lại" không bị lớp phủ che (bấm Thử lại gửi lại đúng nội dung). */
export function closeIfOffline(setOpen: (v: boolean) => void) {
  return (o: WriteOutcome) => {
    if (o === "offline") setOpen(false);
  };
}
