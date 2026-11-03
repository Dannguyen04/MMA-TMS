import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import type { TrainingPlan } from "@/api";
import { listPlansForFighter } from "@/screens/fighter/api";
import { formatDay, planStatusLabel } from "@/screens/fighter/format";
import { planPhaseLabel } from "@/training/plan-phase";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterHub, HubHeader } from "@/screens/fighter/redesign/shell";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useLoad } from "@/screens/fighter/use-load";
import { FadeInView, PressableScale } from "@/components/motion";

export function FighterPlansScreen() {
  const colors = useFighterPalette();
  const router = useRouter();
  const { fighterId, canFetch } = useFighterId();

  const load = useCallback(async () => {
    if (!fighterId) return { rows: [] as TrainingPlan[], total: 0 };
    const page = await listPlansForFighter(fighterId, { page: 1, limit: 50 });
    return { rows: page.data, total: page.total };
  }, [fighterId]);

  const { data, error, loading, reload, refresh } = useLoad(canFetch, fighterId ?? "none", load);
  const rows = data?.rows ?? [];
  const empty = !!data && data.total === 0 && !error;

  return (
    <FighterHub refreshing={loading && !data} onRefresh={refresh}>
      <HubHeader title="Giáo án" />
      <View style={styles.pad}>
        <View style={[styles.status, { borderBottomColor: colors.line }]}>
          <Text style={[styles.statusTitle, { color: colors.ink }]}>Giáo án được giao</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {error ? "Lỗi tải" : data ? (data.total === 0 ? "Chưa có" : String(data.total)) : ""}
          </Text>
        </View>

        {error ? (
          <Pressable accessibilityRole="button" onPress={reload} style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>Không tải được giáo án</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>{error}</Text>
            <Text style={{ color: colors.accent, fontWeight: "600" }}>Thử lại</Text>
          </Pressable>
        ) : null}

        {empty ? (
          <View style={styles.empty}>
            <View style={[styles.symbol, { backgroundColor: colors.surface2 }]}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={40} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>Chưa có giáo án được giao</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>
              Trao đổi với huấn luyện viên về lộ trình phù hợp. Giáo án được giao sẽ xuất hiện tại đây.
            </Text>
          </View>
        ) : null}

        {rows.map((row, i) => (
          <FadeInView key={row.id} index={i}>
            <PressableScale
              accessibilityRole="button"
              onPress={() => router.push(`/giao-an/${row.id}` as Href)}
              style={[styles.row, { borderBottomColor: colors.line }]}
            >
              <View style={styles.flex}>
                <Text style={[styles.statusTitle, { color: colors.ink }]}>{row.title}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>
                  {planStatusLabel(row.status)} · {planPhaseLabel(row.phase)} · {formatDay(row.startDate)}
                  {row.endDate ? ` – ${formatDay(row.endDate)}` : ""}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={16} color={colors.muted} />
            </PressableScale>
          </FadeInView>
        ))}

        <View style={[styles.library, { backgroundColor: colors.agenda }]}>
          <View style={styles.libHead}>
            <MaterialCommunityIcons name="book-open-variant" size={28} color={colors.agendaInk} />
            <View style={styles.flex}>
              <Text style={[styles.statusTitle, { color: colors.agendaInk }]}>Thư viện bài tập</Text>
              <Text style={[styles.meta, { color: colors.agendaMuted }]}>Tra cứu kỹ thuật & hướng dẫn</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở thư viện tham khảo"
            onPress={() => router.push("/giao-an/bai-tap" as Href)}
            style={[styles.cta, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.ctaLabel}>Mở thư viện tham khảo</Text>
          </Pressable>
          <Text style={[styles.meta, { color: colors.agendaMuted }]}>
            Chỉ để tham khảo, không thay giáo án. Không tự chọn bài tập ngoài hướng dẫn của huấn luyện viên và giới hạn y tế.
          </Text>
        </View>
      </View>
    </FighterHub>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 2 },
  eyebrow: { fontSize: 12, lineHeight: 17 },
  title: { fontSize: 26, lineHeight: 36, fontWeight: "700" },
  pad: { paddingHorizontal: 20, gap: 16 },
  status: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  statusTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  meta: { fontSize: 12, lineHeight: 17 },
  empty: { minHeight: 240, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, gap: 8 },
  symbol: { width: 92, height: 100, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 22, lineHeight: 30, fontWeight: "700", textAlign: "center" },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  flex: { flex: 1, gap: 2 },
  library: { borderRadius: 20, padding: 20, gap: 16 },
  libHead: { flexDirection: "row", gap: 12, alignItems: "center" },
  cta: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  ctaLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
});
