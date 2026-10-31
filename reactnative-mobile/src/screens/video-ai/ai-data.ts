import { useCallback, useMemo } from "react";
import { useRouter } from "expo-router";

import { USE_MOCK_VIDEO_AI, videoAiApi } from "@/api/video-ai";
import type { AiJob } from "@/api/video-ai.types";
import { useDoctorRoster } from "@/screens/doctor/redesign/doctor-roster";
import { fighterName } from "@/screens/coach/readonly/ro-format";
import { useFighterNames } from "@/screens/coach/readonly/use-coach";
import { useLoad } from "@/screens/fighter/use-load";
import { useSession, useSessionRole } from "@/session/session-context";

import { hasCoachReview } from "./ai-model";

export type AiRole = "coach" | "admin" | "doctor";

export function aiRoleFrom(role: string | null): AiRole {
  if (role === "ADMIN") return "admin";
  if (role === "DOCTOR") return "doctor";
  return "coach";
}

export function useAiRole(): AiRole {
  return aiRoleFrom(useSessionRole());
}

/** Dữ liệu thật khi đã đăng nhập thật, hoặc khi bật mock. */
export function useAiEnabled(): boolean {
  const { isDemo } = useSession();
  return USE_MOCK_VIDEO_AI || !isDemo;
}

export function useMeId(): string | null {
  return useSession().user?.id ?? null;
}

export const DETAIL_PATH: Record<AiRole, string> = {
  coach: "/(coach)/video-analysis/chi-tiet",
  admin: "/(admin)/quan-tri/video-chi-tiet",
  doctor: "/(doctor)/vo-si/video",
};

export type DetailFocus = "result" | "alerts";

/** Mở Chi tiết video theo vai trò; vào từ job thì cuộn sẵn tới thẻ Kết quả (hoặc Cảnh báo). */
export function useOpenVideo() {
  const router = useRouter();
  const role = useAiRole();
  return useCallback(
    (videoId: string, jobId?: string | null, focus?: DetailFocus) =>
      router.push({ pathname: DETAIL_PATH[role], params: { id: videoId, job: jobId ?? "", focus: focus ?? "" } } as never),
    [router, role],
  );
}

/** Tên võ sĩ: Coach/Admin qua /fighters, Doctor qua danh sách phụ trách. */
export function useAiNames(enabled: boolean): Record<string, string> {
  const role = useAiRole();
  const coachNames = useFighterNames(enabled && role !== "doctor");
  const roster = useDoctorRoster();
  return useMemo(() => {
    if (role !== "doctor") return coachNames;
    return Object.fromEntries(roster.items.map((f) => [f.id, fighterName(f)]));
  }, [role, coachNames, roster.items]);
}

/** Tiêu đề video theo id (GET /videos, tối đa 100), để dòng job hiện tên video. */
export function useVideoTitles(enabled: boolean) {
  const run = useCallback(async () => {
    const page = await videoAiApi.listVideos({ limit: 100 });
    return Object.fromEntries(page.items.map((v) => [v.id, v.title]));
  }, []);
  return useLoad(enabled, "vai-titles", run, { keepOnError: true });
}

export type JobsData = { jobs: AiJob[]; pending: Set<string>; total: number };

/** GET /jobs (lọc trên máy) + với HLV: GET /coaching/jobs/:id/state cho job DONE để biết job nào chờ HLV duyệt. */
export async function loadJobs(withReview: boolean): Promise<JobsData> {
  const jobs = await videoAiApi.listJobs();
  const pending = new Set<string>();
  if (withReview) {
    const done = jobs.filter((j) => j.status === "DONE");
    const states = await Promise.allSettled(done.map((j) => videoAiApi.getCoachingState(j.id)));
    states.forEach((s, i) => {
      // Không đọc được trạng thái → không gắn chip (không đoán).
      if (s.status === "fulfilled" && !hasCoachReview(s.value)) pending.add(done[i]!.id);
    });
  }
  return { jobs, pending, total: jobs.length };
}

export function useJobs(enabled: boolean, withReview: boolean) {
  const run = useCallback(() => loadJobs(withReview), [withReview]);
  return useLoad(enabled, `vai-jobs|${withReview}`, run, { keepOnError: true });
}
