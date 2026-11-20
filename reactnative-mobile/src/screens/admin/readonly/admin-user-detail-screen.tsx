import { useCallback } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { adminApi } from "@/api/admin/admin";
import { isFighterProfile } from "@/api/types";
import { EmptyLine, RolePage } from "@/components/navigation/role-page";
import { adminRest as t } from "@/i18n/admin/admin-rest";
import { adminRo } from "@/i18n/admin/admin-ro";
import { coachRo } from "@/i18n/coach/coach-ro";
import { vi } from "@/i18n/common/vi";
import { ageFromDob, vnDate } from "@/screens/coach/readonly/ro-format";
import { useCoachEnabled } from "@/screens/coach/readonly/use-coach";
import { Initials } from "@/screens/fighter/me/me-tab";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useLoad } from "@/screens/fighter/shared/use-load";
import { EvHead } from "@/screens/media/evidence/evidence-panels";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

import { fighterIdOf, roleLabel, userDisplayName } from "./admin-format";
import { userInitials } from "./admin-users-screen";

const weightLabels = vi.weightClass as Record<string, string>;
const stanceLabels = (vi as unknown as { stance?: Record<string, string> }).stance ?? {};

/** One ruled fact line: label left, value right (bold, one line). */
export function FactLine({ label, value, warn, last }: { label: string; value: string; warn?: boolean; last?: boolean }) {
  const { colors: c } = useThemePreference();
  return <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 11, borderTopWidth: 1, borderTopColor: c.line, ...(last ? { borderBottomWidth: 1, borderBottomColor: c.line } : null) }}>
    <Text style={{ ...readableTextStyle(14.5), color: c.ink }}>{label}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), flexShrink: 1, textAlign: "right", color: warn ? c.danger : c.ink }}>{value}</Text>
  </View>;
}

/**
 * Admin user page (redesign step 22), opened with `nguoi-dung/chi-tiet?id=`: initials, name, role · status, then the
 * Tài khoản and Hồ sơ sections as ruled lines; a fighter account adds a row to the fighter page. Read only.
 */
export function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const uid = typeof id === "string" ? id : "";
  const enabled = useCoachEnabled() && Boolean(uid);
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const run = useCallback(() => adminApi.getUser(uid), [uid]);
  const { data: u, error, loading, reload, refresh } = useLoad(enabled, `ud|${uid}`, run, { keepOnError: true });
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(admin)/nguoi-dung" as never));
  const profile = u?.profile ?? null;
  const fighterId = u ? fighterIdOf(u) : null;
  const name = u ? userDisplayName(u) : "";

  const profileLines: [string, string][] = [];
  if (isFighterProfile(profile)) {
    const age = ageFromDob(profile.dateOfBirth);
    profileLines.push([adminRo.user.weightClass, weightLabels[profile.weightClass] ?? profile.weightClass]);
    profileLines.push([adminRo.user.dob, `${vnDate(profile.dateOfBirth)}${age != null ? ` · ${coachRo.detail.age(age)}` : ""}`]);
    if (profile.nationality) profileLines.push([adminRo.user.nationality, profile.nationality]);
    if (profile.heightCm) profileLines.push([adminRo.user.height, coachRo.detail.height(profile.heightCm)]);
    if (profile.reachCm) profileLines.push([adminRo.user.reach, coachRo.detail.height(profile.reachCm)]);
    if (profile.dominantStance && stanceLabels[profile.dominantStance]) profileLines.push([adminRo.user.stance, stanceLabels[profile.dominantStance]!]);
    if (profile.gym) profileLines.push([adminRo.user.gym, profile.gym]);
  } else if (profile) {
    if ("isHeadCoach" in profile && profile.isHeadCoach != null) profileLines.push([adminRo.user.headCoach, profile.isHeadCoach ? adminRo.user.yes : adminRo.user.no]);
    if (profile.specialization) profileLines.push([adminRo.user.specialization, profile.specialization]);
    if (profile.licenseNumber) profileLines.push([adminRo.user.license, profile.licenseNumber]);
  }

  return <RolePage testID="admin-user" title={t.userTitle} onBack={back} onRefresh={refresh}>
    {!uid ? <View style={{ gap: 10 }}>
      <EmptyLine testID="admin-user-missing" title={t.notFound}/>
      <Pressable accessibilityRole="button" onPress={back} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
        <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{t.backToList}</Text>
      </Pressable>
    </View> : null}
    {uid && !u && loading ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {uid && !u && error ? <RetryRow message={t.userFailed} retry={t.retry} onRetry={reload}/> : null}
    {u ? <>
      <View accessible accessibilityLabel={[name, roleLabel(u.role), u.isActive ? "" : t.locked].filter(Boolean).join(", ")} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Initials text={userInitials(name)}/>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(28), lineHeight: lh(38), letterSpacing: 0.2, textTransform: "uppercase", color: c.ink }}>{name}</Text>
          <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>
            {roleLabel(u.role)}{u.isActive ? "" : " · "}{u.isActive ? null : <Text style={{ ...readableTextStyle(14.5, true), color: c.danger }}>{t.locked}</Text>}
          </Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <EvHead title={t.account}/>
        <View>
          <FactLine label={t.email} value={u.email}/>
          <FactLine label={t.role} value={roleLabel(u.role)}/>
          <FactLine label={t.status} value={u.isActive ? t.active : t.locked} warn={!u.isActive}/>
          <FactLine label={t.created} value={vnDate(u.createdAt)}/>
          <FactLine label={t.updated} value={vnDate(u.updatedAt)} last/>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <EvHead title={t.profile}/>
        {profileLines.length ? <View>{profileLines.map(([l, v], k) => <FactLine key={l} label={l} value={v} last={k === profileLines.length - 1}/>)}</View>
          : <Text style={{ ...readableTextStyle(15), color: c.ink }}>{t.noProfile}</Text>}
      </View>
      {fighterId ? <SlipRow testID="admin-user-fighter" icon="martialArts" title={t.fighterPage} line={t.fighterPageLine} a11y={`${t.fighterPage}, ${t.fighterPageLine}`} last
        onPress={() => router.push({ pathname: "/(admin)/vo-si/chi-tiet", params: { id: fighterId } } as never)}/> : null}
    </> : null}
  </RolePage>;
}
