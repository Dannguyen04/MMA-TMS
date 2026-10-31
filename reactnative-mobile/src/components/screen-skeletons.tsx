import { StyleSheet, View } from "react-native";

import { SkeletonCards, SkeletonPatientBar, SkeletonRows, SkeletonTiles } from "@/components/loading";
import { Skeleton } from "@/components/motion";
import { loadingText } from "@/i18n/loading";
import { radius, spacing } from "@/theme";

/** Khung chờ theo hình màn Trang chủ võ sĩ: lịch tuần, ô điều kiện, lối tắt. */
export function FighterHomeSkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={loadingText.loading} style={styles.stack}>
      <View style={styles.block}>
        <Skeleton height={16} width="45%" />
        <View style={styles.days}>
          {Array.from({ length: 7 }, (_, i) => (
            <View key={i} style={styles.day}>
              <Skeleton height={52} />
            </View>
          ))}
        </View>
        <Skeleton height={12} width="60%" />
      </View>
      <SkeletonTiles count={2} />
      <SkeletonRows rows={3} />
    </View>
  );
}

/** Khung chờ màn Tổng quan y tế (bác sĩ): trạng thái, ô chỉ số, thẻ hồ sơ. */
export function MedicalOverviewSkeleton({ patientBar = false }: { patientBar?: boolean }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={loadingText.loading} style={styles.stack}>
      {patientBar ? <SkeletonPatientBar /> : null}
      <View style={styles.between}>
        <Skeleton height={16} width="40%" />
        <Skeleton height={24} width={96} />
      </View>
      <SkeletonTiles count={4} />
      <SkeletonCards count={2} lines={3} />
    </View>
  );
}

/** Khung chờ màn Hồ sơ sức khỏe: thẻ điều kiện, ô chỉ số, các mục hồ sơ. */
export function HealthDossierSkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={loadingText.loading} style={styles.stack}>
      <View style={styles.block}>
        <Skeleton height={20} width="55%" />
        <Skeleton height={12} width="80%" />
      </View>
      <SkeletonTiles count={2} />
      <SkeletonCards count={3} lines={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  block: { gap: spacing.sm, borderRadius: radius.panel, paddingVertical: spacing.sm },
  days: { flexDirection: "row", gap: 6 },
  day: { flex: 1 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
