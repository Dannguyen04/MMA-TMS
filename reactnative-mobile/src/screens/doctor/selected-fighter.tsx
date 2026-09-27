import { createContext, use, useMemo, useState, type ReactNode } from "react";

import type { PublicFighter } from "@/api";

type SelectedFighterValue = {
  fighter: PublicFighter | null;
  setFighter: (fighter: PublicFighter | null) => void;
};

const SelectedFighterContext = createContext<SelectedFighterValue | null>(null);

export function SelectedFighterProvider({ children }: { children: ReactNode }) {
  const [fighter, setFighter] = useState<PublicFighter | null>(null);
  const value = useMemo(() => ({ fighter, setFighter }), [fighter]);
  return (
    <SelectedFighterContext.Provider value={value}>{children}</SelectedFighterContext.Provider>
  );
}

export function useSelectedFighter(): SelectedFighterValue {
  const value = use(SelectedFighterContext);
  if (!value) {
    throw new Error("useSelectedFighter must be used within SelectedFighterProvider");
  }
  return value;
}
