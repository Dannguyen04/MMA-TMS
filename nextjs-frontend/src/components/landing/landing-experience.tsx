"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useMediaQuery } from "@/components/account/use-media-query";
import { FighterStage } from "./fighter-stage";
import { playStageIntro, setupLandingMotion, WIDE_QUERY } from "./landing-motion";
import type { LabelRegistry } from "./stage/world";
import { initialStory, type StoryState } from "./story";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

/**
 * Client shell of the landing page: owns the scroll story shared by the motion layer and the 3D
 * stage. The page content arrives as server-rendered children.
 */
export function LandingExperience({ children }: { children: ReactNode }) {
    const root = useRef<HTMLDivElement>(null);
    const story = useRef<StoryState>(initialStory());
    const labels = useRef<LabelRegistry>(new Map());
    const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
    const wide = useMediaQuery(WIDE_QUERY);
    const compact = wide === false;
    const [stageReady, setStageReady] = useState(false);
    const onStageReady = useCallback(() => setStageReady(true), []);

    useEffect(() => {
        story.current.compact = compact;
    }, [compact]);

    useGSAP(
        () => {
            if (root.current) setupLandingMotion(root.current, story.current);
        },
        { scope: root },
    );

    useGSAP(
        () => {
            if (stageReady && reducedMotion !== null) playStageIntro(story.current, reducedMotion);
        },
        { dependencies: [stageReady, reducedMotion] },
    );

    return (
        <div ref={root} className="landing-shell relative min-h-dvh overflow-x-clip text-white">
            <FighterStage story={story} labels={labels} compact={compact} animate={reducedMotion === false} ready={stageReady} onReady={onStageReady} />
            {children}
        </div>
    );
}
