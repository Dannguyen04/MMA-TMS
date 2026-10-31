"use client";

import { useState, type ReactNode } from "react";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tabs } from "@/components/ui/tabs";
import type { BodyLook } from "@/components/fighter-3d/body/body-material";
import { BodyViewer } from "./body3d/body-viewer";
import { CampTimeline } from "./camp/camp-timeline";
import { BodyRoundsReplay } from "./replay/body-rounds-replay";
import { CornerTimelineReplay } from "./replay/corner-timeline-replay";

type ReplayStyle = "timeline" | "body";

function SectionIntro({ note, children }: { note: string; children?: ReactNode }) {
    return (
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="max-w-2xl text-sm text-pretty text-fg-muted">{note}</p>
            {children}
        </div>
    );
}

function BodySection() {
    const [look, setLook] = useState<BodyLook>("hologram");
    return (
        <>
            <SectionIntro note="Khoảnh khắc 1 và 2 của kịch bản demo: cơ thể quét từ đầu xuống chân, rồi HLV thử xếp buổi đấu tập và thấy ngay vùng nào bị chặn.">
                <SegmentedControl<BodyLook>
                    label="Phong cách cơ thể"
                    size="md"
                    value={look}
                    onChange={setLook}
                    options={[
                        { value: "hologram", label: "A · Hologram" },
                        { value: "clinical", label: "B · Lâm sàng" },
                    ]}
                />
            </SectionIntro>
            <BodyViewer look={look} />
        </>
    );
}

function ReplaySection() {
    const [style, setStyle] = useState<ReplayStyle>("timeline");
    return (
        <>
            <SectionIntro note="Khoảnh khắc 3: bấm Phát để diễn lại trận theo đúng dữ liệu HLV ghi ở góc đài. Không có chuyển động nào nằm ngoài dữ liệu.">
                <SegmentedControl<ReplayStyle>
                    label="Phong cách diễn lại"
                    size="md"
                    value={style}
                    onChange={setStyle}
                    options={[
                        { value: "timeline", label: "A · Dải thời gian" },
                        { value: "body", label: "B · Cơ thể qua từng hiệp" },
                    ]}
                />
            </SectionIntro>
            {style === "timeline" ? <CornerTimelineReplay /> : <BodyRoundsReplay />}
        </>
    );
}

export function LabWorkbench({ defaultTab }: { defaultTab?: string }) {
    return (
        <Tabs
            defaultTab={defaultTab && ["body", "replay", "camp"].includes(defaultTab) ? defaultTab : undefined}
            label="Phần thử"
            urlParam="phan"
            items={[
                { id: "body", label: "Cơ thể 3D", content: <BodySection /> },
                { id: "replay", label: "Diễn lại hiệp", content: <ReplaySection /> },
                {
                    id: "camp",
                    label: "Camp",
                    content: (
                        <>
                            <SectionIntro note="Thay bảng lịch bằng một dòng thời gian: các pha của camp, cửa sổ đình chỉ và những buổi bị ảnh hưởng." />
                            <CampTimeline />
                        </>
                    ),
                },
            ]}
        />
    );
}
