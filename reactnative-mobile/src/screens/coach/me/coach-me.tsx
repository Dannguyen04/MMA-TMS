import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { listAssignedApplications } from "@/api/admissions";
import { coachApi } from "@/api/coach";
import { Icon } from "@/components/icon";
import { PressableScale, StaggerList } from "@/components/motion";
import { RolePage } from "@/components/role-page";
import { coachMe as t } from "@/i18n/coach-video";
import { coachRo } from "@/i18n/coach-ro";
import { adm } from "@/i18n/admissions";
import { COACH_ADMISSIONS, isWaiting } from "@/screens/admissions/redesign/coach-admissions";
import { fighterName } from "@/screens/coach/readonly/ro-format";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { COACH_VIDEOS } from "@/screens/coach/video/video-model";
import { ConfirmDialog } from "@/screens/doctor/redesign/confirm-dialog";
import { Initials } from "@/screens/fighter/me/me-tab";
import { SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useAiEnabled, useJobs } from "@/screens/video-ai/ai-data";
import { useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

const DAY = 86_400_000;

/** 00:00 → 24:00 today in Vietnam time, as ISO. */
export function todayRangeVn(now = Date.now()): { fromDate: string; toDate: string } {
  const vn = new Date(now + 7 * 3_600_000);
  const start = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 3_600_000;
  return { fromDate: new Date(start).toISOString(), toDate: new Date(start + DAY - 1).toISOString() };
}

/** Two letters from the name, upper case ("Lê Hùng" → "LH"). */
export function coachInitials(first: string, last: string): string {
  return `${first.trim().charAt(0)}${last.trim().charAt(0)}`.toLocaleUpperCase("vi") || "•";
}

async function loadCounts() {
  const [fighters, sessions] = await Promise.allSettled([
    coachApi.listFighters({ page: 1, limit: 1 }),
    coachApi.listSessions({ page: 1, limit: 1, ...todayRangeVn() }),
  ]);
  return {
    fighters: fighters.status === "fulfilled" ? fighters.value.total : null,
    today: sessions.status === "fulfilled" ? sessions.value.total : null,
  };
}

/** Applications given to this coach that still wait for an assessment. */
async function loadAdmissionsWaiting() {
  const page = await listAssignedApplications({ page: 1, limit: 100 });
  return page.items.filter(isWaiting).length;
}

/**
 * Coach Tôi (redesign step 19), like the fighter's Tôi: initials, name, role · speciality on the page, the email line,
 * a 3-number strip (fighters, sessions today, analyses waiting), then rows Đánh giá nhập học (step 24) · Video · Giao diện ·
 * Đăng xuất (red, last).
 */
export function CoachMeV2() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const { user, signOut } = useSession();
  const [confirm, setConfirm] = useState(false);
  const [counts, , refreshCounts] = useSource(loadCounts, "coach-me|counts");
  const [admissions, , refreshAdmissions] = useSource(loadAdmissionsWaiting, "coach-me|admissions");
  const admWaiting = admissions.state === "ok" ? admissions.data : 0;
  const ai = useAiEnabled();
  const jobs = useJobs(ai, true);

  const profile = user?.profile && "firstName" in user.profile ? user.profile : null;
  const name = profile ? fighterName(profile) : user?.email ?? "";
  const extra = (profile ?? {}) as { specialization?: unknown; isHeadCoach?: unknown };
  const speciality = typeof extra.specialization === "string" && extra.specialization.trim() ? extra.specialization.trim() : "";
  const role = extra.isHeadCoach === true ? coachRo.nav.roleHead : t.role;
  const sub = [role, speciality].filter(Boolean).join(" · ");
  const waiting = jobs.data ? jobs.data.pending.size : null;
  const n = counts.state === "ok" ? counts.data : null;
  const stats: [string, number | null][] = [[t.fighters, n?.fighters ?? null], [t.today, n?.today ?? null], [t.waiting, waiting]];

  const logout = () => {
    setConfirm(false);
    void signOut().then(() => router.replace("/login"));
  };

  return <RolePage testID="coach-me-v2" title={t.title} onRefresh={() => Promise.all([refreshCounts(), refreshAdmissions(), jobs.refresh()])}>
    <StaggerList gap={14}>
      <View accessible accessibilityLabel={[name, sub].filter(Boolean).join(", ")} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 2 }}>
        <Initials text={profile ? coachInitials(profile.firstName, profile.lastName) : (name.charAt(0).toLocaleUpperCase("vi") || "•")}/>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(28), lineHeight: lh(32), letterSpacing: 0.2, textTransform: "uppercase", color: c.ink }}>{name}</Text>
          {sub ? <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>{sub}</Text> : null}
        </View>
      </View>
      {user?.email ? <View testID="me-email" style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 11, borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
        <Text style={{ ...readableTextStyle(14.5), color: c.ink }}>{t.email}</Text>
        <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), color: c.ink, flexShrink: 1, textAlign: "right" }}>{user.email}</Text>
      </View> : null}
      <View testID="me-stats" style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }}>
        {stats.map(([label, value], k) => <View key={label} accessible accessibilityLabel={`${label}: ${value ?? "–"}`}
          style={{ flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 12, paddingHorizontal: 6, borderLeftWidth: k ? 1 : 0, borderLeftColor: c.line }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(24), lineHeight: lh(28), color: value ? c.ink : c.inkSubtle }}>{value ?? "–"}</Text>
          <Text numberOfLines={1} style={{ ...readableTextStyle(12.5), color: c.ink }}>{label}</Text>
        </View>)}
      </View>
    </StaggerList>
    <StaggerList offset={3}>
      <SlipRow testID="me-admissions" icon="admission" title={adm.coach.meRow} line={admWaiting ? adm.coach.meLine(admWaiting) : undefined}
        a11y={[adm.coach.meRow, admWaiting ? adm.coach.meLine(admWaiting) : ""].filter(Boolean).join(", ")} onPress={() => router.push(COACH_ADMISSIONS)}/>
      <SlipRow testID="me-video" icon="video" title={t.video} line={waiting ? t.videoLine(waiting) : undefined} a11y={[t.video, waiting ? t.videoLine(waiting) : ""].filter(Boolean).join(", ")}
        onPress={() => router.push(COACH_VIDEOS as Href)}/>
      <SlipRow testID="me-appearance" icon="appearance" title={t.look} a11y={t.look} onPress={() => router.push("/appearance" as Href)}/>
      <PressableScale testID="coach-logout" scaleTo={0.99} accessibilityRole="button" accessibilityLabel={t.signOut} onPress={() => setConfirm(true)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
        <View style={{ width: 52 }}><Icon name="logout" size={28} color={c.danger}/></View>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.display, fontSize: fz(17), lineHeight: lh(20), letterSpacing: 0.5, textTransform: "uppercase", color: c.danger }}>{t.signOut}</Text>
      </PressableScale>
    </StaggerList>
    <ConfirmDialog visible={confirm} title={t.signOutAsk} cancelLabel={t.cancel} confirmLabel={t.signOut} onCancel={() => setConfirm(false)} onConfirm={logout}/>
  </RolePage>;
}
