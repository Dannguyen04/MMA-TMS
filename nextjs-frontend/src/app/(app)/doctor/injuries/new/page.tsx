import type { Metadata } from "next";

import { dayKey, toDateTimeInputValue } from "@/lib/format";
import { InjuryForm, type InjuryAlertOption } from "@/components/clinical/injury-form";
import { PageHeader } from "@/components/ui/page-header";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { listAlerts } from "@/lib/services/ai";
import { listFighters } from "@/lib/services/people";
import { listVideos } from "@/lib/services/videos";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Record injury" };

export default async function NewInjuryPage({ searchParams }: PageProps<"/doctor/injuries/new">) {
    const user = await requireRole("doctor");
    const params = await searchParams;
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    const [fighters, alerts, videos] = await Promise.all([listFighters(user), listAlerts({ fighterIds: scope }), listVideos({ fighterIds: scope })]);
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
