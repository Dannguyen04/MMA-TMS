"use client";

import { RefreshCw, Stethoscope, UserMinus, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { Term, TermHint } from "@/components/domain/term-hint";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Callout } from "@/components/training/callout";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { endAssignmentAction } from "@/lib/actions/admin";
import { assignCareTeamMemberAction } from "@/lib/actions/care-team";
import { CARE_ROLES, END_REASON_MAX, type CareRole, type CareTeam, type CareTeamMember, type StaffOption } from "@/lib/domain/care-team";
import { careTeamChange } from "@/lib/domain/care-team-change";
import { formatDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n/translate";
import { CARE_TEAM_ANCHOR, routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { splitAround } from "./admin-format";

export interface CareTeamCardProps {
    fighterId: string;
    fighterName: string;
    team: CareTeam;
    /** Active coach and doctor accounts that can be assigned. */
    staff: Record<CareRole, StaffOption[]>;
    className?: string;
}

/** Per-role wording: the section title, the field label and each sentence that names the role. */
const ROLE_KEYS: Record<
    CareRole,
    { section: MessageKey; field: MessageKey; assign: MessageKey; assignTitle: MessageKey; choose: MessageKey; addAccount: MessageKey; noStaff: MessageKey; loadError: MessageKey; nextStep: MessageKey }
> = {
    coach: {
        section: "screens.admin.rolePlural.coach",
        field: "role.coach",
        assign: "screens.admin.careTeam.assign.coach",
        assignTitle: "screens.admin.careTeam.assignTitle.coach",
        choose: "screens.admin.careTeam.choose.coach",
        addAccount: "screens.admin.careTeam.addAccount.coach",
        noStaff: "screens.admin.careTeam.noStaff.coach",
        loadError: "screens.admin.careTeam.loadError.coach",
        nextStep: "screens.admin.nextStep.coach.title",
    },
    doctor: {
        section: "screens.admin.rolePlural.doctor",
        field: "role.doctor",
        assign: "screens.admin.careTeam.assign.doctor",
        assignTitle: "screens.admin.careTeam.assignTitle.doctor",
        choose: "screens.admin.careTeam.choose.doctor",
        addAccount: "screens.admin.careTeam.addAccount.doctor",
        noStaff: "screens.admin.careTeam.noStaff.doctor",
        loadError: "screens.admin.careTeam.loadError.doctor",
        nextStep: "screens.admin.nextStep.doctor.title",
    },
};

/**
 * The fighter's current coaches and sports doctors, with assigning and ending an assignment. An empty role is the
 * fighter's next step, so it reads as one ("Next: assign a sports doctor") with the assign button in it.
 *
 * Several administrators can act on the same reminder, so the team is read again before the assign form opens: if
 * someone else assigned the role meanwhile, the card shows who instead of an empty form. The assignment itself is
 * refused if the team changed after the form opened (`assignCareTeamMemberAction`).
 */
export function CareTeamCard({ fighterId, fighterName, team, staff, className }: CareTeamCardProps) {
    const t = useT();
    const locale = useLocale();
    const router = useRouter();
    const toast = useToast();
    const [refreshing, startRefresh] = useTransition();
    // The role whose form waits for the fresh read, with the staff ids shown when its button was pressed.
    const [checking, setChecking] = useState<{ role: CareRole; seen: string[] } | null>(null);
    // What changed since the page loaded, said next to the role it concerns.
    const [changed, setChanged] = useState<{ role: CareRole; message: string } | null>(null);
    // The roles and member stay set while a dialog closes, so its text doesn't change mid-animation.
    const [assignRole, setAssignRole] = useState<CareRole>("coach");
    const [assignSeen, setAssignSeen] = useState<string[]>([]);
    const [assigning, setAssigning] = useState(false);
    const [ending, setEnding] = useState<{ role: CareRole; member: CareTeamMember } | null>(null);
    const [endOpen, setEndOpen] = useState(false);

    const staffIds = (role: CareRole) => team[role]?.map((member) => member.staffId) ?? [];
    const unassigned = (role: CareRole) => staff[role].filter((option) => !team[role]?.some((member) => member.staffId === option.staffId));
    const accountOf = (role: CareRole, staffId: string) => staff[role].find((option) => option.staffId === staffId);
    const notify = (state: { message?: string }) => toast({ title: state.message ?? t("screens.admin.careTeam.updated") });

    // Once the fresh read has landed, open the form only if nobody changed the role in the meantime.
    if (checking && !refreshing) {
        const current = team[checking.role];
        const change = current ? careTeamChange(checking.role, checking.seen, current) : null;
        setChecking(null);
        if (change) {
            setChanged({ role: checking.role, message: change });
        } else {
            setAssignRole(checking.role);
            setAssignSeen(staffIds(checking.role));
            setAssigning(true);
        }
    }

    function requestAssign(role: CareRole) {
        setChanged(null);
        setChecking({ role, seen: staffIds(role) });
        startRefresh(() => router.refresh());
    }

    const assignButton = (role: CareRole, variant: "primary" | "secondary") => (
        <Button
            size="sm"
            variant={variant}
            loading={checking?.role === role}
            disabled={team[role] === null || unassigned(role).length === 0 || (checking !== null && checking.role !== role)}
            onClick={() => requestAssign(role)}
        >
            <UserPlus aria-hidden />
            {t(ROLE_KEYS[role].assign)}
        </Button>
    );

    return (
        <Card id={CARE_TEAM_ANCHOR} className={cn("scroll-mt-24", className)}>
            <CardHeader
                title={
                    <span className="inline-flex items-center gap-1">
                        {t("screens.admin.careTeam.title")}
                        <TermHint term="careTeam" locale={locale} />
                    </span>
                }
                description={t("screens.admin.careTeam.description", { name: fighterName })}
                icon={<UsersRound />}
            />
            <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {CARE_ROLES.map((role) => {
                    const members = team[role];
                    const section = t(ROLE_KEYS[role].section);
                    return (
                        <section key={role} aria-label={section} className="min-w-0">
                            <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
                                <h3 className="text-sm font-semibold text-fg">{section}</h3>
                                {/* An empty role carries its button in the callout below. */}
                                {members !== null && members.length > 0 && assignButton(role, "secondary")}
                            </div>
                            {/* Always rendered, so the change is announced when it appears. */}
                            <div role="status">
                                {changed?.role === role && (
                                    <InlineNote icon={RefreshCw} tone="info" className="mt-2">
                                        {changed.message}
                                    </InlineNote>
                                )}
                            </div>
                            {members === null ? (
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                    <p className="text-sm text-danger-fg">{t(ROLE_KEYS[role].loadError)}</p>
                                    <Button size="sm" variant="secondary" loading={refreshing && checking === null} onClick={() => startRefresh(() => router.refresh())}>
                                        <RefreshCw aria-hidden />
                                        {t("screens.admin.common.tryAgain")}
                                    </Button>
                                </div>
                            ) : members.length === 0 ? (
                                <EmptyRole role={role} fighterName={fighterName} canAssign={staff[role].length > 0} action={assignButton(role, "primary")} />
                            ) : (
                                <ul className="mt-2 divide-y divide-border">
                                    {members.map((member) => {
                                        const account = accountOf(role, member.staffId);
                                        const name = account?.name ?? member.name;
                                        return (
                                            <li key={member.assignmentId} className="flex items-center gap-3 py-2.5">
                                                <Avatar name={name} size="sm" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-fg">
                                                        {account ? (
                                                            <Link href={routes.admin.user(account.userId)} className="hover:underline">
                                                                {name}
                                                            </Link>
                                                        ) : (
                                                            name
                                                        )}
                                                        {member.primary && <span className="ml-1.5 font-normal text-fg-subtle">{t("screens.admin.careTeam.primary")}</span>}
                                                    </p>
                                                    {member.since && (
                                                        <p className="text-[13px] text-fg-muted">{t("screens.admin.careTeam.since", { date: formatDate(member.since, locale) })}</p>
                                                    )}
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setEnding({ role, member: { ...member, name } });
                                                        setEndOpen(true);
                                                    }}
                                                >
                                                    <UserMinus aria-hidden />
                                                    {t("screens.admin.careTeam.end")}
                                                    <span className="sr-only"> {t("screens.admin.careTeam.endSr", { name })}</span>
                                                </Button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    );
                })}
            </CardContent>

            <ActionDialog
                open={assigning}
                onClose={() => setAssigning(false)}
                title={t(ROLE_KEYS[assignRole].assignTitle)}
                description={t("screens.admin.careTeam.assignDescription", { name: fighterName })}
                action={assignCareTeamMemberAction}
                submitLabel={t("screens.admin.careTeam.assignSubmit")}
                pendingLabel={t("screens.admin.careTeam.assigning")}
                onSuccess={notify}
            >
                {(form) => {
                    const control = form.control("staffId", { required: true });
                    return (
                        <>
                            <input type="hidden" name="fighterId" value={fighterId} />
                            <input type="hidden" name="role" value={assignRole} />
                            {/* The team as it was when the form opened: the assignment is refused if it changes before saving. */}
                            {assignSeen.map((staffId) => (
                                <input key={staffId} type="hidden" name="expected" value={staffId} />
                            ))}
                            <Field label={t(ROLE_KEYS[assignRole].field)} htmlFor={control.id} required error={form.error("staffId")}>
                                <Select {...control} defaultValue="">
                                    <option value="" disabled>
                                        {t(ROLE_KEYS[assignRole].choose)}
                                    </option>
                                    {unassigned(assignRole).map((option) => (
                                        <option key={option.staffId} value={option.staffId}>
                                            {option.title ? `${option.name} · ${option.title}` : option.name}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        </>
                    );
                }}
            </ActionDialog>

            <ActionDialog
                open={endOpen}
                onClose={() => setEndOpen(false)}
                title={ending ? t("screens.admin.careTeam.endTitle", { name: ending.member.name }) : t("screens.admin.careTeam.endTitleFallback")}
                description={t("screens.admin.careTeam.endDescription", { name: fighterName })}
                action={endAssignmentAction}
                submitLabel={t("screens.admin.careTeam.endSubmit")}
                submitVariant="danger"
                pendingLabel={t("screens.admin.careTeam.ending")}
                onSuccess={notify}
            >
                {(form) => {
                    const control = form.control("reason", { required: true });
                    return (
                        <>
                            <input type="hidden" name="fighterId" value={fighterId} />
                            <input type="hidden" name="role" value={ending?.role ?? ""} />
                            <input type="hidden" name="assignmentId" value={ending?.member.assignmentId ?? ""} />
                            <Field label={t("screens.admin.common.reason")} htmlFor={control.id} required error={form.error("reason")}>
                                <Textarea {...control} rows={3} maxLength={END_REASON_MAX} placeholder={t("screens.admin.careTeam.endPlaceholder")} />
                            </Field>
                        </>
                    );
                }}
            </ActionDialog>
        </Card>
    );
}

/**
 * A role nobody holds yet: the fighter's next step, with its one action. Without a sports doctor there's no baseline
 * examination, so the fighter can't train; without a coach nobody plans their training.
 */
function EmptyRole({ role, fighterName, canAssign, action }: { role: CareRole; fighterName: string; canAssign: boolean; action: ReactNode }) {
    const t = useT();
    const locale = useLocale();
    const doctor = role === "doctor";
    const [beforeTerm, afterTerm] = splitAround(t("screens.admin.careTeam.noDoctor", { name: fighterName }), "term");
    return (
        <Callout
            tone={doctor ? "warning" : "info"}
            icon={doctor ? Stethoscope : UsersRound}
            title={t(ROLE_KEYS[role].nextStep)}
            className="mt-2"
            action={
                canAssign ? (
                    action
                ) : (
                    <ButtonLink href={routes.admin.newUserAs(role)} size="sm" variant="secondary">
                        <UserPlus aria-hidden />
                        {t(ROLE_KEYS[role].addAccount)}
                    </ButtonLink>
                )
            }
        >
            {doctor ? (
                <>
                    {beforeTerm}
                    <Term term="baselineExam" locale={locale}>
                        {t("screens.admin.careTeam.baselineTerm")}
                    </Term>
                    {afterTerm}
                </>
            ) : (
                t("screens.admin.careTeam.noCoach", { name: fighterName })
            )}
            {!canAssign && ` ${t(ROLE_KEYS[role].noStaff)}`}
        </Callout>
    );
}
