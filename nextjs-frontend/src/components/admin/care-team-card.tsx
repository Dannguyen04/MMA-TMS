"use client";

import { UserMinus, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ActionDialog } from "@/components/ui/action-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { assignStaffAction, endAssignmentAction } from "@/lib/actions/admin";
import { CARE_ROLE_LABELS, CARE_ROLES, END_REASON_MAX, type CareRole, type CareTeam, type CareTeamMember, type StaffOption } from "@/lib/domain/care-team";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";

export interface CareTeamCardProps {
    fighterId: string;
    fighterName: string;
    team: CareTeam;
    /** Active coach and doctor accounts that can be assigned. */
    staff: Record<CareRole, StaffOption[]>;
}

const SECTION_TITLES: Record<CareRole, string> = { coach: "Coaches", doctor: "Sports doctors" };
const FIELD_LABELS: Record<CareRole, string> = { coach: "Coach", doctor: "Sports doctor" };

/** The fighter's current coaches and sports doctors, with assigning and ending an assignment. */
export function CareTeamCard({ fighterId, fighterName, team, staff }: CareTeamCardProps) {
    const toast = useToast();
    // The roles and member stay set while a dialog closes, so its text doesn't change mid-animation.
    const [assignRole, setAssignRole] = useState<CareRole>("coach");
    const [assigning, setAssigning] = useState(false);
    const [ending, setEnding] = useState<{ role: CareRole; member: CareTeamMember } | null>(null);
    const [endOpen, setEndOpen] = useState(false);

    const unassigned = (role: CareRole) => staff[role].filter((option) => !team[role].some((member) => member.staffId === option.staffId));
    const accountOf = (role: CareRole, staffId: string) => staff[role].find((option) => option.staffId === staffId);
    const notify = (state: { message?: string }) => toast({ title: state.message ?? "Care team updated." });

    return (
        <Card>
            <CardHeader title="Care team" description={`Who coaches ${fighterName} and looks after their health`} icon={<UsersRound />} />
            <CardContent className="flex flex-col gap-6">
                {CARE_ROLES.map((role) => (
                    <section key={role} aria-label={SECTION_TITLES[role]}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold text-fg">{SECTION_TITLES[role]}</h3>
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={unassigned(role).length === 0}
                                onClick={() => {
                                    setAssignRole(role);
                                    setAssigning(true);
                                }}
                            >
                                <UserPlus aria-hidden />
                                Assign {CARE_ROLE_LABELS[role]}
                            </Button>
                        </div>
                        {team[role].length === 0 ? (
                            <p className="mt-2 text-sm text-fg-subtle">No {CARE_ROLE_LABELS[role]} assigned.</p>
                        ) : (
                            <ul className="mt-2 divide-y divide-border">
                                {team[role].map((member) => {
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
                                                    {member.primary && <span className="ml-1.5 font-normal text-fg-subtle">(primary)</span>}
                                                </p>
                                                {member.since && <p className="text-[13px] text-fg-muted">Since {formatDate(member.since)}</p>}
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
                                                End
                                                <span className="sr-only"> {name}&apos;s assignment</span>
                                            </Button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                ))}
            </CardContent>

            <ActionDialog
                open={assigning}
                onClose={() => setAssigning(false)}
                title={`Assign a ${CARE_ROLE_LABELS[assignRole]}`}
                description={`The assignment starts now. ${fighterName} appears on their roster straight away.`}
                action={assignStaffAction}
                submitLabel="Assign"
                pendingLabel="Assigning…"
                onSuccess={notify}
            >
                {(form) => {
                    const control = form.control("staffId", { required: true });
                    return (
                        <>
                            <input type="hidden" name="fighterId" value={fighterId} />
                            <input type="hidden" name="role" value={assignRole} />
                            <Field label={FIELD_LABELS[assignRole]} htmlFor={control.id} required error={form.error("staffId")}>
                                <Select {...control} defaultValue="">
                                    <option value="" disabled>
                                        Choose a {CARE_ROLE_LABELS[assignRole]}
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
                title={ending ? `End ${ending.member.name}'s assignment?` : "End assignment?"}
                description={`They stop seeing ${fighterName} on their roster. The assignment stays in the fighter's history with your reason.`}
                action={endAssignmentAction}
                submitLabel="End assignment"
                submitVariant="danger"
                pendingLabel="Ending…"
                onSuccess={notify}
            >
                {(form) => {
                    const control = form.control("reason", { required: true });
                    return (
                        <>
                            <input type="hidden" name="fighterId" value={fighterId} />
                            <input type="hidden" name="role" value={ending?.role ?? ""} />
                            <input type="hidden" name="assignmentId" value={ending?.member.assignmentId ?? ""} />
                            <Field label="Reason" htmlFor={control.id} required error={form.error("reason")}>
                                <Textarea {...control} rows={3} maxLength={END_REASON_MAX} placeholder="e.g. Moved to another camp" />
                            </Field>
                        </>
                    );
                }}
            </ActionDialog>
        </Card>
    );
}
