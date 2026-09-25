import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";

import { PIPELINE_STAGES } from "./landing-data";
import type { ChapterId, StoryState } from "./story";

/**
 * Scroll choreography for the landing tour. Runs inside a GSAP context (useGSAP), so every tween,
 * ScrollTrigger and SplitText it creates is reverted on unmount. With reduced motion nothing is
 * pinned, scrubbed or smoothed: content is simply there, and the stage stays on the hero.
 */

export const WIDE_QUERY = "(min-width: 1024px)";
const MOTION_QUERY = "(prefers-reduced-motion: no-preference)";

export function setupLandingMotion(root: HTMLElement, story: StoryState): void {
    const mm = gsap.matchMedia();
    mm.add({ motion: MOTION_QUERY, wide: WIDE_QUERY }, (context) => {
        const { motion, wide } = context.conditions as { motion: boolean; wide: boolean };
        if (!motion) {
            story.intro = 1;
            story.position = 0;
            return;
        }
        root.dataset.motion = wide ? "wide" : "compact";

        const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95 });
        lenis.on("scroll", ScrollTrigger.update);
        const raf = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);

        // Absolute page offset, measured from the real scroll position: Lenis's own can lag behind a
        // native jump, and would then aim at the wrong place.
        const offsetOf = (target: Element) => Math.round(target.getBoundingClientRect().top + window.scrollY);

        // In-page links glide through the pinned chapters instead of jumping.
        const onClick = (event: MouseEvent) => {
            const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
            const target = link ? document.getElementById(link.hash.slice(1)) : null;
            if (!target) return;
            event.preventDefault();
            lenis.scrollTo(offsetOf(target), { duration: 1.8 });
        };
        root.addEventListener("click", onClick);

        const pointerX = gsap.quickTo(story.pointer, "x", { duration: 1.1, ease: "power3" });
        const pointerY = gsap.quickTo(story.pointer, "y", { duration: 1.1, ease: "power3" });
        const onPointer = (event: PointerEvent) => {
            if (event.pointerType !== "mouse") return;
            pointerX((event.clientX / window.innerWidth) * 2 - 1);
            pointerY(1 - (event.clientY / window.innerHeight) * 2);
        };
        window.addEventListener("pointermove", onPointer, { passive: true });

        setupChrome(root);
        setupHero(root);
        setupTitles(root);

        const sections = gsap.utils.toArray<HTMLElement>("[data-chapter]", root);
        const transitions = sections.map(() => 0);
        const sync = () => {
            story.position = transitions.reduce((sum, value) => sum + value, 0);
        };
        // Create triggers in page order so each pin's spacing is known to the triggers after it.
        sections.forEach((section, index) => {
            if (index > 0) {
                ScrollTrigger.create({
                    trigger: section,
                    start: "top bottom",
                    end: "top top",
                    onUpdate: (self) => {
                        transitions[index] = self.progress;
                        sync();
                    },
                    onRefresh: (self) => {
                        transitions[index] = self.progress;
                        sync();
                    },
                });
            }
            const id = section.dataset.chapter as ChapterId;
            const local = (progress: number) => {
                story.local[id] = progress;
            };
            CHAPTER_SETUP[id]?.(section, { wide, local });
        });

        setupHud(root);
        setupReveals(root);

        // A chapter link used before this ran (or a deep link) jumped to where the chapter sat
        // before pinning added scroll length; take the reader to where it is now.
        // Fonts and images still reflow the page after this, so follow every refresh until the reader scrolls.
        const jumpToHash = () => {
            const target = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
            if (target?.closest("[data-chapter]")) lenis.scrollTo(offsetOf(target), { immediate: true, force: true });
        };
        const release = () => {
            ScrollTrigger.removeEventListener("refresh", jumpToHash);
            for (const type of ["wheel", "touchstart", "keydown"]) window.removeEventListener(type, release);
        };
        ScrollTrigger.addEventListener("refresh", jumpToHash);
        for (const type of ["wheel", "touchstart", "keydown"]) window.addEventListener(type, release, { passive: true });
        ScrollTrigger.refresh();
        window.addEventListener("hashchange", jumpToHash);

        return () => {
            delete root.dataset.motion;
            release();
            window.removeEventListener("hashchange", jumpToHash);
            root.removeEventListener("click", onClick);
            window.removeEventListener("pointermove", onPointer);
            gsap.ticker.remove(raf);
            lenis.destroy();
        };
    });
}

/** Camera and light intro once the 3D stage has loaded. */
export function playStageIntro(story: StoryState, reducedMotion: boolean): void {
    if (reducedMotion) {
        story.intro = 1;
        return;
    }
    gsap.fromTo(story, { intro: 0 }, { intro: 1, duration: 3.4, ease: "none" });
}

interface ChapterOptions {
    wide: boolean;
    local: (progress: number) => void;
}

const CHAPTER_SETUP: Partial<Record<ChapterId, (section: HTMLElement, options: ChapterOptions) => void>> = {
    analysis: setupAnalysis,
    training: setupTraining,
    performance: setupPerformance,
    medicine: setupMedicine,
    roles: setupRoles,
};

/** A scrubbed timeline 0–1 long: pinned for `length` of scroll on wide screens, played across the section otherwise. */
function chapterTimeline(section: HTMLElement, { wide, local }: ChapterOptions, length: string | (() => string)) {
    const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: wide
            ? { trigger: section, start: "top top", end: length, pin: true, scrub: 0.7, invalidateOnRefresh: true, onUpdate: (self) => local(self.progress) }
            : { trigger: section, start: "top 70%", end: "bottom 60%", scrub: 0.7, onUpdate: (self) => local(self.progress) },
    });
    timeline.set({}, {}, 1);
    return timeline;
}

function setupAnalysis(section: HTMLElement, options: ChapterOptions) {
    const stages = gsap.utils.toArray<HTMLElement>("[data-analysis-stage]", section);
    const percent = section.querySelector<HTMLElement>("[data-analysis-percent]");
    const pipeline = section.querySelector("[data-analysis-pipeline]");
    const results = section.querySelector("[data-analysis-results]");
    const step = 0.48 / PIPELINE_STAGES.length;

    const timeline = chapterTimeline(section, options, "+=240%");
    timeline.fromTo("[data-analysis-bar]", { scaleX: 0 }, { scaleX: 1, duration: 0.48 }, 0.02);
    timeline.eventCallback("onUpdate", () => {
        const progress = timeline.progress();
        const done = Math.min(1, Math.max(0, (progress - 0.02) / 0.48));
        if (percent) percent.textContent = String(Math.round(done * 100));
        stages.forEach((item, index) => {
            const start = 0.02 + index * step;
            const state = progress >= start + step ? "done" : progress >= start ? "active" : "pending";
            if (item.dataset.state !== state) item.dataset.state = state;
        });
    });
    if (options.wide) {
        timeline.to(pipeline, { autoAlpha: 0, y: -40, scale: 0.96, duration: 0.08 }, 0.54);
        timeline.fromTo(results, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.08 }, 0.58);
    }
    countUp(timeline, section.querySelectorAll("[data-analysis-results] [data-count-to]"), 0.6, 0.12);
    timeline.from(gsap.utils.toArray("[data-analysis-metric]", section), { autoAlpha: 0, y: 24, stagger: 0.02, duration: 0.06 }, 0.6);
    timeline.from(gsap.utils.toArray("[data-analysis-finding]", section), { autoAlpha: 0, x: 60, stagger: 0.05, duration: 0.08 }, 0.68);
    timeline.from("[data-analysis-review]", { autoAlpha: 0, y: 16, duration: 0.06 }, 0.88);
}

function setupTraining(section: HTMLElement, options: ChapterOptions) {
    const track = section.querySelector<HTMLElement>("[data-training-track]");
    const distance = () => (track ? Math.max(0, track.scrollWidth - (track.parentElement?.clientWidth ?? window.innerWidth)) : 0);
    const timeline = chapterTimeline(section, options, () => `+=${Math.round(distance() + window.innerHeight * 0.9)}`);
    timeline.from("[data-training-session]", { autoAlpha: 0, x: 80, duration: 0.14 }, 0.02);
    if (track) timeline.to(track, { x: () => -distance(), duration: 0.85 }, 0.1);
    timeline.from(gsap.utils.toArray("[data-training-phase]", section), { autoAlpha: 0.25, scale: 0.94, stagger: 0.12, duration: 0.2 }, 0.05);
}

function setupPerformance(section: HTMLElement, options: ChapterOptions) {
    const timeline = chapterTimeline(section, options, "+=190%");
    countUp(timeline, section.querySelectorAll("[data-count-to]"), 0.05, 0.5);
    timeline.fromTo("[data-trend-line]", { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45 }, 0.22);
    timeline.from("[data-trend-area]", { autoAlpha: 0, duration: 0.3 }, 0.4);
    timeline.from(gsap.utils.toArray("[data-trend-dot]", section), { scale: 0, transformOrigin: "50% 50%", stagger: 0.05, duration: 0.05 }, 0.22);
    timeline.from(gsap.utils.toArray("[data-goal-bar]", section), { scaleX: 0, stagger: 0.06, duration: 0.2 }, 0.58);
}

function setupMedicine(section: HTMLElement, options: ChapterOptions) {
    const steps = gsap.utils.toArray<HTMLElement>("[data-clearance-step]", section);
    const timeline = chapterTimeline(section, options, "+=190%");
    timeline.from("[data-medicine-observation]", { autoAlpha: 0, x: 60, duration: 0.1 }, 0.12);
    for (const value of gsap.utils.toArray<HTMLElement>("[data-recovery-value]", section)) {
        const state = { value: Number(value.dataset.from) };
        timeline.to(state, { value: Number(value.dataset.to), duration: 0.5, onUpdate: () => (value.textContent = String(Math.round(state.value))) }, 0.3);
    }
    for (const bar of gsap.utils.toArray<HTMLElement>("[data-recovery-bar]", section)) {
        timeline.fromTo(bar, { scaleX: Number(bar.dataset.from) }, { scaleX: Number(bar.dataset.to), duration: 0.5 }, 0.3);
    }
    timeline.eventCallback("onUpdate", () => {
        const progress = timeline.progress();
        const active = progress < 0.42 ? 0 : progress < 0.74 ? 1 : 2;
        steps.forEach((item, index) => {
            const next = String(index === active);
            if (item.dataset.active !== next) item.dataset.active = next;
        });
    });
}

function setupRoles(section: HTMLElement, { local }: ChapterOptions) {
    ScrollTrigger.create({ trigger: section, start: "top bottom", end: "bottom top", onUpdate: (self) => local(self.progress) });
    gsap.from(gsap.utils.toArray("[data-role-card]", section), {
        autoAlpha: 0,
        y: 70,
        rotateX: -25,
        transformPerspective: 900,
        stagger: 0.1,
        duration: 1.1,
        ease: "expo.out",
        scrollTrigger: { trigger: section, start: "top 55%" },
    });
}

/** Header glass once the page moves, and the thin progress bar along the top. */
function setupChrome(root: HTMLElement) {
    const header = root.querySelector<HTMLElement>("[data-landing-header]");
    ScrollTrigger.create({ start: 40, end: "max", onToggle: (self) => header?.toggleAttribute("data-scrolled", self.isActive) });
    gsap.to(root.querySelector("[data-scroll-progress]"), { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });
}

/** Hero copy slides in on load and drifts away as the tour begins. */
function setupHero(root: HTMLElement) {
    const lines = gsap.utils.toArray<HTMLElement>("[data-hero-line]", root);
    const intro = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.25 });
    intro.from(lines, { yPercent: 110, duration: 1.4, stagger: 0.12 });
    intro.from("[data-hero-copy] [data-reveal]", { autoAlpha: 0, y: 12, duration: 1 }, 0);
    intro.from("[data-hero-sub]", { autoAlpha: 0, y: 24, duration: 1.2 }, 0.45);
    intro.from("[data-hero-actions] > *", { autoAlpha: 0, y: 24, stagger: 0.08, duration: 1.2 }, 0.6);
    intro.from("[data-landing-header]", { autoAlpha: 0, y: -20, duration: 1.2 }, 0.4);
    intro.from("[data-scroll-cue]", { autoAlpha: 0, duration: 1.2 }, 1.4);

    const hero = root.querySelector("[data-chapter='hero']");
    gsap.to("[data-hero-copy]", { yPercent: -18, autoAlpha: 0, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "65% top", scrub: true } });
    gsap.to("[data-scroll-cue]", { autoAlpha: 0, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "15% top", scrub: true } });
}

/** Chapter headings rise line by line out of a mask as they enter. */
function setupTitles(root: HTMLElement) {
    for (const title of gsap.utils.toArray<HTMLElement>("[data-split]", root)) {
        SplitText.create(title, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            onSplit: (self) =>
                gsap.from(self.lines, { yPercent: 105, duration: 1.2, ease: "expo.out", stagger: 0.09, scrollTrigger: { trigger: title, start: "top 88%" } }),
        });
    }
}

/** Remaining copy fades up in small batches. */
function setupReveals(root: HTMLElement) {
    const items = gsap.utils.toArray<HTMLElement>("[data-reveal]", root).filter((item) => !item.closest("[data-hero-copy]"));
    gsap.set(items, { autoAlpha: 0, y: 28 });
    // Active until the end of the page, so a jump past an item (restored scroll, deep link) still reveals it.
    ScrollTrigger.batch(items, {
        start: "top 90%",
        end: "max",
        once: true,
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1, ease: "expo.out", stagger: 0.08, overwrite: true }),
    });
}

/** Rail on the left: marks the chapter in view. */
function setupHud(root: HTMLElement) {
    for (const item of gsap.utils.toArray<HTMLElement>("[data-hud-item]", root)) {
        const section = root.querySelector(`[data-chapter='${item.dataset.hudItem}']`);
        if (!section) continue;
        // A pinned chapter's spacer spans the pin as well, so "bottom" is where the chapter really ends.
        const span = section.parentElement?.classList.contains("pin-spacer") ? section.parentElement : section;
        ScrollTrigger.create({ trigger: span, start: "top center", end: "bottom center", onToggle: (self) => item.toggleAttribute("data-active", self.isActive) });
    }
}

/** Counts `[data-count-to]` numbers up from zero inside a scrubbed timeline. */
function countUp(timeline: gsap.core.Timeline, elements: Iterable<Element>, at: number, duration: number) {
    for (const element of elements) {
        const target = Number((element as HTMLElement).dataset.countTo);
        const decimals = Number((element as HTMLElement).dataset.decimals ?? 0);
        const state = { value: 0 };
        timeline.to(state, { value: target, duration, ease: "power2.out", onUpdate: () => (element.textContent = state.value.toFixed(decimals)) }, at);
    }
}
