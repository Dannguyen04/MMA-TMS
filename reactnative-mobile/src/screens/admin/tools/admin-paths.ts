/** Admin Quản trị paths (redesign step 23). */
export const ADMIN_VIDEOS = "/(admin)/quan-tri/video";
export const ADMIN_VIDEO_PAGE = "/(admin)/quan-tri/video-chi-tiet";
export const ADMIN_ASSIGN = "/(admin)/quan-tri/phan-cong-bac-si";

/** The admin video page for a video (and the job when known). */
export function adminVideoHref(videoId: string, jobId?: string) {
  return { pathname: ADMIN_VIDEO_PAGE, params: jobId ? { id: videoId, jobId } : { id: videoId } };
}

/** The Video page on a tab, optionally filtered (Tổng quan "Phân tích lỗi" opens seg=ai&status=FAILED). */
export function adminVideosHref(opts: { seg?: "library" | "ai"; status?: string; fighterId?: string } = {}) {
  const params: Record<string, string> = { t: String(Date.now()) };
  if (opts.seg) params.seg = opts.seg;
  if (opts.status) params.status = opts.status;
  if (opts.fighterId) params.fighterId = opts.fighterId;
  return { pathname: ADMIN_VIDEOS, params };
}
