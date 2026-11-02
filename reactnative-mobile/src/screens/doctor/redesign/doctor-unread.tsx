import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { doctorRoApi } from "@/api/doctor-ro";

import { useDoctorRoster } from "./doctor-roster";

export type DoctorUnread = {
  /** Số thông báo chưa đọc; 0 khi chưa tải được (không hiện huy hiệu). */
  count: number;
  refresh: () => void;
};

const UnreadContext = createContext<DoctorUnread>({ count: 0, refresh: () => undefined });

/** Số thông báo chưa đọc cho huy hiệu tab Thông báo (GET /notifications/unread-count). */
export function DoctorUnreadProvider({ children }: { children: ReactNode }) {
  const { enabled } = useDoctorRoster();
  const [count, setCount] = useState(0);
  const seq = useRef(0);

  const refresh = useCallback(() => {
    const id = ++seq.current;
    if (!enabled) {
      setCount(0);
      return;
    }
    void doctorRoApi
      .unreadCount()
      .then((row) => {
        if (id === seq.current) setCount(Math.max(0, Number(row.count) || 0));
      })
      .catch(() => {
        // Lỗi mạng: giữ số cũ, không hiện lỗi trên thanh tab.
      });
  }, [enabled]);

  useEffect(refresh, [refresh]);

  const value = useMemo(() => ({ count, refresh }), [count, refresh]);
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useDoctorUnread(): DoctorUnread {
  return useContext(UnreadContext);
}

/** Chữ trên huy hiệu: tối đa "99+". */
export function badgeText(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > 99 ? "99+" : String(Math.floor(count));
}
