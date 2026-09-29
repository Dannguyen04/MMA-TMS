import { ShieldCheck } from "lucide-react";

import { ROLES } from "../landing-data";
import { ChapterTitle, Kicker, Panel } from "./chapter-parts";

/** 05 — Roles. The camera pulls back to the whole octagon, lit by one beam per role. */
export function RolesChapter() {
    return (
        <section id="roles" data-chapter="roles" aria-labelledby="roles-title" className="landing-chapter">
            <div className="landing-chapter-inner flex-col items-stretch justify-between gap-10 lg:py-24">
                <div className="mx-auto max-w-2xl text-center">
                    <Kicker index="05" className="justify-center">
                        Roles
                    </Kicker>
                    <ChapterTitle id="roles-title">One corner. Four roles.</ChapterTitle>
                    <p data-reveal className="mx-auto mt-5 max-w-lg text-[15px] leading-7 text-nav-fg">
                        Each role opens its own dashboard with only what that role should see.
                    </p>
                </div>
                <div>
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {ROLES.map((role) => (
                            <li key={role.role} data-role-card>
                                <Panel className="h-full p-5">
                                    <span aria-hidden className="block h-1 w-10 rounded-full" style={{ backgroundColor: role.color, boxShadow: `0 0 18px ${role.color}` }} />
                                    <p className="mt-5 text-lg font-semibold text-white">{role.role}</p>
                                    <p className="mt-1.5 text-[13px] leading-5 text-nav-fg">{role.text}</p>
                                </Panel>
                            </li>
                        ))}
                    </ul>
                    <p data-reveal className="mt-6 flex items-center justify-center gap-2 text-[13px] text-nav-fg">
                        <ShieldCheck aria-hidden className="size-4 text-landing-success" />
                        Medical data is only visible to assigned sports doctors.
                    </p>
                </div>
            </div>
        </section>
    );
}
