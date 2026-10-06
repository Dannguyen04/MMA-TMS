import { isSupportedVideoMime, type VideoCameraAngle, type VideoTrainingType } from "@/api/media";

export type UploadDraft = {
  title: string;
  trainingType: VideoTrainingType | null;
  cameraAngle: VideoCameraAngle | null;
  durationMs: number | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  filename: string | null;
};

export type UploadIssue =
  | "title"
  | "type"
  | "angle"
  | "file"
  | "duration"
  | "durationRange"
  | "size"
  | "mime";

export function uploadIssue(draft: UploadDraft): UploadIssue | null {
  const title = draft.title.trim();
  if (!title || title.length > 200) return "title";
  if (!draft.trainingType) return "type";
  if (!draft.cameraAngle) return "angle";
  if (!draft.filename) return "file";
  if (draft.durationMs == null) return "duration";
  if (!Number.isInteger(draft.durationMs) || draft.durationMs < 1 || draft.durationMs > 86_400_000) {
    return "durationRange";
  }
  if (draft.fileSizeBytes == null || draft.fileSizeBytes < 1) return "size";
  if (!draft.mimeType || !isSupportedVideoMime(draft.mimeType)) return "mime";
  return null;
}
