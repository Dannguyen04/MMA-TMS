import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { doctorRoApi, USE_MOCK_DOCTOR } from "@/api/doctor-ro";
import type { PublicFighter } from "@/api/types";
import { doctorRo } from "@/i18n/doctor-ro";
import { mapFighterError } from "@/screens/fighter/errors";
import { useSession } from "@/session/session-context";

const PAGE = 100;
const MAX_PAGES = 5;

export type DoctorRoster = {
  /** Có gọi API không (phiên bác sĩ thật hoặc đang bật mock). */
  enabled: boolean;
  items: PublicFighter[];
  total: number;
  loaded: boolean;
  loading: boolean;
  error: string;
  reload: () => void;
  /** Kéo để làm mới: giữ dữ liệu cũ; reject khi lỗi. */
  refresh: () => Promise<void>;
};

const RosterContext = createContext<DoctorRoster | null>(null);

/**
 * Danh sách võ sĩ bác sĩ phụ trách (GET /doctors/:id/fighters), tải một lần cho cả tab Võ sĩ,
 * màn Tôi (đếm số) và chi tiết võ sĩ (bác sĩ không có quyền GET /fighters/:id).
 */
export function DoctorRosterProvider({ children }: { children: ReactNode }) {
  const { user, isDemo } = useSession();
  const enabled = USE_MOCK_DOCTOR || (!isDemo && user?.role === "DOCTOR");
  const doctorId = user?.profile && typeof user.profile.id === "string" ? user.profile.id : "";
  const [items, setItems] = useState<PublicFighter[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);

  const fetchAll = useCallback(async () => {
    if (!doctorId) throw new Error("NO_DOCTOR_PROFILE");
    const rows: PublicFighter[] = [];
    let count = 0;
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const res = await doctorRoApi.listRoster(doctorId, { page, limit: PAGE });
      rows.push(...res.data);
      count = res.total;
      if (!res.hasNextPage || res.data.length === 0) break;
    }
    return { rows, count };
  }, [doctorId]);

  const message = useCallback(
    (cause: unknown) => (cause instanceof Error && cause.message === "NO_DOCTOR_PROFILE" ? doctorRo.fighters.noProfile : mapFighterError(cause)),
    [],
  );

  const reload = useCallback(() => {
    const id = ++seq.current;
    if (!enabled) {
      setItems([]);
      setTotal(0);
      setError("");
      setLoading(false);
      setLoaded(true);
      return;
    }
    setLoading(true);
    void fetchAll()
      .then(({ rows, count }) => {
        if (id !== seq.current) return;
        setItems(rows);
        setTotal(count);
        setError("");
      })
      .catch((cause: unknown) => {
        if (id === seq.current) setError(message(cause));
      })
      .finally(() => {
        if (id !== seq.current) return;
        setLoading(false);
        setLoaded(true);
      });
  }, [enabled, fetchAll, message]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const id = ++seq.current;
    try {
      const { rows, count } = await fetchAll();
      if (id !== seq.current) return;
      setItems(rows);
      setTotal(count);
      setError("");
      setLoaded(true);
    } catch (cause: unknown) {
      if (id === seq.current) setError(message(cause));
      throw cause;
    }
  }, [enabled, fetchAll, message]);

  useEffect(reload, [reload]);

  const value = useMemo<DoctorRoster>(
    () => ({ enabled, items, total, loaded, loading, error, reload, refresh }),
    [enabled, items, total, loaded, loading, error, reload, refresh],
  );
  return <RosterContext.Provider value={value}>{children}</RosterContext.Provider>;
}

const EMPTY: DoctorRoster = {
  enabled: false,
  items: [],
  total: 0,
  loaded: true,
  loading: false,
  error: "",
  reload: () => undefined,
  refresh: async () => undefined,
};

export function useDoctorRoster(): DoctorRoster {
  return useContext(RosterContext) ?? EMPTY;
}
