import { CheckCircle2, Scale } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CampWeightCard } from "@/components/domain/camp-weight-card";
import { Callout } from "@/components/training/callout";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { RequirementStateBadge } from "@/components/domain/status-badges";
import { boutLimitKg } from "@/lib/domain/bout";
import { boutOn, expiresBeforeBout, gateSummary } from "@/lib/domain/bout-rules";
import { kgLabel } from "@/lib/domain/weight-input";
import { nutritionPhaseFor, savedWeightMessage, weighInCountdown } from "@/lib/domain/nutrition";
import { dayKey, formatDate, formatDateTime } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { getCurrentBout, getWeightTrack, wayOffForBout } from "@/lib/services/bouts";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("boutFighter.page.title") };
}

export default async function FighterBoutPage({ searchParams }: PageProps<"/fighter/bout">) {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const [query, { t, locale }] = await Promise.all([searchParams, getTranslator()]);
    const bout = await getCurrentBout(user.profileId);
    const saved = savedWeightMessage(param(query.saved), param(query.status), t);

    if (!bout) {
        return (
            <>
                <PageHeader title={t("boutFighter.page.title")} description={t("boutFighter.page.noBout")} />
                {saved && <SavedNote message={saved} />}
                <EmptyState
                    icon={<Scale />}
                    title={t("boutFighter.page.noBout")}
                    description={t("boutFighter.page.noBoutText")}
                    action={
                        <ButtonLink href={routes.fighter.weighIn} size="lg">
                            {t("boutFighter.weight.logWeight")}
                        </ButtonLink>
                    }
                />
            </>
        );
    }

    const todayOn = dayKey(new Date());
    const [track, wayOff] = await Promise.all([getWeightTrack(bout.id), wayOffForBout(bout.id, todayOn)]);
    const limit = boutLimitKg(bout);
    const boutDay = boutOn(bout);
    const phaseKey = nutritionPhaseFor(bout.phase);
    const note = phaseKey ? bout.nutritionPlan[phaseKey] : null;

    return (
        <>
            <PageHeader
                title={bout.event}
                description={bout.opponent ?? t("boutFighter.page.opponentTba")}
                meta={<span className="text-sm text-fg-muted">{bout.weightClassLabel}</span>}
            />
            {saved && <SavedNote message={saved} />}

            <DescriptionList
                columns={2}
                className="mb-6 grid-cols-2 lg:grid-cols-4"
                items={[
                    {
                        label: bout.catchweightKg === null ? t("boutFighter.page.limit") : t("boutFighter.page.catchweight"),
                        value: limit === null ? t("boutFighter.page.noUpperLimit") : kgLabel(limit),
                    },
                    { label: t("boutFighter.page.weighIn"), value: formatDateTime(bout.weighInAt, locale) },
                    { label: t("boutFighter.page.bout"), value: formatDateTime(bout.boutAt, locale) },
                    { label: t("boutFighter.page.countdown"), value: track ? weighInCountdown(track.daysToWeighIn, t) : "—" },
                ]}
            />

            <div className="flex flex-col gap-6">
                {track && <CampWeightCard track={track} wayOff={wayOff} logHref={routes.fighter.weighIn} locale={locale} />}

                {phaseKey && (
                    <Card>
                        <CardHeader title={t(`boutLabel.nutritionPhase.${phaseKey}`)} />
                        <CardContent>
                            {note ? (
                                <>
                                    <p className="text-sm text-pretty whitespace-pre-wrap text-fg">{note.text}</p>
                                    <p className="mt-2 text-xs text-fg-muted">
                                        {note.authorName} · {formatDateTime(note.updatedAt, locale)}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-fg-muted">{t("boutFighter.page.noPlan")}</p>
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader
                        title={t("boutFighter.page.medicalFile")}
                        description={bout.requirements.length > 0 ? gateSummary(bout.requirements, boutDay, t) : undefined}
                    />
                    <CardContent>
                        {bout.requirements.length === 0 ? (
                            <p className="text-sm text-fg-muted">{t("boutFighter.page.noDocuments")}</p>
                        ) : (
                            <ul className="divide-y divide-border">
                                {bout.requirements.map((item) => {
                                    const late = expiresBeforeBout(item, boutDay);
                                    return (
                                        <li key={item.code} className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
                                            <span className="min-w-0">
                                                <span className="block text-fg">
                                                    {item.label}
                                                    {!item.required && <span className="ml-1.5 text-xs text-fg-subtle">{t("boutFighter.page.optional")}</span>}
                                                </span>
                                                {item.validUntil && (
                                                    <span className={cn("block text-[13px] text-fg-muted", late && "font-medium text-danger-fg")}>
                                                        {t(late ? "boutFighter.page.validUntilLate" : "boutFighter.page.validUntil", {
                                                            date: formatDate(item.validUntil, locale),
                                                        })}
                                                    </span>
                                                )}
                                            </span>
                                            <RequirementStateBadge state={item.state} size="sm" locale={locale} />
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

function SavedNote({ message }: { message: string }) {
    return (
        <div className="mb-6">
            <Callout tone="success" icon={CheckCircle2} role="status" title={message} />
        </div>
    );
}
