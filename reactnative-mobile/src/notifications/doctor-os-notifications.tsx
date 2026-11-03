import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { doctor } from "@/i18n/doctor";
import { radius, spacing, type, useThemePreference } from "@/theme";

import {
  readOsNotificationPhase,
  requestOsNotificationPhase,
  type OsNotificationPhase,
} from "./os-access";

type DoctorOsNotificationValue = {
  phase: OsNotificationPhase;
  ask: () => void;
};

const DoctorOsNotificationContext = createContext<DoctorOsNotificationValue | null>(null);

export function DoctorOsNotificationProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<OsNotificationPhase>({ kind: "checking" });
  const asked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void readOsNotificationPhase()
      .then((next) => {
        if (!cancelled) setPhase(next);
      })
      .catch(() => {
        if (!cancelled) setPhase({ kind: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ask = () => {
    if (asked.current || phase.kind !== "rationale") return;
    asked.current = true;
    void requestOsNotificationPhase()
      .then(setPhase)
      .catch(() => setPhase({ kind: "failed" }));
  };

  return (
    <DoctorOsNotificationContext.Provider value={{ phase, ask }}>
      {children}
    </DoctorOsNotificationContext.Provider>
  );
}

function useDoctorOsNotifications(): DoctorOsNotificationValue | null {
  return useContext(DoctorOsNotificationContext);
}

export function DoctorPushRationale() {
  const value = useDoctorOsNotifications();
  const { colors } = useThemePreference();
  if (!value || value.phase.kind !== "rationale") return null;

  return (
    <View
      style={{
        borderWidth: 1,
        borderRadius: radius.panel,
        borderColor: colors.line,
        backgroundColor: colors.surface,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <Text style={[type.label, { color: colors.lotus }]}>{doctor.notifications.rationaleTitle}</Text>
      <Text style={[type.body, { color: colors.ink }]}>{doctor.notifications.rationale}</Text>
      <Pressable accessibilityRole="button" onPress={value.ask} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={[type.link, { color: colors.lotus }]}>{doctor.notifications.continue}</Text>
      </Pressable>
    </View>
  );
}

export function DoctorPushDeliveryNote({ includeGap = false }: { includeGap?: boolean }) {
  const value = useDoctorOsNotifications();
  const { colors } = useThemePreference();
  if (!value) return null;

  const text = deliveryCopy(value.phase, includeGap);
  if (!text) return null;

  return <Text style={[type.caption, { color: colors.inkMuted }]}>{text}</Text>;
}

function deliveryCopy(phase: OsNotificationPhase, includeGap: boolean): string | null {
  if (phase.kind === "denied") return doctor.notifications.denied;
  if (phase.kind === "unsupported") return doctor.notifications.unsupported;
  if (phase.kind === "failed") return doctor.notifications.failed;
  if (phase.kind === "granted" && includeGap) return doctor.notifications.gap[phase.gap];
  return null;
}
