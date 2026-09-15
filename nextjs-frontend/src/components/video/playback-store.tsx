"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

import { clamp } from "@/lib/utils";

/**
 * Shared playhead for the analysis workspace. The player, timeline and panels read it through
 * selectors, so 60 fps playback only re-renders what actually changes.
 */

export type PlaybackRate = 0.25 | 0.5 | 1;

export const PLAYBACK_RATES: PlaybackRate[] = [0.25, 0.5, 1];

export interface PlaybackSnapshot {
    timeMs: number;
    playing: boolean;
    rate: PlaybackRate;
    durationMs: number;
}

export interface PlaybackStore {
    getSnapshot(): PlaybackSnapshot;
    subscribe(listener: () => void): () => void;
    /** Called only for explicit seeks (not clock ticks), so a <video> element can follow. */
    subscribeSeek(listener: (timeMs: number) => void): () => void;
    seek(timeMs: number): void;
    /** Clock update from playback; does not notify seek listeners. */
    tick(timeMs: number): void;
    play(): void;
    pause(): void;
    toggle(): void;
    setRate(rate: PlaybackRate): void;
}

export function createPlaybackStore(durationMs: number, initialMs = 0): PlaybackStore {
    let snapshot: PlaybackSnapshot = { timeMs: clamp(initialMs, 0, durationMs), playing: false, rate: 1, durationMs };
    const listeners = new Set<() => void>();
    const seekListeners = new Set<(timeMs: number) => void>();

    const set = (patch: Partial<PlaybackSnapshot>) => {
        snapshot = { ...snapshot, ...patch };
        listeners.forEach((listener) => listener());
    };

    const play = () => {
        if (snapshot.timeMs >= durationMs) {
            set({ timeMs: 0, playing: true });
            seekListeners.forEach((listener) => listener(0));
        } else set({ playing: true });
    };

    return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        subscribeSeek(listener) {
            seekListeners.add(listener);
            return () => seekListeners.delete(listener);
        },
        seek(timeMs) {
            const next = clamp(timeMs, 0, durationMs);
            set({ timeMs: next });
            seekListeners.forEach((listener) => listener(next));
        },
        tick(timeMs) {
            const next = clamp(timeMs, 0, durationMs);
            if (next >= durationMs) set({ timeMs: next, playing: false });
            else if (next !== snapshot.timeMs) set({ timeMs: next });
        },
        play,
        pause: () => set({ playing: false }),
        toggle: () => (snapshot.playing ? set({ playing: false }) : play()),
        setRate: (rate) => set({ rate }),
    };
}

const PlaybackContext = createContext<PlaybackStore | null>(null);

export function PlaybackProvider({ store, children }: { store: PlaybackStore; children: ReactNode }) {
    return <PlaybackContext.Provider value={store}>{children}</PlaybackContext.Provider>;
}

export function usePlaybackStore(): PlaybackStore {
    const store = useContext(PlaybackContext);
    if (!store) throw new Error("usePlaybackStore must be used inside <PlaybackProvider>.");
    return store;
}

/** Subscribes to a derived value of the playhead. Return primitives so unchanged values skip renders. */
export function usePlayback<T>(selector: (snapshot: PlaybackSnapshot) => T): T {
    const store = usePlaybackStore();
    const get = () => selector(store.getSnapshot());
    return useSyncExternalStore(store.subscribe, get, get);
}
