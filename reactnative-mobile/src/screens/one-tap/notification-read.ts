import { useCallback, useState } from "react";
import Toast from "react-native-toast-message";

import { oneTapApi } from "@/api/one-tap";
import { ot } from "@/i18n/one-tap";

import { classify, showRetryToast } from "./write";

/**
 * Đánh dấu đã đọc 1 thông báo (PATCH /notifications/:id/read; không có "đọc tất cả").
 * Lạc quan: chuyển đã đọc ngay; lỗi → trả lại chưa đọc, 403 báo không có quyền, mất mạng toast "Thử lại".
 */
export function useMarkRead(onSettled?: () => void) {
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());
  const mark = useCallback(
    function go(id: string) {
      setRead((s) => new Set(s).add(id));
      void oneTapApi
        .markNotificationRead(id)
        .then(() => onSettled?.())
        .catch((e: unknown) => {
          setRead((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
          const kind = classify(e);
          if (kind === "offline") showRetryToast(() => go(id));
          else Toast.show({ type: "error", text1: kind === "forbidden" ? ot.notifForbidden : ot.failed, position: "top" });
        });
    },
    [onSettled],
  );
  return { isRead: (row: { id: string; isRead: boolean }) => row.isRead || read.has(row.id), mark };
}
