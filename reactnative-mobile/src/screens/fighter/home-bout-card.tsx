import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { fighterBout as t } from "@/i18n/fighter-bout";
import { fighterHref } from "@/navigation/role-href";
import { ActionButton, CardSkeleton, ConnectionBanner, SPEC, useDelayedFlag } from "@/screens/fighter/bout-states";
import { BoutHeadline, BoutWeightCard } from "@/screens/fighter/bout-weight-card";
import { useBouts } from "@/screens/fighter/use-active-bout";

/** Thẻ cân nặng trận sắp tới trên trang chủ. Không có trận → không hiện gì. */
export function HomeBoutCard() {
  const router = useRouter();
  const { data, error, loading, reload, refresh } = useBouts(null);
  const showSkeleton = useDelayedFlag(loading && !data && !error);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void Promise.resolve(refreshRef.current()).catch(() => undefined);
    }, []),
  );

  if (showSkeleton) return <CardSkeleton height={HOME_CARD_SKELETON_HEIGHT} />;
  // Mất kết nối: banner + "Thử lại"; dữ liệu cũ (nếu có) vẫn hiện bên dưới.
  const banner = error ? <ConnectionBanner error={error} onRetry={reload} retrying={loading} hasData={!!data} /> : null;
  if (!data?.active || !data.track) return banner;
  const { active, track } = data;

  return (
    <View style={styles.wrap}>
    {banner}
    <BoutWeightCard
      bout={active}
      track={track}
      variant="home"
      action={
        <View style={styles.footer}>
          <BoutHeadline bout={active} />
          <View style={styles.buttons}>
            <ActionButton
              flex
              variant="secondary"
              label={t.weight.openBout}
              onPress={() => router.push(fighterHref.bouts)}
            />
            <ActionButton
              flex
              label={t.weight.record}
              onPress={() => router.push({ pathname: "/(fighter)/tran/can-nang", params: { bout: active.id } })}
            />
          </View>
        </View>
      }
    />
    </View>
  );
}

/** Chiều cao thẻ thật (đo bằng ảnh chụp) để skeleton không làm trang chủ nhảy. */
export const HOME_CARD_SKELETON_HEIGHT = 282;

const styles = StyleSheet.create({
  wrap: { gap: SPEC.gap },
  footer: { gap: SPEC.gap },
  buttons: { flexDirection: "row", gap: 8 },
});
