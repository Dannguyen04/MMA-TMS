import { CircleAlert, CircleCheck, Check, Info, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";

import { CardLink } from "@/components/dashboard/card-link";
import { Callout } from "@/components/training/callout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { Tone as UiTone } from "@/components/ui/tone";
import type { ClinicalRestrictions, MedicalEligibility } from "@/lib/domain/medical-contract";
import type { Vitals as VitalsData } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { ELIGIBILITY_REASON, HYDRATION, JOINT, SESSION_TYPE, TECHNIQUE, num, type Tone } from "./labels";

export const reasonsText = (e: MedicalEligibility | null | undefined) => (e ? e.reasons.map((r) => ELIGIBILITY_REASON[r]) : []);

/** Doctor labels speak red/amber/green; the app's components speak semantic tones. */
export const UI_TONE: Record<Tone, UiTone> = { red: "danger", amber: "warning", green: "success", blue: "info", neutral: "neutral" };

/** Stretched row link: the whole table row opens the record; other links in the row stay on top. `yt-rowlink` marks it for tests. */
export const ROW_LINK = "yt-rowlink font-medium text-fg after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none";
/** The row that holds a ROW_LINK: positioned, pointer, and a focus ring while its link has focus. */
export const ROW = "relative cursor-pointer has-[a.yt-rowlink:focus-visible]:outline-2 has-[a.yt-rowlink:focus-visible]:-outline-offset-2 has-[a.yt-rowlink:focus-visible]:outline-ring";
/** A second link inside a row with a ROW_LINK: lifted above the stretched link. */
export const SUB_LINK = "relative z-10 text-fg hover:underline";
/** Muted secondary line under a cell value. */
export const CELL_SUB = "block text-[13px] text-fg-muted";

export function PageHead({ title, sub, actions, eyebrow, back, className, children }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode; back?: { href: string; label: string }; className?: string; children?: ReactNode }) {
    return <PageHeader title={title} description={sub} actions={actions} eyebrow={eyebrow} back={back} meta={children} className={cn("mb-0 sm:mb-0", className)} />;
}

/** A titled card section. The heading id lets the section be named by its title. */
export function Panel({ title, aside, children, className, id, contentClassName }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; id?: string; contentClassName?: string }) {
    const headingId = title && id ? `${id}-h` : undefined;
    return (
        <Card role={headingId ? "region" : undefined} aria-labelledby={headingId} className={cn("min-w-0", className)}>
            {title && <CardHeader title={<span id={headingId}>{title}</span>} action={aside ? <div className="flex items-center gap-2 text-[13px] text-fg-muted">{aside}</div> : undefined} />}
            <CardContent className={cn(!title && "pt-5", contentClassName)}>{children}</CardContent>
        </Card>
    );
}

export function Pill({ tone = "neutral", icon, children }: { tone?: Tone; icon?: Parameters<typeof Badge>[0]["icon"]; children: ReactNode }) {
    return (
        <Badge tone={UI_TONE[tone]} icon={icon}>
            {children}
        </Badge>
    );
}

/** Cổng điều kiện (Tập/Thi đấu). `e` null: chưa đọc được (chế độ demo không có điều kiện thi đấu) nên không hiện. */
export function Gate({ label, e }: { label: string; e: MedicalEligibility | null }) {
    if (!e) return null;
    return (
        <Badge tone={e.eligible ? "success" : "danger"} icon={e.eligible ? Check : X}>
            {label}
            <span className="sr-only">{e.eligible ? ": đủ điều kiện" : ": chưa đủ điều kiện"}</span>
        </Badge>
    );
}

/** Empty state: framed on its own, `compact` (no frame) inside a Panel. */
export function Empty({ title, children, action, icon, compact }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode; compact?: boolean }) {
    return (
        <div role="status">
            <EmptyState compact={compact} title={title} description={children} action={action} icon={icon} />
        </div>
    );
}

export function ErrorBox({ title, children, action, compact }: { title: string; children?: ReactNode; action?: ReactNode; compact?: boolean }) {
    return <ErrorState compact={compact} title={title} description={children} action={action} />;
}

export function GoLink({ href, children }: { href: string; children: ReactNode }) {
    return <CardLink href={href}>{children}</CardLink>;
}

export function Vitals({ v }: { v: VitalsData | null | undefined }) {
    if (!v) return <p className="text-sm text-fg-muted">Phiếu khám không có chỉ số sinh tồn.</p>;
    const cells: [string, string, string][] = [
        ["Cân nặng", num(v.weightKg), "kg"],
        ["Mạch nghỉ", String(v.restingHeartRate), "lần/phút"],
        ["Huyết áp", `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`, "mmHg"],
        ["Nhiệt độ", num(v.temperatureC), "°C"],
        ["SpO2", String(v.spo2Pct), "%"],
        ["Mức nước", HYDRATION[v.hydration], ""],
    ];
    return (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cells.map(([k, val, u]) => (
                <div key={k} className="min-w-0 rounded-lg bg-surface-muted px-3 py-2.5">
                    <dt className="truncate text-xs text-fg-muted">{k}</dt>
                    <dd className="mt-0.5 flex items-baseline gap-1">
                        <b className="text-lg font-semibold text-fg tabular-nums">{val}</b>
                        {u && <small className="text-xs text-fg-muted">{u}</small>}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

/** Giới hạn bằng lời của bác sĩ (dạng của dịch vụ y tế). */
export function Restrictions({ r }: { r: ClinicalRestrictions | null | undefined }) {
    if (!r || (!r.allowedSessionTypes?.length && !r.allowedTechniqueTypes?.length && !r.excludedJoints?.length && !r.notes)) return null;
    return (
        <div className="mt-2.5 grid gap-2">
            <ul className="flex flex-wrap gap-1.5">
                {r.allowedSessionTypes?.map((s) => (
                    <li key={s}>
                        <Badge>{SESSION_TYPE[s] ?? s}</Badge>
                    </li>
                ))}
                {r.allowedTechniqueTypes?.map((t) => (
                    <li key={t}>
                        <Badge>{TECHNIQUE[t] ?? t}</Badge>
                    </li>
                ))}
                {r.excludedJoints?.map((j) => (
                    <li key={j}>
                        <Badge tone="danger" icon={X}>
                            Tránh {JOINT[j]?.toLowerCase() ?? j}
                        </Badge>
                    </li>
                ))}
            </ul>
            {r.notes && <p className="text-sm text-fg-muted">{r.notes}</p>}
        </div>
    );
}

/** Body regions a clearance blocks, as danger badges. */
export function AvoidList({ items }: { items: { key: string; label: string }[] }) {
    return (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {items.map((item) => (
                <li key={item.key}>
                    <Badge tone="danger" icon={X}>
                        {item.label}
                    </Badge>
                </li>
            ))}
        </ul>
    );
}

export function ListSkeleton({ label, rows = 6 }: { label: string; rows?: number }) {
    return <TableSkeleton label={label} rows={rows} />;
}

/** Lọc theo võ sĩ bằng liên kết (giữ các tham số khác). */
export function FighterFilter({ base, fighters, current, extra = {}, param = "fighter" }: { base: string; fighters: { id: string; name: string }[]; current?: string; extra?: Record<string, string | undefined>; param?: string }) {
    const q = (f?: string) => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
        if (f) p.set(param, f);
        const s = p.toString();
        return s ? `${base}?${s}` : base;
    };
    return (
        <SegmentedLinks
            label="Lọc theo võ sĩ"
            className="max-w-full"
            items={[{ id: "", name: "Tất cả võ sĩ" }, ...fighters].map((f) => ({ href: q(f.id || undefined), label: f.name, active: f.id ? current === f.id : !current }))}
        />
    );
}

const FLASH: Record<"green" | "red" | "amber", { tone: UiTone; icon: typeof Info }> = {
    green: { tone: "success", icon: CircleCheck },
    red: { tone: "danger", icon: CircleAlert },
    amber: { tone: "warning", icon: TriangleAlert },
};

/** Thông báo một lần sau khi lưu (tham số `?saved=`), thay cho toast tiếng Anh cũ; `amber` cho dữ liệu đọc thiếu. */
export function Flash({ text, tone }: { text: string | null; tone?: "red" | "amber" }) {
    if (!text) return null;
    const look = FLASH[tone ?? "green"];
    return (
        <div data-tone={tone}>
            <Callout role="status" tone={look.tone} icon={look.icon} title={text} />
        </div>
    );
}
