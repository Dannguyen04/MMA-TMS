import { trainingTypeLabel } from "@/lib/domain/labels";
import type { CameraAngle, VideoTrainingType } from "@/lib/domain/types";
import { formatClock, formatDate, formatFileSize } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n/translate";

/** Client-side state and validation of the upload wizard. The server re-validates everything. */

export const MIN_DURATION_SEC = 10;
export const MAX_DURATION_SEC = 900;

export interface UploadLimits {
    allowedVideoFormats: string[];
    videoMaxSizeMb: number;
}

export type DurationStatus = "idle" | "reading" | "read" | "unreadable";

export interface FootageState {
    file: File | null;
    durationSec: number | null;
    durationStatus: DurationStatus;
    /** Entered by the user when the browser can't read the length. */
    manualDurationSec: string;
}

export const EMPTY_FOOTAGE: FootageState = { file: null, durationSec: null, durationStatus: "idle", manualDurationSec: "60" };

export interface DetailsState {
    fighterId: string;
    trainingType: VideoTrainingType | "";
    cameraAngle: CameraAngle | "";
    sessionId: string;
    sessionExerciseId?: string;
    evidenceProtocol?: 'whole_body_v1' | 'upper_body_v1' | 'lower_body_v1';
    title: string;
    titleEdited: boolean;
    notes: string;
}

export const fileSizeMb = (file: File) => file.size / (1024 * 1024);

export function fileExtension(name: string): string {
    const dot = name.lastIndexOf(".");
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function formatList(values: string[], t: Translator): string {
    const upper = values.map((v) => v.toUpperCase());
    return upper.length <= 1 ? (upper[0] ?? "") : t("screens.video.upload.listOr", { list: upper.slice(0, -1).join(", "), last: upper[upper.length - 1] });
}

/** Problems with the chosen file that block the upload, or null. */
export function fileProblem(file: File, limits: UploadLimits, t: Translator): string | null {
    const extension = fileExtension(file.name);
    if (!limits.allowedVideoFormats.includes(extension)) {
        return t("screens.video.upload.unsupported", { name: file.name, formats: formatList(limits.allowedVideoFormats, t) });
    }
    if (file.size === 0) return t("screens.video.upload.empty", { name: file.name });
    const size = fileSizeMb(file);
    if (size > limits.videoMaxSizeMb) {
        return t("screens.video.upload.tooBig", { size: formatFileSize(size), limit: formatFileSize(limits.videoMaxSizeMb) });
    }
    return null;
}

/** Length used for the upload: what the browser read, or the user's estimate. */
export function effectiveDuration(footage: FootageState): number | null {
    if (footage.durationStatus === "read") return footage.durationSec;
    if (footage.durationStatus === "unreadable") {
        const manual = Number(footage.manualDurationSec);
        return Number.isFinite(manual) && manual > 0 ? manual : null;
    }
    return null;
}

export function durationProblem(seconds: number | null, t: Translator): string | null {
    if (seconds === null) return t("screens.video.upload.enterLength");
    if (seconds < MIN_DURATION_SEC) return t("screens.video.upload.tooShort", { n: Math.round(seconds), min: MIN_DURATION_SEC });
    if (seconds > MAX_DURATION_SEC) return t("screens.video.upload.tooLong", { length: formatClock(seconds) });
    return null;
}

export function defaultTitle(type: VideoTrainingType | "", now: string, t: Translator, locale: Locale): string {
    return type ? t("screens.video.upload.defaultTitle", { type: trainingTypeLabel(t, type), date: formatDate(now, locale) }) : "";
}

/** Reads a video's length with a detached <video> element. Resolves null when the browser can't tell. */
export function readVideoDuration(file: File, timeoutMs = 5000): Promise<number | null> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement("video");
        let settled = false;
        const finish = (value: number | null) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            video.removeAttribute("src");
            video.load();
            URL.revokeObjectURL(url);
            resolve(value);
        };
        const timer = window.setTimeout(() => finish(null), timeoutMs);
        video.preload = "metadata";
        video.muted = true;
        video.onloadedmetadata = () => finish(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null);
        video.onerror = () => finish(null);
        video.src = url;
    });
}
