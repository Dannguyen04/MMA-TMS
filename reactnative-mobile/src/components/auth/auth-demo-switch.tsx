import { Modal, Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { UserRole } from "@/api/types";
import { vi } from "@/i18n/vi";
import { homeHrefForGate, useSession } from "@/session/session-context";
import { radius, spacing, type, useThemePreference } from "@/theme";

const DEMOS: { role: UserRole; label: string }[] = [
  { role: "FIGHTER", label: vi.login.demo },
  { role: "COACH", label: vi.login.demoCoach },
  { role: "DOCTOR", label: vi.login.demoDoctor },
  { role: "ADMIN", label: vi.login.demoAdmin },
];

type AuthDemoSwitchProps = {
  open: boolean;
  onClose: () => void;
};

/** Temporary QA entry. Login is the only importer — delete with the login import. */
export function AuthDemoSwitch({ open, onClose }: AuthDemoSwitchProps) {
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { enterDemo } = useSession();

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
          onPress={() => undefined}
        >
          <Text style={[type.caption, { color: colors.inkSubtle }]}>{vi.login.demoPick}</Text>
          {DEMOS.map((item) => (
            <Pressable
              key={item.role}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => {
                onClose();
                const next = enterDemo(item.role);
                router.replace(homeHrefForGate(next));
              }}
              style={styles.option}
            >
              <Text style={[type.body, { color: colors.ink }]}>{item.label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Text style={[type.link, { color: colors.lotus }]}>{vi.common.close}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.xs,
    overflow: "hidden",
  },
  option: {
    minHeight: 48,
    justifyContent: "center",
  },
  close: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
