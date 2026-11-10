import { AlertTriangle, ArrowRight, Check, Inbox, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { ClinicalRestrictions, MedicalEligibility } from "@/lib/domain/medical-contract";
import type { Vitals as VitalsData } from "@/lib/domain/types";
import type { Translator } from "@/lib/i18n/translate";
import { ELIGIBILITY_REASON, HYDRATION, JOINT, SESSION_TYPE, TECHNIQUE, num, type Tone } from "./labels";

export const reasonsText = (t: Translator, e: MedicalEligibility | null | undefined) => (e ? e.reasons.map((r) => t(ELIGIBILITY_REASON[r])) : []);

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
export function Gate({ label, e, t }: { label: string; e: MedicalEligibility | null; t: Translator }) {
    if (!e) return null;
    return (
        <span className="yt-gate" data-ok={e.eligible}>
            {e.eligible ? <Check aria-hidden /> : <X aria-hidden />}
            {label}
            <span className="sr-only">{t(e.eligible ? "doctorUi.gate.eligible" : "doctorUi.gate.notEligible")}</span>
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

export function Vitals({ v, t }: { v: VitalsData | null | undefined; t: Translator }) {
    if (!v) return <p className="yt-muted">{t("doctorUi.vitals.none")}</p>;
    const locale = t.locale ?? "vi";
    const cells: [string, string, string][] = [
        [t("doctorUi.vitals.weight"), num(v.weightKg, locale), "kg"],
        [t("doctorUi.vitals.restingHeartRate"), String(v.restingHeartRate), t("doctorUi.vitals.bpm")],
        [t("doctorUi.vitals.bloodPressure"), `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`, "mmHg"],
        [t("doctorUi.vitals.temperature"), num(v.temperatureC, locale), "°C"],
        ["SpO2", String(v.spo2Pct), "%"],
        [t("doctorUi.vitals.hydration"), t(HYDRATION[v.hydration]), ""],
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
export function Restrictions({ r, t }: { r: ClinicalRestrictions | null | undefined; t: Translator }) {
    if (!r || (!r.allowedSessionTypes?.length && !r.allowedTechniqueTypes?.length && !r.excludedJoints?.length && !r.notes)) return null;
    return (
        <div className="yt-restr">
            <ul className="yt-chips">
                {r.allowedSessionTypes?.map((s) => <li key={s}>{SESSION_TYPE[s] ? t(SESSION_TYPE[s]) : s}</li>)}
                {r.allowedTechniqueTypes?.map((k) => <li key={k}>{TECHNIQUE[k] ? t(TECHNIQUE[k]) : k}</li>)}
                {r.excludedJoints?.map((j) => (
                    <li key={j} data-tone="block">
                        {t("doctorUi.restrictions.avoid", { joint: JOINT[j] ? t(JOINT[j]).toLowerCase() : j })}
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

/** Lọc theo võ sĩ bằng liên kết (giữ các tham số khác). */
export function FighterFilter({
    base,
    fighters,
    current,
    extra = {},
    param = "fighter",
    t,
}: {
    base: string;
    fighters: { id: string; name: string }[];
    current?: string;
    extra?: Record<string, string | undefined>;
    param?: string;
    t: Translator;
}) {
    const q = (f?: string) => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
        if (f) p.set(param, f);
        const s = p.toString();
        return s ? `${base}?${s}` : base;
    };
    return (
        <nav className="yt-segs yt-fseg" aria-label={t("doctorUi.filter.byFighter")} data-shot="filters">
            <Link href={q()} aria-current={!current ? "page" : undefined}>
                {t("doctorUi.filter.allFighters")}
            </Link>
            {fighters.map((f) => (
                <Link key={f.id} href={q(f.id)} aria-current={current === f.id ? "page" : undefined}>
                    {f.name}
                </Link>
            ))}
        </nav>
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
