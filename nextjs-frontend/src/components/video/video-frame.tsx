"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A still from the footage (one second in) as a tile's picture. The video only loads once the tile is near the
 * viewport, and `fallback` stays on screen until a frame is decoded, or for good if the footage can't be read.
 */
export function VideoFrame({ src, fallback }: { src: string; fallback: ReactNode }) {
    const ref = useRef<HTMLSpanElement>(null);
    const [near, setNear] = useState(false);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const node = ref.current;
        // Without IntersectionObserver the tile keeps its placeholder.
        if (!node || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setNear(true);
                    observer.disconnect();
                }
            },
            { rootMargin: "200px" },
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    return (
        <span ref={ref} aria-hidden className="absolute inset-0">
            {(!ready || failed) && fallback}
            {near && !failed && (
                <video
                    src={`${src}#t=1`}
                    preload="metadata"
                    muted
                    playsInline
                    disablePictureInPicture
                    tabIndex={-1}
                    onLoadedData={() => setReady(true)}
                    onError={() => setFailed(true)}
                    className={cn("absolute inset-0 size-full object-cover transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}
                />
            )}
        </span>
    );
}
