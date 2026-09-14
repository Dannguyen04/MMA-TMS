import { Award, BriefcaseMedical, Check, ClipboardList, KeyRound, ShieldOff, Users } from "lucide-react";
import Link from "next/link";

import { InlineNote } from "@/components/dashboard/inline-note";
import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { EmptyState } from "@/components/ui/states";
import type { Coach, Doctor, Permission, RoleDefinition } from "@/lib/domain/types";
import { pluralize } from "@/lib/format";

/** A fighter on a coach's roster or a doctor's list, with the link to their record. */
export interface RosterEntry {
    id: string;
    href: string;
    fighter: FighterIdentityData;
}

const ROSTER_PREVIEW_LIMIT = 8;

/* ─── Coach ───────────────────────────────────────────────────────────────── */

export function CoachProfileCard({ coach, rosterHref, roster }: { coach: Coach; rosterHref: string; roster: RosterEntry[] }) {
    return (
        <Card className="min-w-0">
            <CardHeader
                title="Coaching profile"
                icon={<ClipboardList />}
                description="Shown to your fighters and the medical team."
                action={
                    <ButtonLink href={rosterHref} variant="secondary" size="sm">
                        <Users aria-hidden />
                        View roster
                    </ButtonLink>
                }
                className="flex-col sm:flex-row"
            />
            <CardContent className="flex flex-col gap-5">
                <DescriptionList
                    columns={3}
                    items={[
                        { label: "Specialty", value: coach.specialty },
                        { label: "Experience", value: pluralize(coach.yearsExperience, "year") },
                        { label: "Roster", value: pluralize(coach.fighterIds.length, "fighter") },
                    ]}
                />
                <section aria-labelledby="coach-certifications">
                    <h3 id="coach-certifications" className="flex items-center gap-1.5 text-[13px] text-fg-muted">
                        <Award aria-hidden className="size-3.5" />
                        Certifications
                    </h3>
                    {coach.certifications.length === 0 ? (
                        <p className="mt-1 text-sm text-fg-subtle">None recorded yet.</p>
                    ) : (
                        <ul className="mt-2 flex flex-wrap gap-2">
                            {coach.certifications.map((certification) => (
                                <li key={certification}>
                                    <Badge tone="neutral" variant="outline">
                                        {certification}
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
                <RosterPreview
                    id="coach-roster"
                    heading="Your fighters"
                    emptyText="No fighters assigned yet. The academy administrator assigns fighters to coaches."
                    roster={roster}
                    moreHref={rosterHref}
                />
            </CardContent>
        </Card>
    );
}

/* ─── Doctor ──────────────────────────────────────────────────────────────── */

export function DoctorProfileCard({ doctor, patientsHref, roster }: { doctor: Doctor; patientsHref: string; roster: RosterEntry[] }) {
    return (
        <Card className="min-w-0">
            <CardHeader
                title="Clinical profile"
                icon={<BriefcaseMedical />}
                description="Shown on examinations, clearances and recovery plans you sign."
                action={
                    <ButtonLink href={patientsHref} variant="secondary" size="sm">
                        <Users aria-hidden />
                        Assigned fighters
                    </ButtonLink>
                }
                className="flex-col sm:flex-row"
            />
            <CardContent className="flex flex-col gap-5">
                <DescriptionList
                    columns={3}
                    items={[
                        { label: "Specialty", value: doctor.specialty },
                        { label: "License number", value: <span className="font-mono text-[13px]">{doctor.licenseNumber}</span> },
                        { label: "Assigned fighters", value: pluralize(doctor.fighterIds.length, "fighter") },
                    ]}
                />
                <RosterPreview
                    id="doctor-roster"
                    heading="Fighters in your care"
                    emptyText="No fighters assigned yet. The academy administrator assigns fighters to sports doctors."
                    roster={roster}
                    moreHref={patientsHref}
                />
            </CardContent>
        </Card>
    );
}

/* ─── Roster preview ──────────────────────────────────────────────────────── */

function RosterPreview({
    id,
    heading,
    emptyText,
    roster,
    moreHref,
}: {
    id: string;
    heading: string;
    emptyText: string;
    roster: RosterEntry[];
    moreHref: string;
}) {
    const shown = roster.slice(0, ROSTER_PREVIEW_LIMIT);
    const hidden = roster.length - shown.length;

    return (
        <section aria-labelledby={id} className="border-t border-border pt-4">
            <h3 id={id} className="flex items-center gap-1.5 text-[13px] text-fg-muted">
                <Users aria-hidden className="size-3.5" />
                {heading}
            </h3>
            {shown.length === 0 ? (
                <p className="mt-1 text-sm text-fg-subtle">{emptyText}</p>
            ) : (
                <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    {shown.map((entry) => (
                        <li key={entry.id} className="min-w-0">
                            <FighterIdentity fighter={entry.fighter} size="sm" href={entry.href} showHealth />
                        </li>
                    ))}
                </ul>
            )}
            {hidden > 0 && (
                <p className="mt-3 text-[13px] text-fg-muted">
                    <Link href={moreHref} className="font-medium text-primary-soft-fg hover:underline">
                        {pluralize(hidden, "more fighter")}
                    </Link>
                </p>
            )}
        </section>
    );
}

/* ─── Administrator ───────────────────────────────────────────────────────── */

export interface PermissionEntry {
    permission: Permission;
    label: string;
    group: string;
}

/** What the administrator role can do, grouped by area, plus a reminder that clinical data is out of scope. */
export function AccessSummaryCard({
    role,
    catalog,
    rolesHref,
}: {
    role: RoleDefinition;
    catalog: PermissionEntry[];
    rolesHref: string;
}) {
    const groups = [...new Set(catalog.map((entry) => entry.group))];

    return (
        <Card className="min-w-0">
            <CardHeader
                title="Access & permissions"
                icon={<KeyRound />}
                description={`Granted by the ${role.label} role — ${pluralize(role.permissions.length, "permission")}.`}
                action={
                    <ButtonLink href={rolesHref} variant="secondary" size="sm">
                        Manage roles
                    </ButtonLink>
                }
                className="flex-col sm:flex-row"
            />
            <CardContent className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    {groups.map((group) => {
                        const granted = catalog.filter((entry) => entry.group === group && role.permissions.includes(entry.permission));
                        const headingId = `access-${group.toLowerCase().replace(/[^a-z]+/g, "-")}`;
                        return (
                            <section key={group} aria-labelledby={headingId} className="min-w-0">
                                <h3 id={headingId} className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
                                    {group}
                                </h3>
                                {granted.length === 0 ? (
                                    <p className="mt-1.5 text-[13px] text-fg-muted">No access</p>
                                ) : (
                                    <ul className="mt-1.5 flex flex-col gap-1.5">
                                        {granted.map((entry) => (
                                            <li key={entry.permission} className="flex items-start gap-2 text-[13px] text-fg">
                                                <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success-fg" />
                                                {entry.label}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        );
                    })}
                </div>
                <InlineNote icon={ShieldOff}>
                    Administrators can&apos;t open medical records, examinations or clinical notes. That information stays with the sports doctors
                    assigned to each fighter.
                </InlineNote>
            </CardContent>
        </Card>
    );
}

/* ─── Missing profile ─────────────────────────────────────────────────────── */

export function MissingProfileCard({ kind }: { kind: "fighter" | "coaching" | "clinical" }) {
    return (
        <Card className="min-w-0">
            <CardContent className="pt-5">
                <EmptyState
                    compact
                    title={`No ${kind} profile linked`}
                    description={`Your account isn't linked to a ${kind} profile yet, so assignments can't be shown. Ask your academy administrator to link it.`}
                />
            </CardContent>
        </Card>
    );
}
