import type { ScopeState } from "@/components/medical/eligibility-model";
import { jointLabel, sessionTypeName, techniqueLabel } from "@/components/medical/medical-format";
import { fighterBody as t } from "@/i18n/fighter-body";

/** Backend reason code → words for the fighter. */
export function reasonLine(code: string): string {
  return t.reason[code] ?? t.reasonUnknown;
}

/** The doctor's limits on the current exam and clearance, without duplicates. */
export function limitRows(state: ScopeState): { label: string; value: string }[] {
  const sources = [state.exam?.restrictions, state.clearance?.restrictions];
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value && !rows.some((r) => r.label === label && r.value === value)) rows.push({ label, value });
  };
  for (const r of sources) {
    if (!r) continue;
    add(t.sheet.avoidJoints, r.excludedJoints?.map(jointLabel).join(", "));
    add(t.sheet.allowedSessions, r.allowedSessionTypes?.map(sessionTypeName).join(", "));
    add(t.sheet.allowedTechniques, r.allowedTechniqueTypes?.map(techniqueLabel).join(", "));
    add(t.sheet.note, r.notes?.trim());
  }
  return rows;
}

