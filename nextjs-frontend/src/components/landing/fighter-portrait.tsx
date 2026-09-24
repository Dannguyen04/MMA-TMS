import Image from "next/image";

import type { FighterAction } from "./fighter-motion";

export function FighterPortrait({ action, animationId }: { action: FighterAction; animationId: number }) {
    return (
        <div className="landing-fighter-parallax absolute inset-0 z-[6] pointer-events-none">
            <div key={animationId} className={`landing-fighter-visual is-${action} absolute inset-0`}>
                <Image
                    aria-hidden
                    alt=""
                    src="/images/landing/fighter-hero.png"
                    fill
                    priority
                    sizes="(min-width: 1024px) 58vw, 100vw"
                    className="landing-fighter-afterimage landing-fighter-afterimage-blue object-contain object-bottom"
                />
                <Image
                    aria-hidden
                    alt=""
                    src="/images/landing/fighter-hero.png"
                    fill
                    priority
                    sizes="(min-width: 1024px) 58vw, 100vw"
                    className="landing-fighter-afterimage landing-fighter-afterimage-red object-contain object-bottom"
                />
                <Image
                    data-testid="fighter-portrait"
                    alt=""
                    src="/images/landing/fighter-hero.png"
                    fill
                    priority
                    quality={95}
                    sizes="(min-width: 1024px) 58vw, 100vw"
                    className="landing-fighter-image object-contain object-bottom"
                />
            </div>
        </div>
    );
}
