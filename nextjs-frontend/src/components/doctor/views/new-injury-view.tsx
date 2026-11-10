import { dayKey, toDateTimeInputValue } from "@/lib/format";
import { InjuryForm, type InjuryAlertOption } from "@/components/clinical/injury-form";
import { InjuryRecordForm } from "@/components/clinical/injury-record-form";
import { FormSection } from "@/components/doctor/form-section";
import { FighterChooser } from "@/components/medical/fighter-chooser";
import { PageHeader } from "@/components/ui/page-header";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { listAlerts } from "@/lib/services/ai";
import { medicalFeatureAvailable, usesMedicalServiceForms } from "@/lib/services/medical-features";
import { listFighters } from "@/lib/services/people";
import { listVideos } from "@/lib/services/videos";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { param } from "@/lib/utils";

/** Without a fighter, the page asks who first (like a new examination), then opens the form in that fighter's profile. */
function ChooseFighter({ fighters, t }: { fighters: Parameters<typeof FighterChooser>[0]["fighters"]; t: Translator }) {
    return (
        <>
            <PageHeader back={{ href: routes.doctor.injuries, label: t("doctorViews.injuries.title") }} title={t("doctorViews.injuries.new")} description={t("doctorViews.newInjury.chooserDescription")} />
            <FighterChooser fighters={fighters} hrefFor={(fighterId) => routes.doctor.fighterNewInjury(fighterId)} title={t("doctorViews.newInjury.chooserTitle")} />
        </>
    );
}

/** The injury form, on its own page or inside the fighter's profile (where `fighter` is that fighter). */
export async function NewInjuryView({ query: params, scoped = false }: { query: Record<string, string | string[] | undefined>; scoped?: boolean }) {
    const user = await requireRole("doctor");
    const { t } = await getTranslator();
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    if (usesMedicalServiceForms()) {
        const fighters = await listFighters(user);
        const requested = param(params.fighter) ?? "";
        const preselected = canAccessFighter(user, requested) ? fighters.find((fighter) => fighter.id === requested) : undefined;
        if (!scoped && !preselected) return <ChooseFighter fighters={fighters} t={t} />;
        const cancelHref = preselected ? routes.doctor.fighter(preselected.id) : routes.doctor.injuries;
        const recordForm = (
                <InjuryRecordForm
                    fighters={fighters.map((fighter) => ({ id: fighter.id, name: fighter.name })).sort((a, b) => a.name.localeCompare(b.name))}
                    defaultFighterId={preselected?.id ?? ""}
                    nowInput={toDateTimeInputValue(now)}
                    cancelHref={scoped && preselected ? routes.doctor.fighterInjuries(preselected.id) : cancelHref}
                    fighterLocked={scoped && Boolean(preselected)}
                    // Outside production builds: the same one-click sample fill the demo form offers.
                    demoFill={process.env.NODE_ENV !== "production"}
                />
        );
        const recordDescription = t("doctorViews.newInjury.recordDescription");
        if (scoped) {
            return (
                <FormSection title={t("doctorViews.injuries.new")} description={recordDescription}>
                    {recordForm}
                </FormSection>
            );
        }
        return (
            <>
                <PageHeader
                    back={preselected ? { href: cancelHref, label: preselected.name } : { href: cancelHref, label: t("doctorViews.injuries.title") }}
                    title={t("doctorViews.injuries.new")}
                    description={recordDescription}
                />
                {recordForm}
            </>
        );
    }

    // Linking an AI observation is only offered where observations exist (demo mode for now).
    const [fighters, alerts, videos] = await Promise.all([
        listFighters(user),
        medicalFeatureAvailable("aiObservations") ? listAlerts({ fighterIds: scope }) : [],
        listVideos({ fighterIds: scope }),
    ]);
    const videosById = new Map(videos.map((video) => [video.id, video]));

    const requestedAlertId = param(params.alert) ?? "";
    const requestedFighterId = param(params.fighter) ?? "";

    const alertOptions: InjuryAlertOption[] = alerts
        .filter((alert) => alert.linkedInjuryId === null)
        .map((alert) => {
            const video = videosById.get(alert.videoId);
            return { alert, source: video ? { trainingType: video.trainingType, uploadedAt: video.uploadedAt } : null };
        });

    const linkedAlert = alertOptions.find((option) => option.alert.id === requestedAlertId)?.alert;
    const defaultFighterId = linkedAlert?.fighterId ?? (requestedFighterId && canAccessFighter(user, requestedFighterId) ? requestedFighterId : "");
    const preselected = fighters.find((fighter) => fighter.id === defaultFighterId);
    // An AI observation names its fighter, so only a bare "new injury" asks who it is for.
    if (!scoped && !preselected && !linkedAlert) return <ChooseFighter fighters={fighters} t={t} />;

    const back = linkedAlert
        ? { href: routes.doctor.aiAlert(linkedAlert.id), label: t("doctorViews.injury.ai") }
        : preselected
          ? { href: routes.doctor.fighter(preselected.id), label: preselected.name }
          : { href: routes.doctor.injuries, label: t("doctorViews.injuries.title") };

    const description = t("doctorViews.newInjury.description");
    const injuryForm = (
            <InjuryForm
                fighters={fighters.map((fighter) => ({
                    id: fighter.id,
                    name: fighter.name,
                    nickname: fighter.nickname,
                    weightClass: fighter.weightClass,
                    stance: fighter.stance,
                    level: fighter.level,
                    healthStatus: fighter.healthStatus,
                }))}
                alerts={alertOptions}
                defaultFighterId={defaultFighterId}
                defaultAlertId={linkedAlert?.id ?? ""}
                nowInput={toDateTimeInputValue(now)}
                today={dayKey(now)}
                cancelHref={scoped && preselected ? routes.doctor.fighterInjuries(preselected.id) : back.href}
                fighterLocked={scoped && Boolean(preselected)}
                demoFill={isDemoAuthEnabled()}
            />
    );
    if (scoped) {
        return (
            <FormSection title={t("doctorViews.injuries.new")} description={description}>
                {injuryForm}
            </FormSection>
        );
    }
    return (
        <>
            <PageHeader back={back} title={t("doctorViews.injuries.new")} description={description} />
            {injuryForm}
        </>
    );
}
