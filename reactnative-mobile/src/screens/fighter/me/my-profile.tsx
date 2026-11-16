import { ActivityIndicator, Text, View } from "react-native";
import { StaggerList } from "@/components/motion";
import { useRouter } from "expo-router";

import { isFighterProfile } from "@/api";
import { fighterMe as t } from "@/i18n/fighter-me";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { CampShell, sentences } from "@/screens/fight-camp/camp-ui";
import { getMe } from "@/screens/fighter/api";
import { RetryRow } from "@/screens/fighter/redesign/tab-page";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz } from "@/theme/typography";
import { backToMe, facts, type MeProfile } from "./me-model";
import { Identity } from "./me-tab";

/** Hồ sơ của tôi (redesign step 11): the personal fields that left the Tôi tab, then the bio one sentence per line. */
export function FighterMyProfile() {
  const { colors: c } = useThemePreference();
  const router = useRouter();
  const { profile, user, canFetch } = useFighterId();
  const [me, reload] = useSource(() => canFetch ? getMe() : Promise.resolve(null), `${canFetch}`);
  const fresh = me.state === "ok" && me.data && isFighterProfile(me.data.profile) ? me.data.profile : null;
  const p = (fresh ?? profile) as MeProfile | null;
  const email = (me.state === "ok" && me.data ? me.data.email : null) ?? user?.email ?? null;

  return <CampShell title={t.profile.title} onBack={() => backToMe(router)}>
    {!p && me.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {!p && me.state === "error" ? <RetryRow message={t.failed} retry={t.retry} onRetry={reload}/> : null}
    {p ? <View testID="my-profile" style={{ gap: 14 }}>
      <Identity p={p}/>
      <StaggerList offset={1}>
        {facts(p, email).map(f => <View key={f.label} accessible accessibilityLabel={`${f.label}: ${f.value === "–" ? t.none : f.value}`}
          style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 10, borderTopColor: c.line, borderTopWidth: 1 }}>
          <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.inkMuted }}>{f.label}</Text>
          <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: c.ink, flexShrink: 1 }}>{f.value}</Text>
        </View>)}
      </StaggerList>
      {p.bio && p.bio.trim() ? <View>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(18), letterSpacing: 0.6, textTransform: "uppercase", color: c.ink, marginTop: 6, marginBottom: 4 }}>{t.profile.bio}</Text>
        {sentences(p.bio).map((line, k) => <Text key={k} style={{ ...readableTextStyle(15.5), color: c.ink }}>{line}</Text>)}
      </View> : null}
    </View> : null}
  </CampShell>;
}
