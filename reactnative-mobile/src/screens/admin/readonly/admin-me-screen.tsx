import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { Icon } from "@/components/icon";
import { PressableScale, StaggerList } from "@/components/motion/motion";
import { RolePage } from "@/components/navigation/role-page";
import { adminRest as t } from "@/i18n/admin/admin-rest";
import { ConfirmDialog } from "@/screens/doctor/redesign/confirm-dialog";
import { Initials } from "@/screens/fighter/me/me-tab";
import { SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

import { userDisplayName } from "./admin-format";
import { userInitials } from "./admin-users-screen";

/** Admin Tôi (redesign step 22), like the coach and doctor Tôi: initials, name, "Quản trị", email line, Giao diện, Đăng xuất (asks first). */
export function AdminMeScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const { user, signOut } = useSession();
  const [confirm, setConfirm] = useState(false);
  const name = user ? userDisplayName({ email: user.email, profile: (user.profile && "firstName" in user.profile ? user.profile : null) as never }) : "";
  const logout = () => {
    setConfirm(false);
    void signOut().then(() => router.replace("/login"));
  };
  return <RolePage testID="admin-me" title={t.meTitle}>
    <StaggerList gap={14}>
      <View accessible accessibilityLabel={[name, t.roleAdmin].filter(Boolean).join(", ")} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 2 }}>
        <Initials text={userInitials(name)}/>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(28), lineHeight: lh(38), letterSpacing: 0.2, textTransform: "uppercase", color: c.ink }}>{name}</Text>
          <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>{t.roleAdmin}</Text>
        </View>
      </View>
      {user?.email ? <View testID="me-email" style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 11, borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
        <Text style={{ ...readableTextStyle(14.5), color: c.ink }}>{t.email}</Text>
        <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), color: c.ink, flexShrink: 1, textAlign: "right" }}>{user.email}</Text>
      </View> : null}
    </StaggerList>
    <StaggerList offset={2}>
      <SlipRow testID="me-appearance" icon="appearance" title={t.look} a11y={t.look} onPress={() => router.push("/appearance" as Href)}/>
      <PressableScale testID="admin-logout" scaleTo={0.99} accessibilityRole="button" accessibilityLabel={t.signOut} onPress={() => setConfirm(true)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
        <View style={{ width: 52 }}><Icon name="logout" size={28} color={c.danger}/></View>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.display, fontSize: fz(17), lineHeight: lh(23), letterSpacing: 0.5, textTransform: "uppercase", color: c.danger }}>{t.signOut}</Text>
      </PressableScale>
    </StaggerList>
    <ConfirmDialog visible={confirm} title={t.signOutAsk} cancelLabel={t.cancel} confirmLabel={t.signOut} onCancel={() => setConfirm(false)} onConfirm={logout}/>
  </RolePage>;
}
