import { isFighterProfile } from "@/api";
import { useSession } from "@/session/session-context";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function useFighterId() {
  const { user, isDemo, gate } = useSession();
  const profile = user && isFighterProfile(user.profile) ? user.profile : null;
  const fighterId = profile?.id ?? null;
  const canFetch = gate === "fighter" && !isDemo && !!fighterId && isUuid(fighterId);
  return { fighterId, profile, user, isDemo, gate, canFetch };
}
