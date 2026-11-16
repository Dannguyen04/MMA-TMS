import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import Svg, { Polygon } from "react-native-svg";

import { isFighterProfile, listFighterDoctors, type DoctorAssignment } from "@/api";
import { Icon } from "@/components/icon";
import { PressableScale, Skeleton, StaggerList } from "@/components/motion";
import { fighterMe as t } from "@/i18n/fighter-me";
import { fighterHref } from "@/navigation/role-href";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { ConfirmDialog } from "@/screens/doctor/redesign/confirm-dialog";
import { getMe } from "@/screens/fighter/api";
import { dmLocal } from "@/screens/fighter/health/health-model";
import { FighterTabPage, RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useSession } from "@/session/session-context";
import { useAppearanceState, useThemePreference } from "@/theme";
import { appearance } from "@/i18n/appearance";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { activeDoctor, fullName, initials, MY_PROFILE, stats, type MeProfile } from "./me-model";

/** Initials on a lotus block with two cut corners, like every frame. */
export function Initials({ text, size = 64 }: { text: string; size?: number }) {
  const { colors: c } = useThemePreference();
  const k = Math.round(size * 0.19);
  return <View aria-hidden={true} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    <Svg width={size} height={size} style={{ position: "absolute" }}>
      <Polygon points={`0,0 ${size - k},0 ${size},${k} ${size},${size} ${k},${size} 0,${size - k}`} fill={c.lotus}/>
    </Svg>
    <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: size * 0.44, lineHeight: size * 0.52, letterSpacing: 0.5, color: "#fff" }}>{text}</Text>
  </View>;
}

/** Name and gym beside the initials; on the page itself, not in a frame (Trang chủ owns the framed spotlight). */
export function Identity({ p, onPress }: { p: MeProfile; onPress?: () => void }) {
  const { colors: c } = useThemePreference();
  const name = fullName(p);
  const body = <>
    <Initials text={initials(p)}/>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(28), lineHeight: lh(32), letterSpacing: 0.2, textTransform: "uppercase", color: c.ink }}>{name}</Text>
      {p.gym ? <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>{p.gym}</Text> : null}
    </View>
  </>;
  const style = { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 2 } as const;
  if (!onPress) return <View accessible accessibilityLabel={[name, p.gym].filter(Boolean).join(", ")} style={style}>{body}</View>;
  return <PressableScale testID="me-identity" scaleTo={0.99} accessibilityRole="button" accessibilityLabel={t.openProfile([name, p.gym].filter(Boolean).join(", "))} onPress={onPress} style={style}>
    {body}
    <Icon name="chevron" size={18} color={c.inkSubtle}/>
  </PressableScale>;
}

function StatStrip({ p }: { p: MeProfile }) {
  const { colors: c } = useThemePreference();
  return <View testID="me-stats" style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }}>
    {stats(p).map((s, k) => <View key={s.label} accessible accessibilityLabel={t.statA11y(s.label, s.value ? `${s.value}${s.unit ? ` ${s.unit}` : ""}` : t.none)}
      style={{ flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 12, paddingHorizontal: 6, borderLeftWidth: k ? 1 : 0, borderLeftColor: c.line }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", maxWidth: "100%" }}>
        <Text numberOfLines={s.unit ? 1 : 2} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(24), lineHeight: lh(28), textAlign: "center", color: s.value ? c.ink : c.inkSubtle }}>{s.value ?? "–"}</Text>
        {s.value && s.unit ? <Text style={{ fontFamily: fonts.display, fontSize: fz(14), lineHeight: lh(18), color: c.ink, marginLeft: 1 }}>{s.unit}</Text> : null}
      </View>
      <Text numberOfLines={1} style={{ ...readableTextStyle(12.5), color: c.ink }}>{s.label}</Text>
    </View>)}
  </View>;
}

/**
 * Fighter Tôi (redesign step 11): initials, name, gym and the 4-stat strip on the page, then one-line rows:
 * the doctor in charge, Trận, Hồ sơ nhập học, Video, Cài đặt (which also shows the appearance in use), and Đăng xuất last in red.
 */
export function FighterMeV2() {
  const router = useRouter();
  const { signOut } = useSession();
  const { fighterId, profile, canFetch } = useFighterId();
  const [confirm, setConfirm] = useState(false);
  const [me, reloadMe, refreshMe] = useSource(() => canFetch ? getMe() : Promise.resolve(null), `${canFetch}`);
  const [docs, reloadDocs, refreshDocs] = useSource<DoctorAssignment[] | null>(
    () => canFetch && fighterId ? listFighterDoctors(fighterId, { page: 1, limit: 20 }).then(r => r.data) : Promise.resolve(null),
    `${canFetch}-${fighterId}`);

  // The session already holds the profile, so the identity shows at once; GET /me refreshes it.
  const fresh = me.state === "ok" && me.data && isFighterProfile(me.data.profile) ? me.data.profile : null;
  const p = (fresh ?? profile) as MeProfile | null;
  const doctor = docs.state === "ok" && docs.data ? activeDoctor(docs.data) : null;
  const go = (href: Href) => () => router.push(href);
  const { applied } = useAppearanceState();
  const settingsLine = `${t.settings.notifications} · ${t.settings.appearanceLine(appearance.modes[applied.settings.mode], Math.round(applied.settings.fontScale * 100))}`;

  const logout = () => {
    setConfirm(false);
    void signOut().then(() => router.replace("/login"));
  };

  return <FighterTabPage testID="fighter-me-v2" title={t.title} onRefresh={() => Promise.all([refreshMe(), refreshDocs()])}>
    {p ? <StaggerList gap={14}>
      <Identity p={p} onPress={go(MY_PROFILE)}/>
      <StatStrip p={p}/>
    </StaggerList> : me.state === "error" ? <RetryRow message={t.failed} retry={t.retry} onRetry={reloadMe}/>
      : <View style={{ gap: 14 }}><Skeleton width="100%" height={64}/><Skeleton width="100%" height={56}/></View>}
    <StaggerList offset={2}>
      {docs.state === "loading" ? <View style={{ paddingVertical: 8 }}><Skeleton width="100%" height={48}/></View>
        : docs.state === "error" ? <RetryRow message={t.doctor.failed} retry={t.retry} onRetry={reloadDocs}/>
        : doctor ? <SlipRow testID="me-doctor" icon="stethoscope" title={doctor.doctorName || t.doctor.fallback} line={t.doctor.since(dmLocal(doctor.startsAt))}
          a11y={`${doctor.doctorName || t.doctor.fallback}. ${t.doctor.since(dmLocal(doctor.startsAt))}`}/>
        : <SlipRow testID="me-doctor-none" icon="stethoscope" title={t.doctor.none} a11y={t.doctor.none}/>}
      <SlipRow testID="me-bouts" icon="martialArts" title={t.rows.bouts} a11y={t.rows.bouts} onPress={go(fighterHref.bouts)}/>
      <SlipRow testID="me-admission" icon="admission" title={t.rows.admission} a11y={t.rows.admission} onPress={go("/ho-so-cua-toi" as Href)}/>
      <SlipRow testID="me-video" icon="video" title={t.rows.video} a11y={t.rows.video} onPress={go("/video" as Href)}/>
      <SlipRow testID="me-settings" icon="sliders" title={t.rows.settings} line={settingsLine} a11y={`${t.rows.settings}. ${settingsLine}`} onPress={go("/cai-dat" as Href)}/>
      <LogoutRow onPress={() => setConfirm(true)}/>
    </StaggerList>
    <ConfirmDialog visible={confirm} title={t.logout.title} cancelLabel={t.logout.cancel} confirmLabel={t.logout.confirm}
      onCancel={() => setConfirm(false)} onConfirm={logout}/>
  </FighterTabPage>;
}

function LogoutRow({ onPress }: { onPress: () => void }) {
  const { colors: c } = useThemePreference();
  return <PressableScale testID="me-logout" scaleTo={0.99} accessibilityRole="button" accessibilityLabel={t.rows.logout} onPress={onPress}
    style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
    <View style={{ width: 52 }}><Icon name="logout" size={28} color={c.danger}/></View>
    <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.display, fontSize: fz(17), lineHeight: lh(20), letterSpacing: 0.5, textTransform: "uppercase", color: c.danger }}>{t.rows.logout}</Text>
  </PressableScale>;
}
