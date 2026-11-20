import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { adminApi } from "@/api/admin/admin";
import { useCoachEnabled } from "@/screens/coach/readonly/use-coach";

export type AdminUnread = { count: number; refresh: () => void };

const UnreadContext = createContext<AdminUnread>({ count: 0, refresh: () => undefined });

/** Unread count for the Thông báo tab badge (GET /notifications/unread-count, redesign step 22). */
export function AdminUnreadProvider({ children }: { children: ReactNode }) {
  const enabled = useCoachEnabled();
  const [count, setCount] = useState(0);
  const seq = useRef(0);
  const refresh = useCallback(() => {
    const id = ++seq.current;
    if (!enabled) {
      setCount(0);
      return;
    }
    void adminApi.unreadCount()
      .then((row) => { if (id === seq.current) setCount(Math.max(0, Number(row.count) || 0)); })
      .catch(() => undefined); // keep the old number; no error on the tab bar
  }, [enabled]);
  useEffect(refresh, [refresh]);
  const value = useMemo(() => ({ count, refresh }), [count, refresh]);
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useAdminUnread(): AdminUnread {
  return useContext(UnreadContext);
}
