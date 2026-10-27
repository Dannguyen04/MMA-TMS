import { z } from "zod";
import { observationSchema, tacticSchema, type OpponentAnalysis, type OpponentObservation, type OpponentTactic } from "./round-advice";

export type OpponentAnalysisForm = { observations: OpponentObservation[]; tactics: OpponentTactic[] };
export type OpponentAnalysisInput = {
    profile: NonNullable<OpponentAnalysis["profile"]>;
    observations: OpponentObservation[];
    tactics: Omit<OpponentTactic, "review">[];
};
export function nextAnalysisId(prefix: "obs" | "tac", ids: readonly string[]): string {
    let n = 1;
    while (ids.includes(`${prefix}-${n}`)) n++;
    return `${prefix}-${n}`;
}
export function removeObservation(form: OpponentAnalysisForm, id: string): OpponentAnalysisForm {
    return {
        observations: form.observations.filter((o) => o.id !== id),
        tactics: form.tactics.map((t) => ({ ...t, observationIds: t.observationIds.filter((basis) => basis !== id) })),
    };
}
/** Whitelist editable fields; restore hidden data from the current server record. */
export function buildOpponentAnalysisInput(raw: unknown, existing: OpponentAnalysis, scheduledRounds: number | null) {
    const parsed = z.object({
        observations: z.array(observationSchema).max(6),
        tactics: z.array(tacticSchema.omit({ sessionIds: true, review: true })).max(5),
    }).safeParse(raw);
    if (!parsed.success) return parsed;
    const issues: z.core.$ZodIssue[] = [];
    const issue = (path: (string | number)[], message: string) => issues.push({ code: "custom", path, message });
    const ids = new Set<string>();
    for (const section of ["observations", "tactics"] as const) {
        parsed.data[section].forEach((item, index) => {
            if (ids.has(item.id)) issue([section, index, "id"], "uniqueId");
            ids.add(item.id);
        });
    }
    parsed.data.observations.forEach((o, i) => {
        if (!o.evidenceUrl?.trim() && !o.evidenceNote?.trim()) issue(["observations", i, "evidenceNote"], "evidence");
        if (o.evidenceUrl && !z.url({ protocol: /^https?$/ }).safeParse(o.evidenceUrl).success) issue(["observations", i, "evidenceUrl"], "url");
    });
    const observations = new Set(parsed.data.observations.map((o) => o.id));
    parsed.data.tactics.forEach((t, i) => {
        if (!t.observationIds.length || t.observationIds.some((id) => !observations.has(id))) issue(["tactics", i, "observationIds"], "basis");
        if (t.round !== null && (scheduledRounds === null || t.round > scheduledRounds)) issue(["tactics", i, "round"], "round");
    });
    if (issues.length) return { success: false as const, error: new z.ZodError(issues) };
    const data: OpponentAnalysisInput = {
        profile: { ...(existing.profile ?? {}) },
        observations: parsed.data.observations.map((o) => ({
            ...o,
            evidenceTime: existing.observations?.find((old) => old.id === o.id)?.evidenceTime ?? null,
            evidenceUrl: o.evidenceUrl?.trim() || null,
            evidenceNote: o.evidenceNote?.trim() || null,
        })),
        tactics: parsed.data.tactics.map((t) => ({
            ...t,
            sessionIds: [...(existing.tactics?.find((old) => old.id === t.id)?.sessionIds ?? [])],
        })),
    };
    return { success: true as const, data };
}
