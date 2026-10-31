import { useCallback, useEffect, useState } from "react";

import { coachApi, USE_MOCK_COACH } from "@/api/coach";
import { useSession } from "@/session/session-context";
import { nameMap } from "./ro-format";

/** Gọi API khi có phiên thật hoặc đang bật mock; tài khoản demo không có máy chủ → danh sách rỗng. */
export function useCoachEnabled(): boolean {
  const { isDemo } = useSession();
  return USE_MOCK_COACH || !isDemo;
}

export function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Bản đồ id → tên võ sĩ (buổi tập / giáo án chỉ có fighterId). Lỗi thì để trống, không chặn màn. */
export function useFighterNames(enabled: boolean): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  const load = useCallback(() => {
    if (!enabled) return;
    coachApi
      .listFighters({ limit: 100 })
      .then((res) => setNames(nameMap(res.data)))
      .catch(() => undefined);
  }, [enabled]);
  useEffect(load, [load]);
  return names;
}
