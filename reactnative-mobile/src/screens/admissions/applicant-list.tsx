import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import {
  listOwnApplications,
  type ApplicantApplication,
} from "@/api/admissions";
import { blockingApplication } from "@/admissions/open-application";
import { AppearanceLink } from "@/components/appearance/appearance-link";
import { AuthButton } from "@/components/auth/auth-button";
import { useToastMessage } from "@/components/toast/app-toast";
import {
  APPLICATION_STATUS_TONE,
  AvatarInitials,
  SkeletonCards,
  StatusChip,
  VisualCard,
} from "@/components/visuals";
import { vi } from "@/i18n/vi";
import { AdmissionPage } from "@/screens/admissions/page";
import { formatDay } from "@/screens/fighter/format";
import { useSession } from "@/session/session-context";
import { mapApiMessage } from "@/session/map-api-message";
import { radius, spacing, type, useThemePreference, type ColorTokens } from "@/theme";

export function ApplicantListScreen({
  detailHref,
  showSubmit,
}: {
  detailHref: (id: string) => string;
  showSubmit?: boolean;
}) {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { signOut, user } = useSession();
  const [items, setItems] = useState<ApplicantApplication[]>([]);
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void listOwnApplications({ page: 1, limit: 20 })
      .then((page) => {
        setItems(page.items);
        setError("");
      })
      .catch((cause: unknown) => setError(mapApiMessage(cause)))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = loading ? null : blockingApplication(items);
  const canSubmit = !loading && !open;

  return (
    <AdmissionPage title={showSubmit ? vi.admission.roleGuest : vi.admission.mine} onBack={!showSubmit}>
      {showSubmit ? (
        <VisualCard colors={colors}>
          <Text style={[type.body, { color: colors.ink }]}>{user?.email ?? ""}</Text>
          <Text style={[type.caption, { color: colors.inkMuted }]}>{vi.admission.guestIntro}</Text>
        </VisualCard>
      ) : null}
      {showSubmit ? <Text style={[type.label, { color: colors.inkMuted }]}>{vi.admission.title}</Text> : null}
      {loading ? <SkeletonCards colors={colors} count={3} /> : null}
      {!loading && !error && items.length === 0 ? (
        <VisualCard colors={colors}>
          <Text style={[type.body, { color: colors.inkMuted }]}>{vi.admission.empty}</Text>
        </VisualCard>
      ) : null}
      {!loading
        ? items.map((item) => {
            const name = `${item.applicant.lastName} ${item.applicant.firstName}`;
            const statusLabel = vi.admission.status[item.status];
            return (
              <ApplicationRow
                key={item.id}
                colors={colors}
                accessibilityLabel={`${name}, ${statusLabel}`}
                onPress={() => router.push(detailHref(item.id) as never)}
              >
                <AvatarInitials colors={colors} name={name} size={44} />
                <View style={styles.rowBody}>
                  <Text style={[type.body, { color: colors.ink }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={[type.caption, { color: colors.inkMuted }]} numberOfLines={1}>
                    {`${vi.admission.submittedAt}: ${formatDay(item.submittedAt)}`}
                  </Text>
                  <View style={styles.chipRow}>
                    <StatusChip colors={colors} label={statusLabel} tone={APPLICATION_STATUS_TONE[item.status]} />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.inkSubtle} style={styles.chevron} />
              </ApplicationRow>
            );
          })
        : null}
      {showSubmit ? (
        <>
          {open ? (
            <>
              <Text style={[type.caption, { color: colors.inkMuted }]}>{vi.admission.openBlocksSubmit}</Text>
              <AuthButton
                title={vi.admission.openExisting}
                onPress={() => router.push(detailHref(open.id) as never)}
              />
            </>
          ) : null}
          <AuthButton
            title={vi.admission.submit}
            disabled={!canSubmit}
            onPress={() => {
              if (canSubmit) router.push("/ho-so/new" as never);
            }}
          />
          <AppearanceLink />
          <AuthButton
            title={vi.dashboard.logout}
            variant="secondary"
            onPress={() => {
              void signOut().then(() => router.replace("/login"));
            }}
          />
        </>
      ) : null}
    </AdmissionPage>
  );
}

function ApplicationRow({
  colors,
  accessibilityLabel,
  onPress,
  children,
}: {
  colors: ColorTokens;
  accessibilityLabel: string;
  onPress: () => void;
  children: ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.lg,
  },
  rowBody: { flex: 1, flexShrink: 1, minWidth: 0, gap: spacing.xs },
  chipRow: { flexDirection: "row" },
  chevron: { flexShrink: 0 },
});
