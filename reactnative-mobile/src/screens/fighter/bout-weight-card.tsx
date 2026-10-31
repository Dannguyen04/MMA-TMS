import { useRouter } from "expo-router";
import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Bout, WeightTrack, WeightTrackStatus } from "@/api/bouts";
import { PressableScale } from "@/components/motion";
import { Icon, type IconName } from "@/components/icon";
import { WeightChart } from "@/components/visuals";
import { fighterBout as t } from "@/i18n/fighter-bout";
import { fighterHref } from "@/navigation/role-href";
import { ActionButton, OverWeightText, SPEC, TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette, type FighterPalette } from "@/screens/fighter/redesign/palette";
import { useThemePreference } from "@/theme";
import { formatKg } from "@/utils/weight-input";
import { vnShortDate } from "@/utils/vn-date";

/** Màu + biểu tượng theo trạng thái cân. Hổ phách lấy từ token `warning` của theme. */
export function weightStatusTone(colors: FighterPalette, status: WeightTrackStatus) {
  switch (status) {
    case "GREEN":
      return { fg: colors.success, bg: colors.successSoft, icon: "success" as IconName };
    case "YELLOW":
      return { fg: colors.attention, bg: colors.attentionSoft, icon: "warning" as IconName };
    case "RED":
      return { fg: colors.danger, bg: colors.dangerSoft, icon: "alertCircle" as IconName };
    default:
      return { fg: colors.ink, bg: colors.surface2, icon: "circle" as IconName };
  }
}

/** Quá hạng cân: số cân gần nhất lớn hơn giới hạn. */
export function overWeightKg(track: WeightTrack): number {
  if (track.status === "NEUTRAL") return 0;
  if (track.latestKg == null) return 0;
  const over = Math.round((track.latestKg - track.limitKg) * 10) / 10;
  return over > 0 ? over : 0;
}

export function WeightStatusBadge({ status }: { status: WeightTrackStatus }) {
  const colors = useFighterPalette();
  const tone = weightStatusTone(colors, status);
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Icon name={tone.icon} size={16} color={tone.fg} />
      <Text style={[TEXT.captionBold, { color: tone.fg }]} numberOfLines={1}>
        {t.status[status]}
      </Text>
    </View>
  );
}

function remainingText(track: WeightTrack): string {
  if (track.status === "NEUTRAL") return "Đã qua cân chính thức. Số cân được giữ để theo dõi.";
  if (track.latestKg == null) return t.weight.noneDetail;
  const over = track.latestKg - track.limitKg;
  if (over <= 0) return t.weight.reached;
  return t.weight.remaining(formatKg(over), formatKg(track.remainingPct ?? 0));
}

/** Dòng vượt cân (1 hoặc 2 dòng) + nút "Cách giảm cân an toàn". */
function OverWeightBlock({ over, limitKg, className }: { over: number; limitKg: number; className?: string }) {
  const colors = useFighterPalette();
  const router = useRouter();
  return (
    <View style={styles.overBlock}>
      <View style={styles.overRow} accessibilityRole="alert">
        <Icon name="warning" size={24} color={colors.danger} />
        <OverWeightText over={formatKg(over)} limitKg={formatKg(limitKg, true)} className={className} color={colors.danger} />
      </View>
      <ActionButton
        label={t.weight.guide}
        icon="exercise"
        variant="secondary"
        onPress={() => router.push(fighterHref.boutGuide)}
      />
    </View>
  );
}

function Legend({ color, dashed, label }: { color: string; dashed?: boolean; label: string }) {
  const colors = useFighterPalette();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendLine, dashed ? { borderTopWidth: 2, borderStyle: "dotted", borderColor: color } : { backgroundColor: color }]} />
      <Text style={[TEXT.caption, { color: colors.ink }]}>{label}</Text>
    </View>
  );
}

/**
 * Thẻ cân nặng của một trận.
 * - `full`: số cân, tiến độ, biểu đồ có đường giới hạn + lộ trình, nút ghi cân.
 * - `home`: bản gọn cho trang chủ; chạm để mở trang trận.
 */
export function BoutWeightCard({
  bout,
  track,
  variant = "full",
  action,
  onPress,
}: {
  bout: Bout;
  track: WeightTrack;
  variant?: "full" | "home";
  action?: ReactNode;
  onPress?: () => void;
}) {
  const colors = useFighterPalette();
  const { colors: tokens } = useThemePreference();
  const hasWeight = track.latestKg != null;
  const over = overWeightKg(track);
  const isOver = over > 0;
  const body = (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: isOver ? colors.danger : colors.line },
        isOver && { borderWidth: 2 },
      ]}
    >
      <View style={styles.head}>
        {isOver ? <Icon name="warning" size={24} color={colors.danger} /> : null}
        <Text style={[TEXT.cardTitle, styles.flex, { color: colors.ink }]} numberOfLines={1}>
          {variant === "home" ? t.weight.homeTitle : t.weight.cardTitle}
        </Text>
        <WeightStatusBadge status={isOver ? "RED" : track.status} />
      </View>

      <View style={styles.valueRow}>
        <View style={styles.flex}>
          {hasWeight ? (
            <Text style={[TEXT.bigNumber, { color: colors.ink }]} accessibilityLabel={`${formatKg(track.latestKg!)} ${"kg"}`}>
              {formatKg(track.latestKg!)}
              <Text style={[TEXT.kg, { color: colors.ink }]}> kg</Text>
            </Text>
          ) : (
            <Text style={[TEXT.cardTitle, { color: colors.ink }]}>{t.weight.none}</Text>
          )}
          {hasWeight && track.latestOn ? (
            <Text style={[TEXT.caption, { color: colors.ink }]}>{t.weight.weighedOn(vnShortDate(track.latestOn))}</Text>
          ) : null}
        </View>
        <View style={styles.limitBox}>
          <Text style={[TEXT.caption, { color: colors.ink }]}>{t.weight.limit}</Text>
          <Text style={[TEXT.bodyBold, { color: colors.ink }]}>{formatKg(track.limitKg, true)} kg</Text>
        </View>
      </View>

      {isOver ? (
        <OverWeightBlock over={over} limitKg={track.limitKg} className={bout.weightClassName} />
      ) : (
        <Text style={[TEXT.body, { color: colors.ink }]}>{remainingText(track)}</Text>
      )}

      {variant === "full" ? (
        <>
          <WeightChart
            colors={tokens}
            points={track.points}
            unit="kg"
            hideLatest
            decimalComma
            limitKg={track.limitKg}
            limitLabel={t.weight.limitLine(formatKg(track.limitKg, true))}
            reference={track.referencePath.map((row) => ({ measuredAt: row.on, weightKg: row.kg }))}
          />
          <View style={styles.legend}>
            <Legend color={colors.ink} label={t.weight.legendActual} />
            <Legend color={colors.link} dashed label={t.weight.legendPlan} />
          </View>
        </>
      ) : null}
      {action}
    </View>
  );

  if (!onPress) return body;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${t.weight.homeTitle}. ${t.status[track.status]}`}
      onPress={onPress}
    >
      {body}
    </PressableScale>
  );
}

/** Dòng "Gặp ..." dùng chung cho thẻ trang chủ. */
export function BoutHeadline({ bout }: { bout: Bout }) {
  const colors = useFighterPalette();
  return (
    <View style={styles.headline}>
      <Icon name="martialArts" size={24} color={colors.link} />
      <Text style={[TEXT.bodyBold, styles.flex, { color: colors.ink }]} numberOfLines={1}>
        {t.weigh.forBout(bout.opponentName)} · {vnShortDate(bout.weighInAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: 1, borderRadius: SPEC.radius, padding: SPEC.card, gap: SPEC.gap },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 99, paddingHorizontal: 8, minHeight: 24 },
  valueRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: SPEC.gap },
  limitBox: { alignItems: "flex-end" },
  overBlock: { gap: 8 },
  overRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: SPEC.gap },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendLine: { width: 16, height: 2, borderRadius: 1 },
  headline: { flexDirection: "row", alignItems: "center", gap: 8 },
});
