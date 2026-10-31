import { useCallback, useEffect, useRef, useState } from "react";

import { mapFighterError } from "@/screens/fighter/errors";

type LoadOptions = {
  /**
   * Lỗi mạng khi đã có dữ liệu: giữ dữ liệu cũ và báo lỗi (kể cả khi kéo để làm mới).
   * Mặc định tắt để các màn hình khác giữ nguyên hành vi.
   */
  keepOnError?: boolean;
};

export function useLoad<T>(enabled: boolean, key: string, run: () => Promise<T>, options: LoadOptions = {}) {
  const keep = options.keepOnError === true;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dataRef = useRef<T | null>(null);
  dataRef.current = data;

  const reload = useCallback(() => {
    if (!enabled) {
      setData(null);
      setError("");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    // keepOnError + đã có dữ liệu: giữ thông báo lỗi tới khi tải lại xong (banner không nhấp nháy).
    if (!(keep && dataRef.current)) setError("");
    void run()
      .then((value) => {
        if (!cancelled) {
          setData(value);
          if (keep) setError("");
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          if (!keep) setData(null);
          setError(mapFighterError(cause));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, key, run, keep]);

  /** Kéo để làm mới: giữ dữ liệu cũ, chỉ thay khi thành công; reject khi lỗi để hiện toast. */
  const refresh = useCallback(async () => {
    if (!enabled) return;
    let value: T;
    try {
      value = await run();
    } catch (cause: unknown) {
      if (keep) setError(mapFighterError(cause));
      throw cause;
    }
    setData(value);
    setError("");
  }, [enabled, run, keep]);

  useEffect(() => {
    const stop = reload();
    return () => {
      stop?.();
    };
  }, [reload]);

  return { data, error, loading, setError, setData, reload, refresh };
}
