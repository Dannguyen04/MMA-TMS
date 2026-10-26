import Ionicons from "@expo/vector-icons/Ionicons";
import { Fragment, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import type { ApplicationStatus, StaffApplication } from "@/api/admissions";
import { AuthButton } from "@/components/auth/auth-button";
import { useToastMessage } from "@/components/toast/app-toast";
import { AuthTextField } from "@/components/auth/auth-text-field";
import {
  APPLICATION_STATUS_ICON,
  APPLICATION_STATUS_TONE,
  SkeletonBlock,
  toneColors,
  type VisualTone,
} from "@/components/visuals";
import { vi } from "@/i18n/vi";
import { AdminShell, useAdminType } from "@/screens/admin/admin-page";
import { radius, spacing, useThemePreference, type ColorTokens } from "@/theme";

function fullName(item: StaffApplication) {
  return `${item.applicant.lastName} ${item.applicant.firstName}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function statusInk(colors: ColorTokens, tone: VisualTone) {
  return tone === "neutral" ? colors.ink : toneColors(colors, tone).label;
}

function StatusMark({ colors, status }: { colors: ColorTokens; status: ApplicationStatus }) {
  const at = useAdminType();
  const tone = APPLICATION_STATUS_TONE[status];
  const t = toneColors(colors, tone);
  const ink = statusInk(colors, tone);
  return (
    <View style={[styles.mark, { backgroundColor: t.soft, borderColor: t.border }]}>
      <Ionicons name={APPLICATION_STATUS_ICON[status]} size={16} color={ink} />
      <Text style={[at.metaStrong, { color: ink }]} numberOfLines={1}>
        {vi.admission.status[status]}
      </Text>
    </View>
  );
}

export function AdminApplicationList({
  items,
  total,
  loaded,
  error,
  onOpen,
}: {
  items: StaffApplication[];
  total: number;
  loaded: boolean;
  error: string;
  onOpen: (id: string) => void;
}) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  useToastMessage(error, "error");
  const lead = loaded && !error ? `${total} ${vi.admission.countUnit}` : undefined;

  return (
    <AdminShell title={vi.admission.staff} lead={lead} onBack>
      {!loaded && !error ? (
        <View>
          {[0, 1, 2].map((index) => (
            <View key={index} style={styles.skeletonRow}>
              <SkeletonBlock colors={colors} height={20} width="65%" />
              <SkeletonBlock colors={colors} height={28} width="45%" />
            </View>
          ))}
        </View>
      ) : null}
      {loaded && items.length === 0 ? (
        <Text style={[at.body, { color: colors.inkMuted }]}>{vi.admission.empty}</Text>
      ) : null}
      {items.length > 0 ? (
        <View style={[styles.list, { borderColor: colors.line }]}>
          {items.map((item, index) => {
            const tone = APPLICATION_STATUS_TONE[item.status];
            const bar = tone === "neutral" ? colors.inkSubtle : toneColors(colors, tone).fg;
            return (
              <Fragment key={item.id}>
                {index > 0 ? <View style={[styles.rule, { backgroundColor: colors.line }]} /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${fullName(item)}, ${vi.admission.status[item.status]}`}
                  onPress={() => onOpen(item.id)}
                  style={styles.row}
                >
                  <View style={[styles.bar, { backgroundColor: bar }]} />
                  <View style={styles.rowBody}>
                    <Text style={[at.section, { color: colors.ink }]} numberOfLines={2}>
                      {fullName(item)}
                    </Text>
                    <View style={styles.rowMeta}>
                      <StatusMark colors={colors} status={item.status} />
                      <Text style={[at.meta, { color: colors.inkMuted }]}>
                        {formatDate(item.submittedAt)}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.inkSubtle} />
                </Pressable>
              </Fragment>
            );
          })}
        </View>
      ) : null}
    </AdminShell>
  );
}

function Fact({ colors, label, value }: { colors: ColorTokens; label: string; value: string }) {
  const at = useAdminType();
  return (
    <View style={styles.fact}>
      <Text style={[at.meta, { color: colors.inkMuted }]}>{label}</Text>
      <Text style={[at.body, { color: colors.ink }]}>{value}</Text>
    </View>
  );
}

function Section({ colors, title, children }: { colors: ColorTokens; title: string; children: ReactNode }) {
  const at = useAdminType();
  return (
    <View style={[styles.section, { borderTopColor: colors.line }]}>
      <Text style={[at.section, { color: colors.ink }]}>{title}</Text>
      {children}
    </View>
  );
}

export function AdminApplicationDetail({
  item,
  error,
  notice,
  busy,
  coachId,
  onCoachId,
  assignReason,
  onAssignReason,
  decisionReason,
  onDecisionReason,
  onAssign,
  onApprove,
  onReject,
  onResend,
  assessment,
}: {
  item: StaffApplication | null;
  error: string;
  notice: string;
  busy: boolean;
  coachId: string;
  onCoachId: (value: string) => void;
  assignReason: string;
  onAssignReason: (value: string) => void;
  decisionReason: string;
  onDecisionReason: (value: string) => void;
  onAssign: () => void;
  onApprove: () => void;
  onReject: () => void;
  onResend: () => void;
  assessment: ReactNode;
}) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const [section, setSection] = useState(0);
  useToastMessage(error, "error");
  useToastMessage(notice, "success");
  const decisionBlocked = busy || !decisionReason.trim();

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <AdminShell onBack>
        <View style={styles.sectionRow} accessibilityRole="tablist">
          {vi.admission.adminSections.map((label, index) => {
            const selected = index === section;
            return (
              <Pressable
                key={label}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                onPress={() => setSection(index)}
                style={[
                  styles.sectionItem,
                  {
                    backgroundColor: selected ? colors.cta : colors.surface,
                    borderColor: selected ? colors.cta : colors.line,
                  },
                ]}
              >
                <Text numberOfLines={1} style={[at.metaStrong, { color: selected ? colors.onCta : colors.ink }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {section === 0 ? (
          <OverviewSection colors={colors} item={item} error={error} busy={busy} onResend={onResend} assessment={assessment} />
        ) : null}

        {section === 1 ? (
          <>
            {item ? <CompactHeader colors={colors} item={item} /> : null}
            <Section colors={colors} title={vi.admission.assign}>
              {item ? (
                <Fact
                  colors={colors}
                  label={vi.admission.currentCoach}
                  value={item.currentAssignment?.coachId ?? vi.admission.noCoach}
                />
              ) : null}
              <AuthTextField label={vi.admission.coachId} value={coachId} onChangeText={onCoachId} autoCapitalize="none" />
              <AuthTextField
                label={vi.admission.reason}
                helper={vi.admission.optional}
                value={assignReason}
                onChangeText={onAssignReason}
              />
              <AuthButton
                title={vi.admission.assign}
                disabled={busy || !coachId.trim()}
                loading={busy}
                onPress={onAssign}
              />
            </Section>
          </>
        ) : null}

        {section === 2 ? (
          <>
            {item ? <CompactHeader colors={colors} item={item} /> : null}
            <Section colors={colors} title={vi.admission.decision}>
              <AuthTextField label={vi.admission.reason} value={decisionReason} onChangeText={onDecisionReason} />
              <View style={styles.decisionRow}>
                <View style={styles.flex}>
                  <AuthButton title={vi.admission.approve} disabled={decisionBlocked} onPress={onApprove} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={vi.admission.reject}
                  accessibilityState={{ disabled: decisionBlocked }}
                  disabled={decisionBlocked}
                  onPress={onReject}
                  style={[styles.reject, { borderColor: decisionBlocked ? colors.disabledFill : colors.danger }]}
                >
                  <Text style={[at.rowTitle, { color: decisionBlocked ? colors.disabledInk : colors.danger }]}>
                    {vi.admission.reject}
                  </Text>
                </Pressable>
              </View>
            </Section>
          </>
        ) : null}
      </AdminShell>
    </KeyboardAvoidingView>
  );
}

function CompactHeader({ colors, item }: { colors: ColorTokens; item: StaffApplication }) {
  const at = useAdminType();
  return (
    <View style={styles.compactHeader}>
      <Text style={[at.rowTitle, styles.flex, { color: colors.ink }]} numberOfLines={2}>
        {fullName(item)}
      </Text>
      <StatusMark colors={colors} status={item.status} />
    </View>
  );
}

function OverviewSection({
  colors,
  item,
  error,
  busy,
  onResend,
  assessment,
}: {
  colors: ColorTokens;
  item: StaffApplication | null;
  error: string;
  busy: boolean;
  onResend: () => void;
  assessment: ReactNode;
}) {
  const at = useAdminType();
  return (
    <>
      {item ? (
        <>
          <StatusHeader colors={colors} item={item} />
          <View style={styles.facts}>
            <Fact colors={colors} label={vi.admission.submittedAt} value={formatDate(item.submittedAt)} />
            <Fact colors={colors} label={vi.admission.email} value={item.applicant.email} />
            <Fact
              colors={colors}
              label={vi.admission.currentCoach}
              value={item.currentAssignment?.coachId ?? vi.admission.noCoach}
            />
            {item.decision ? (
              <Fact
                colors={colors}
                label={`${vi.admission.decision} · ${formatDate(item.decision.decidedAt)}`}
                value={item.decision.reason}
              />
            ) : null}
            {item.activation ? (
              <Fact
                colors={colors}
                label={vi.admission.activationStatusLabel}
                value={vi.admission.activationStatus[item.activation.status]}
              />
            ) : null}
          </View>
        </>
      ) : !error ? (
        <View style={styles.headerSkeleton}>
          <SkeletonBlock colors={colors} height={16} width="40%" />
          <SkeletonBlock colors={colors} height={30} width="80%" />
          <SkeletonBlock colors={colors} height={72} />
        </View>
      ) : null}

      {assessment}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onResend}
        style={[styles.resend, { borderTopColor: colors.line }]}
      >
        <Ionicons name="mail-outline" size={22} color={busy ? colors.disabledInk : colors.lotus} />
        <Text style={[at.rowTitle, styles.flex, { color: busy ? colors.disabledInk : colors.lotus }]}>
          {vi.admission.resend}
        </Text>
        <Ionicons name="send-outline" size={18} color={busy ? colors.disabledInk : colors.lotus} />
      </Pressable>
    </>
  );
}

function StatusHeader({ colors, item }: { colors: ColorTokens; item: StaffApplication }) {
  const at = useAdminType();
  const tone = APPLICATION_STATUS_TONE[item.status];
  const t = toneColors(colors, tone);
  const ink = statusInk(colors, tone);
  const label = vi.admission.status[item.status];
  return (
    <View style={styles.header}>
      <Text style={[at.metaStrong, { color: colors.inkMuted }]}>{vi.admission.title}</Text>
      <Text style={[at.name, { color: colors.ink }]} numberOfLines={3}>
        {fullName(item)}
      </Text>
      <View
        accessible
        accessibilityLabel={`${vi.admission.title}: ${label}`}
        style={[styles.statusBand, { backgroundColor: t.soft, borderLeftColor: tone === "neutral" ? colors.ink : t.fg }]}
      >
        <Ionicons name={APPLICATION_STATUS_ICON[item.status]} size={30} color={ink} />
        <Text style={[at.status, styles.flex, { color: ink }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { borderTopWidth: 1, borderBottomWidth: 1 },
  rule: { height: StyleSheet.hairlineWidth },
  row: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  bar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  rowBody: { flex: 1, gap: spacing.sm },
  rowMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.md },
  skeletonRow: { gap: spacing.sm, paddingVertical: spacing.lg },
  mark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  header: { gap: spacing.sm },
  headerSkeleton: { gap: spacing.sm },
  statusBand: {
    marginTop: spacing.sm,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderLeftWidth: 6,
    borderTopRightRadius: radius.field,
    borderBottomRightRadius: radius.field,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  facts: { gap: spacing.md },
  fact: { gap: 2 },
  section: {
    borderTopWidth: 1,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  sectionRow: { flexDirection: "row", gap: spacing.sm },
  sectionItem: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.field,
  },
  compactHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  decisionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  reject: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.field,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  resend: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
});
