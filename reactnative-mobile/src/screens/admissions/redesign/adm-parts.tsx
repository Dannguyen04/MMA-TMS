import { Text, View } from "react-native";

import type { ApplicationSnapshot, ApplicationStatus, AssessmentCriterion, StaffApplication } from "@/api/admissions/admissions";
import { findCountry } from "@/constants/countries";
import { Icon } from "@/components/icon";
import { adm } from "@/i18n/admissions";
import { vi } from "@/i18n/vi";
import { FactLine } from "@/screens/admin/readonly/admin-user-detail-screen";
import { Initials } from "@/screens/fighter/me/me-tab";
import { SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

/* ---------- Plain helpers ---------- */

export const applicantName = (a: Pick<ApplicationSnapshot, "firstName" | "lastName">) => `${a.lastName} ${a.firstName}`.trim();

/** Two letters: first word and last word ("Trần Văn Hòa" → "TH"). */
export function nameInitials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "•";
  return `${w[0]!.charAt(0)}${w.length > 1 ? w[w.length - 1]!.charAt(0) : ""}`.toLocaleUpperCase("vi");
}

const pad = (n: number) => String(n).padStart(2, "0");
const parts = (v: string | null | undefined) => {
  if (!v) return null;
  const only = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (only) return { y: +only[1]!, m: +only[2]!, d: +only[3]! };
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) return null;
  const vn = new Date(t.getTime() + 7 * 3_600_000);
  return { y: vn.getUTCFullYear(), m: vn.getUTCMonth() + 1, d: vn.getUTCDate() };
};
/** "01/11/2026" in Vietnam time; a bare date stays as written. */
export const vnDay = (v: string | null | undefined) => { const p = parts(v); return p ? `${pad(p.d)}/${pad(p.m)}/${p.y}` : adm.none; };
/** "01/11". */
export const shortDay = (v: string | null | undefined) => { const p = parts(v); return p ? `${pad(p.d)}/${pad(p.m)}` : adm.none; };
export function ageOf(dob: string, now = Date.now()): number | null {
  const p = parts(dob);
  if (!p) return null;
  const n = new Date(now + 7 * 3_600_000);
  let age = n.getUTCFullYear() - p.y;
  if (n.getUTCMonth() + 1 < p.m || (n.getUTCMonth() + 1 === p.m && n.getUTCDate() < p.d)) age -= 1;
  return age >= 0 ? age : null;
}
export const weightWord = (w: string) => (vi.weightClass as Record<string, string>)[w] ?? w;
export const countryWord = (code: string | null) => (code ? findCountry(code)?.name ?? code : adm.none);

export type WordTone = "ok" | "warn" | undefined;
/** Only the status word is coloured: green for a step passed, red for a closed file. */
export function statusTone(s: ApplicationStatus): WordTone {
  if (s === "PASSED" || s === "APPROVED" || s === "ACTIVATED") return "ok";
  if (s === "FAILED" || s === "REJECTED") return "warn";
  return undefined;
}

/* ---------- Page pieces ---------- */

/** The applicant at the top of a page: lotus initials, the name big, one line under it. */
export function WhoHead({ name, line }: { name: string; line: string }) {
  const { colors: c } = useThemePreference();
  return <View accessible accessibilityRole="header" accessibilityLabel={`${name}, ${line}`} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 2 }}>
    <Initials text={nameInitials(name)}/>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(28), lineHeight: lh(38), letterSpacing: 0.2, textTransform: "uppercase", color: c.ink }}>{name}</Text>
      <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>{line}</Text>
    </View>
  </View>;
}

const STATE_TITLE: Record<ApplicationStatus, string> = {
  SUBMITTED: adm.state.waitAssess, PASSED: adm.status.PASSED, FAILED: adm.status.FAILED,
  APPROVED: adm.status.APPROVED, REJECTED: adm.status.REJECTED, ACTIVATED: adm.status.ACTIVATED,
};

/** Where the file stands: a mark (clock = waiting, check, cross), the status in display type, one line. */
export function StateLine({ status, line, testID }: { status: ApplicationStatus; line: string; testID?: string }) {
  const { colors: c } = useThemePreference();
  const tone = statusTone(status);
  const color = tone === "ok" ? c.success : tone === "warn" ? c.danger : c.ink;
  const title = STATE_TITLE[status];
  return <View testID={testID} accessible accessibilityLabel={`${title}, ${line}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
    <View style={{ width: 40, alignItems: "center" }}>
      <Icon name={tone === "ok" ? "check" : tone === "warn" ? "close" : "history"} size={28} color={tone ? color : c.lotus}/>
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(18), lineHeight: lh(25), letterSpacing: 0.5, textTransform: "uppercase", color }}>{title}</Text>
      <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.ink }}>{line}</Text>
    </View>
  </View>;
}

type Cell = "done" | "now" | "no" | "todo";
/** The four steps as cells: done (green check), now (lotus dot), stopped (red cross), still to come (dim dash). */
export function stepCells(s: ApplicationStatus): Cell[] {
  switch (s) {
    case "SUBMITTED": return ["done", "now", "todo", "todo"];
    case "FAILED": return ["done", "no", "todo", "todo"];
    case "PASSED": return ["done", "done", "now", "todo"];
    case "REJECTED": return ["done", "done", "no", "todo"];
    case "APPROVED": return ["done", "done", "done", "now"];
    case "ACTIVATED": return ["done", "done", "done", "done"];
  }
}

export function StepStrip({ status }: { status: ApplicationStatus }) {
  const { colors: c } = useThemePreference();
  const cells = stepCells(status);
  const word: Record<Cell, string> = { done: adm.stepDone, now: adm.stepNow, no: adm.stepNo, todo: adm.stepTodo };
  return <View testID="adm-steps" accessible accessibilityLabel={`${adm.stepsA11y}: ${adm.steps.map((l, k) => `${l} ${word[cells[k]!]}`).join(", ")}`}
    style={{ flexDirection: "row", borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
    {adm.steps.map((label, k) => {
      const cell = cells[k]!;
      const color = cell === "done" ? c.success : cell === "no" ? c.danger : cell === "now" ? c.lotus : c.inkSubtle;
      return <View key={label} style={{ flex: 1, minWidth: 0, alignItems: "center", paddingTop: 10, paddingBottom: 9, paddingHorizontal: 4, borderLeftColor: c.line, borderLeftWidth: k ? 1 : 0 }}>
        <View style={{ height: 22, justifyContent: "center" }}>
          {cell === "done" ? <Icon name="check" size={20} color={color}/> : cell === "no" ? <Icon name="close" size={20} color={color}/>
            : <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(20), lineHeight: lh(22), color }}>{cell === "now" ? "•" : "–"}</Text>}
        </View>
        <Text numberOfLines={1} style={{ ...readableTextStyle(12.5), color: c.ink, marginTop: 4 }}>{label}</Text>
      </View>;
    })}
  </View>;
}

/** A section head with an optional status word on the right, coloured on its own. */
export function Sec({ title, aside, tone }: { title: string; aside?: string; tone?: WordTone }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginTop: 8 }}>
    <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(18), lineHeight: lh(25), letterSpacing: 0.7, textTransform: "uppercase", color: c.ink }}>{title}</Text>
    {aside ? <Text numberOfLines={1} style={{ ...readableTextStyle(13.5, true), color: tone === "ok" ? c.success : tone === "warn" ? c.danger : c.ink }}>{aside}</Text> : null}
  </View>;
}

export function Para({ children }: { children: string }) {
  const { colors: c } = useThemePreference();
  return <Text style={{ ...readableTextStyle(15), lineHeight: lh(22), color: c.ink }}>{children}</Text>;
}

/** Facts as ruled lines; the last one closes the block. */
export function Facts({ rows }: { rows: readonly (readonly [string, string, boolean?])[] }) {
  return <View>{rows.map(([l, v, warn], k) => <FactLine key={l} label={l} value={v} warn={warn} last={k === rows.length - 1}/>)}</View>;
}

/** Hồ sơ (contact, birth, weight) and Kinh nghiệm (training, fights), then the applicant's reason as a paragraph. */
export function ProfileBlock({ a, accountEmail }: { a: ApplicationSnapshot; accountEmail?: string | null }) {
  const age = ageOf(a.dateOfBirth);
  const rows: [string, string][] = [[adm.facts.email, a.email]];
  if (accountEmail && accountEmail !== a.email) rows.push([adm.facts.account, accountEmail]);
  rows.push([adm.facts.phone, a.contactPhone ?? adm.none], [adm.facts.dob, `${vnDay(a.dateOfBirth)}${age != null ? ` · ${adm.age(age)}` : ""}`],
    [adm.facts.nationality, countryWord(a.nationality)], [adm.facts.weight, weightWord(a.weightClass)]);
  return <View testID="adm-profile" style={{ gap: 8 }}>
    <Sec title={adm.sections.profile}/>
    <Facts rows={rows}/>
    <Sec title={adm.sections.experience}/>
    <Facts rows={[[adm.facts.training, a.trainingBackground?.trim() || adm.none], [adm.facts.competition, a.competitionBackground?.trim() || adm.none]]}/>
    {a.motivation?.trim() ? <Para>{a.motivation.trim()}</Para> : null}
  </View>;
}

/** One criterion as a row: the measured value as the lead (dash when it was only observed), name, method · observation. */
export function CriterionRow({ c, index, last, onPress }: { c: AssessmentCriterion; index?: number; last?: boolean; onPress?: () => void }) {
  const lead = c.value != null ? String(c.value).replace(".", ",") : "–";
  const line = [c.unit && c.value != null ? c.unit : "", c.method, c.observation].filter(Boolean).join(" · ");
  return <SlipRow testID={index != null ? `adm-criterion-${index}` : undefined} lead={lead} leadTone={c.value == null ? "dim" : undefined} title={c.criterionName} line={line}
    a11y={`${c.criterionName}, ${c.value != null ? `${lead}${c.unit ? ` ${c.unit}` : ""}, ` : ""}${c.method}, ${c.observation}`} last={last} onPress={onPress}/>;
}

/** Đánh giá: the verdict on the right, coach and date, the summary, then the criteria rows. */
export function AssessmentBlock({ s, coachName }: { s: NonNullable<StaffApplication["assessment"]>; coachName: string }) {
  const pass = s.conclusion === "PASS";
  return <View testID="adm-assessment" style={{ gap: 8 }}>
    <Sec title={adm.sections.assessment} aside={pass ? adm.pass : adm.fail} tone={pass ? "ok" : "warn"}/>
    <Facts rows={[[adm.facts.coach, coachName], [adm.facts.date, vnDay(s.assessedAt)]]}/>
    {s.summary.trim() ? <Para>{s.summary.trim()}</Para> : null}
    {s.criteria.length ? <View>{s.criteria.map((c, k) => <CriterionRow key={`${c.criterionName}-${k}`} c={c} last={k === s.criteria.length - 1}/>)}</View> : null}
  </View>;
}

/** Quyết định: Duyệt / Từ chối on the right, the date, the reason. */
export function DecisionBlock({ d }: { d: NonNullable<StaffApplication["decision"]> }) {
  const ok = d.decision === "APPROVED";
  return <View testID="adm-decision" style={{ gap: 8 }}>
    <Sec title={adm.sections.decision} aside={ok ? adm.approved : adm.rejected} tone={ok ? "ok" : "warn"}/>
    <Facts rows={[[adm.facts.date, vnDay(d.decidedAt)]]}/>
    {d.reason.trim() ? <Para>{d.reason.trim()}</Para> : null}
  </View>;
}

/** Lịch sử, newest first: the date as the lead, what happened as the title. */
export function HistoryBlock({ item, coachName }: { item: StaffApplication; coachName: (id: string | null | undefined) => string }) {
  const rows: { key: string; title: string; at: string; line?: string }[] = [{ key: "s", title: adm.history.submitted, at: item.submittedAt }];
  for (const p of item.assignmentHistory) rows.push({ key: `a-${p.id}`, title: adm.history.assigned(coachName(p.coachId)), at: p.startsAt });
  if (item.assessment) rows.push({ key: "e", title: adm.history.assessed(coachName(item.assessment.coachId)), at: item.assessment.assessedAt, line: item.assessment.conclusion === "PASS" ? adm.pass : adm.fail });
  if (item.decision) rows.push({ key: "d", title: adm.history.decided(item.decision.decision === "APPROVED"), at: item.decision.decidedAt });
  if (item.activation?.completedAt) rows.push({ key: "k", title: adm.history.activated, at: item.activation.completedAt });
  rows.sort((a, b) => b.at.localeCompare(a.at));
  return <View testID="adm-history" style={{ gap: 8 }}>
    <Sec title={adm.sections.history}/>
    <View>{rows.map((r, k) => <HistoryRow key={r.key} day={shortDay(r.at)} title={r.title} line={r.line} a11y={`${vnDay(r.at)}, ${r.title}${r.line ? `, ${r.line}` : ""}`} last={k === rows.length - 1}/>)}</View>
  </View>;
}

function HistoryRow({ day, title, line, a11y, last }: { day: string; title: string; line?: string; a11y: string; last?: boolean }) {
  const { colors: c } = useThemePreference();
  return <View accessible accessibilityLabel={a11y} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1, ...(last ? { borderBottomColor: c.line, borderBottomWidth: 1 } : null) }}>
    <Text numberOfLines={1} style={{ width: 60, fontFamily: fonts.display, fontSize: fz(18), lineHeight: lh(22), color: c.ink }}>{day}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), color: c.ink, flex: 1 }}>{title}</Text>
    {line ? <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.ink }}>{line}</Text> : null}
  </View>;
}
