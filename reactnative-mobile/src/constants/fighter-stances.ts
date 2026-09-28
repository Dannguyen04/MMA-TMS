export const FIGHTER_STANCES = ["ORTHODOX", "SOUTHPAW", "SWITCH"] as const;

export type FighterStance = (typeof FIGHTER_STANCES)[number];

export function isFighterStance(value: string): value is FighterStance {
  return (FIGHTER_STANCES as readonly string[]).includes(value);
}
