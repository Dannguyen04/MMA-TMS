"use client";

import { Megaphone, Users } from "lucide-react";
import { useState } from "react";

import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import type { ActionForm } from "@/components/ui/use-action-form";
import { createBroadcastAction, type BroadcastData } from "@/lib/actions/admin";
import type { ActionState } from "@/lib/actions/state";
import { BROADCAST_CHANNEL_LABELS } from "@/lib/domain/labels";
import type { BroadcastChannel, Role } from "@/lib/domain/types";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CHANNEL_ICONS } from "./admin-badges";
import { ROLE_ORDER } from "./admin-format";

export interface BroadcastComposerProps {
    /** Active accounts per role, for the live recipient estimate. */
    activeCounts: Record<Role, number>;
    /** Earliest allowed schedule time, `YYYY-MM-DDTHH:mm` in the academy timezone. */
    minSchedule: string;
    /** Suggested schedule time, same format. */
    defaultSchedule: string;
    timezone: string;
}

const CHANNEL_DESCRIPTIONS: Record<BroadcastChannel, string> = {
    in_app: "Appears in the notification bell.",
    email: "Sent to their email address only.",
    in_app_email: "Both — for important announcements.",
};

const CHANNEL_OPTIONS: ChoiceOption<BroadcastChannel>[] = (["in_app", "email", "in_app_email"] as const).map((value) => ({
    value,
    label: BROADCAST_CHANNEL_LABELS[value],
    icon: CHANNEL_ICONS[value],
    description: CHANNEL_DESCRIPTIONS[value],
}));

const BODY_MAX = 1000;

const ROLE_PLURALS: Record<Role, string> = {
    fighter: "Fighters",
    coach: "Coaches",
    doctor: "Sports doctors",
    admin: "Administrators",
};

type Delivery = "now" | "schedule";

/** "New broadcast" button with a dialog to compose, target and send or schedule a broadcast. */
export function BroadcastComposer({ activeCounts, minSchedule, defaultSchedule, timezone }: BroadcastComposerProps) {
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const [audience, setAudience] = useState<Role[]>([]);
    const [channel, setChannel] = useState<BroadcastChannel>("in_app");
    const [delivery, setDelivery] = useState<Delivery>("now");
    const [confirming, setConfirming] = useState(false);

    const recipients = audience.reduce((total, role) => total + activeCounts[role], 0);
    const submitLabel = delivery === "schedule" ? "Schedule broadcast" : recipients > 0 ? `Send now to ${pluralize(recipients, "person", "people")}` : "Send now";

    const openComposer = () => {
        setAudience([]);
        setChannel("in_app");
        setDelivery("now");
        setOpen(true);
    };

    /**
     * Sending now can't be undone, so a complete "send now" submit opens a confirmation first; only that
     * confirmation sends. Incomplete submits go straight to validation, which can never send.
     */
    const prepare = (fd: FormData): ActionState<BroadcastData> | void => {
        const complete = String(fd.get("title") ?? "").trim().length >= 3 && String(fd.get("body") ?? "").trim().length >= 10 && fd.getAll("audience").length > 0;
        if (delivery === "now" && complete && fd.get("confirmSend") !== "yes") {
            setConfirming(true);
            return { status: "idle" };
        }
    };

    return (
        <>
            <Button onClick={openComposer}>
                <Megaphone aria-hidden />
                New broadcast
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                size="lg"
                title="New broadcast"
                description="Announce something to everyone in one or more roles."
                action={createBroadcastAction}
                prepare={prepare}
                submitLabel={submitLabel}
                pendingLabel={delivery === "schedule" ? "Scheduling…" : "Sending…"}
                onSuccess={(state) => toast({ title: state.data?.status === "scheduled" ? "Broadcast scheduled" : "Broadcast sent", description: state.message })}
            >
                {(form) => (
                    <>
                        <ComposerFields
                            form={form}
                            activeCounts={activeCounts}
                            minSchedule={minSchedule}
                            defaultSchedule={defaultSchedule}
                            timezone={timezone}
                            audience={audience}
                            onAudienceChange={setAudience}
                            channel={channel}
                            onChannelChange={setChannel}
                            delivery={delivery}
                            onDeliveryChange={setDelivery}
                            recipients={recipients}
                        />
                        <ConfirmDialog
                            open={confirming}
                            onClose={() => setConfirming(false)}
                            onConfirm={() => {
                                setConfirming(false);
                                form.submit({ confirmSend: "yes" });
                            }}
                            tone="primary"
                            title={`Send to ${pluralize(recipients, "person", "people")} now?`}
                            confirmLabel="Send broadcast"
                            description={`${audience.map((role) => ROLE_PLURALS[role]).join(", ")} get it ${channel === "in_app" ? "in the app" : channel === "email" ? "by email" : "in the app and by email"} straight away. Sending can't be undone.`}
                        />
                    </>
                )}
            </ActionDialog>
        </>
    );
}

interface ComposerFieldsProps extends BroadcastComposerProps {
    form: ActionForm<BroadcastData>;
    audience: Role[];
    onAudienceChange: (audience: Role[]) => void;
    channel: BroadcastChannel;
    onChannelChange: (channel: BroadcastChannel) => void;
    delivery: Delivery;
    onDeliveryChange: (delivery: Delivery) => void;
    recipients: number;
}

function ComposerFields({
    form,
    activeCounts,
    minSchedule,
    defaultSchedule,
    timezone,
    audience,
    onAudienceChange,
    channel,
    onChannelChange,
    delivery,
    onDeliveryChange,
    recipients,
}: ComposerFieldsProps) {
    const [bodyLength, setBodyLength] = useState(0);
    const { control, error } = form;
    const bodyHint = `${bodyLength} / ${BODY_MAX} characters`;
    const scheduleHint = `Time in ${timezone}.`;
    // Once a role is ticked the audience error is resolved, so the live estimate takes its place again.
    const audienceError = audience.length === 0 ? error("audience") : undefined;
    const audienceId = control("audience").id;

    const toggleRole = (role: Role, checked: boolean) =>
        onAudienceChange(checked ? ROLE_ORDER.filter((r) => r === role || audience.includes(r)) : audience.filter((r) => r !== role));

    return (
        <>
            <Field label="Title" htmlFor={control("title").id} required error={error("title")}>
                <Input {...control("title", { required: true })} maxLength={120} placeholder="e.g. Gym closed on Sunday for mat replacement" />
            </Field>

            <Field label="Message" htmlFor={control("body").id} required hint={bodyHint} error={error("body")}>
                <Textarea
                    {...control("body", { hint: bodyHint, required: true })}
                    rows={4}
                    maxLength={BODY_MAX}
                    onChange={(event) => setBodyLength(event.target.value.length)}
                    placeholder="What people need to know and what, if anything, they should do."
                />
            </Field>

            <fieldset data-invalid={audienceError ? "true" : undefined} className="flex flex-col gap-2" aria-describedby={audienceError ? `${audienceId}-error` : `${audienceId}-estimate`}>
                <legend className="mb-1 text-sm font-medium text-fg">
                    Audience
                    <span className="ml-0.5 text-danger-fg" aria-hidden>
                        *
                    </span>
                    <span className="sr-only"> (required)</span>
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ROLE_ORDER.map((role) => (
                        <label
                            key={role}
                            className={cn(
                                "flex cursor-pointer items-center gap-3 rounded-lg border bg-surface px-3 py-2.5 has-checked:border-primary has-checked:bg-primary-soft/40",
                                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                                audienceError ? "border-danger-solid" : "border-border hover:border-control-border",
                            )}
                        >
                            <input
                                type="checkbox"
                                name="audience"
                                value={role}
                                checked={audience.includes(role)}
                                onChange={(event) => toggleRole(role, event.target.checked)}
                                aria-required
                                aria-invalid={audienceError ? true : undefined}
                                className="size-4 shrink-0 accent-[var(--primary)]"
                            />
                            <span className="flex-1 text-sm font-medium text-fg">{ROLE_PLURALS[role]}</span>
                            <span className="text-xs text-fg-subtle">{activeCounts[role]} active</span>
                        </label>
                    ))}
                </div>
                {audienceError ? (
                    <p id={`${audienceId}-error`} className="text-[13px] font-medium text-danger-fg">
                        {audienceError}
                    </p>
                ) : (
                    <p id={`${audienceId}-estimate`} aria-live="polite" className="flex items-center gap-1.5 text-[13px] text-fg-muted">
                        <Users aria-hidden className="size-3.5" />
                        {audience.length === 0
                            ? "Choose at least one role."
                            : `Reaches about ${pluralize(recipients, "active account")}. Suspended and invited accounts are skipped.`}
                    </p>
                )}
            </fieldset>

            <ChoiceGroup
                id={control("channel").id}
                name="channel"
                legend="Channel"
                variant="compact"
                columns={3}
                options={CHANNEL_OPTIONS}
                value={channel}
                onChange={onChannelChange}
                error={error("channel")}
            />

            <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-fg">Delivery</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {(["now", "schedule"] as const).map((value) => (
                        <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-fg">
                            <input
                                type="radio"
                                name="delivery"
                                value={value}
                                checked={delivery === value}
                                onChange={() => onDeliveryChange(value)}
                                className="size-4 accent-[var(--primary)]"
                            />
                            {value === "now" ? "Send now" : "Schedule for later"}
                        </label>
                    ))}
                </div>
                <div className={cn(delivery !== "schedule" && "hidden")}>
                    <Field label="Send at" htmlFor={control("scheduledFor").id} required hint={scheduleHint} error={error("scheduledFor")} className="sm:max-w-xs">
                        <Input
                            {...control("scheduledFor", { hint: scheduleHint, required: true })}
                            type="datetime-local"
                            min={minSchedule}
                            disabled={delivery !== "schedule"}
                            defaultValue={defaultSchedule}
                        />
                    </Field>
                </div>
                {delivery === "now" && <p className="text-[13px] text-fg-subtle">Sending can&apos;t be undone. In-app notifications arrive immediately.</p>}
            </fieldset>
        </>
    );
}
