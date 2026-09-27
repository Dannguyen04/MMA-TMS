import type { Metadata } from "next";

import { dayKey, toDateTimeInputValue } from "@/lib/format";
import { InjuryForm, type InjuryAlertOption } from "@/components/clinical/injury-form";
import { InjuryRecordForm } from "@/components/clinical/injury-record-form";
import { PageHeader } from "@/components/ui/page-header";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { listAlerts } from "@/lib/services/ai";
import { medicalFeatureAvailable, usesMedicalServiceForms } from "@/lib/services/medical-features";
import { listFighters } from "@/lib/services/people";
import { listVideos } from "@/lib/services/videos";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Record injury" };

export default async function NewInjuryPage({ searchParams }: PageProps<"/doctor/injuries/new">) {
    const user = await requireRole("doctor");
    const params = await searchParams;
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    if (usesMedicalServiceForms()) {
        const fighters = await listFighters(user);
        const requested = param(params.fighter) ?? "";
        const preselected = canAccessFighter(user, requested) ? fighters.find((fighter) => fighter.id === requested) : undefined;
        const cancelHref = preselected ? routes.doctor.fighter(preselected.id) : routes.doctor.injuries;
        return (
            <>
                <PageHeader
                    back={preselected ? { href: cancelHref, label: preselected.name } : { href: cancelHref, label: "Injuries" }}
                    eyebrow="Injury record"
                    title="Record injury"
                    description="Document a confirmed injury after your assessment. Treatments and a recovery plan follow from the injury record."
                />
                <InjuryRecordForm
                    fighters={fighters.map((fighter) => ({ id: fighter.id, name: fighter.name })).sort((a, b) => a.name.localeCompare(b.name))}
                    defaultFighterId={preselected?.id ?? ""}
                    nowInput={toDateTimeInputValue(now)}
                    cancelHref={cancelHref}
                />
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

    const back = linkedAlert
        ? { href: routes.doctor.aiAlert(linkedAlert.id), label: "AI movement observation" }
        : preselected
          ? { href: routes.doctor.fighter(preselected.id), label: preselected.name }
          : { href: routes.doctor.injuries, label: "Injuries" };

    return (
        <>
            <PageHeader
                back={back}
                eyebrow="Injury record"
                title="Record injury"
                description="Document a confirmed injury after your assessment. Treatments, a recovery plan and Medical Clearance follow from the injury record."
            />
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
                cancelHref={back.href}
            />
        </>
    );
}
