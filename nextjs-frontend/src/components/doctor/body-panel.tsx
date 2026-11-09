import type { Injury } from "@/lib/domain/types";
import { BodyModel, type BodyInjury } from "./body3d/body-model";
import { EXCLUDED_COLOR, STATUS_COLOR } from "./body3d/regions";
import { INJURY_STATUS, JOINT, SEVERITY, injuryName, injuryPlace, jointOf } from "./labels";

/** A legend row for the body map: colour dot, region and state in words. */
const JOINT_ROW = "grid grid-cols-[10px_minmax(0,1fr)] items-center gap-x-2.5 rounded-lg bg-surface-muted px-2.5 py-2 text-[13px]";
const COLOR = { active: STATUS_COLOR.injury, recovering: STATUS_COLOR.recovering, resolved: STATUS_COLOR.healed } as const;

/** Bản đồ cơ thể 3D (dự phòng 2D) cho chấn thương của võ sĩ và các khớp bị loại trừ khi tập. */
export function BodyPanel({ injuries, excluded, height = 460, abnormalHead }: { injuries: Injury[]; excluded: string[]; height?: number; abnormalHead?: boolean }) {
    const body: BodyInjury[] = injuries.map((i) => ({ affectedJoint: jointOf(i), status: i.status.toUpperCase(), injuryType: injuryName(i), severity: SEVERITY[i.severity].label }));
    const extra = excluded.filter((j) => !body.some((b, k) => b.affectedJoint === j && injuries[k]!.status !== "resolved"));
    return (
        <div className="text-fg">
            <BodyModel injuries={body} excludedJoints={abnormalHead ? [...excluded, "HEAD"] : excluded} height={height} />
            <ul className="mt-3.5 grid gap-2" aria-label="Vùng được đánh dấu">
                {injuries.map((i) => (
                    <li key={i.id} className={JOINT_ROW}>
                        <i style={{ background: COLOR[i.status] }} aria-hidden className="size-2.5 rounded-full" />
                        <span>
                            {injuryPlace(i)} · {injuryName(i)}
                        </span>
                        <small className="col-start-2 text-xs text-fg-muted">
                            {INJURY_STATUS[i.status].label} · {SEVERITY[i.severity].label}
                        </small>
                    </li>
                ))}
                {extra.map((j) => (
                    <li key={j} className={JOINT_ROW}>
                        <i style={{ background: EXCLUDED_COLOR }} aria-hidden className="size-2.5 rounded-full" />
                        <span>{JOINT[j as keyof typeof JOINT] ?? j}</span>
                        <small className="col-start-2 text-xs text-fg-muted">Loại trừ khi tập</small>
                    </li>
                ))}
                {abnormalHead && (
                    <li className={JOINT_ROW}>
                        <i style={{ background: EXCLUDED_COLOR }} aria-hidden className="size-2.5 rounded-full" />
                        <span>Đầu · thần kinh</span>
                        <small className="col-start-2 text-xs text-fg-muted">Đánh giá bất thường</small>
                    </li>
                )}
            </ul>
        </div>
    );
}
