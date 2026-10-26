import { Text } from "react-native";
import { useRouter, type Href } from "expo-router";

import { FeatureUnavailable } from "@/components/feature-unavailable";
import { manager } from "@/i18n/manager";
import { useAdminType } from "@/screens/admin/admin-page";
import { AdminRow, AdminScreen, AdminSection } from "@/screens/admin/admin-ui";
import { useThemePreference } from "@/theme";

const t = manager.settings;

/** Figma "Manager · Cài đặt" (161:19395). Giao diện dùng chung màn /appearance. */
export function AdminSettingsScreen() {
  const { colors, resolvedScheme: scheme } = useThemePreference();
  const at = useAdminType();
  const router = useRouter();
  return (
    <AdminScreen title={t.title}>
      <AdminSection title={t.display}>
        <AdminRow
          icon="palette"
          title={t.appearance}
          subtitle={`${scheme === "dark" ? t.schemeDark : t.schemeLight} · ${t.appearanceSub}`}
          onPress={() => router.push("/appearance" as Href)}
        />
        <Text style={[at.meta, { color: colors.inkMuted }]}>{t.appearanceHint}</Text>
      </AdminSection>
      <AdminSection title={t.system}>
        <FeatureUnavailable compact description={manager.missing.system} />
      </AdminSection>
    </AdminScreen>
  );
}
