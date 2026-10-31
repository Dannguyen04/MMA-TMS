import { useCallback, useEffect, useState } from "react";

import { mapFighterError } from "@/screens/fighter/errors";

export function useLoad<T>(enabled: boolean, key: string, run: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reload = useCallback(() => {
    if (!enabled) {
      setData(null);
      setError("");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void run()
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(mapFighterError(cause));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, key, run]);

  useEffect(() => {
    const stop = reload();
    return () => {
      stop?.();
    };
  }, [reload]);

  return { data, error, loading, setError, setData, reload };
}
