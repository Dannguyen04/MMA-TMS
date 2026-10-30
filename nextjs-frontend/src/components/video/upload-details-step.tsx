"use client";

import { Info } from "lucide-react";
import { useId } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { TRAINING_TYPE_ICONS } from "@/components/domain/training-type-icon";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { trainingTypeLabel, VIDEO_TRAINING_TYPES } from "@/lib/domain/labels";
import type { CameraAngle, VideoTrainingType } from "@/lib/domain/types";
import { formatWeekdayDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n/translate";
import type { WizardFighterOption, WizardSessionOption } from "./upload-wizard-data";
import type { DetailsState } from "./upload-wizard-state";
import { ExerciseContextFields } from "./exercise-context-fields";
import { cameraAngleLabel } from "./video-copy";

const CAMERA_TIPS: Record<CameraAngle, MessageKey> = {
    front: "screens.video.upload.tipFront" as MessageKey,
    side: "screens.video.upload.tipSide" as MessageKey,
    diagonal: "screens.video.upload.tipDiagonal" as MessageKey,
};

const CAMERA_ORDER = ["diagonal", "side", "front"] as const;

export interface DetailsStepProps {
    evidenceEnabled?: boolean;
    role: "fighter" | "coach";
    details: DetailsState;
    fighters: WizardFighterOption[];
    sessions: WizardSessionOption[];
    errors: Record<string, string>;
    onChange: (patch: Partial<DetailsState>) => void;
}

/** Step 2: who, what and how it was filmed. */
export function DetailsStep({ role, details, fighters, sessions, errors, onChange, evidenceEnabled }: DetailsStepProps) {
    const baseId = useId();
    const t = useT();
    const locale = useLocale();
    const cameraOptions: ChoiceOption<CameraAngle>[] = CAMERA_ORDER.map((angle) => ({ value: angle, label: cameraAngleLabel(t, angle), description: t(CAMERA_TIPS[angle]) }));
    const ids = { fighter: `${baseId}-fighter`, type: `${baseId}-type`, angle: `${baseId}-angle`, session: `${baseId}-session`, title: `${baseId}-title`, notes: `${baseId}-notes` };
    const fighter = fighters.find((f) => f.id === details.fighterId) ?? null;
    const fighterSessions = sessions.filter((s) => s.fighterId === details.fighterId);
    const firstName = fighter?.name.split(" ")[0] ?? "";

    const clearanceNote = (() => {
        if (!fighter || !details.trainingType) return null;
        const self = role === "fighter";
        if (fighter.clearanceState === "not_cleared" || fighter.clearanceState === "expired") {
            return self ? t("screens.video.upload.clearanceBlocksSelf") : t("screens.video.upload.clearanceBlocks", { name: firstName });
        }
        const blocking = fighter.restrictions.filter((r) => r.types.includes(details.trainingType as VideoTrainingType));
        if (blocking.length === 0) return null;
        const params = { name: firstName, type: trainingTypeLabel(t, details.trainingType).toLowerCase(), restrictions: blocking.map((r) => r.label).join("; ") };
        return self ? t("screens.video.upload.clearanceRestrictsSelf", params) : t("screens.video.upload.clearanceRestricts", params);
    })();

    const typeOptions: ChoiceOption<VideoTrainingType>[] = VIDEO_TRAINING_TYPES.map((type) => ({
        value: type,
        label: trainingTypeLabel(t, type),
        icon: TRAINING_TYPE_ICONS[type],
        description: t(`screens.video.upload.hint.${type}`),
        extra: fighter?.restrictions.some((r) => r.types.includes(type)) ? (
            <span className="mt-1 block text-xs font-medium text-warning-fg">{t("screens.video.upload.restricted")}</span>
        ) : undefined,
    }));

    return (
        <div className="flex flex-col gap-6">
            {role === "coach" ? (
                <Field label={t("screens.video.fighter")} htmlFor={ids.fighter} required error={errors.fighterId} hint={t("screens.video.upload.rosterOnly")}>
                    <Select id={ids.fighter} name="fighterId" value={details.fighterId} onChange={(event) => onChange({ fighterId: event.target.value, sessionId: "" })} required>
                        <option value="">{t("screens.video.upload.chooseAFighter")}</option>
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
                        <p className="mb-2 text-xs font-medium text-fg-muted">{t("screens.video.upload.footageOf")}</p>
                        <FighterIdentity fighter={fighter} size="sm" />
                    </div>
                )
            )}

            <div>
                <ChoiceGroup
                    id={ids.type}
                    name="trainingType"
                    legend={t("screens.video.trainingType")}
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
                legend={t("screens.video.cameraAngle")}
                required
                variant="compact"
                columns={3}
                options={cameraOptions}
                value={details.cameraAngle}
                onChange={(cameraAngle) => onChange({ cameraAngle })}
                error={errors.cameraAngle}
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label={t("screens.video.title")} htmlFor={ids.title} required error={errors.title} hint={t("screens.video.upload.titleHint")}>
                    <Input id={ids.title} name="title" value={details.title} maxLength={120} onChange={(event) => onChange({ title: event.target.value, titleEdited: true })} required />
                </Field>
                <Field
                    label={t("screens.video.upload.session")}
                    htmlFor={ids.session}
                    optional
                    error={errors.sessionId}
                    hint={
                        details.fighterId
                            ? fighterSessions.length > 0
                                ? t("screens.video.upload.sessionsRecent")
                                : t("screens.video.upload.noRecentSessions")
                            : t("screens.video.upload.fighterFirst")
                    }
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
                        <option value="">{t("screens.video.upload.noSession")}</option>
                        {fighterSessions.map((session) => (
                            <option key={session.id} value={session.id}>
                                {formatWeekdayDate(session.scheduledAt, locale)} · {session.title}
                            </option>
                        ))}
                    </Select>
                </Field>
            </div>

            {evidenceEnabled && <ExerciseContextFields details={details} onChange={onChange} />}
            <Field label={t("screens.video.upload.notes")} htmlFor={ids.notes} optional hint={t("screens.video.upload.notesHint")} error={errors.notes}>
                <Textarea id={ids.notes} name="notes" rows={3} maxLength={1000} value={details.notes} onChange={(event) => onChange({ notes: event.target.value })} />
            </Field>
        </div>
    );
}
