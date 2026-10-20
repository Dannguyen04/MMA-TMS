"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Component, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { ARENA_PLATE } from "./arena-plate";
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
 * The fixed stage behind the whole page. Shows the fighter cutout over the arena plate as a poster
 * until WebGL is ready (or for good, without WebGL), then the live octagon. The poster loads the
 * same files as the scene, so neither is downloaded twice. Decorative: hidden from assistive tech.
 */
export function FighterStage({ story, labels, compact, animate, ready, onReady }: FighterStageProps) {
    const t = useT();
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
                <Image src={ARENA_PLATE.url} alt="" fill unoptimized sizes="100vw" className="landing-poster-plate object-cover" />
                <Image
                    src={FIGHTER_IMAGE.url}
                    alt=""
                    width={FIGHTER_IMAGE.width}
                    height={FIGHTER_IMAGE.height}
                    priority
                    unoptimized
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
                        {t("landing.stage.leftKnee")} <b>{LEFT_KNEE_ANGLE}°</b>
                    </span>
                    <span ref={register("focus")} className="landing-label landing-label-alert">
                        {t("landing.stage.aiObservation")} · <b>{t("landing.stage.leftKnee")}</b>
                    </span>
                    {SAMPLE_SCORES.map(({ id, techniqueKey, score }, index) => (
                        <span key={id} ref={register(`bar-${index}`)} className="landing-label landing-label-bar">
                            {t(techniqueKey)} <b>{score}</b>
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

function subscribeNever(): () => void {
    return () => {};
}

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
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
