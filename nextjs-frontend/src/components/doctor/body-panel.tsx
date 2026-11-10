"use client";

import { useT } from "@/components/i18n/locale-provider";
import type { Injury } from "@/lib/domain/types";
import { BodyModel, type BodyInjury } from "./body3d/body-model";
import { EXCLUDED_COLOR, STATUS_COLOR } from "./body3d/regions";
import { INJURY_STATUS, JOINT, SEVERITY, injuryName, injuryPlace, jointOf } from "./labels";

const COLOR = { active: STATUS_COLOR.injury, recovering: STATUS_COLOR.recovering, resolved: STATUS_COLOR.healed } as const;

/** Bản đồ cơ thể 3D (dự phòng 2D) cho chấn thương của võ sĩ và các khớp bị loại trừ khi tập. */
export function BodyPanel({ injuries, excluded, height = 460, abnormalHead }: { injuries: Injury[]; excluded: string[]; height?: number; abnormalHead?: boolean }) {
    const t = useT();
    const body: BodyInjury[] = injuries.map((i) => ({ affectedJoint: jointOf(i), status: i.status.toUpperCase(), injuryType: injuryName(t, i), severity: t(SEVERITY[i.severity].label) }));
    const extra = excluded.filter((j) => !body.some((b, k) => b.affectedJoint === j && injuries[k]!.status !== "resolved"));
    return (
        <div className="hs-body">
            <BodyModel injuries={body} excludedJoints={abnormalHead ? [...excluded, "HEAD"] : excluded} height={height} />
            <ul className="hs-joints" aria-label={t("doctorUi.body.marked")}>
                {injuries.map((i) => (
                    <li key={i.id}>
                        <i style={{ background: COLOR[i.status] }} aria-hidden />
                        <span>
                            {injuryPlace(t, i)} · {injuryName(t, i)}
                        </span>
                        <small>
                            {t(INJURY_STATUS[i.status].label)} · {t(SEVERITY[i.severity].label)}
                        </small>
                    </li>
                ))}
                {extra.map((j) => (
                    <li key={j}>
                        <i style={{ background: EXCLUDED_COLOR }} aria-hidden />
                        <span>{j in JOINT ? t(JOINT[j as keyof typeof JOINT]) : j}</span>
                        <small>{t("doctorUi.body.excluded")}</small>
                    </li>
                ))}
                {abnormalHead && (
                    <li>
                        <i style={{ background: EXCLUDED_COLOR }} aria-hidden />
                        <span>{t("doctorUi.body.headNeuro")}</span>
                        <small>{t("doctorUi.body.abnormal")}</small>
                    </li>
                )}
            </ul>
        </div>
    );
}
