import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, View, type ColorValue, type RefreshControlProps } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { showAppToast } from "@/components/toast/app-toast";
import { Skeleton } from "@/components/motion";
import { loadingText } from "@/i18n/loading";
import { radius, spacing, useThemePreference } from "@/theme";

/**
 * Quy tắc tải (batch 6, phương án B):
 * - Lần đầu: skeleton (không chữ "Đang tải…", không màn trắng).
 * - Kéo để làm mới: giữ dữ liệu cũ; lỗi → toast, không xoá danh sách.
 * - Tải thêm: hàng skeleton ở cuối (SkeletonFooter).
 * - Thao tác: spinner trong nút + khoá nút (ButtonSpinner / prop `loading` của nút).
 * - Giảm chuyển động: skeleton tĩnh, thanh tiến trình tĩnh.
 */

/** RefreshControl theo theme (màu accent `lotus`). */
/**
 * Lưu ý: ScrollView (Android, web) clone phần tử này kèm `style` và con là chính ScrollView,
 * nên phải chuyển tiếp mọi prop còn lại, nếu không nội dung sẽ biến mất.
 */
export function ThemedRefreshControl({
  refreshing,
  onRefresh,
  tint,
  ...rest
}: { refreshing: boolean; onRefresh: () => void; tint?: ColorValue } & Omit<RefreshControlProps, "refreshing" | "onRefresh">) {
  const { colors } = useThemePreference();
  const color = tint ?? colors.lotus;
  return (
    <RefreshControl
      {...rest}
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={color}
      colors={[color as string]}
      progressBackgroundColor={colors.surface}
      title=""
    />
  );
}

/**
 * Bọc một hàm tải để dùng cho kéo-để-làm-mới.
 * `run` phải trả Promise và KHÔNG xoá dữ liệu cũ khi `mode === "refresh"`.
 * Lỗi khi làm mới → toast (dữ liệu cũ vẫn giữ).
 */
export function usePullRefresh(run: (mode: "refresh") => Promise<unknown> | unknown) {
  const [refreshing, setRefreshing] = useState(false);
  const runRef = useRef(run);
  runRef.current = run;
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.resolve()
      .then(() => runRef.current("refresh"))
      .catch(() => showAppToast(loadingText.refreshFailed, "error"))
      .finally(() => setRefreshing(false));
  }, []);
  return { refreshing, onRefresh };
}

/** Kết quả tải có tách lần đầu / làm mới. */
export function useRefreshable<T>(
  enabled: boolean,
  key: string,
  run: () => Promise<T>,
  mapError: (cause: unknown) => string,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const token = useRef(0);
  const runRef = useRef(run);
  runRef.current = run;
  const mapRef = useRef(mapError);
  mapRef.current = mapError;

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      const mine = ++token.current;
      if (!enabled) {
        setData(null);
        setError("");
        setLoading(false);
        return;
      }
      if (mode === "initial") {
        setLoading(true);
        setError("");
      } else setRefreshing(true);
      try {
        const value = await runRef.current();
        if (mine !== token.current) return;
        setData(value);
        setError("");
      } catch (cause: unknown) {
        if (mine !== token.current) return;
        if (mode === "refresh") showAppToast(loadingText.refreshFailed, "error");
        else {
          setData(null);
          setError(mapRef.current(cause));
        }
      } finally {
        if (mine === token.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, key],
  );

  useEffect(() => {
    void load("initial");
    return () => {
      token.current += 1;
    };
  }, [load]);

  const reload = useCallback(() => void load("initial"), [load]);
  const refresh = useCallback(() => void load("refresh"), [load]);
  return { data, setData, error, setError, loading, refreshing, reload, refresh };
}

/** Thanh tiến trình 2px dưới header (chi tiết / thao tác nền). */
export function TopProgress({ active }: { active: boolean }) {
  const { colors } = useThemePreference();
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(x);
      x.value = 0;
      return;
    }
    x.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [active, reduced, x]);
  const bar = useAnimatedStyle(() => ({ transform: [{ translateX: `${-100 + x.value * 200}%` as unknown as number }] }));
  if (!active) return null;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={loadingText.loading}
      style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
    >
      <Animated.View style={[styles.bar, { backgroundColor: colors.lotus }, reduced ? styles.barStatic : bar]} />
    </View>
  );
}

/** Spinner cho nút đang chạy thao tác (dùng khi nút chưa có prop `loading`). */
export function ButtonSpinner({ color }: { color?: ColorValue }) {
  const { colors } = useThemePreference();
  return <ActivityIndicator size="small" color={color ?? colors.onCta} accessibilityLabel={loadingText.working} />;
}

/** Hàng skeleton cho danh sách: avatar tròn (tuỳ chọn) + 2 dòng. */
export function SkeletonRows({ rows = 4, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={loadingText.loading} style={styles.rows}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          {avatar ? <Skeleton height={40} round /> : null}
          <View style={styles.rowText}>
            <Skeleton height={14} width={i % 2 ? "55%" : "70%"} />
            <Skeleton height={11} width={i % 2 ? "35%" : "45%"} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Thẻ skeleton: tiêu đề + chip + 1–2 dòng. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  const { colors } = useThemePreference();
  return (
    <View style={[styles.card, { borderColor: colors.line, backgroundColor: colors.surface }]}>
      <Skeleton height={16} width="60%" />
      <Skeleton height={20} width={96} />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? "50%" : "90%"} />
      ))}
    </View>
  );
}

export function SkeletonCards({ count = 3, lines = 2 }: { count?: number; lines?: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={loadingText.loading} style={styles.cards}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </View>
  );
}

/** Ô số liệu skeleton (lưới 2 cột). */
export function SkeletonTiles({ count = 2 }: { count?: number }) {
  const { colors } = useThemePreference();
  return (
    <View style={styles.tiles}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.tile, { borderColor: colors.line, backgroundColor: colors.surface }]}>
          <Skeleton height={11} width="50%" />
          <Skeleton height={22} width="70%" />
        </View>
      ))}
    </View>
  );
}

/** Thanh võ sĩ skeleton (avatar + tên + hạng cân). */
export function SkeletonPatientBar() {
  return (
    <View style={styles.row}>
      <Skeleton height={42} round />
      <View style={styles.rowText}>
        <Skeleton height={15} width="55%" />
        <Skeleton height={11} width="35%" />
      </View>
    </View>
  );
}

/** Cuối danh sách khi đang tải thêm trang. */
export function SkeletonFooter({ active }: { active: boolean }) {
  if (!active) return null;
  return <SkeletonRows rows={1} />;
}

/** Bọc nội dung: lần đầu hiện skeleton, sau đó hiện children. */
export function LoadGate({ loading, skeleton, children }: { loading: boolean; skeleton: ReactNode; children: ReactNode }) {
  return <>{loading ? skeleton : children}</>;
}

const styles = StyleSheet.create({
  track: { height: 2, width: "100%", overflow: "hidden", borderRadius: 1 },
  bar: { height: 2, width: "50%" },
  barStatic: { width: "100%", opacity: 0.6 },
  rows: { gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.xs },
  rowText: { flex: 1, gap: 6 },
  card: { borderWidth: 1, borderRadius: radius.panel, padding: spacing.lg, gap: spacing.sm },
  cards: { gap: spacing.md },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: { flexBasis: "47%", flexGrow: 1, borderWidth: 1, borderRadius: radius.field, padding: spacing.md, gap: 6 },
});
