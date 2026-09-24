import { Activity, ArrowDownRight, ArrowRight, HeartPulse, ScanLine } from "lucide-react";
import Link from "next/link";

import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { FighterExperience } from "./fighter-experience";
import { LandingHeader } from "./landing-header";

const PILLARS = [
    { icon: ScanLine, index: "01", title: "AI-assisted analysis", text: "Technique signals distilled into the next action." },
    { icon: Activity, index: "02", title: "Training that adapts", text: "Plans, sessions and progress in one rhythm." },
    { icon: HeartPulse, index: "03", title: "Fight-ready health", text: "Recovery and clearance beside performance." },
];

export function LandingPage({ primaryHref, primaryLabel }: { primaryHref: string; primaryLabel: string }) {
    return (
        <div className="landing-shell min-h-dvh overflow-x-clip bg-nav-bg text-white">
            <div aria-hidden className="landing-grid fixed inset-0" />
            <LandingHeader primaryHref={primaryHref} primaryLabel={primaryLabel} />

            <main>
                <section className="relative mx-auto grid min-h-[calc(100svh-84px)] w-full max-w-[90rem] items-center px-5 pb-10 sm:px-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(34rem,1.12fr)] lg:px-12">
                    <div className="pointer-events-none relative z-20 max-w-2xl pb-[25rem] pt-16 sm:pb-[30rem] lg:pb-20 lg:pt-10">
                        <div className="mb-7 flex items-center gap-3 text-[11px] font-semibold tracking-[0.22em] text-nav-accent uppercase">
                            <span className="h-px w-8 bg-nav-accent" />
                            MMA performance intelligence
                        </div>
                        <h1 className="max-w-[12ch] text-[clamp(3.25rem,8vw,7.4rem)] leading-[0.84] font-semibold tracking-[-0.07em] text-balance">
                            Train harder.
                            <span className="block text-nav-fg">Recover smarter.</span>
                            <span className="landing-gradient-text block">Fight cleared.</span>
                        </h1>
                        <p className="mt-7 max-w-lg text-base leading-7 text-nav-fg sm:text-lg">
                            One focused corner for technique, training and athlete health—built for every decision before fight night.
                        </p>
                        <div className="pointer-events-auto mt-9 flex flex-wrap items-center gap-3">
                            <ButtonLink href={primaryHref} size="lg" className="landing-primary-action rounded-none px-6 shadow-none">
                                {primaryLabel}
                                <ArrowRight aria-hidden />
                            </ButtonLink>
                            <Link
                                href="#system"
                                className={buttonClasses({
                                    variant: "ghost",
                                    size: "lg",
                                    className: "text-nav-fg hover:bg-white/8 hover:text-white",
                                })}
                            >
                                Explore the system
                                <ArrowDownRight aria-hidden />
                            </Link>
                        </div>
                        <p className="mt-8 hidden items-center gap-2 text-xs text-nav-fg/65 lg:flex">
                            <span className="inline-block size-1.5 rounded-full bg-success-solid shadow-[0_0_12px_var(--success-solid)]" />
                            Swipe or click the fighter. Your scroll stays yours.
                        </p>
                    </div>

                    <FighterExperience />
                </section>

                <section id="system" aria-labelledby="system-title" className="relative z-20 scroll-mt-6 border-y border-white/10 bg-nav-surface/65 backdrop-blur-xl">
                    <div className="mx-auto grid max-w-[90rem] lg:grid-cols-[0.7fr_repeat(3,1fr)]">
                        <div className="flex items-center border-b border-white/10 px-5 py-8 sm:px-8 lg:border-r lg:border-b-0 lg:px-12">
                            <div>
                                <p className="text-[11px] font-semibold tracking-[0.2em] text-nav-accent uppercase">One connected corner</p>
                                <h2 id="system-title" className="mt-2 text-xl font-semibold tracking-tight text-white">
                                    Less noise. Better calls.
                                </h2>
                            </div>
                        </div>
                        {PILLARS.map(({ icon: Icon, index, title, text }) => (
                            <article key={title} className="group border-b border-white/10 px-5 py-8 last:border-b-0 sm:px-8 lg:border-r lg:border-b-0 lg:last:border-r-0">
                                <div className="flex items-center justify-between">
                                    <Icon aria-hidden className="size-5 text-nav-accent transition-transform group-hover:-translate-y-0.5" />
                                    <span className="font-mono text-[10px] text-nav-fg/45">{index}</span>
                                </div>
                                <h3 className="mt-8 text-base font-semibold text-white">{title}</h3>
                                <p className="mt-2 max-w-[28ch] text-sm leading-6 text-nav-fg">{text}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="relative z-20 px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
                    <div className="landing-octagon-panel mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 border border-white/10 bg-white/[0.035] p-8 sm:p-12 lg:flex-row lg:items-end">
                        <div>
                            <p className="text-[11px] font-semibold tracking-[0.2em] text-nav-accent uppercase">Step into the corner</p>
                            <h2 className="mt-3 max-w-xl text-3xl leading-tight font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
                                Every signal. One clear decision.
                            </h2>
                        </div>
                        <ButtonLink href={primaryHref} size="lg" className="landing-primary-action rounded-none px-6 shadow-none">
                            {primaryLabel}
                            <ArrowRight aria-hidden />
                        </ButtonLink>
                    </div>
                </section>
            </main>

            <footer className="relative z-20 mx-auto flex max-w-[90rem] items-center justify-between border-t border-white/10 px-5 py-6 text-xs text-nav-fg/55 sm:px-8 lg:px-12">
                <span>MMA-TMS</span>
                <span>Training · Performance · Health</span>
            </footer>
        </div>
    );
}
