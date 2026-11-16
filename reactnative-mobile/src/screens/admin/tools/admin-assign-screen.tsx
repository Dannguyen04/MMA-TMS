import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import { assignFighterDoctor, listFighterDoctors, listFighters, listUsers, type DoctorAssignment, type PublicFighter, type PublicUser } from "@/api";
import { Icon } from "@/components/icon";
import { hapticSuccess, PressableScale, StaggerList } from "@/components/motion";
import { RolePage } from "@/components/role-page";
import { adminTools as t } from "@/i18n/admin-tools";
import { FighterPick } from "@/screens/coach/fighter-pick";
import { vnDate } from "@/screens/coach/readonly/ro-format";
import { Action } from "@/screens/fight-camp/camp-ui";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { EvHead } from "@/screens/media/evidence/evidence-panels";
import { FactLine } from "@/screens/admin/readonly/admin-user-detail-screen";
import { userDisplayName } from "@/screens/admin/readonly/admin-format";
import { userInitials } from "@/screens/admin/readonly/admin-users-screen";
import { useToastMessage } from "@/components/toast/app-toast";
import { mapApiMessage } from "@/session/map-api-message";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "error" };

const profileId = (u: PublicUser): string | null => (u.profile && typeof u.profile.id === "string" ? u.profile.id : null);
const doctorLine = (u: PublicUser): string => (u.profile && "specialization" in u.profile && u.profile.specialization) || u.email;
const fighterLabel = (f: PublicFighter) => `${f.firstName} ${f.lastName}`.trim();

/** One choosable doctor: initials, name, specialization; the chosen one turns red with a check. */
export function PickRow({ testID, initials, title, line, on, last, onPress }: { testID: string; initials: string; title: string; line: string; on: boolean; last?: boolean; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  return <PressableScale testID={testID} scaleTo={0.99} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${title}, ${line}`} onPress={onPress}
    style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1, ...(last ? { borderBottomColor: c.line, borderBottomWidth: 1 } : null) }}>
    <Text numberOfLines={1} style={{ width: 52, fontFamily: fonts.displayExtraBold, fontSize: fz(26), lineHeight: lh(32), color: on ? c.lotus : c.ink }}>{initials}</Text>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(17), lineHeight: lh(20), letterSpacing: 0.5, textTransform: "uppercase", color: c.ink }}>{title}</Text>
      <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.ink }}>{line}</Text>
    </View>
    <View style={{ width: 22, alignItems: "center" }}>{on ? <Icon name="check" size={22} color={c.lotus}/> : null}</View>
  </PressableScale>;
}

/**
 * Admin Phân công bác sĩ (redesign step 23), `quan-tri/phan-cong-bac-si[?fighterId=&applicationId=]`: the Võ sĩ field,
 * then either the fighter's current doctor (with a row to Bác sĩ phụ trách) or doctor rows to choose one, and the lit
 * "Phân công" in the footer. Done shows the result; from an application the footer goes back to it.
 */
export function AdminAssignScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const params = useLocalSearchParams<{ fighterId?: string; applicationId?: string }>();
  const applicationId = typeof params.applicationId === "string" ? params.applicationId : "";
  const [fighters, setFighters] = useState<Load<PublicFighter[]>>({ state: "loading" });
  const [doctors, setDoctors] = useState<Load<PublicUser[]>>({ state: "loading" });
  const [fighterId, setFighterId] = useState(typeof params.fighterId === "string" ? params.fighterId : "");
  const [assignments, setAssignments] = useState<Load<DoctorAssignment[]> | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ fighter: string; doctor: string; from: string } | null>(null);
  useToastMessage(error, "error");

  const loadFighters = useCallback(() => {
    setFighters({ state: "loading" });
    listFighters({ page: 1, limit: 100 }).then((p) => setFighters({ state: "ok", data: p.data })).catch(() => setFighters({ state: "error" }));
  }, []);
  const loadDoctors = useCallback(() => {
    setDoctors({ state: "loading" });
    listUsers({ role: "DOCTOR", status: "ACTIVE", page: 1, limit: 100 })
      .then((p) => setDoctors({ state: "ok", data: p.items.filter((u) => profileId(u)) }))
      .catch(() => setDoctors({ state: "error" }));
  }, []);
  const loadAssignments = useCallback((id: string) => {
    if (!id) { setAssignments(null); return; }
    setAssignments({ state: "loading" });
    listFighterDoctors(id, { page: 1, limit: 20 }).then((p) => setAssignments({ state: "ok", data: p.data })).catch(() => setAssignments({ state: "error" }));
  }, []);
  useEffect(() => { loadFighters(); loadDoctors(); }, [loadFighters, loadDoctors]);
  useEffect(() => { setDoctorId(""); loadAssignments(fighterId); }, [fighterId, loadAssignments]);

  const fighterList = fighters.state === "ok" ? fighters.data : [];
  const fighter = fighterList.find((f) => f.id === fighterId) ?? null;
  const doctorList = doctors.state === "ok" ? doctors.data : [];
  const active = assignments?.state === "ok" ? assignments.data.find((a) => a.endsAt == null) ?? null : null;
  const activeName = active ? active.doctorName?.trim() || (() => { const u = doctorList.find((d) => profileId(d) === active.doctorId); return u ? userDisplayName(u) : t.doctors; })() : "";
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(admin)" as Href));
  const openDoctors = (id: string) => router.push({ pathname: "/(admin)/vo-si/bac-si", params: { id } } as never);

  const assign = () => {
    if (busy || !fighterId || !doctorId || active) return;
    setBusy(true);
    setError("");
    assignFighterDoctor(fighterId, doctorId)
      .then(() => {
        hapticSuccess();
        const u = doctorList.find((d) => profileId(d) === doctorId);
        setDone({ fighter: fighter ? fighterLabel(fighter) : t.fighter, doctor: u ? userDisplayName(u) : t.doctors, from: vnDate(new Date().toISOString()) });
      })
      .catch((cause: unknown) => { setError(mapApiMessage(cause)); loadAssignments(fighterId); })
      .finally(() => setBusy(false));
  };

  if (done) {
    const again = () => { setDone(null); setFighterId(""); setDoctorId(""); };
    return <RolePage testID="admin-assign-done" title={t.assign} onBack={back}
      footer={applicationId ? <Action label={t.backToApplication} onPress={() => router.replace(`/quan-tri/nhap-hoc/${applicationId}` as Href)}/> : <Action label={t.another} onPress={again}/>}>
      <View accessible accessibilityRole="header" accessibilityLabel={t.done} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon name="check" size={30} color={c.success}/>
        <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(30), lineHeight: lh(34), textTransform: "uppercase", color: c.ink }}>{t.done}</Text>
      </View>
      <View>
        <FactLine label={t.fighter} value={done.fighter}/>
        <FactLine label={t.doctors} value={done.doctor}/>
        <FactLine label={t.from} value={done.from} last/>
      </View>
      <SlipRow testID="assign-done-doctors" icon="stethoscope" title={t.doctorsPage} line={done.fighter} a11y={`${t.doctorsPage}, ${done.fighter}`} last onPress={() => openDoctors(fighterId)}/>
    </RolePage>;
  }

  const showChoice = Boolean(fighterId) && assignments?.state === "ok" && !active;
  return <RolePage testID="admin-assign" title={t.assign} onBack={back}
    footer={showChoice && doctorList.length ? <Action label={t.cta} onPress={assign} disabled={!doctorId} pending={busy}/> : undefined}>
    <FighterPick testID="assign-fighter" label={t.fighter} placeholder={t.pickFighter} empty={t.noFighters} failed={t.fightersFailed} retry={t.retry}
      state={fighters.state} fighters={fighterList} value={fighterId} onChange={setFighterId} onRetry={loadFighters}/>

    {fighterId && assignments?.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 24 }}/> : null}
    {fighterId && assignments?.state === "error" ? <RetryRow message={t.currentFailed} retry={t.retry} onRetry={() => loadAssignments(fighterId)}/> : null}

    {active ? <View style={{ gap: 8 }}>
      <EvHead title={t.current}/>
      <SlipRow testID="assign-current" lead={userInitials(activeName)} title={activeName} line={t.since(vnDate(active.startsAt))} a11y={`${activeName}, ${t.since(vnDate(active.startsAt))}`} last/>
      <Text style={{ ...readableTextStyle(15), color: c.ink }}>{t.hasDoctor}</Text>
      <SlipRow testID="assign-doctors-page" icon="stethoscope" title={t.doctorsPage} line={t.doctorsPageLine} a11y={`${t.doctorsPage}, ${t.doctorsPageLine}`} last onPress={() => openDoctors(fighterId)}/>
    </View> : null}

    {showChoice ? <View style={{ gap: 8 }}>
      <EvHead title={t.chooseDoctor} aside={doctorList.length ? String(doctorList.length) : undefined}/>
      {doctors.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 24 }}/> : null}
      {doctors.state === "error" ? <RetryRow message={t.doctorsFailed} retry={t.retry} onRetry={loadDoctors}/> : null}
      {doctors.state === "ok" && !doctorList.length ? <Text style={{ ...readableTextStyle(15), color: c.ink }}>{t.noDoctors}</Text> : null}
      {doctorList.length ? <StaggerList testID="assign-doctor-list">
        {doctorList.map((u, k) => {
          const id = profileId(u)!;
          const name = userDisplayName(u);
          return <PickRow key={id} testID={`assign-doctor-${id}`} initials={userInitials(name)} title={name} line={doctorLine(u)} on={doctorId === id}
            last={k === doctorList.length - 1} onPress={() => setDoctorId(id)}/>;
        })}
      </StaggerList> : null}
    </View> : null}
  </RolePage>;
}
