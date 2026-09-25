import { ArrowDown, ArrowRight } from "lucide-react";
import Link from "next/link";

import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { AnalysisChapter } from "./chapters/analysis-chapter";
import { Kicker } from "./chapters/chapter-parts";
import { MedicineChapter } from "./chapters/medicine-chapter";
import { PerformanceChapter } from "./chapters/performance-chapter";
import { RolesChapter } from "./chapters/roles-chapter";
import { TrainingChapter } from "./chapters/training-chapter";
import { CHAPTER_NAV } from "./landing-data";
import { LandingExperience } from "./landing-experience";
import { LandingHeader } from "./landing-header";

/**
 * Public landing page: a scroll tour over a fixed 3D stage. Everything readable is plain HTML
 * rendered on the server; the client layer only adds motion and the WebGL stage.
 */
export function LandingPage({ primaryHref, primaryLabel }: { primaryHref: string; primaryLabel: string }) {
    return (
        <LandingExperience>
            <div aria-hidden data-scroll-progress className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-brand-red via-landing-cyan to-brand-blue" />
            <LandingHeader primaryHref={primaryHref} primaryLabel={primaryLabel} />
            <nav aria-label="Tour chapters" className="landing-hud fixed top-1/2 left-6 z-30 hidden -translate-y-1/2 xl:block">
                <ol className="space-y-3">
                    {CHAPTER_NAV.map((chapter) => (
                        <li key={chapter.id}>
                            <a href={`#${chapter.id}`} data-hud-item={chapter.id} className="landing-hud-item group flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] uppercase">
                                <span aria-hidden className="landing-hud-line" />
                                <span className="landing-hud-index">{chapter.index}</span>
                                <span className="landing-hud-label">{chapter.label}</span>
                            </a>
                        </li>
                    ))}
                </ol>
            </nav>

            <main>
                <section id="hero" data-chapter="hero" aria-labelledby="landing-title" className="landing-chapter">
                    <div aria-hidden className="landing-hero-scrim pointer-events-none absolute inset-0" />
                    <div className="landing-chapter-inner max-lg:items-start">
                        <div data-hero-copy className="landing-hero-copy relative z-10 max-w-[54rem] pt-2 pb-[44svh] lg:py-0">
                            <Kicker className="text-nav-accent">MMA performance intelligence</Kicker>
                            <h1 id="landing-title" data-hero-title className="mt-7 text-[clamp(2.6rem,7vw,6.3rem)] leading-[0.9] font-semibold tracking-[-0.06em] text-white">
                                <span className="landing-line-mask">
                                    <span data-hero-line className="block">
                                        Train harder.
                                    </span>
                                </span>
                                <span className="landing-line-mask">
                                    <span data-hero-line className="block text-nav-fg">
                                        Recover smarter.
                                    </span>
                                </span>
                                <span className="landing-line-mask">
                                    <span data-hero-line className="landing-gradient-text block">
                                        Fight cleared.
                                    </span>
                                </span>
                            </h1>
                            <p data-hero-sub className="mt-7 max-w-lg text-base leading-7 text-nav-fg sm:text-lg">
                                Technique, training and athlete health in one corner: AI-assisted, coach-reviewed, doctor-cleared.
                            </p>
                            <div data-hero-actions className="mt-9 flex flex-wrap items-center gap-3">
                                <ButtonLink href={primaryHref} size="lg" className="landing-primary-action rounded-none px-6 shadow-none">
                                    {primaryLabel}
                                    <ArrowRight aria-hidden />
                                </ButtonLink>
                                <Link href="#analysis" className={buttonClasses({ variant: "ghost", size: "lg", className: "text-nav-fg hover:bg-white/8 hover:text-white" })}>
                                    Take the tour
                                    <ArrowDown aria-hidden />
                                </Link>
                            </div>
                        </div>
                        <a
                            href="#analysis"
                            data-scroll-cue
                            className="absolute bottom-8 left-[6.5rem] z-10 hidden items-center gap-3 font-mono text-[10px] tracking-[0.24em] text-nav-fg/70 uppercase hover:text-white lg:flex"
                        >
                            Scroll to enter the octagon
                            <span aria-hidden className="landing-scroll-cue" />
                        </a>
                    </div>
                </section>

                <AnalysisChapter />
                <TrainingChapter />
                <PerformanceChapter />
                <MedicineChapter />
                <RolesChapter />

                <section id="cta" data-chapter="cta" aria-labelledby="cta-title" className="landing-chapter">
                    <div className="landing-chapter-inner lg:justify-end">
                        <div className="w-full max-w-xl">
                            <Kicker index="06">Fight night starts here</Kicker>
                            <h2 id="cta-title" data-split className="mt-4 text-[clamp(2.6rem,6vw,5.4rem)] leading-[0.9] font-semibold tracking-[-0.055em] text-balance text-white">
                                Every signal. One clear decision.
                            </h2>
                            <p data-reveal className="mt-6 max-w-md text-[15px] leading-7 text-nav-fg">
                                Footage, training, scores and clearance, reviewed by the people responsible for them.
                            </p>
                            <div data-reveal className="mt-9">
                                <ButtonLink href={primaryHref} size="lg" className="landing-primary-action rounded-none px-6 shadow-none">
                                    {primaryLabel}
                                    <ArrowRight aria-hidden />
                                </ButtonLink>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="relative z-20 border-t border-white/10 bg-landing-ink/80 backdrop-blur-xl">
                <div className="mx-auto flex max-w-[90rem] flex-col gap-2 px-5 py-6 text-xs text-nav-fg/70 sm:flex-row sm:justify-between sm:px-8 lg:px-12">
                    <span>MMA-TMS · Training · Performance · Health</span>
                    <span>Medical data is only visible to assigned sports doctors.</span>
                </div>
            </footer>
        </LandingExperience>
    );
}
