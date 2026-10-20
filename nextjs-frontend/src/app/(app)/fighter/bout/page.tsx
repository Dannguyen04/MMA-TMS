import { CalendarClock, FileCheck2, Scale, Swords } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FlashToast } from "@/components/medical/flash-toast";
import { BoutRequirementStatusBadge, BoutStatusBadge, WeightWarningBadge } from "@/components/domain/status-badges";
import { WeightChart } from "@/components/domain/weight-chart";
import { WeightFigures, WeightStatusNote } from "@/components/domain/weight-summary";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import type { Bout, BoutRequirement, WeightTrack } from "@/lib/domain/types";
import { activeBout, WEIGHT_SAVED_NOTICE } from "@/lib/domain/weigh-in";
import { dayKey, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { nullIfServiceFails } from "@/lib/services/api-helpers";
import { getWeightTrack, listBouts } from "@/lib/services/bouts";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("nav.Bout") };
}

/** Ready, as Gate 1 counts it (`evaluateGate1`): provided or confirmed, and still valid on fight day. */
function isReady(item: BoutRequirement, boutDay: string): boolean {
    return (item.status === "PROVIDED" || item.status === "CONFIRMED") && item.validUntil !== null && dayKey(item.validUntil) >= boutDay;
}

/** A date key (`YYYY-MM-DD`) as noon in the academy timezone, so formatting never shifts the day. */
const atNoon = (key: string) => `${key}T12:00:00+07:00`;

/**
 * The fighter's running bout on a phone: the fight, today's weight against the limit, and which
 * medical documents the coach still needs. The fighter reads the checklist; the coach keeps it.
 */
export default async function FighterBoutPage({ searchParams }: PageProps<"/fighter/bout">) {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighter = await requireFighterAccess(user, user.profileId);
    const [query, { t, locale }] = await Promise.all([searchParams, getTranslator()]);

    const bouts = await nullIfServiceFails(listBouts({ fighterIds: [fighter.id] }));
    const bout = bouts ? activeBout(bouts) : null;
    const track = bout ? await nullIfServiceFails(getWeightTrack(bout.id)) : null;

    const saved = param(query.notice) === WEIGHT_SAVED_NOTICE;
    const notice =
        saved && track?.latestKg != null
            ? { title: t("weight.savedKg", { kg: formatNumber(track.latestKg, 1) }), description: t("weight.savedStatus", { status: t(`weightStatus.${track.status}`) }) }
            : saved
              ? { title: t("weight.saved") }
              : null;

    if (!bout) {
        return (
            <>
                <FlashToast notice={notice} cleanHref={routes.fighter.bout} />
                <PageHeader title={t("nav.Bout")} />
                <EmptyState
                    icon={<Swords />}
                    title={t("bout.noneTitle")}
                    description={t("bout.noneText")}
                    action={
                        <ButtonLink href={routes.fighter.weighIn}>
                            <Scale aria-hidden />
                            {t("weight.logWeight")}
                        </ButtonLink>
                    }
                />
            </>
        );
    }

    const limitKg = bout.catchweightKg ?? bout.weightLimitKg;

    return (
        <>
            <FlashToast notice={notice} cleanHref={routes.fighter.bout} />
            <PageHeader
                eyebrow={t("bout.eyebrow")}
                title={bout.eventName}
                description={t("bout.versus", { opponent: bout.opponentName ?? t("bout.opponentTba") })}
                meta={
                    <>
                        <BoutStatusBadge status={bout.status} locale={locale} />
                        {bout.daysToWeighIn !== undefined && (
                            <Badge tone="neutral" variant="outline" icon={CalendarClock}>
                                {countdown(t, bout.daysToWeighIn)}
                            </Badge>
                        )}
                    </>
                }
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                    <FighterWeightCard bout={bout} track={track} limitKg={limitKg} t={t} locale={locale} />
                </div>
                <div className="flex min-w-0 flex-col gap-6">
                    <Card className="min-w-0">
                        <CardHeader title={t("bout.detailsTitle")} icon={<Swords aria-hidden />} />
                        <CardContent>
                            <DescriptionList
                                columns={1}
                                items={[
                                    { label: t("bout.weighIn"), value: formatDateTime(bout.weighInAt, locale) },
                                    { label: t("bout.boutTime"), value: formatDateTime(bout.boutAt, locale) },
                                    ...(bout.venue ? [{ label: t("bout.venue"), value: bout.venue }] : []),
                                ]}
                            />
                        </CardContent>
                    </Card>
                    <MedicalDocumentsCard requirements={bout.requirements} boutAt={bout.boutAt} t={t} locale={locale} />
                </div>
            </div>
        </>
    );
}

function countdown(t: Translator, days: number): string {
    if (days > 0) return plural(t, "bout.daysToWeighIn", days);
    if (days === 0) return t("bout.weighInToday");
    return t("bout.weighInDone");
}

interface WithLanguage {
    t: Translator;
    locale: Locale;
}

function FighterWeightCard({ bout, track, limitKg, t, locale }: { bout: Bout; track: WeightTrack | null; limitKg: number } & WithLanguage) {
    const weight = track ?? bout.weight ?? null;
    const status = weight?.status ?? "GREY";

    return (
        <Card className="min-w-0">
            <CardHeader title={t("weight.title")} icon={<Scale aria-hidden />} action={<WeightWarningBadge status={status} locale={locale} />} />
            <CardContent className="flex flex-col gap-4">
                <WeightFigures
                    latestKg={weight?.latestKg ?? null}
                    latestOn={weight?.latestOn ?? null}
                    limitKg={limitKg}
                    remainingPct={weight?.remainingPct ?? null}
                    catchweight={bout.catchweightKg !== null}
                    t={t}
                    locale={locale}
                />
                <WeightStatusNote status={status} audience="fighter" t={t} />
                {track && <WeightChart track={track} weighInAt={bout.weighInAt} t={t} locale={locale} height={220} />}

                <ButtonLink href={routes.fighter.weighIn} size="lg" className="w-full sm:w-auto sm:self-start">
                    <Scale aria-hidden />
                    {t("weight.logWeight")}
                </ButtonLink>
            </CardContent>
        </Card>
    );
}

function MedicalDocumentsCard({ requirements, boutAt, t, locale }: { requirements: BoutRequirement[]; boutAt: string } & WithLanguage) {
    const boutDay = dayKey(boutAt);
    const ready = requirements.filter((item) => isReady(item, boutDay)).length;

    return (
        <Card className="min-w-0">
            <CardHeader
                title={t("bout.documentsTitle")}
                description={requirements.length > 0 ? t("bout.documentsReady", { ready, total: requirements.length }) : t("bout.documentsNone")}
                icon={<FileCheck2 aria-hidden />}
            />
            <CardContent>
                {requirements.length > 0 ? (
                    <ul className="flex flex-col divide-y divide-border">
                        {requirements.map((item) => (
                            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                                <span className="min-w-0 text-sm text-fg">
                                    {item.label}
                                    {item.validUntil && (
                                        <span className="block text-xs text-fg-subtle">{t("bout.validUntil", { date: formatDate(atNoon(item.validUntil), locale) })}</span>
                                    )}
                                    {(item.status === "PROVIDED" || item.status === "CONFIRMED") && !isReady(item, boutDay) && (
                                        <span className="block text-xs text-warning-fg">{t("bout.expiresBeforeBout")}</span>
                                    )}
                                </span>
                                <BoutRequirementStatusBadge status={item.status} size="sm" locale={locale} />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-fg-muted">{t("bout.documentsEmpty")}</p>
                )}
            </CardContent>
        </Card>
    );
}
