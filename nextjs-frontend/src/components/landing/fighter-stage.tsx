"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Component, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";

import { cn } from "@/lib/utils";
import { SAMPLE_SCORES } from "./landing-data";
import { FIGHTER_IMAGE, LEFT_KNEE_ANGLE } from "./pose-skeleton";
import type { LabelId, LabelRegistry } from "./stage/world";
import type { StoryState } from "./story";

const FighterScene = dynamic(() => import("./fighter-scene"), { ssr: false });

interface FighterStageProps {
    story: RefObject<StoryState>;
    labels: RefObject<LabelRegistry>;
    compact: boolean;
    animate: boolean;
    ready: boolean;
    onReady: () => void;
}

/**
 * The fixed stage behind the whole page. Shows the fighter cutout as a poster until WebGL is ready
 * (or for good, without WebGL), then the live octagon. Decorative: hidden from assistive tech.
 */
export function FighterStage({ story, labels, compact, animate, ready, onReady }: FighterStageProps) {
    const webgl = useSyncExternalStore(subscribeNever, supportsWebGL, () => null);
    const [failed, setFailed] = useState(false);
    const live = webgl === true && !failed;

    const register = (id: LabelId) => (element: HTMLElement | null) => {
        const registry = labels.current;
        if (!element) return;
        registry.set(id, element);
        return () => {
            registry.delete(id);
        };
    };

    return (
        <div aria-hidden className="landing-stage pointer-events-none fixed inset-0 z-0 overflow-hidden bg-landing-ink">
            <div className={cn("absolute inset-0 transition-opacity duration-[1400ms]", live && ready ? "opacity-0" : "opacity-100")}>
                <div className="landing-poster-glow absolute inset-0" />
                <Image
                    src={FIGHTER_IMAGE.url}
                    alt=""
                    width={FIGHTER_IMAGE.width}
                    height={FIGHTER_IMAGE.height}
                    priority
                    data-testid="fighter-poster"
                    className="absolute bottom-0 left-1/2 h-[88svh] w-auto max-w-none -translate-x-1/2 object-contain lg:left-[64%]"
                />
            </div>
            {live && (
                <SceneBoundary onError={() => setFailed(true)}>
                    <div className={cn("absolute inset-0 transition-opacity duration-[1400ms]", ready ? "opacity-100" : "opacity-0")}>
                        <FighterScene story={story} labels={labels} compact={compact} animate={animate} onReady={onReady} />
                    </div>
                </SceneBoundary>
            )}
            {live && (
                // On narrow screens the copy covers the stage, and the panels already say what the labels would.
                <div className="absolute inset-0 max-lg:hidden">
                    <span ref={register("knee")} className="landing-label landing-label-ai">
                        Left knee <b>{LEFT_KNEE_ANGLE}°</b>
                    </span>
                    <span ref={register("focus")} className="landing-label landing-label-alert">
                        AI observation · <b>Left knee</b>
                    </span>
                    {SAMPLE_SCORES.map(({ technique, score }, index) => (
                        <span key={technique} ref={register(`bar-${index}`)} className="landing-label landing-label-bar">
                            {technique} <b>{score}</b>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

let webglSupport: boolean | undefined;

function supportsWebGL(): boolean {
    if (webglSupport === undefined) {
        try {
            const probe = document.createElement("canvas");
            const context = probe.getContext("webgl2");
            webglSupport = context !== null;
            context?.getExtension("WEBGL_lose_context")?.loseContext();
        } catch {
            webglSupport = false;
        }
    }
    return webglSupport;
}

function subscribeNever() {
    return () => {};
}

/** Keeps the poster up if WebGL fails after detection (lost context, driver errors). */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch() {
        this.props.onError();
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}
