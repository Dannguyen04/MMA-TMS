"use client";

import type { BodyJoint } from "@/lib/domain/medical-contract";
import type { BodyRegion } from "@/lib/domain/types";
import { BodyModel, type BodyInjury } from "./body3d/body-model";
import { isMappedJoint } from "./body3d/regions";
import { BODY_REGION, JOINT, jointOf } from "./labels";

type Target = { joint?: BodyJoint | ""; region?: BodyRegion | "" };

/**
 * Mô hình 3D cho một vùng đang chọn (biểu mẫu ghi chấn thương, quan sát AI, phiếu khám…).
 * Chọn vùng trong danh sách là vùng đó sáng lên; 2D chỉ dùng khi giảm chuyển động hoặc lỗi WebGL.
 */
export function RegionModel({ targets, label, status = "ACTIVE", height = 340, emptyText = "Chưa chọn vùng", legend = true }: { targets: Target[]; label?: string; status?: "ACTIVE" | "RECOVERING" | "RESOLVED"; height?: number; emptyText?: string; legend?: boolean }) {
    const items = targets
        .filter((t) => t.joint || t.region)
        .map((t) => {
            const joint = t.joint ? t.joint : jointOf({ bodyRegion: t.region as BodyRegion });
            const name = t.joint ? JOINT[t.joint] : BODY_REGION[t.region as BodyRegion];
            return { joint, name, mapped: isMappedJoint(joint) };
        });
    const body: BodyInjury[] = items.map((i) => ({ affectedJoint: i.joint, status, injuryType: label ?? i.name, severity: "" }));
    const unmapped = items.filter((i) => !i.mapped);
    return (
        <div className="rm" data-legend={legend} aria-live="polite">
            <BodyModel injuries={body} height={height} />
            <p className="rm-caption">
                {items.length === 0 ? emptyText : items.map((i) => i.name).join(" · ")}
                {unmapped.length > 0 && <small> — mô hình 3D chưa có vùng này, hãy xem mô tả</small>}
            </p>
        </div>
    );
}
