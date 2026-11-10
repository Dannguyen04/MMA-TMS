"use client";

import type { BodyJoint } from "@/lib/domain/medical-contract";
import { useT } from "@/components/i18n/locale-provider";
import type { BodyRegion } from "@/lib/domain/types";
import { BodyModel, type BodyInjury } from "./body3d/body-model";
import { isMappedJoint } from "./body3d/regions";
import { BODY_REGION, JOINT, jointOf } from "./labels";

type Target = { joint?: BodyJoint | ""; region?: BodyRegion | "" };

/**
 * Mô hình 3D cho một vùng đang chọn (biểu mẫu ghi chấn thương, quan sát AI, phiếu khám…).
 * Chọn vùng trong danh sách là vùng đó sáng lên; 2D chỉ dùng khi giảm chuyển động hoặc lỗi WebGL.
 */
export function RegionModel({ targets, label, status = "ACTIVE", height = 340, emptyText, legend = true }: { targets: Target[]; label?: string; status?: "ACTIVE" | "RECOVERING" | "RESOLVED"; height?: number; emptyText?: string; legend?: boolean }) {
    const t = useT();
    const items = targets
        .filter((x) => x.joint || x.region)
        .map((x) => {
            const joint = x.joint ? x.joint : jointOf({ bodyRegion: x.region as BodyRegion });
            const name = t(x.joint ? JOINT[x.joint] : BODY_REGION[x.region as BodyRegion]);
            return { joint, name, mapped: isMappedJoint(joint) };
        });
    const body: BodyInjury[] = items.map((i) => ({ affectedJoint: i.joint, status, injuryType: label ?? i.name, severity: "" }));
    const unmapped = items.filter((i) => !i.mapped);
    return (
        <div className="rm" data-legend={legend} aria-live="polite">
            <BodyModel injuries={body} height={height} />
            <p className="rm-caption">
                {items.length === 0 ? (emptyText ?? t("doctorUi.body.noRegion")) : items.map((i) => i.name).join(" · ")}
                {unmapped.length > 0 && <small>{t("doctorUi.body.unmapped")}</small>}
            </p>
        </div>
    );
}
