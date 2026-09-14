"use client";

import { Info } from "lucide-react";
import { useId } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { TRAINING_TYPE_ICONS } from "@/components/domain/training-type-icon";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { CAMERA_ANGLE_LABELS, TRAINING_TYPE_LABELS, VIDEO_TRAINING_TYPE_HINTS, VIDEO_TRAINING_TYPES } from "@/lib/domain/labels";
import type { CameraAngle, VideoTrainingType } from "@/lib/domain/types";
import { formatWeekdayDate } from "@/lib/format";
import type { WizardFighterOption, WizardSessionOption } from "./upload-wizard-data";
import type { DetailsState } from "./upload-wizard-state";

const CAMERA_TIPS: Record<CameraAngle, string> = {
    front: "Best for guard and head movement.",
    side: "Best for punch extension and kicks.",
    diagonal: "Best all-round view — recommended.",
};

const CAMERA_OPTIONS: ChoiceOption<CameraAngle>[] = (["diagonal", "side", "front"] as const).map((angle) => ({
    value: angle,
    label: CAMERA_ANGLE_LABELS[angle],
    description: CAMERA_TIPS[angle],
}));

export interface DetailsStepProps {
    role: "fighter" | "coach";
    details: DetailsState;
    fighters: WizardFighterOption[];
    sessions: WizardSessionOption[];
    errors: Record<string, string>;
    onChange: (patch: Partial<DetailsState>) => void;
}

/** Step 2: who, what and how it was filmed. */
export function DetailsStep({ role, details, fighters, sessions, errors, onChange }: DetailsStepProps) {
    const baseId = useId();
    const ids = { fighter: `${baseId}-fighter`, type: `${baseId}-type`, angle: `${baseId}-angle`, session: `${baseId}-session`, title: `${baseId}-title`, notes: `${baseId}-notes` };
    const fighter = fighters.find((f) => f.id === details.fighterId) ?? null;
    const fighterSessions = sessions.filter((s) => s.fighterId === details.fighterId);
    const firstName = fighter?.name.split(" ")[0] ?? "";

    const clearanceNote = (() => {
        if (!fighter || !details.trainingType) return null;
        const who = role === "fighter" ? "Your" : `${firstName}'s`;
        if (fighter.clearanceState === "not_cleared" || fighter.clearanceState === "expired") {
            return `${who} Medical Clearance doesn't currently allow training. You can still upload this footage for analysis — check with the sports doctor before planning sessions.`;
        }
        const blocking = fighter.restrictions.filter((r) => r.types.includes(details.trainingType as VideoTrainingType));
        if (blocking.length === 0) return null;
        return `${who} Medical Clearance restricts ${TRAINING_TYPE_LABELS[details.trainingType].toLowerCase()} (${blocking.map((r) => r.label).join("; ")}). The footage can still be analysed — check with the sports doctor before scheduling similar sessions.`;
    })();

    const typeOptions: ChoiceOption<VideoTrainingType>[] = VIDEO_TRAINING_TYPES.map((type) => ({
        value: type,
        label: TRAINING_TYPE_LABELS[type],
        icon: TRAINING_TYPE_ICONS[type],
        description: VIDEO_TRAINING_TYPE_HINTS[type],
        extra: fighter?.restrictions.some((r) => r.types.includes(type)) ? (
            <span className="mt-1 block text-xs font-medium text-warning-fg">Restricted by clearance</span>
        ) : undefined,
    }));

    return (
        <div className="flex flex-col gap-6">
            {role === "coach" ? (
                <Field label="Fighter" htmlFor={ids.fighter} required error={errors.fighterId} hint="Only fighters on your roster are listed.">
                    <Select id={ids.fighter} name="fighterId" value={details.fighterId} onChange={(event) => onChange({ fighterId: event.target.value, sessionId: "" })} required>
                        <option value="">Choose a fighter</option>
                        {fighters.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.name}
                            </option>
                        ))}
                    </Select>
                </Field>
            ) : (
                fighter && (
                    <div className="rounded-lg border border-border bg-surface-muted/60 px-4 py-3">
                        <p className="mb-2 text-xs font-medium text-fg-muted">Uploading footage of</p>
                        <FighterIdentity fighter={fighter} size="sm" />
                    </div>
                )
            )}

            <div>
                <ChoiceGroup
                    id={ids.type}
                    name="trainingType"
                    legend="Training type"
                    required
                    columns={2}
                    options={typeOptions}
                    value={details.trainingType}
                    onChange={(trainingType) => onChange({ trainingType })}
                    error={errors.trainingType}
                />
                <div aria-live="polite">
                    {clearanceNote && (
                        <InlineNote icon={Info} tone="info" className="mt-3">
                            {clearanceNote}
                        </InlineNote>
                    )}
                </div>
            </div>

            <ChoiceGroup
                id={ids.angle}
                name="cameraAngle"
                legend="Camera angle"
                required
                variant="compact"
                columns={3}
                options={CAMERA_OPTIONS}
                value={details.cameraAngle}
                onChange={(cameraAngle) => onChange({ cameraAngle })}
                error={errors.cameraAngle}
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Title" htmlFor={ids.title} required error={errors.title} hint="Shown in the video library.">
                    <Input id={ids.title} name="title" value={details.title} maxLength={120} onChange={(event) => onChange({ title: event.target.value, titleEdited: true })} required />
                </Field>
                <Field
                    label="Link to a training session"
                    htmlFor={ids.session}
                    optional
                    error={errors.sessionId}
                    hint={details.fighterId ? (fighterSessions.length > 0 ? "Sessions from the last three weeks." : "No recent sessions for this fighter.") : "Choose a fighter first."}
                >
                    <Select
                        id={ids.session}
                        name="sessionId"
                        value={details.sessionId}
                        disabled={!details.fighterId || fighterSessions.length === 0}
                        onChange={(event) => {
                            const session = fighterSessions.find((s) => s.id === event.target.value);
                            const sessionType = session && VIDEO_TRAINING_TYPES.find((t) => t === session.type);
                            onChange({ sessionId: event.target.value, ...(sessionType && !details.trainingType ? { trainingType: sessionType } : {}) });
                        }}
                    >
                        <option value="">No session</option>
                        {fighterSessions.map((session) => (
                            <option key={session.id} value={session.id}>
                                {formatWeekdayDate(session.scheduledAt)} · {session.title}
                            </option>
                        ))}
                    </Select>
                </Field>
            </div>

            <Field label="Notes for the coach" htmlFor={ids.notes} optional hint="Anything that helps read the footage, e.g. “Round 3 of 4, working the hook off the jab.”" error={errors.notes}>
                <Textarea id={ids.notes} name="notes" rows={3} maxLength={1000} value={details.notes} onChange={(event) => onChange({ notes: event.target.value })} />
            </Field>
        </div>
    );
}
