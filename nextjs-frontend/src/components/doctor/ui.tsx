import { AlertTriangle, ArrowRight, Check, Inbox, X } from "lucide-react";
import Link from "next/link";
import { SegmentMotion } from "@/components/ui/segment-motion";
import type { ReactNode } from "react";

import type { ClinicalRestrictions, MedicalEligibility } from "@/lib/domain/medical-contract";
import type { Vitals as VitalsData } from "@/lib/domain/types";
import { ELIGIBILITY_REASON, HYDRATION, JOINT, SESSION_TYPE, TECHNIQUE, num, type Tone } from "./labels";

export const reasonsText = (e: MedicalEligibility | null | undefined) => (e ? e.reasons.map((r) => ELIGIBILITY_REASON[r]) : []);

export function PageHead({ title, sub, actions, className = "", children }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; className?: string; children?: ReactNode }) {
    return (
        <header className={`yt-head ${className}`} data-shot="head">
            <div className="yt-head-main">
                <h1>{title}</h1>
                {sub && <p className="yt-head-sub">{sub}</p>}
            </div>
            {actions && <div className="yt-head-actions">{actions}</div>}
            {children}
        </header>
    );
}

export function Panel({ title, aside, children, className = "", id, tone }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; id?: string; tone?: "plate" }) {
    return (
        <section className={`yt-panel ${className}`} data-tone={tone} aria-labelledby={title && id ? `${id}-h` : undefined} data-shot={id}>
            {title && (
                <header className="yt-panel-h">
                    <h2 id={id ? `${id}-h` : undefined}>{title}</h2>
                    {aside && <div className="yt-panel-aside">{aside}</div>}
                </header>
            )}
            {children}
        </section>
    );
}

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
    return (
        <span className="yt-pill" data-tone={tone}>
            {children}
        </span>
    );
}

/** Cổng điều kiện (Tập/Thi đấu). `e` null: chưa đọc được (chế độ demo không có điều kiện thi đấu) nên không hiện. */
export function Gate({ label, e }: { label: string; e: MedicalEligibility | null }) {
    if (!e) return null;
    return (
        <span className="yt-gate" data-ok={e.eligible}>
            {e.eligible ? <Check aria-hidden /> : <X aria-hidden />}
            {label}
            <span className="sr-only">{e.eligible ? ": đủ điều kiện" : ": chưa đủ điều kiện"}</span>
        </span>
    );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
    return (
        <div className="yt-empty" role="status">
            <Inbox aria-hidden />
            <p className="yt-empty-t">{title}</p>
            {children && <p className="yt-empty-d">{children}</p>}
            {action}
        </div>
    );
}

export function ErrorBox({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
    return (
        <div className="yt-error" role="alert">
            <AlertTriangle aria-hidden />
            <p className="yt-empty-t">{title}</p>
            {children && <p className="yt-empty-d">{children}</p>}
            {action}
        </div>
    );
}

export function GoLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link href={href} className="yt-go">
            {children}
            <ArrowRight aria-hidden />
        </Link>
    );
}

export function Vitals({ v }: { v: VitalsData | null | undefined }) {
    if (!v) return <p className="yt-muted">Phiếu khám không có chỉ số sinh tồn.</p>;
    const cells: [string, string, string][] = [
        ["Cân nặng", num(v.weightKg), "kg"],
        ["Mạch nghỉ", String(v.restingHeartRate), "lần/phút"],
        ["Huyết áp", `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`, "mmHg"],
        ["Nhiệt độ", num(v.temperatureC), "°C"],
        ["SpO2", String(v.spo2Pct), "%"],
        ["Mức nước", HYDRATION[v.hydration], ""],
    ];
    return (
        <dl className="yt-vitals">
            {cells.map(([k, val, u]) => (
                <div key={k}>
                    <dt>{k}</dt>
                    <dd>
                        <b>{val}</b>
                        {u && <small>{u}</small>}
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
        <div className="yt-restr">
            <ul className="yt-chips">
                {r.allowedSessionTypes?.map((s) => <li key={s}>{SESSION_TYPE[s] ?? s}</li>)}
                {r.allowedTechniqueTypes?.map((t) => <li key={t}>{TECHNIQUE[t] ?? t}</li>)}
                {r.excludedJoints?.map((j) => (
                    <li key={j} data-tone="block">
                        Tránh {JOINT[j]?.toLowerCase() ?? j}
                    </li>
                ))}
            </ul>
            {r.notes && <p className="yt-note">{r.notes}</p>}
        </div>
    );
}

export function Sk({ w = "100%", h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
    return <span className="yt-sk" style={{ width: w, height: h, borderRadius: r }} />;
}

export function ListSkeleton({ label, rows = 6, head = true }: { label: string; rows?: number; head?: boolean }) {
    return (
        <div aria-busy="true" aria-live="polite" className="yt-skel-page">
            <span className="sr-only">{label}</span>
            {head && (
                <div className="yt-skel-head">
                    <Sk w={320} h={44} r={8} />
                    <Sk w={220} h={14} />
                </div>
            )}
            <div className="yt-panel yt-skel-list">
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} className="yt-skel-row" style={{ ["--i" as string]: i }}>
                        <Sk w={44} h={44} r={22} />
                        <div>
                            <Sk w="40%" h={16} />
                            <Sk w="65%" h={12} />
                        </div>
                        <Sk w={90} h={26} r={999} />
                    </div>
                ))}
            </div>
        </div>
    );
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
        <SegmentMotion className="yt-segs yt-fseg" aria-label="Lọc theo võ sĩ" data-shot="filters">
            <Link href={q()} aria-current={!current ? "page" : undefined}>
                Tất cả võ sĩ
            </Link>
            {fighters.map((f) => (
                <Link key={f.id} href={q(f.id)} aria-current={current === f.id ? "page" : undefined}>
                    {f.name}
                </Link>
            ))}
        </SegmentMotion>
    );
}

/** Thông báo một lần sau khi lưu (tham số `?saved=`), thay cho toast tiếng Anh cũ. */
export function Flash({ text, tone }: { text: string | null; tone?: "red" }) {
    if (!text) return null;
    return (
        <p className="yt-flash" role="status" data-tone={tone}>
            {text}
        </p>
    );
}
