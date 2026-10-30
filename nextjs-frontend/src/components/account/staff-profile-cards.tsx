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
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

/** A fighter on a coach's roster or a doctor's list, with the link to their record. */
export interface RosterEntry {
    id: string;
    href: string;
    fighter: FighterIdentityData;
}

const ROSTER_PREVIEW_LIMIT = 8;

/* ─── Coach ───────────────────────────────────────────────────────────────── */

export function CoachProfileCard({ coach, rosterHref, roster, locale = "en" }: { coach: Coach; rosterHref: string; roster: RosterEntry[]; locale?: Locale }) {
    const t = createTranslator(locale);

    return (
        <Card className="min-w-0">
            <CardHeader
                title={t("account.staff.coachingTitle")}
                icon={<ClipboardList />}
                description={t("account.staff.coachingDescription")}
                action={
                    <ButtonLink href={rosterHref} variant="secondary" size="sm">
                        <Users aria-hidden />
                        {t("account.staff.viewRoster")}
                    </ButtonLink>
                }
                className="flex-col sm:flex-row"
            />
            <CardContent className="flex flex-col gap-5">
                <DescriptionList
                    columns={3}
                    items={[
                        { label: t("account.staff.specialty"), value: coach.specialty },
                        {
                            label: t("account.staff.experience"),
                            value: coach.yearsExperience === null
                                ? t("account.profile.notRecorded")
                                : locale === "vi"
                                  ? `${coach.yearsExperience} năm`
                                  : pluralize(coach.yearsExperience, "year"),
                        },
                        {
                            label: t("account.staff.roster"),
                            value: locale === "vi"
                                ? `${coach.fighterIds.length} võ sĩ`
                                : pluralize(coach.fighterIds.length, "fighter"),
                        },
                    ]}
                />
                <section aria-labelledby="coach-certifications">
                    <h3 id="coach-certifications" className="flex items-center gap-1.5 text-[13px] text-fg-muted">
                        <Award aria-hidden className="size-3.5" />
                        {t("account.staff.certifications")}
                    </h3>
                    {coach.certifications.length === 0 ? (
                        <p className="mt-1 text-sm text-fg-subtle">{t("account.staff.noneRecorded")}</p>
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
                    heading={t("account.staff.yourFighters")}
                    emptyText={t("account.staff.noFightersCoach")}
                    roster={roster}
                    moreHref={rosterHref}
                    locale={locale}
                />
            </CardContent>
        </Card>
    );
}

/* ─── Doctor ──────────────────────────────────────────────────────────────── */

export function DoctorProfileCard({ doctor, patientsHref, roster, locale = "en" }: { doctor: Doctor; patientsHref: string; roster: RosterEntry[]; locale?: Locale }) {
    const t = createTranslator(locale);

    return (
        <Card className="min-w-0">
            <CardHeader
                title={t("account.staff.clinicalTitle")}
                icon={<BriefcaseMedical />}
                description={t("account.staff.clinicalDescription")}
                action={
                    <ButtonLink href={patientsHref} variant="secondary" size="sm">
                        <Users aria-hidden />
                        {t("account.staff.assignedFighters")}
                    </ButtonLink>
                }
                className="flex-col sm:flex-row"
            />
            <CardContent className="flex flex-col gap-5">
                <DescriptionList
                    columns={3}
                    items={[
                        { label: t("account.staff.specialty"), value: doctor.specialty },
                        { label: t("account.staff.licenseNumber"), value: <span className="font-mono text-[13px]">{doctor.licenseNumber}</span> },
                        {
                            label: t("account.staff.assignedFighters"),
                            value: locale === "vi"
                                ? `${doctor.fighterIds.length} võ sĩ`
                                : pluralize(doctor.fighterIds.length, "fighter"),
                        },
                    ]}
                />
                <RosterPreview
                    id="doctor-roster"
                    heading={t("account.staff.fightersInCare")}
                    emptyText={t("account.staff.noFightersDoctor")}
                    roster={roster}
                    moreHref={patientsHref}
                    locale={locale}
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
    locale = "en",
}: {
    id: string;
    heading: string;
    emptyText: string;
    roster: RosterEntry[];
    moreHref: string;
    locale?: Locale;
}) {
    const shown = roster.slice(0, ROSTER_PREVIEW_LIMIT);
    const hidden = roster.length - shown.length;
    const t = createTranslator(locale);

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
                            <FighterIdentity fighter={entry.fighter} size="sm" href={entry.href} showHealth locale={locale} />
                        </li>
                    ))}
                </ul>
            )}
            {hidden > 0 && (
                <p className="mt-3 text-[13px] text-fg-muted">
                    <Link href={moreHref} className="font-medium text-primary-soft-fg hover:underline">
                        {t(hidden === 1 ? "account.staff.moreFighters" : "account.staff.moreFighters.plural", { count: hidden })}
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
    locale = "en",
}: {
    role: RoleDefinition;
    catalog: PermissionEntry[];
    rolesHref: string;
    locale?: Locale;
}) {
    const groups = [...new Set(catalog.map((entry) => entry.group))];
    const t = createTranslator(locale);

    return (
        <Card className="min-w-0">
            <CardHeader
                title={t("account.staff.accessTitle")}
                icon={<KeyRound />}
                description={t(role.permissions.length === 1 ? "account.staff.accessDescription" : "account.staff.accessDescription.plural", {
                    role: locale === "vi" ? t(`role.${role.role}`) : role.label,
                    count: role.permissions.length,
                })}
                action={
                    <ButtonLink href={rolesHref} variant="secondary" size="sm">
                        {t("account.staff.manageRoles")}
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
                                    <p className="mt-1.5 text-[13px] text-fg-muted">{t("account.staff.noAccess")}</p>
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
                    {t("account.staff.adminMedicalNotice")}
                </InlineNote>
            </CardContent>
        </Card>
    );
}

/* ─── Missing profile ─────────────────────────────────────────────────────── */

export function MissingProfileCard({ kind, locale = "en" }: { kind: "fighter" | "coaching" | "clinical"; locale?: Locale }) {
    const t = createTranslator(locale);
    const kindText = kind === "fighter" ? t("account.staff.kindFighter") : kind === "coaching" ? t("account.staff.kindCoaching") : t("account.staff.kindClinical");

    return (
        <Card className="min-w-0">
            <CardContent className="pt-5">
                <EmptyState
                    compact
                    title={t("account.staff.missingTitle", { kind: kindText })}
                    description={t("account.staff.missingDescription", { kind: kindText })}
                />
            </CardContent>
        </Card>
    );
}
