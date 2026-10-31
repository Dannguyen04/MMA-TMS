import { useCallback, useEffect, useRef, useState } from "react";

import type { Paginated } from "@/api/types";
import { mapFighterError } from "@/screens/fighter/errors";
import { mergePage } from "@/screens/coach/readonly/ro-format";

/**
 * Danh sách phân trang chỉ đọc: tải trang 1, "xem thêm" theo `hasNextPage`, kéo-để-làm-mới.
 * Lỗi mạng giữ lại dữ liệu cũ. `enabled=false` → danh sách rỗng, không gọi API.
 */
export function usePagedList<T extends { id: string }>(
  enabled: boolean,
  key: string,
  fetchPage: (page: number) => Promise<Paginated<T>>,
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const pageRef = useRef(1);
  const seq = useRef(0);
  const itemsRef = useRef<T[]>([]);
  itemsRef.current = items;
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(() => {
    if (!enabled) {
      setItems([]);
      setTotal(0);
      setHasNext(false);
      setLoaded(true);
      setLoading(false);
      setError("");
      return Promise.resolve();
    }
    const mine = ++seq.current;
    setLoading(true);
    return fetchRef
      .current(1)
      .then((res) => {
        if (mine !== seq.current) return;
        pageRef.current = 1;
        setItems((prev) => mergePage(prev, res, 1));
        setTotal(res.total);
        setHasNext(res.hasNextPage);
        setError("");
        setLoaded(true);
      })
      .catch((cause: unknown) => {
        if (mine !== seq.current) return;
        setError(mapFighterError(cause));
        setLoaded(true);
      })
      .finally(() => {
        if (mine === seq.current) setLoading(false);
      });
  }, [enabled]);

  useEffect(() => {
    setLoaded(false);
    setItems([]);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, key]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetchRef.current(1);
      pageRef.current = 1;
      setItems((prev) => mergePage(prev, res, 1));
      setTotal(res.total);
      setHasNext(res.hasNextPage);
      setError("");
    } catch (cause: unknown) {
      setError(mapFighterError(cause));
      throw cause;
    }
  }, [enabled]);

  const loadMore = useCallback(() => {
    if (!enabled || !hasNext || loadingMore || loading) return;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    fetchRef
      .current(nextPage)
      .then((res) => {
        pageRef.current = nextPage;
        setItems((prev) => mergePage(prev, res, nextPage));
        setHasNext(res.hasNextPage);
        setTotal(res.total);
        setError("");
      })
      .catch((cause: unknown) => setError(mapFighterError(cause)))
      .finally(() => setLoadingMore(false));
  }, [enabled, hasNext, loading, loadingMore]);

  return { items, total, hasNext, loaded, loading, loadingMore, error, reload: load, refresh, loadMore, itemsRef };
}

/** Coach mock bật thì luôn gọi mock; thật thì tài khoản demo (không có token) coi như rỗng. */
export function useCoachDataEnabled(isDemo: boolean, mock: boolean): boolean {
  return mock || !isDemo;
}
