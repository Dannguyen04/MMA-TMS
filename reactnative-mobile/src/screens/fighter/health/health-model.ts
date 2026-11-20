import type { Suspension } from "@/features/fight-camp/api";
import type { MedicalDossier, MedicalHistoryEntry } from "@/api/types";
import { clearanceDates, clearanceState, clearanceWord, reasonFor, SCOPES } from "@/components/medical/clearance-state";
import { scopeState, type EligibilityLevel, type EligibilityScope, type ScopeState } from "@/components/medical/eligibility-model";
import {
  clearanceTypeLabel, decisionLabel, snakeSnapshot, injuryStatusLabel, jointLabel, recordTypeLabel, recoveryStatusLabel, reviewStatusLabel, scopeLabel, severityLabel,
} from "@/components/medical/medical-format";
import { clearanceCopy } from "@/i18n/clearance";
import { fighterBody } from "@/i18n/fighter-body";
import { fighterHealth as t } from "@/i18n/fighter-health";
import { allowedTodayLine, liveSuspensions, strictestSuspension, suspensionHeadline } from "@/features/fight-camp/logic/camp-rules";
import { limitRows, reasonLine } from "./medical-lines";

export type Tone = "ok" | "lim" | "no";
export type Cell = { tone: Tone; word: string };
export type Verdict = { tone: Tone; word: string; lines: string[]; training: Cell; competition: Cell; frame: "success" | "accent" | "danger" };

const toneOf = (level: EligibilityLevel): Tone => level === "eligible" ? "ok" : level === "restricted" ? "lim" : "no";
const cellOf = (level: EligibilityLevel): Cell => ({ tone: toneOf(level), word: t.cell[level] });
const dot = (s: string) => /[.!?]$/.test(s) ? s : `${s}.`;

/** The suspension that limits training today (in force or graded return), or null. UPCOMING does not yet. */
export function suspensionToday(items: readonly Suspension[] | null | undefined): Suspension | null {
  if (!items) return null;
  return strictestSuspension(liveSuspensions(items).filter(s => s.status !== "UPCOMING"))?.main ?? null;
}

/** "Tránh dùng: vai trái." … from the doctor's limits on the exam and the clearance. */
export function limitLines(state: ScopeState): string[] {
  return limitRows(state).map(r => dot(r.label === fighterBody.sheet.note ? r.value : `${r.label}: ${r.value.toLocaleLowerCase("vi")}`));
}

/**
 * The Cơ thể spotlight (step 10): one answer to "can I train today?", the reason one sentence per line, and the two
 * scopes. A medical "not eligible" outranks a suspension; a suspension outranks "eligible" or "restricted".
 */
export function verdict(dossier: MedicalDossier, suspension: Suspension | null): Verdict {
  const training = scopeState(dossier, "training");
  const competition = scopeState(dossier, "competition");
  const comp = cellOf(competition.level);
  const compLine = competition.level === "notEligible" ? [t.competitionNo] : [];
  if (training.level === "notEligible") {
    const codes = training.value.reasons;
    const lines = codes.length ? [...new Set(codes.map(code => reasonFor(dossier, "training", code, reasonLine)))] : [fighterBody.reasonUnknown];
    return { tone: "no", word: t.word.notEligible, lines, training: cellOf("notEligible"), competition: comp, frame: "danger" };
  }
  if (suspension) {
    const lines = [allowedTodayLine(suspension), suspensionHeadline(suspension)].filter((x): x is string => !!x).map(dot);
    return { tone: "no", word: t.word.suspended, lines, training: { tone: "lim", word: t.cell.suspended }, competition: comp, frame: "danger" };
  }
  if (training.level === "restricted") {
    const lines = limitLines(training).slice(0, 2);
    return { tone: "lim", word: t.word.restricted, lines: [...lines, ...compLine], training: cellOf("restricted"), competition: comp, frame: "accent" };
  }
  return { tone: "ok", word: t.word.eligible, lines: compLine.length ? compLine : [t.allClear], training: cellOf("eligible"), competition: comp, frame: compLine.length ? "accent" : "success" };
}

/** Academy time (UTC+7). */
const local = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString();
/** dd/mm on the academy calendar; a plain yyyy-mm-dd stays that day. */
export const dmLocal = (iso: string) => { const s = iso.length === 10 ? iso : local(iso); return `${s.slice(8, 10)}/${s.slice(5, 7)}`; };
export const hmLocal = (iso: string) => local(iso).slice(11, 16);

export type ClearanceRow = { scope: EligibilityScope; ok: boolean; word: string | null; line: string };

/**
 * One licence row per scope that has a current exam, from that exam's clearance only: "Tập luyện · đến 30/11",
 * or "Chưa hiệu lực" with "Tập luyện · 01/12 – 02/12". "Cần cấp lại" only when it really expired.
 */
export function clearanceRows(d: MedicalDossier, now: Date = new Date()): ClearanceRow[] {
  return SCOPES.flatMap(scope => {
    const state = clearanceState(d, scope, now);
    if (state.kind === "noExam") return [];
    const dates = clearanceDates(state);
    return [{ scope, ok: state.kind === "valid", word: clearanceWord(state), line: [clearanceCopy.scope[scope], dates].filter(Boolean).join(" · ") }];
  });
}

export function examLine(d: MedicalDossier): string | null {
  const { training, competition } = d.currentExaminations;
  if (!training && !competition) return null;
  // Short words, as on the verdict cells, so the row fits one line.
  const word = (e: typeof training) => !e ? "—" : e.decision === "ELIGIBLE" ? t.cell.eligible : e.decision === "ELIGIBLE_WITH_RESTRICTIONS" ? t.cell.restricted : e.decision === "NOT_ELIGIBLE" ? t.cell.notEligible : decisionLabel(e.decision);
  return t.records.examLine(word(training), word(competition));
}

const s = (v: unknown) => typeof v === "string" && v.trim() ? v.trim() : null;

/** One history entry as a one-line row: big day, title, one line, and whether it reads as good or bad. */
export function historyRow(e: MedicalHistoryEntry): { day: string; title: string; line: string; tone?: "ok" | "warn" } {
  const x = snakeSnapshot(e.snapshot);
  const day = dmLocal(e.recordedAt).slice(0, 2);
  switch (e.recordType) {
    case "INJURY":
      return { day, title: recordTypeLabel("INJURY"), line: [jointLabel(x.affected_joint), s(x.injury_type), injuryStatusLabel(x.status)].filter(Boolean).join(" · "), tone: x.status === "RESOLVED" ? "ok" : "warn" };
    case "TREATMENT":
      return { day, title: recordTypeLabel("TREATMENT"), line: [s(x.treatment_type), s(x.description)].filter(Boolean).join(" · ") || "—" };
    case "RECOVERY_PLAN":
      return { day, title: t.history.recovery, line: [s(x.title), recoveryStatusLabel(x.status)].filter(Boolean).join(" · ") };
    case "MEDICAL_EXAMINATION":
      return { day, title: recordTypeLabel("MEDICAL_EXAMINATION"), line: `${scopeLabel(x.scope)}: ${decisionLabel(x.decision)}`, tone: x.decision === "NOT_ELIGIBLE" ? "warn" : "ok" };
    case "MEDICAL_CLEARANCE":
      return { day, title: t.history.clearance, line: [clearanceTypeLabel(x.clearance_type), s(x.valid_until) ? t.records.until(dmLocal(String(x.valid_until))) : null].filter(Boolean).join(" · "), tone: x.status === "ACTIVE" ? "ok" : undefined };
    case "MEDICAL_REVIEW_REQUEST":
      return { day, title: recordTypeLabel("MEDICAL_REVIEW_REQUEST"), line: [s(x.reason), reviewStatusLabel(x.status)].filter(Boolean).join(" · ") };
    default:
      return { day, title: recordTypeLabel(e.recordType), line: "" };
  }
}

/** Entries grouped by academy month, newest first, in the order the server sent them. */
export function byMonth(entries: readonly MedicalHistoryEntry[], thisYear: number): { key: string; label: string; items: MedicalHistoryEntry[] }[] {
  const out: { key: string; label: string; items: MedicalHistoryEntry[] }[] = [];
  for (const e of entries) {
    const iso = local(e.recordedAt);
    const key = iso.slice(0, 7);
    let g = out.find(x => x.key === key);
    if (!g) {
      const y = Number(iso.slice(0, 4));
      g = { key, label: t.history.month(Number(iso.slice(5, 7)), y === thisYear ? null : y), items: [] };
      out.push(g);
    }
    g.items.push(e);
  }
  return out;
}

export const injuryTitle = (joint: unknown, type: string) => [jointLabel(joint), type].filter(Boolean).join(" · ");
export { severityLabel, injuryStatusLabel };

/** Back from a Cơ thể sub-page; after a reload or a deep link there is no history, so land on Cơ thể. */
export function backToHealth(router: { canGoBack: () => boolean; back: () => void; replace: (href: never) => void }) {
  if (router.canGoBack()) router.back(); else router.replace("/co-the" as never);
}

/** Joints to mark on the body map: injured (active injuries), avoided (training limits), head ring for KO / TKO. */
export type BodyMarks = { hurt: string[]; avoid: string[]; head: boolean };
export function bodyMarks(dossier: MedicalDossier, suspension: Suspension | null): BodyMarks {
  const hurt = [...new Set(dossier.activeInjuries.map(i => String(i.affectedJoint)))];
  const training = scopeState(dossier, "training");
  const excluded = [training.exam?.restrictions?.excludedJoints, training.clearance?.restrictions?.excludedJoints].flatMap(x => x ?? []).map(String);
  const avoid = [...new Set(excluded)].filter(j => !hurt.includes(j));
  return { hurt, avoid, head: !!suspension && (suspension.reason === "KO" || suspension.reason === "TKO") };
}
