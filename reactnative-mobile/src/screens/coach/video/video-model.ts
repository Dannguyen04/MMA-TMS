import type { Href } from "expo-router";

/** The one coach video page (redesign step 19); `[id]` and `review` redirect here. */
export const COACH_VIDEO_PAGE = "/(coach)/video-analysis/chi-tiet";
export const COACH_VIDEOS = "/(coach)/video-analysis";

export const coachVideoHref = (id: string, jobId?: string | null) =>
  ({ pathname: COACH_VIDEO_PAGE, params: jobId ? { id, job: jobId } : { id } }) as unknown as Href;

/** Tải video; from a fighter page the fighter is set and shown, from the Video list it is picked in the form. */
export const coachUploadHref = (fighterId?: string) =>
  ({ pathname: "/(coach)/video-analysis/upload", params: fighterId ? { fighterId } : {} }) as unknown as Href;
