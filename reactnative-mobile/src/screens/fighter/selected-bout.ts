import { useSyncExternalStore } from "react";

/** Trận võ sĩ đang xem (giữ trong bộ nhớ để quay lại từ màn ghi cân vẫn đúng trận). `null` = trận gần nhất. */
let selectedBoutId: string | null = null;
const listeners = new Set<() => void>();

export function setSelectedBoutId(id: string | null) {
  if (id === selectedBoutId) return;
  selectedBoutId = id;
  listeners.forEach((listener) => listener());
}

export function useSelectedBoutId(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => selectedBoutId,
    () => null,
  );
}
