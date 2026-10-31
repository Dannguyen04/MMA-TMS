import { Check, Droplet, Minus, BatteryLow, ArrowDownToLine, Zap, X, type LucideIcon } from "lucide-react";

import type { Tone } from "@/components/ui/tone";
import type { SelfScore, TacticOutcome } from "@/lib/domain/round-advice";
import { INEFFECTIVE_STREAK_TO_DROP } from "@/lib/domain/round-advice";
import { LAB_ROUNDS, LAB_TACTICS, type LabRound } from "../lab-data";

/**
 * The replay walks a fixed list of steps. Odd steps are a round being fought, even steps after them
 * are that round's record arriving (cells turn over) followed by the corner break.
 *   0 idle · 1 R1 · 2 R1 recorded + break · 3 R2 · 4 R2 recorded + break · 5 R3 · 6 R3 recorded, done
 */
export const LAST_STEP = LAB_ROUNDS.length * 2;

export function roundsRecorded(step: number): number {
    return Math.floor(step / 2);
}

export function roundInProgress(step: number): number | null {
    return step % 2 === 1 ? (step + 1) / 2 : null;
}

/** Index of the round whose break is running, or null. */
export function breakAfter(step: number): number | null {
    return step > 0 && step % 2 === 0 && step < LAST_STEP ? step / 2 : null;
}

export const OUTCOME_META: Record<TacticOutcome, { label: string; tone: Tone; icon: LucideIcon }> = {
    EFFECTIVE: { label: "Hiệu quả", tone: "success", icon: Check },
    INEFFECTIVE: { label: "Không hiệu quả", tone: "danger", icon: X },
    NOT_USED: { label: "Không dùng", tone: "neutral", icon: Minus },
};

export const SCORE_META: Record<SelfScore, { label: string; tone: Tone }> = {
    WIN: { label: "Thắng hiệp", tone: "success" },
    CLOSE: { label: "Sát nút", tone: "warning" },
    LOSS: { label: "Thua hiệp", tone: "danger" },
};

export interface RoundEvent {
    key: string;
    label: string;
    icon: LucideIcon;
    tone: Tone;
}

export function roundEvents(round: LabRound): RoundEvent[] {
    const events: RoundEvent[] = [];
    if (round.knockdownsAgainst > 0) events.push({ key: "kd", label: `Bị hạ ${round.knockdownsAgainst}`, icon: ArrowDownToLine, tone: "danger" });
    if (round.stunned) events.push({ key: "stun", label: "Choáng", icon: Zap, tone: "danger" });
    if (round.bleeding) events.push({ key: "bleed", label: "Chảy máu", icon: Droplet, tone: "warning" });
    if (round.fatigued) events.push({ key: "tired", label: "Mệt", icon: BatteryLow, tone: "warning" });
    return events;
}

/** The round after which a tactic was dropped by R21 (two ineffective rounds in a row), or null. */
export function droppedAfter(tacticId: string): number | null {
    let streak = 0;
    for (const round of LAB_ROUNDS) {
        streak = round.tacticMarks[tacticId] === "INEFFECTIVE" ? streak + 1 : 0;
        if (streak >= INEFFECTIVE_STREAK_TO_DROP) return round.roundNo;
    }
    return null;
}

export const TACTICS = LAB_TACTICS;
export const ROUNDS = LAB_ROUNDS;
