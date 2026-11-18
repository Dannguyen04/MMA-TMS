"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Each still streams through the web server and the API, and the API answers 500 when many reads arrive at once, so a
 * page loads at most this many stills at a time; the rest wait their turn.
 */
const MAX_LOADING = 2;
let loading = 0;
const waiting: (() => void)[] = [];

function acquire(start: () => void): () => void {
    if (loading < MAX_LOADING) {
        loading += 1;
        start();
    } else {
        waiting.push(start);
    }
    return () => {
        const index = waiting.indexOf(start);
        if (index >= 0) waiting.splice(index, 1);
    };
}

function release() {
    const next = waiting.shift();
    if (next) next();
    else loading = Math.max(0, loading - 1);
}

/**
 * A still from the footage (one second in) as a tile's picture. The video only loads once the tile is near the
 * viewport and a loading slot is free, and `fallback` stays on screen until a frame is decoded, or for good if the
 * footage can't be read.
 */
export function VideoFrame({ src, fallback }: { src: string; fallback: ReactNode }) {
    const ref = useRef<HTMLSpanElement>(null);
    const holding = useRef(false);
    const [started, setStarted] = useState(false);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);

    const finish = () => {
        if (!holding.current) return;
        holding.current = false;
        release();
    };

    useEffect(() => {
        const node = ref.current;
        // Without IntersectionObserver the tile keeps its placeholder.
        if (!node || typeof IntersectionObserver === "undefined") return;
        let cancelWait: (() => void) | null = null;
        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                observer.disconnect();
                cancelWait = acquire(() => {
                    holding.current = true;
                    setStarted(true);
                });
            },
            { rootMargin: "200px" },
        );
        observer.observe(node);
        return () => {
            observer.disconnect();
            cancelWait?.();
            if (holding.current) {
                holding.current = false;
                release();
            }
        };
    }, []);

    // A stalled stream (no frame, no error) gives its slot back after a while so the other tiles still load.
    useEffect(() => {
        if (!started) return;
        const timer = setTimeout(() => {
            if (!holding.current) return;
            holding.current = false;
            release();
        }, 15_000);
        return () => clearTimeout(timer);
    }, [started]);

    return (
        <span ref={ref} aria-hidden className="absolute inset-0">
            {(!ready || failed) && fallback}
            {started && !failed && (
                <video
                    src={`${src}#t=1`}
                    preload="metadata"
                    muted
                    playsInline
                    disablePictureInPicture
                    tabIndex={-1}
                    onLoadedData={() => {
                        setReady(true);
                        finish();
                    }}
                    onError={() => {
                        setFailed(true);
                        finish();
                    }}
                    className={cn("absolute inset-0 size-full object-cover transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}
                />
            )}
        </span>
    );
}
