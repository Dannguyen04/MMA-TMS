import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { AuthButton } from "@/components/auth/auth-button";
import { AuthTextField } from "@/components/auth/auth-text-field";
import { BlockedApiNotice } from "@/components/blocked/blocked-api-notice";
import { blocked } from "@/i18n/blocked";
import { FighterScreen, GlassCard, SectionLabel } from "@/screens/fighter/screen";
import { radius, spacing, type, useThemePreference } from "@/theme";

export function BlockedLink({ href, label }: { href: Href; label: string }) {
  const { colors } = useThemePreference();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={styles.link}
    >
      <Text style={[type.link, { color: colors.lotus }]}>{label}</Text>
    </Pressable>
  );
}

export function BlockedFighterPage({
  title,
  extra,
  children,
  onBack = true,
}: {
  title: string;
  extra?: string;
  children?: ReactNode;
  onBack?: boolean;
}) {
  return (
    <FighterScreen title={title} onBack={onBack}>
      <BlockedApiNotice extra={extra} />
      {children}
    </FighterScreen>
  );
}

export function EmptyBlockedList() {
  const { colors } = useThemePreference();
  return (
    <GlassCard>
      <Text style={[type.body, { color: colors.inkMuted }]}>{blocked.empty}</Text>
    </GlassCard>
  );
}

export function DisabledForm({
  fields,
  cta = blocked.submit,
}: {
  fields: { label: string; placeholder?: string }[];
  cta?: string;
}) {
  return (
    <>
      {fields.map((field) => (
        <AuthTextField
          key={field.label}
          label={field.label}
          value=""
          onChangeText={() => undefined}
          placeholder={field.placeholder}
          editable={false}
        />
      ))}
      <AuthButton title={cta} onPress={() => undefined} disabled />
    </>
  );
}

export function EvidenceReviewSketch() {
  const { colors } = useThemePreference();
  return (
    <>
      <SectionLabel text={blocked.pipeline} />
      <GlassCard>
        <Text style={[type.caption, { color: colors.inkMuted }]}>{blocked.stageHint}</Text>
        <View style={styles.rail}>
          {blocked.stages.map((stage) => (
            <View
              key={stage}
              style={[styles.dot, { borderColor: colors.line, backgroundColor: colors.surfaceMuted }]}
            >
              <Text style={[type.caption, { color: colors.inkSubtle }]}>{stage}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
      <SectionLabel text={blocked.evidence} />
      <View style={[styles.frame, { borderColor: colors.cage }]}>
        <Text style={[type.caption, { color: colors.inkMuted }]}>{blocked.noObservation}</Text>
      </View>
      <SectionLabel text={blocked.observation} />
      <GlassCard>
        <Text style={[type.body, { color: colors.ink }]}>{blocked.noObservation}</Text>
        <Text style={[type.caption, { color: colors.inkMuted }]}>
          {blocked.confidence}: —
        </Text>
      </GlassCard>
      <SectionLabel text={blocked.decision} />
      <AuthButton title={blocked.accept} onPress={() => undefined} disabled />
      <AuthButton title={blocked.correct} onPress={() => undefined} disabled variant="secondary" />
      <AuthButton title={blocked.reject} onPress={() => undefined} disabled variant="secondary" />
    </>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 44, justifyContent: "center" },
  rail: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  dot: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  frame: {
    minHeight: 160,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radius.panel,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
  },
});
