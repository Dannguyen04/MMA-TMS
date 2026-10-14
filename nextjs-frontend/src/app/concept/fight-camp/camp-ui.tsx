import type { Dispatch, ReactNode } from "react";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import type { Action, CampState, Role } from "./camp-state";
import s from "./prototype.module.css";
import d from "./workspace.module.css";

export type WorkspaceProps = { state: CampState; dispatch: Dispatch<Action>; role: Role };
export function Pill({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "amber" | "neutral" }) {
    return <span className={`${s.badge} ${s[tone]}`}>{children}</span>;
}
export function Panel({ title, eyebrow, children, action }: { title: string; eyebrow?: string; children: ReactNode; action?: ReactNode }) {
    return <section className={s.card}><div className={s.cardHeading}><div>{eyebrow && <span className={s.eyebrow}>{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>{children}</section>;
}
export function Effect({ children }: { children: ReactNode }) {
    return <div className={s.resultPreview}><Check size={18} /><div><strong>Sau thao tác này</strong><p>{children}</p></div></div>;
}
export function Hint({ children }: { children: ReactNode }) {
    return <div className={s.infoBox}><ShieldCheck size={18} /><p>{children}</p></div>;
}
export function ArrowLabel({ children }: { children: ReactNode }) { return <>{children}<ArrowRight size={15} /></>; }
export function Empty({ children }: { children: ReactNode }) { return <p className={d.empty}>{children}</p>; }
export function dateLabel(date: string) { return date ? date.split("-").reverse().join("/") : "Chưa hẹn"; }
