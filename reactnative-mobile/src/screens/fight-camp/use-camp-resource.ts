import { useCallback, useEffect, useRef, useState } from "react";
import { campError } from "./camp-rules";
/** Late responses from a previous bout/unmounted screen must not replace this screen. */
export function useCampResource<T>(key: string, load: () => Promise<T>) {
  const loader = useRef(load); loader.current = load;
  const generation = useRef(0);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const reload = useCallback(async () => {
    const version = ++generation.current; setLoading(true); setError("");
    try { const value = await loader.current(); if (version === generation.current) setData(value); }
    catch (e) { if (version === generation.current) setError(campError(e)); }
    finally { if (version === generation.current) setLoading(false); }
  }, [key]);
  useEffect(() => { setData(null); void reload(); return () => { generation.current++; }; }, [reload]);
  return { data, loading, error, reload, setData };
}
