import { IconBadge, type IconName } from "@/components/icon";

/**
 * Bản web: không import lottie-react-native (cần @lottiefiles/dotlottie-react, chưa cài)
 * → luôn dùng icon tĩnh theo theme. Bản native: state-illustration.tsx (Lottie).
 */
export type StateKind = "success" | "empty" | "error" | "analyzing" | "unavailable";

const FALLBACK_ICON: Record<StateKind, IconName> = {
  success: "success",
  empty: "empty",
  error: "warning",
  analyzing: "aiAlert",
  unavailable: "empty",
};

export function StateIllustration({ kind, size = 96 }: { kind: StateKind; size?: number }) {
  return (
    <IconBadge
      name={FALLBACK_ICON[kind]}
      size={Math.round(size / 3.2)}
      tone={kind === "success" ? "success" : kind === "error" ? "danger" : "accent"}
    />
  );
}
