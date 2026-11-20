import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { USE_MOCK_DOCTOR } from "@/api/doctor-ro";
import { MOCK_DOCTOR_SPECIALIZATION } from "@/api/doctor-ro.mock";
import { videoAiApi } from "@/api/video-ai";
import { Icon } from "@/components/icon";
import { PressableScale, StaggerList } from "@/components/motion";
import { RolePage } from "@/components/role-page";
import { doctorRest as t } from "@/i18n/doctor-rest";
import { coachInitials } from "@/screens/coach/me/coach-me";
import { fighterName } from "@/screens/coach/readonly/ro-format";
import { Initials } from "@/screens/fighter/me/me-tab";
import { SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useLoad } from "@/screens/fighter/use-load";
import { useAiEnabled } from "@/screens/video-ai/ai-data";
import { useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

import { ConfirmDialog } from "./confirm-dialog";
import { attentionUnion, doctorTitleVi, rosterTiles } from "./doctor-format";
import { doctorAiListHref } from "./doctor-paths";
import { useDoctorRoster } from "./doctor-roster";

/**
 * Doctor Tôi (redesign step 21), like the coach's Tôi: initials, name, "Bác sĩ · speciality", the email line, a strip of
 * three numbers that open the list (Võ sĩ, Cần chú ý, Cảnh báo AI), then rows Giao diện · Đăng xuất (red, last).
 */
export function DoctorMeScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const { user, isDemo, signOut } = useSession();
  const roster = useDoctorRoster();
  const [confirm, setConfirm] = useState(false);

  const profile = user?.profile && "firstName" in user.profile ? user.profile : null;
  const name = profile ? fighterName(profile) : user?.email ?? "";
  const rawTitle = profile && "specialization" in profile && typeof profile.specialization === "string"
    ? profile.specialization
    : USE_MOCK_DOCTOR && isDemo ? MOCK_DOCTOR_SPECIALIZATION : null;
  const title = doctorTitleVi(rawTitle);
  // "Bác sĩ · Y học thể thao"; a title that already says Bác sĩ stands alone.
  const sub = title && /^bác sĩ/i.test(title) ? title : [t.role, title].filter(Boolean).join(" · ");
  const tiles = rosterTiles(roster);
  const aiEnabled = useAiEnabled();
  const impairments = useLoad(aiEnabled && roster.enabled, "me-impairments", useCallback(() => videoAiApi.listImpairmentJobs().then((r) => r.map((j) => j.fighterId).filter((id): id is string => Boolean(id))), []), { keepOnError: true });
  const attention = tiles.attention == null ? null : attentionUnion(roster.items, impairments.data ?? []);
  const aiCount = impairments.data ? impairments.data.length : null;

  const openFighters = (status: "all" | "attention") =>
    router.navigate({ pathname: "/(doctor)/vo-si", params: { status, t: String(Date.now()) } } as unknown as Href);
  const openAi = () => router.navigate(doctorAiListHref() as unknown as Href);
  const stats: { key: string; label: string; value: number | null; warn: boolean; onPress: () => void }[] = [
    { key: "fighters", label: t.statFighters, value: tiles.total, warn: false, onPress: () => openFighters("all") },
    { key: "attention", label: t.statAttention, value: attention, warn: true,
      onPress: () => (tiles.attention === 0 && (impairments.data?.length ?? 0) > 0 ? openAi() : openFighters("attention")) },
    { key: "ai", label: t.statAi, value: aiCount, warn: true, onPress: openAi },
  ];

  const logout = () => {
    setConfirm(false);
    void signOut().then(() => router.replace("/login"));
  };

  return <RolePage testID="doctor-me" title={t.meTitle} onRefresh={() => Promise.all([roster.refresh(), impairments.refresh()])}>
    <StaggerList gap={14}>
      <View accessible accessibilityLabel={[name, sub].filter(Boolean).join(", ")} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 2 }}>
        <Initials text={profile ? coachInitials(profile.firstName, profile.lastName) : (name.charAt(0).toLocaleUpperCase("vi") || "•")}/>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(28), lineHeight: lh(38), letterSpacing: 0.2, textTransform: "uppercase", color: c.ink }}>{name}</Text>
          <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>{sub}</Text>
        </View>
      </View>
      {user?.email ? <View testID="me-email" style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 11, borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
        <Text style={{ ...readableTextStyle(14.5), color: c.ink }}>{t.email}</Text>
        <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), color: c.ink, flexShrink: 1, textAlign: "right" }}>{user.email}</Text>
      </View> : null}
      <View testID="me-stats" style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }}>
        {stats.map((s, k) => <PressableScale key={s.key} testID={`me-stat-${s.key}`} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`${s.label}: ${s.value ?? "–"}`} onPress={s.onPress}
          style={{ flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 12, paddingHorizontal: 6, borderLeftWidth: k ? 1 : 0, borderLeftColor: c.line }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(24), lineHeight: lh(28), color: !s.value ? c.inkSubtle : s.warn ? c.danger : c.ink }}>{s.value ?? "–"}</Text>
          <Text numberOfLines={1} style={{ ...readableTextStyle(12.5), color: c.ink }}>{s.label}</Text>
        </PressableScale>)}
      </View>
    </StaggerList>
    <StaggerList offset={3}>
      <SlipRow testID="me-appearance" icon="appearance" title={t.look} a11y={t.look} onPress={() => router.push("/appearance" as Href)}/>
      <PressableScale testID="doctor-logout" scaleTo={0.99} accessibilityRole="button" accessibilityLabel={t.signOut} onPress={() => setConfirm(true)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
        <View style={{ width: 52 }}><Icon name="logout" size={28} color={c.danger}/></View>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.display, fontSize: fz(17), lineHeight: lh(23), letterSpacing: 0.5, textTransform: "uppercase", color: c.danger }}>{t.signOut}</Text>
      </PressableScale>
    </StaggerList>
    <ConfirmDialog visible={confirm} title={t.signOutAsk} cancelLabel={t.cancel} confirmLabel={t.signOut} onCancel={() => setConfirm(false)} onConfirm={logout}/>
  </RolePage>;
}
