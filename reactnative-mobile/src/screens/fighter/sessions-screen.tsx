import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { useToastMessage } from "@/components/toast/app-toast";
import {
  getFighterMedical,
  SESSION_STATUSES,
  type MedicalDossier,
  type SessionStatus,
  type TrainingSessionSummary,
} from "@/api";
import { listPlansForFighter, listSessionsForFighter } from "@/screens/fighter/api";
import { fighter } from "@/i18n/fighter";
import { mapFighterError } from "@/screens/fighter/errors";
import { formatWhen, sessionStatusLabel, sessionTypeLabel } from "@/screens/fighter/format";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterHub, HubHeader } from "@/screens/fighter/redesign/shell";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useLoad } from "@/screens/fighter/use-load";
import { FadeInView, PressableScale } from "@/components/motion";
import { FilterSelect } from "@/components/filter-sheet";
import { SkeletonCards } from "@/components/loading";
import { Skeleton } from "@/components/motion";

type SessionList = {
  rows: TrainingSessionSummary[];
  filterTotal: number;
  anyTotal: number;
  medical: MedicalDossier | null;
  medicalError: string;
  planCount: number | null;
  planError: string;
};

export function FighterSessionsScreen() {
  const colors = useFighterPalette();
  const router = useRouter();
  const { fighterId, canFetch } = useFighterId();
  const [status, setStatus] = useState<SessionStatus | "">("");

  const load = useCallback(async (): Promise<SessionList> => {
    if (!fighterId) {
      return { rows: [], filterTotal: 0, anyTotal: 0, medical: null, medicalError: "", planCount: 0, planError: "" };
    }
    const [page, anyPage, medicalResult, plansResult] = await Promise.all([
      listSessionsForFighter({ page: 1, limit: 50, ...(status ? { status } : {}) }),
      status ? listSessionsForFighter({ page: 1, limit: 1 }) : Promise.resolve(null),
      getFighterMedical(fighterId).then(
        (value) => ({ value, error: "" }),
        (cause: unknown) => ({ value: null, error: mapFighterError(cause) }),
      ),
      listPlansForFighter(fighterId, { page: 1, limit: 1 }).then(
        (value) => ({ count: value.total, error: "" }),
        (cause: unknown) => ({ count: null as number | null, error: mapFighterError(cause) }),
      ),
    ]);
    return {
      rows: page.data,
      filterTotal: page.total,
      anyTotal: anyPage ? anyPage.total : page.total,
      medical: medicalResult.value,
      medicalError: medicalResult.error,
      planCount: plansResult.count,
      planError: plansResult.error,
    };
  }, [fighterId, status]);

  const { data, error, loading, reload, refresh } = useLoad(canFetch, `${fighterId ?? "none"}:${status || "all"}`, load);
  useToastMessage(error, "error");
  useToastMessage(data?.medicalError, "error");
  useToastMessage(data?.planError, "error");
  const rows = data?.rows ?? [];
  const noneAtAll = !!data && data.anyTotal === 0 && !error;
  const filterEmpty = !!data && !noneAtAll && rows.length === 0 && !error;
  const training = data?.medical?.eligibility.training;

  return (
    <FighterHub refreshing={loading && !data} onRefresh={refresh}>
      <HubHeader title="Buổi tập" />
      <View style={styles.pad}>
        <FilterSelect
          label="Trạng thái"
          options={[{ value: "" as const, label: fighter.tap.filterAll }, ...SESSION_STATUSES.map((value) => ({ value, label: sessionStatusLabel(value) }))]}
          value={status}
          allValue=""
          onChange={setStatus}
        />
        <View style={styles.rowBetween}>
          <Text style={[styles.kicker, { color: colors.muted }]}>DANH SÁCH</Text>
          <Text style={[styles.kicker, { color: colors.muted, fontWeight: "400" }]}>
            {data ? `${data.filterTotal} buổi tập` : ""}
          </Text>
        </View>

        {error ? (
          <Pressable accessibilityRole="button" onPress={reload} style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>Không tải được buổi tập</Text>
            <Text style={[styles.link, { color: colors.accent }]}>Thử lại</Text>
          </Pressable>
        ) : null}

        {!error && loading && !data ? (
          <SkeletonCards count={3} lines={2} />
        ) : null}

        {noneAtAll ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface2 }]}>
              <MaterialCommunityIcons name="calendar-month-outline" size={36} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>Chưa có buổi tập</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>
              Lịch và trạng thái sẽ xuất hiện ở đây khi có buổi tập được ghi nhận.
            </Text>
          </View>
        ) : null}

        {filterEmpty ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>Không có buổi ở bộ lọc này</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>
              Đổi bộ lọc để xem các buổi tập khác đã được ghi nhận.
            </Text>
          </View>
        ) : null}

        {rows.map((row, i) => (
          <FadeInView key={row.id} index={i}>
            <PressableScale
              accessibilityRole="button"
              onPress={() => router.push(`/tap/${row.id}` as Href)}
              style={[styles.session, { borderBottomColor: colors.line }]}
            >
              <Text style={[styles.sessionTitle, { color: colors.ink }]}>{row.title}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>
                {formatWhen(row.scheduledAt)} · {sessionTypeLabel(row.sessionType)} · {sessionStatusLabel(row.status)}
              </Text>
            </PressableScale>
          </FadeInView>
        ))}

        <View style={[styles.readiness, { backgroundColor: colors.surface2 }]}>
          {data?.medicalError ? (
            <Pressable accessibilityRole="button" onPress={reload}>
              <Text style={[styles.meta, { color: colors.accent }]}>Thử lại</Text>
            </Pressable>
          ) : (
            <View style={styles.elig}>
              <MaterialCommunityIcons
                name={training?.eligible ? "shield-check" : "shield-off-outline"}
                size={22}
                color={training ? (training.eligible ? colors.success : colors.warning) : colors.muted}
              />
              <View style={styles.flex}>
                <Text style={[styles.sessionTitle, { color: colors.ink }]}>
                  {training?.eligible ? "Đủ điều kiện tập luyện" : training ? "Chưa đủ điều kiện tập luyện" : "Điều kiện tập luyện"}
                </Text>
                {loading && !data ? (
                  <Skeleton width="60%" height={14} />
                ) : (
                  <Text style={[styles.meta, { color: colors.muted }]}>
                    {training?.eligible
                      ? "Điều kiện còn tùy loại buổi tập."
                      : training
                        ? "Xem lý do trên Cơ thể. Không bắt đầu buổi tập từ nhãn này."
                        : "Chưa có kết luận của hệ thống."}
                  </Text>
                )}
              </View>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/co-the" as Href)}
            style={[styles.outline, { backgroundColor: colors.surface, borderColor: colors.line }]}
          >
            <Text style={[styles.link, { color: colors.accent }]}>Xem điều kiện tại Cơ thể</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/giao-an" as Href)}
          style={[styles.planRow, { borderBottomColor: colors.line }]}
        >
          <MaterialCommunityIcons name="clipboard-text-outline" size={20} color={colors.ink} />
          <View style={styles.flex}>
            <Text style={[styles.sessionTitle, { color: colors.ink }]}>Giáo án của bạn</Text>
            {loading && !data ? (
              <Skeleton width="60%" height={14} />
            ) : (
              <Text style={[styles.meta, { color: colors.muted }]}>
                {data?.planError
                  ? "Không tải được"
                  : data?.planCount === 0
                    ? "Chưa có giáo án được giao"
                    : data?.planCount
                      ? `${data.planCount} giáo án được giao`
                      : "—"}
              </Text>
            )}
          </View>
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.muted} />
        </Pressable>
      </View>
    </FighterHub>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 2 },
  eyebrow: { fontSize: 12, lineHeight: 17 },
  title: { fontSize: 26, lineHeight: 36, fontWeight: "700" },
  pad: { paddingHorizontal: 20, gap: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 99, paddingHorizontal: 11, paddingVertical: 8, minHeight: 36, justifyContent: "center" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  kicker: { fontSize: 12, fontWeight: "600", letterSpacing: 0.2 },
  empty: { minHeight: 220, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 8 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 22, lineHeight: 30, fontWeight: "700", textAlign: "center" },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  session: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 3 },
  sessionTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  meta: { fontSize: 12, lineHeight: 17 },
  readiness: { borderRadius: 12, padding: 16, gap: 12 },
  elig: { flexDirection: "row", gap: 10, alignItems: "center" },
  flex: { flex: 1, gap: 2 },
  outline: { height: 48, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  link: { fontSize: 14, fontWeight: "600" },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
});
