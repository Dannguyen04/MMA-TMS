import { embedUrl } from "@/lib/domain/opponent-video-suggestions";
import { cn } from "@/lib/utils";

/**
 * Inline YouTube player for opponent footage (T-046). Plain iframe on the privacy-enhanced domain:
 * no YouTube script is loaded, and seeking means a new `src` (the `key` forces the iframe to reload).
 */
export function YoutubePlayer({ url, time, title, className }: { url: string; time?: string | null; title: string; className?: string }) {
    const src = embedUrl(url, time);
    if (!src) return null;
    return (
        <div className={cn("relative aspect-video w-full overflow-hidden rounded-xl bg-black", className)}>
            <iframe
                key={src}
                src={src}
                title={title}
                loading="lazy"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 size-full border-0"
            />
        </div>
    );
}
