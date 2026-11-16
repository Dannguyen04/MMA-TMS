import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, dateKey, mondayOf, weekDays, type ScheduleItem } from "./week-model";

/** Week navigation: starts on today's week with today selected; moving a week selects its Monday. */
export function useWeekNav(now: () => Date = () => new Date()) {
  const today = dateKey(now());
  const [monday, setMonday] = useState(() => mondayOf(today));
  const [selected, setSelected] = useState(today);
  const onWeek = useCallback((delta: -1 | 1) => {
    setMonday(m => {
      const next = addDays(m, delta * 7);
      setSelected(weekDays(next).includes(today) ? today : next);
      return next;
    });
  }, [today]);
  const onToday = useCallback(() => { setMonday(mondayOf(today)); setSelected(today); }, [today]);
  return { today, monday, days: weekDays(monday), selected, onSelect: setSelected, onWeek, onToday };
}

type Loader = (days: string[]) => Promise<ScheduleItem[]>;
/**
 * Loads every source of a week in parallel. Each source fails on its own: what loaded still shows (`partial`), and
 * `error` is set only when all of them failed.
 */
export function useWeekItems(enabled: boolean, days: string[], loaders: readonly Loader[], key: string) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const seq = useRef(0);
  /** quiet = focus / pull refetch: no spinner, and a refetch where every source fails keeps the week on screen. */
  const fetchWeek = useCallback((quiet: boolean): Promise<void> => {
    if (!enabled) { setLoading(false); return Promise.resolve(); }
    const id = ++seq.current;
    if (!quiet) setLoading(true);
    return Promise.allSettled(loaders.map(l => l(days))).then(results => {
      if (id !== seq.current) return;
      const ok = results.filter((r): r is PromiseFulfilledResult<ScheduleItem[]> => r.status === "fulfilled");
      if (quiet && results.length && !ok.length) return;
      setItems(ok.flatMap(r => r.value));
      setPartial(ok.length > 0 && ok.length < results.length);
      setError(results.length && !ok.length ? "failed" : null);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, days[0], key]);
  const run = useCallback(() => { void fetchWeek(false); }, [fetchWeek]);
  const refresh = useCallback(() => fetchWeek(true), [fetchWeek]);
  useEffect(() => { run(); return () => { seq.current++; }; }, [run]);
  return { items, loading, error, partial, reload: run, refresh };
}
