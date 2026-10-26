import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Link, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  isApiError,
  listDoctorFighters,
  type PublicFighter,
  type PublicUser,
} from "@/api";
import { doctor } from "@/i18n/doctor";
import { vi } from "@/i18n/vi";
import { DoctorPushDeliveryNote, DoctorPushRationale } from "@/notifications/doctor-os-notifications";
import { mapApiMessage } from "@/session/map-api-message";
import { useSession } from "@/session/session-context";
import { radius, spacing, type, useThemePreference, type ColorTokens } from "@/theme";
import { CONTRAST_BODY, ensureContrast } from "@/theme/appearance/color-math";

import { useDoctorInbox } from "./inbox-context";
import { useSelectedFighter } from "./selected-fighter";
import { useReadableWidth } from "@/components/readable-width";
import { ThemedRefreshControl, usePullRefresh } from "@/components/loading";

/** Secondary text that still clears body contrast on light and dark surfaces. */
export function doctorMuted(colors: ColorTokens): string {
  return ensureContrast(ensureContrast(colors.inkMuted, colors.bg, CONTRAST_BODY), colors.surface, CONTRAST_BODY);
}

const hiddenScroll = Platform.OS === "web" ? ({ scrollbarWidth: "none" } as ViewStyle) : undefined;

export function DoctorScroll({
  children,
  contentContainerStyle,
  onRefresh,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Kéo để làm mới; reject khi lỗi → toast, giữ dữ liệu cũ. */
  onRefresh?: () => Promise<unknown> | unknown;
}) {
  const readable = useReadableWidth();
  const pull = usePullRefresh(onRefresh ?? (() => undefined));
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <ThemedRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} /> : undefined}
      style={hiddenScroll}
      contentContainerStyle={[contentContainerStyle, readable]}
    >
      {children}
    </ScrollView>
  );
}

export function fighterName(row: { firstName: string; lastName: string }): string {
  return `${row.firstName} ${row.lastName}`.trim();
}

/** Chữ cái đầu, bỏ ký tự không phải chữ: "UX Fighter" + "[TEST]" → "UT". */
export function cleanInitials(...parts: (string | null | undefined)[]): string {
  const letters = parts
    .map((part) => (part ?? "").replace(/[^\p{L}\s]/gu, " ").trim())
    .filter(Boolean)
    .map((part) => part.charAt(0));
  return letters.slice(0, 2).join("").toLocaleUpperCase("vi-VN") || "?";
}

export function fighterInitials(row: { firstName: string; lastName: string }): string {
  return cleanInitials(row.firstName, row.lastName);
}

export function doctorProfileId(user: PublicUser | null): string | null {
  const profile = user?.profile;
  if (!profile || typeof profile.id !== "string") return null;
  return profile.id;
}

export function clinicalMessage(error: unknown): string {
  if (!isApiError(error)) return "Không làm được lúc này. Thử lại sau.";
  if (error.status === 0 || error.code === "NETWORK_ERROR") return "Không kết nối được. Kiểm tra mạng rồi thử lại.";
  if (error.status === 403) return "Bạn chưa được xem hồ sơ võ sĩ này.";
  if (error.status === 404) return "Không tìm thấy võ sĩ.";
  return "Không làm được lúc này. Thử lại sau.";
}

export function clearanceStartsLater(row: {
  status: string;
  isCurrentlyValid: boolean;
  validFrom: string;
}): boolean {
  if (row.status !== "ACTIVE" || row.isCurrentlyValid) return false;
  const start = new Date(row.validFrom).getTime();
  return !Number.isNaN(start) && start > Date.now();
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

export function DoctorChrome({
  title,
  subtitle,
  children,
  requireDoctor = true,
  showPushGap = false,
  showPushRationale = false,
  back = false,
  trailing,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  requireDoctor?: boolean;
  showPushGap?: boolean;
  showPushRationale?: boolean;
  back?: boolean;
  trailing?: ReactNode;
}) {
  const { colors } = useThemePreference();
  const muted = doctorMuted(colors);
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const router = useRouter();
  const inbox = useDoctorInbox();
  const isDoctor = user?.role === "DOCTOR";
  const showChildren = requireDoctor ? isDoctor : Boolean(user);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.nav}>
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={doctor.back}
            hitSlop={8}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.navigate("/(doctor)" as Href);
            }}
            style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.ink} />
          </Pressable>
        ) : null}
        <Text
          accessibilityRole="header"
          style={[type.title, styles.navTitle, { color: colors.ink, textTransform: "none" }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {trailing}
        {inbox ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={doctor.inbox.title}
            hitSlop={8}
            onPress={inbox.open}
            style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
          >
            <MaterialCommunityIcons name="bell-outline" size={22} color={colors.ink} />
          </Pressable>
        ) : null}
      </View>
      {subtitle ? <Text style={[type.body, { color: colors.ink }]}>{subtitle}</Text> : null}
      {showPushRationale ? <DoctorPushRationale /> : null}
      {showPushGap ? <DoctorPushDeliveryNote includeGap /> : null}

      {!user ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[type.body, { color: colors.ink }]}>{doctor.loginHint}</Text>
          <Link href={"/login" as Href} asChild>
            <Pressable accessibilityRole="link" style={styles.link}>
              <Text style={[type.link, { color: colors.lotus }]}>{doctor.me.login}</Text>
            </Pressable>
          </Link>
        </View>
      ) : null}

      {user && !isDoctor ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[type.body, { color: colors.ink }]}>{doctor.roleOnly}</Text>
        </View>
      ) : null}

      {showChildren ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

export function DoctorPatientBar({ onChange }: { onChange: () => void }) {
  const { colors } = useThemePreference();
  const muted = doctorMuted(colors);
  const { fighter } = useSelectedFighter();
  if (!fighter) return null;
  const weight = vi.weightClass[fighter.weightClass];
  return (
    <View style={[styles.patient, { borderBottomColor: colors.line }]}>
      <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[type.body, { color: colors.ink }]}>{fighterInitials(fighter)}</Text>
      </View>
      <View style={styles.patientText}>
        <Text style={[type.body, { color: colors.ink }]}>{fighterName(fighter)}</Text>
        <Text style={[type.caption, { color: muted }]}>
          {weight}
          {fighter.gym ? ` · ${fighter.gym}` : ""}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={doctor.fighters.change}
        onPress={onChange}
        style={({ pressed }) => [styles.change, pressed ? styles.pressed : null]}
      >
        <Text style={[type.label, { color: colors.lotus }]}>{doctor.fighters.change}</Text>
      </Pressable>
    </View>
  );
}

export function FighterSwitchSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useThemePreference();
  const muted = doctorMuted(colors);
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { fighter: selected, setFighter } = useSelectedFighter();
  const [rows, setRows] = useState<PublicFighter[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (user?.role !== "DOCTOR") return;
    const doctorId = doctorProfileId(user);
    if (!doctorId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void listDoctorFighters(doctorId, { page: 1, limit: 50 })
      .then((page) => {
        if (!cancelled) setRows(page.data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(mapApiMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!visible) return;
    const stop = load();
    return () => {
      stop?.();
    };
  }, [load, visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable accessibilityRole="button" style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom + spacing.md,
            borderColor: colors.line,
          },
        ]}
      >
        <View style={styles.sheetHead}>
          <Text style={[type.title, { color: colors.ink, textTransform: "none" }]}>
            {doctor.fighters.sheetTitle}
          </Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.change}>
            <Text style={[type.link, { color: colors.lotus }]}>{doctor.fighters.close}</Text>
          </Pressable>
        </View>
        {loading ? <ActivityIndicator color={colors.lotus} /> : null}
        {error ? (
          <Pressable accessibilityRole="button" onPress={() => load()}>
            <Text style={[type.link, { color: colors.lotus }]}>{doctor.retry}</Text>
          </Pressable>
        ) : null}
        <ScrollView showsVerticalScrollIndicator={false} style={hiddenScroll}>
          {rows.map((row) => {
            const active = selected?.id === row.id;
            return (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setFighter(row);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.sheetRow,
                  { borderBottomColor: colors.line },
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={[type.body, { color: colors.ink }]}>{fighterName(row)}</Text>
                <Text style={[type.caption, { color: muted }]}>
                  {doctor.status[row.currentMedicalStatus]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function DoctorCard({ children }: { children: ReactNode }) {
  const { colors } = useThemePreference();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      {children}
    </View>
  );
}

export const doctorStyles = StyleSheet.create({
  link: {
    minHeight: 44,
    justifyContent: "center",
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xxl + spacing.xl,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.screenX,
    gap: spacing.md,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
  },
  navTitle: {
    flex: 1,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  patient: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.md,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  patientText: {
    flex: 1,
    gap: 2,
  },
  change: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    maxHeight: "70%",
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  body: {
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  link: {
    minHeight: 44,
    justifyContent: "center",
  },
});
