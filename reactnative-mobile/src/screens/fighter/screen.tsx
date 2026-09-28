import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthFormError } from "@/components/auth/auth-form-error";
import { fighter } from "@/i18n/fighter";
import { FighterTabBar } from "@/screens/fighter/tab-bar";
import { radius, spacing, type, useThemePreference } from "@/theme";

type FighterScreenProps = {
  title: string;
  children: ReactNode;
  onBack?: boolean;
  keyboard?: boolean;
  refreshing?: boolean;
  footer?: ReactNode;
};

export function FighterScreen({
  title,
  children,
  onBack,
  keyboard,
  refreshing,
  footer,
}: FighterScreenProps) {
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const body = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: spacing.xxl },
      ]}
    >
      {refreshing ? (
        <ActivityIndicator color={colors.lotus} style={styles.spinner} />
      ) : null}
      {children}
    </ScrollView>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            borderBottomColor: colors.line,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fighter.common.back}
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.back}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.ink} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <Text style={[type.title, styles.title, { color: colors.ink }]}>{title}</Text>
        <View style={styles.back} />
      </View>
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={8}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
      {footer}
      <FighterTabBar />
    </View>
  );
}

export function GlassCard({ children }: { children: ReactNode }) {
  const { colors } = useThemePreference();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line },
      ]}
    >
      {children}
    </View>
  );
}

export function StatusLine({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useThemePreference();
  if (!message) return null;
  return (
    <View style={styles.status}>
      <AuthFormError message={message} />
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
          <Text style={[type.link, { color: colors.lotus }]}>{fighter.common.retry}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyCopy({ text }: { text: string }) {
  const { colors } = useThemePreference();
  return <Text style={[type.body, { color: colors.inkMuted }]}>{text}</Text>;
}

export function SectionLabel({ text }: { text: string }) {
  const { colors } = useThemePreference();
  return <Text style={[type.label, styles.section, { color: colors.lotus }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center" },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  spinner: { marginVertical: spacing.md },
  card: {
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  status: { gap: spacing.sm },
  retry: { minHeight: 44, justifyContent: "center" },
  section: { letterSpacing: 0.8, lineHeight: 18, textTransform: "uppercase" },
});
