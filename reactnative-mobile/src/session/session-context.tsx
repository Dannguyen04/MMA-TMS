import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Href } from "expo-router";

import { getMe, login as loginRequest, logout as logoutRequest } from "@/api/auth";
import { clearSession, getMemorySession, loadStoredSession, persistSession } from "@/api/tokens";
import type { LoginBody, PublicUser, UserRole } from "@/api/types";

export type SessionGate = "loading" | "anonymous" | "guest" | "fighter" | "coach" | "doctor" | "admin";

const DEMO_STAMP = "2024-01-15T00:00:00.000Z";

function demoUserForRole(role: UserRole): PublicUser {
  const base = {
    isActive: true,
    createdAt: DEMO_STAMP,
    updatedAt: DEMO_STAMP,
    deletedAt: null,
  };
  switch (role) {
    case "COACH":
      return {
        ...base,
        id: "demo-coach",
        email: "hlv-demo@mmavision.local",
        role: "COACH",
        profile: { id: "demo-coach-profile", firstName: "Hùng", lastName: "Lê" },
      };
    case "DOCTOR":
      return {
        ...base,
        id: "demo-doctor",
        email: "bacsi-demo@mmavision.local",
        role: "DOCTOR",
        profile: { id: "demo-doctor-profile", firstName: "Lan", lastName: "Phạm" },
      };
    case "ADMIN":
      return {
        ...base,
        id: "demo-admin",
        email: "admin-demo@mmavision.local",
        role: "ADMIN",
        profile: { id: "demo-admin-profile", firstName: "Quản", lastName: "Trị" },
      };
    default:
      return {
        ...base,
        id: "demo-fighter",
        email: "demo@mmavision.local",
        role: "FIGHTER",
        profile: {
          id: "demo-fighter-profile",
          firstName: "Minh",
          lastName: "Trần",
          dateOfBirth: "1998-05-12",
          weightClass: "WELTERWEIGHT",
        },
      };
  }
}

type SessionValue = {
  gate: SessionGate;
  /** Cold-start `restore()` has settled (success, anonymous fallback, or error). */
  restoreSettled: boolean;
  user: PublicUser | null;
  blockedRole: UserRole | null;
  isDemo: boolean;
  signIn: (body: LoginBody) => Promise<SessionGate>;
  enterDemo: (role?: UserRole) => SessionGate;
  applyRegisteredSession: (user: PublicUser) => SessionGate;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

function gateFromUser(user: PublicUser): SessionGate {
  switch (user.role) {
    case "COACH":
      return "coach";
    case "DOCTOR":
      return "doctor";
    case "ADMIN":
      return "admin";
    case "GUEST":
      return "guest";
    default:
      return "fighter";
  }
}

/**
 * Destination after splash/intro once session restore has settled.
 * `null` while `gate === "loading"` so callers can stay on glass (no login flash).
 */
export function postIntroHref(gate: SessionGate): Href | null {
  switch (gate) {
    case "loading":
      return null;
    case "anonymous":
      return "/login" as Href;
    case "guest":
      return "/ho-so" as Href;
    case "coach":
      return "/(coach)/fighters" as Href;
    case "doctor":
      return "/(doctor)" as Href;
    case "admin":
      return "/(admin)" as Href;
    case "fighter":
      return "/" as Href;
  }
}

/** Home after `/users/me`. Fighter Home stays on `/` (splash sandwich); other fighter tabs under `(fighter)`. */
export function homeHrefForGate(gate: SessionGate): Href {
  return postIntroHref(gate) ?? ("/login" as Href);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<SessionGate>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [restoreSettled, setRestoreSettled] = useState(false);
  const isDemoRef = useRef(false);
  const demoGateRef = useRef<SessionGate | null>(null);

  const loadMe = useCallback(async (): Promise<SessionGate> => {
    const me = await getMe();
    if (isDemoRef.current && demoGateRef.current) {
      return demoGateRef.current;
    }
    const next = gateFromUser(me);
    isDemoRef.current = false;
    demoGateRef.current = null;
    setIsDemo(false);
    setUser(me);
    setGate(next);
    return next;
  }, []);

  /** Register already returns `PublicUser`; skip a redundant GET `/users/me`. */
  const applyRegisteredSession = useCallback((nextUser: PublicUser): SessionGate => {
    const next = gateFromUser(nextUser);
    isDemoRef.current = false;
    demoGateRef.current = null;
    setIsDemo(false);
    setUser(nextUser);
    setGate(next);
    return next;
  }, []);

  const restore = useCallback(async () => {
    const stored = await loadStoredSession();
    if (isDemoRef.current) return;
    if (!stored) {
      setUser(null);
      setGate("anonymous");
      return;
    }
    try {
      await loadMe();
    } catch {
      if (isDemoRef.current) return;
      await clearSession();
      setUser(null);
      setGate("anonymous");
    }
  }, [loadMe]);

  useEffect(() => {
    void restore().finally(() => setRestoreSettled(true));
  }, [restore]);

  const signIn = useCallback(
    async (body: LoginBody): Promise<SessionGate> => {
      const result = await loginRequest(body);
      await persistSession(result.session);
      isDemoRef.current = false;
      demoGateRef.current = null;
      setIsDemo(false);
      try {
        return await loadMe();
      } catch (error) {
        await clearSession();
        setUser(null);
        setGate("anonymous");
        throw error;
      }
    },
    [loadMe],
  );

  const enterDemo = useCallback((role: UserRole = "FIGHTER"): SessionGate => {
    const nextUser = demoUserForRole(role);
    const next = gateFromUser(nextUser);
    isDemoRef.current = true;
    demoGateRef.current = next;
    setIsDemo(true);
    setUser(nextUser);
    setGate(next);
    return next;
  }, []);

  const signOut = useCallback(async () => {
    if (!isDemoRef.current) {
      const stored = getMemorySession() ?? (await loadStoredSession());
      if (stored?.accessToken) {
        try {
          await logoutRequest();
        } catch {
          /* still clear local tokens */
        }
      }
      await clearSession();
    }
    isDemoRef.current = false;
    demoGateRef.current = null;
    setIsDemo(false);
    setUser(null);
    setGate("anonymous");
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      gate,
      restoreSettled,
      user,
      blockedRole:
        user &&
        gate !== "fighter" &&
        gate !== "guest" &&
        gate !== "anonymous" &&
        gate !== "loading"
          ? user.role
          : null,
      isDemo,
      signIn,
      enterDemo,
      applyRegisteredSession,
      signOut,
    }),
    [applyRegisteredSession, enterDemo, gate, isDemo, restoreSettled, signIn, signOut, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Role of the signed-in user, or null outside a SessionProvider (tests, standalone screens). */
export function useSessionRole(): string | null {
  return use(SessionContext)?.user?.role ?? null;
}

export function useSession(): SessionValue {
  const value = use(SessionContext);
  if (!value) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return value;
}
