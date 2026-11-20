import { createContext } from "react";

/** Bring the next round's quick entry into view after a save or history selection. */
export const CampScrollContext = createContext<() => void>(() => undefined);
