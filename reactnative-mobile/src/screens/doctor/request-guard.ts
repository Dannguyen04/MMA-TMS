import { useCallback, useMemo, useRef } from "react";

export function useRequestGuard() {
  const ref = useRef(0);
  const start = useCallback(() => {
    ref.current += 1;
    return ref.current;
  }, []);
  const isCurrent = useCallback((token: number) => token === ref.current, []);
  return useMemo(() => ({ start, isCurrent }), [start, isCurrent]);
}
