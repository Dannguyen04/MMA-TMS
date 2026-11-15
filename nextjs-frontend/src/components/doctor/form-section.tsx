import type { ReactNode } from "react";

/** A form shown as its own section of a fighter's profile, under the profile header and tabs. */
export function FormSection({ title, description, meta, children }: { title: string; description?: string; meta?: ReactNode; children: ReactNode }) {
    return (
        <section className="hs-form" aria-labelledby="hs-form-title">
            <header className="hs-form-head">
                <h2 id="hs-form-title">{title}</h2>
                {description && <p>{description}</p>}
                {meta}
            </header>
            {children}
        </section>
    );
}
