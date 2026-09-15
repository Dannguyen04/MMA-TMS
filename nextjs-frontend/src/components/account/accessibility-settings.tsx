import { Fragment } from "react";

import { ReducedMotionStatus } from "./reduced-motion-status";

const PLAYER_SHORTCUTS: { keys: string[][]; action: string }[] = [
    { keys: [["Space"]], action: "Play or pause" },
    { keys: [["←"], ["→"]], action: "Step back or forward one frame" },
    { keys: [["Shift", "←"], ["Shift", "→"]], action: "Jump back or forward one second" },
    { keys: [["["], ["]"]], action: "Previous or next AI detection" },
];

const KEY_NAMES: Record<string, string> = { "←": "Left arrow", "→": "Right arrow", "[": "Left square bracket", "]": "Right square bracket" };

function Kbd({ children }: { children: string }) {
    return (
        <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border-strong bg-surface px-1.5 font-mono text-xs font-medium text-fg shadow-card">
            <span aria-hidden>{children}</span>
            <span className="sr-only">{KEY_NAMES[children] ?? children}</span>
        </kbd>
    );
}

/** Reduced-motion status (follows the OS) and the video player keyboard reference. */
export function AccessibilitySettings() {
    return (
        <div className="flex flex-col divide-y divide-border">
            <section aria-labelledby="a11y-motion" className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0">
                    <h3 id="a11y-motion" className="text-sm font-medium text-fg">
                        Reduce motion
                    </h3>
                    <p className="mt-1 max-w-2xl text-[13px] text-pretty text-fg-muted">
                        Follows your operating system. When it&apos;s on, animations, progress transitions and chart effects are kept to a
                        minimum. Change it in your device settings — on Windows under Accessibility › Visual effects › Animation effects, on macOS
                        and iOS under Accessibility › Motion.
                    </p>
                </div>
                <div className="shrink-0">
                    <ReducedMotionStatus />
                </div>
            </section>
            <section aria-labelledby="a11y-shortcuts" className="pt-5">
                <h3 id="a11y-shortcuts" className="text-sm font-medium text-fg">
                    Video player keyboard shortcuts
                </h3>
                <p className="mt-1 text-[13px] text-fg-muted">Work while the video player has focus — click the video or Tab to it first.</p>
                <dl className="mt-3 grid grid-cols-1 overflow-hidden rounded-lg border border-border sm:grid-cols-2">
                    {PLAYER_SHORTCUTS.map((shortcut) => (
                        <div
                            key={shortcut.action}
                            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0 sm:odd:border-r"
                        >
                            <dt className="min-w-40 flex-1 text-[13px] text-fg">{shortcut.action}</dt>
                            <dd className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-fg-subtle">
                                {shortcut.keys.map((combo, comboIndex) => (
                                    <Fragment key={combo.join("+")}>
                                        {comboIndex > 0 && (
                                            <>
                                                <span aria-hidden>/</span>
                                                <span className="sr-only">or</span>
                                            </>
                                        )}
                                        <span className="inline-flex items-center gap-1">
                                            {combo.map((key, keyIndex) => (
                                                <Fragment key={key}>
                                                    {keyIndex > 0 && <span aria-hidden>+</span>}
                                                    <Kbd>{key}</Kbd>
                                                </Fragment>
                                            ))}
                                        </span>
                                    </Fragment>
                                ))}
                            </dd>
                        </div>
                    ))}
                </dl>
            </section>
        </div>
    );
}
