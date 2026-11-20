import Constants from "expo-constants";
import { View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { appearance } from "@/i18n/common/appearance";
import { fighterMe as t } from "@/i18n/fighter/fighter-me";
import { CampShell } from "@/shared/ui/camp-ui";
import { SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useAppearanceState } from "@/theme";
import { backToMe } from "./me-model";

/** Cài đặt (redesign step 11): only what is true today; no "sắp có" placeholders. */
export function FighterSettingsV2() {
  const router = useRouter();
  const { applied } = useAppearanceState();
  const look = t.settings.appearanceLine(appearance.modes[applied.settings.mode], Math.round(applied.settings.fontScale * 100));
  const version = Constants.expoConfig?.version ?? null;

  return <CampShell title={t.settings.title} onBack={() => backToMe(router)}>
    <View testID="fighter-settings-v2">
      <SlipRow testID="settings-notifications" icon="notifications" title={t.settings.notifications} line={t.settings.notificationsLine}
        a11y={`${t.settings.notifications}. ${t.settings.notificationsLine}`}/>
      <SlipRow testID="settings-appearance" icon="appearance" title={t.rows.appearance} line={look} a11y={`${t.rows.appearance}. ${look}`}
        onPress={() => router.push("/giao-dien" as Href)} last={!version}/>
      {version ? <SlipRow testID="settings-version" icon="info" title={t.settings.version} line={version} a11y={`${t.settings.version} ${version}`} last/> : null}
    </View>
  </CampShell>;
}
