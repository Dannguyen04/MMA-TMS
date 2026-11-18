/** Doctor paths (redesign step 21): one video page for every AI row. */
export const DOCTOR_VIDEO_PAGE = "/(doctor)/ai-alerts/xem";
export const DOCTOR_FIGHTERS = "/(doctor)/vo-si";

/** The video page from an AI job (and its video when known). */
export const doctorVideoHref = (jobId: string, videoId?: string | null) =>
  ({ pathname: DOCTOR_VIDEO_PAGE, params: videoId ? { id: videoId, jobId } : { jobId } });

/** Võ sĩ, Cảnh báo AI tab, optionally for one fighter. `t` makes a repeat tap reapply the preset. */
export const doctorAiListHref = (fighterId?: string) =>
  ({ pathname: DOCTOR_FIGHTERS, params: { seg: "ai", ...(fighterId ? { fighterId } : {}), t: String(Date.now()) } });
