import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { getFighterMedical, listFighterMedicalHistory } from "@/api/medical/medical";
import type { MedicalHistoryEntry, MedicalInjury, RecoveryPlan } from "@/api/types";
import { Icon } from "@/components/icon";
import { classifyMilestones, formatMedicalWhen, snakeSnapshot, injuryFromSnapshot, injuryStatusLabel, severityLabel } from "@/components/medical/medical-format";
import { dateKey } from "@/components/schedule/week-model";
import { fighterHealth as t } from "@/i18n/fighter/fighter-health";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { CampShell, Frame, sentences } from "@/shared/ui/camp-ui";
import { planWeek } from "@/screens/fighter/plans/plans-model";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useFighterId } from "@/screens/fighter/shared/use-fighter-id";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { backToHealth, dmLocal, injuryTitle } from "./health-model";

const HISTORY_PAGE = 100;
const HISTORY_MAX_PAGES = 5;
type Detail = { injury: MedicalInjury | null; plans: RecoveryPlan[]; treatments: MedicalHistoryEntry[] };

async function collect(fighterId: string, recordType: "INJURY" | "TREATMENT", keep: (e: MedicalHistoryEntry) => boolean) {
  const found: MedicalHistoryEntry[] = [];
  for (let page = 1; page <= HISTORY_MAX_PAGES; page += 1) {
    const r = await listFighterMedicalHistory(fighterId, { page, limit: HISTORY_PAGE, recordType });
    found.push(...r.data.filter(keep));
    if (!r.hasNextPage) break;
  }
  return found;
}

/** No `GET /injuries/:id`: an active injury comes from the dossier, a resolved one from its latest INJURY snapshot. */
export async function loadInjury(fighterId: string, injuryId: string): Promise<Detail> {
  const dossier = await getFighterMedical(fighterId);
  let injury = dossier.activeInjuries.find(i => i.id === injuryId) ?? null;
  if (!injury) {
    const revisions = await collect(fighterId, "INJURY", e => e.recordId === injuryId);
    const latest = revisions.reduce<MedicalHistoryEntry | null>((best, e) => !best || e.revision > best.revision ? e : best, null);
    injury = latest ? injuryFromSnapshot(latest) : null;
  }
  const treatments = injury ? await collect(fighterId, "TREATMENT", e => snakeSnapshot(e.snapshot).injury_id === injuryId) : [];
  // Latest revision per treatment, newest first.
  const latest = new Map<string, MedicalHistoryEntry>();
  for (const e of treatments) { const had = latest.get(e.recordId); if (!had || e.revision > had.revision) latest.set(e.recordId, e); }
  const sorted = [...latest.values()].sort((a, b) => String(snakeSnapshot(b.snapshot).treatment_date ?? b.recordedAt).localeCompare(String(snakeSnapshot(a.snapshot).treatment_date ?? a.recordedAt)));
  return { injury, plans: dossier.activeRecoveryPlans.filter(p => p.injuryId === injuryId), treatments: sorted };
}

/**
 * Injury (redesign step 10): a frame with the joint, the status word and two facts; the doctor's description one
 * sentence per line; then the recovery plan and the treatments as rows.
 */
export function FighterInjuryV2() {
  const { colors: c } = useThemePreference();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const injuryId = typeof id === "string" ? id : "";
  const { fighterId, canFetch } = useFighterId();
  const [src, reload] = useSource<Detail | null>(() => canFetch && fighterId && injuryId ? loadInjury(fighterId, injuryId) : Promise.resolve(null), `${canFetch}-${fighterId}-${injuryId}`);
  const d = src.state === "ok" ? src.data : null;
  const i = d?.injury ?? null;
  const today = dateKey(new Date());
  const resolved = i?.status === "RESOLVED";

  return <CampShell title={t.injury.title} onBack={() => backToHealth(router)}>
    {src.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {src.state === "error" ? <RetryRow message={t.injury.failed} retry={t.retry} onRetry={reload}/> : null}
    {src.state === "ok" && !i ? <Text testID="injury-missing" style={{ fontFamily: fonts.display, fontSize: fz(22), lineHeight: lh(30), textTransform: "uppercase", color: c.ink }}>{t.injury.missing}</Text> : null}
    {i && d ? <View testID="injury-v2" style={{ gap: 14 }}>
      <Frame tone={resolved ? "success" : "danger"} pad={18}>
        <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.display, fontSize: fz(24), lineHeight: lh(33), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{injuryTitle(i.affectedJoint, i.injuryType)}</Text>
        <Text numberOfLines={1} style={{ ...readableTextStyle(15, true), color: resolved ? c.success : c.danger, marginBottom: 10 }}>{injuryStatusLabel(i.status)}</Text>
        <Fact label={t.injury.occurred} value={formatMedicalWhen(i.occurredAt)}/>
        <Fact label={t.injury.severity} value={severityLabel(i.severity)}/>
        {i.resolvedAt ? <Fact label={t.injury.resolved} value={formatMedicalWhen(i.resolvedAt)}/> : null}
      </Frame>
      {i.description ? <View>{sentences(i.description).map((line, k) => <Text key={k} style={{ ...readableTextStyle(15.5), color: c.ink }}>{line}</Text>)}</View> : null}
      {d.plans.length ? <View>
        <Heading>{t.injury.recovery}</Heading>
        {d.plans.map(p => {
          const w = planWeek({ startDate: p.startDate, endDate: p.estimatedEndDate }, today);
          const end = p.estimatedEndDate ? dmLocal(p.estimatedEndDate) : null;
          const line = w ? t.records.recoveryLine(w.now, w.total, end) : end ? t.records.until(end) : "";
          const ms = classifyMilestones(p.milestones);
          return <View key={p.id}>
            <SlipRow testID={`injury-plan-${p.id}`} lead={w ? String(w.now) : "–"} leadSub={w ? `/${w.total}` : undefined} title={p.title} line={line} a11y={`${p.title}. ${line}`}/>
            {ms.kind === "standard" ? ms.items.map(m => <View key={m.id} accessible accessibilityLabel={m.title}
              style={{ flexDirection: "row", gap: 10, paddingVertical: 8, paddingLeft: 64 }}>
              <Icon name={m.isCompleted ? "check" : "circle"} size={18} color={m.isCompleted ? c.success : c.inkSubtle}/>
              <Text style={{ ...readableTextStyle(14.5), color: c.ink, flex: 1 }}>{m.title}</Text>
            </View>) : null}
          </View>;
        })}
      </View> : null}
      {d.treatments.length ? <View>
        <Heading>{t.injury.treatments}</Heading>
        {d.treatments.map((e, k) => {
          const s = snakeSnapshot(e.snapshot);
          const title = typeof s.treatment_type === "string" && s.treatment_type ? s.treatment_type : t.injury.treatments;
          const when = typeof s.treatment_date === "string" ? dmLocal(s.treatment_date) : dmLocal(e.recordedAt);
          const line = [when, typeof s.description === "string" ? s.description : null].filter(Boolean).join(" · ");
          return <SlipRow key={e.recordId} testID={`injury-treatment-${e.recordId}`} lead="✓" leadTone="ok" title={title} line={line} a11y={`${title}. ${line}`} last={k === d.treatments.length - 1}/>;
        })}
      </View> : null}
    </View> : null}
  </CampShell>;
}

function Heading({ children }: { children: string }) {
  const { colors: c } = useThemePreference();
  return <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(18), letterSpacing: 0.6, textTransform: "uppercase", color: c.ink, marginTop: 6, marginBottom: 2 }}>{children}</Text>;
}

function Fact({ label, value }: { label: string; value: string }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 9, borderTopColor: c.line, borderTopWidth: 1 }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.inkMuted }}>{label}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: c.ink, flexShrink: 1 }}>{value}</Text>
  </View>;
}
