import { type ReactNode, useEffect } from "react";
import { Redirect, usePathname, useRouter } from "expo-router";

import {
  homeHrefForGate,
  postIntroHref,
  useSession,
  type SessionGate,
} from "@/session/session-context";

const AUTHENTICATED: SessionGate[] = ["guest", "fighter", "coach", "doctor", "admin"];

/**
 * Leave `/` for the post-intro destination as soon as the session gate is known.
 * That navigation happens under the ice, so shatter reveals login or the role
 * home instead of an empty black plate.
 */
export function usePostIntroRedirect(options?: { forceLeaveIndex?: boolean }) {
  const { gate } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const forceLeaveIndex = options?.forceLeaveIndex === true;

  useEffect(() => {
    if (gate === "loading") return;
    const href = postIntroHref(gate);
    if (!href) return;
    if (gate === "fighter" && !forceLeaveIndex && (pathname === "/" || pathname === "")) {
      return;
    }
    router.replace(href);
  }, [forceLeaveIndex, gate, pathname, router]);
}

/** @deprecated Prefer usePostIntroRedirect — kept as alias for staff-off-index call sites. */
export function useRedirectStaffOffIndex() {
  usePostIntroRedirect();
}

export function RoleLayoutGate({
  allow,
  children,
}: {
  allow: "guest" | "fighter" | "coach" | "doctor" | "admin";
  children: ReactNode;
}) {
  const { gate } = useSession();

  if (gate === "loading") {
    return children;
  }
  if (gate === "anonymous") {
    return <Redirect href="/login" />;
  }
  if (gate !== allow) {
    return <Redirect href={homeHrefForGate(gate)} />;
  }
  return children;
}

/** Auth stack: signed-in users continue to their role home. */
export function AuthSessionGate({ children }: { children: ReactNode }) {
  const { gate } = useSession();

  if (gate === "loading" || gate === "anonymous") {
    return children;
  }
  if (AUTHENTICATED.includes(gate)) {
    return <Redirect href={homeHrefForGate(gate)} />;
  }
  return children;
}
