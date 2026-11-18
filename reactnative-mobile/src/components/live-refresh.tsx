import * as Router from "expo-router";
import { useCallback, useRef, useState } from "react";
import { RefreshControl } from "react-native";

import { useThemePreference } from "@/theme";

type FocusHook = (effect: () => void | (() => void)) => void;
// Some screen tests mock expo-router without useFocusEffect; then the screen simply doesn't refetch on focus.
const useFocus: FocusHook = (Router as { useFocusEffect?: FocusHook }).useFocusEffect ?? (() => undefined);

/**
 * Redesign step 8 (2026-11-11): dashboards and week schedules refetch quietly each time the screen comes back into
 * view (not on the first focus, which already loads), and on pull-to-refresh. `refresh` must keep the data on screen
 * and must not reject.
 */
export function useLiveRefresh(refresh: () => Promise<unknown>) {
  const ref = useRef(refresh);
  ref.current = refresh;
  const first = useRef(true);
  useFocus(useCallback(() => {
    if (first.current) { first.current = false; return; }
    void ref.current();
  }, []));
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.resolve().then(() => ref.current()).catch(() => undefined).finally(() => setRefreshing(false));
  }, []);
  return { refreshing, onRefresh };
}

/** Pull-to-refresh control in the accent colour. Forwards the rest of the props: ScrollView clones it on Android/web. */
export function LiveRefreshControl({ refreshing, onRefresh, ...rest }: { refreshing: boolean; onRefresh: () => void }) {
  const { colors: c } = useThemePreference();
  return <RefreshControl {...rest} refreshing={refreshing} onRefresh={onRefresh} tintColor={c.lotus} colors={[c.lotus]} progressBackgroundColor={c.surface}/>;
}
