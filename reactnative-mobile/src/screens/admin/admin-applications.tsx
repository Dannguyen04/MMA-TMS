import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import {
  APPLICATION_STATUSES,
  listApplications,
  type ApplicationStatus,
  type StaffApplication,
} from "@/api/admissions";
import { Icon } from "@/components/icon";
import { FadeInView, PressableScale, SkeletonList } from "@/components/motion";
import { StateView } from "@/components/state-view";
import { useToastMessage } from "@/components/toast/app-toast";
import { manager } from "@/i18n/manager";
import { states } from "@/i18n/unavailable";
import { vi } from "@/i18n/vi";
import { useAdminType } from "@/screens/admin/admin-page";
import { AdminScreen, ApplicationStatusPill, Initials } from "@/screens/admin/admin-ui";
import { mapApiMessage } from "@/session/map-api-message";
import { spacing, useThemePreference } from "@/theme";
import { FilterSelect } from "@/components/filter-sheet";

export function applicantName(item: Pick<StaffApplication, "applicant">): string {
  return `${item.applicant.lastName} ${item.applicant.firstName}`.trim();
}

export function formatDay(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type Filter = "ALL" | ApplicationStatus;

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: "ALL", label: manager.list.all },
  ...APPLICATION_STATUSES.map((status) => ({ value: status as Filter, label: vi.admission.status[status] })),
];

/** Figma "Manager · Hồ sơ nhập học" (161:18980). */
export function AdminApplicationListScreen() {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [items, setItems] = useState<StaffApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useToastMessage(error, "error");

  const load = useCallback(
    (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setError("");
      return listApplications({ page: 1, limit: 50, ...(filter === "ALL" ? {} : { status: filter }) })
        .then((page) => {
          setItems(page.items);
          setTotal(page.total);
          setLoaded(true);
        })
        .catch((cause: unknown) => {
          setLoaded(true);
          if (mode === "refresh") throw cause;
          setError(mapApiMessage(cause));
        });
    },
    [filter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminScreen title={manager.list.title} onRefresh={load}>
      <View style={styles.lead}>
        <Text style={[at.section, { color: colors.ink }]}>{loaded && !error ? manager.list.count(total) : manager.list.title}</Text>
        <Text style={[at.meta, { color: colors.inkMuted }]}>{manager.list.hint}</Text>
      </View>
      <FilterSelect label="Trạng thái" options={FILTERS} value={filter} allValue="ALL" onChange={setFilter} />
      {!loaded ? <SkeletonList rows={4} height={88} /> : null}
      {loaded && error && items.length === 0 ? (
        <StateView kind="error" title={states.loadFailed} description={error} actionLabel={states.retry} onAction={load} compact />
      ) : null}
      {loaded && !error && items.length === 0 ? <StateView kind="empty" title={manager.list.empty} compact /> : null}
      {items.length > 0 ? (
        <View>
          {items.map((item, index) => (
            <FadeInView key={item.id} index={index}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${applicantName(item)}, ${vi.admission.status[item.status]}`}
                onPress={() => router.push(`/quan-tri/nhap-hoc/${item.id}` as never)}
                scaleTo={0.985}
                style={[styles.row, { borderBottomColor: colors.line }]}
              >
                <Initials name={applicantName(item)} />
                <View style={styles.body}>
                  <Text style={[at.rowTitle, { color: colors.ink }]} numberOfLines={2}>{applicantName(item)}</Text>
                  <Text style={[at.meta, { color: colors.inkMuted }]}>{manager.list.submittedOn(formatDay(item.submittedAt))}</Text>
                  <ApplicationStatusPill status={item.status} />
                </View>
                <Icon name="chevron" size={20} tone="muted" />
              </PressableScale>
            </FadeInView>
          ))}
        </View>
      ) : null}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  lead: { gap: spacing.xs },
  row: {
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: spacing.xs },
});
