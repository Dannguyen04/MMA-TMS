import { Activity, HeartPulse, ScanLine, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/brand/logo";

const HIGHLIGHTS = [
    { icon: ScanLine, title: "AI-assisted video analysis", text: "Strike detection, pose tracking and technique metrics — always reviewed by a coach." },
    { icon: Activity, title: "Performance you can act on", text: "Jab to head movement, tracked week over week against real goals." },
    { icon: HeartPulse, title: "Sports medicine built in", text: "Injuries, recovery plans and Medical Clearance in the same place as training." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <aside className="relative hidden overflow-hidden bg-nav-bg px-12 py-10 text-nav-fg lg:flex lg:flex-col">
                {/* Full-bleed hero photo, faded into the nav colour so the copy on top stays readable. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- decorative background photo */}
                <img
                    src="/mma-hero.jpg"
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute inset-0 size-full object-cover object-top opacity-60 blur-[2px]"
                />
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-nav-bg via-nav-bg/80 to-nav-bg/20" />
                <OctagonPattern />
                <div className="relative">
                    <Logo />
                </div>
                <div className="relative mt-auto max-w-md">
                    <p className="text-xs font-semibold tracking-[0.12em] text-nav-accent uppercase">Lotus Combat Academy</p>
                    <p className="mt-3 text-[34px] leading-tight font-semibold tracking-tight text-balance text-white">
                        Train harder. Recover smarter. Fight cleared.
                    </p>
                    <p className="mt-3 text-[15px] text-nav-fg">Hệ thống Quản lý Huấn luyện và Theo dõi Sức khỏe Võ sĩ</p>
                    <ul className="mt-10 space-y-6">
                        {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
                            <li key={title} className="flex gap-4">
                                <span className="octagon flex size-10 shrink-0 items-center justify-center bg-nav-surface text-nav-accent">
                                    <Icon aria-hidden className="size-[18px]" />
                                </span>
                                <span>
                                    <span className="block text-sm font-semibold text-white">{title}</span>
                                    <span className="mt-0.5 block text-sm text-nav-fg">{text}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
                <p className="relative mt-12 flex items-center gap-2 text-xs text-nav-fg/70">
                    <ShieldCheck aria-hidden className="size-3.5" />
                    Medical data is only visible to assigned sports doctors.
                </p>
            </aside>
            <main className="flex flex-col px-5 py-8 sm:px-10">
                <div className="mb-10 lg:hidden">
                    <span className="inline-flex rounded-xl bg-nav-bg px-3 py-2">
                        <Logo />
                    </span>
                </div>
                <div className="m-auto w-full max-w-[26rem]">{children}</div>
            </main>
        </div>
    );
}

/** Faint nested octagons evoking the cage, drawn as a background ornament. */
function OctagonPattern() {
    const octagon = (size: number) => {
        const c = size * 0.2929;
        return `M${c},0 L${size - c},0 L${size},${c} L${size},${size - c} L${size - c},${size} L${c},${size} L0,${size - c} L0,${c} Z`;
    };
    return (
        <svg aria-hidden className="pointer-events-none absolute -top-40 -right-56 size-[720px] opacity-[0.07]" viewBox="0 0 720 720">
            {[720, 600, 480, 360, 240].map((size) => (
                <path
                    key={size}
                    d={octagon(size)}
                    transform={`translate(${(720 - size) / 2} ${(720 - size) / 2})`}
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                />
            ))}
        </svg>
    );
}
