import { toAnalysisJob } from "@/api/media";

import {
  REFERENCED_VIDEO_DETAIL,
  VIDEO_LIST_FIXTURE,
  analysisPanel,
  formatVideoDate,
  initialUploadForm,
  libraryPhase,
  recordById,
  uploadFormReducer,
  visibleScore,
  warningText,
} from "./video-model";

describe("video list fixture", () => {
  it("keeps order and puts score 70 only on record 4", () => {
    expect(VIDEO_LIST_FIXTURE.map((row) => row.title)).toEqual([
      "Heavy bag",
      "Shadow boxing",
      "Shadow boxing",
      "Heavy bag",
    ]);
    expect(VIDEO_LIST_FIXTURE.map((row) => row.analysisStatus)).toEqual(["DONE", "DONE", "FAILED", "DONE"]);
    expect(VIDEO_LIST_FIXTURE.map((row) => visibleScore(row.score))).toEqual([null, null, null, 70]);
    expect(VIDEO_LIST_FIXTURE[2]?.analysisStatus).toBe("FAILED");
    expect(formatVideoDate(VIDEO_LIST_FIXTURE[0]!.createdAt)).toBe("29 tháng 9, 2026");
  });

  it("opens a duplicate title by id", () => {
    const plain = recordById(VIDEO_LIST_FIXTURE, "fixture-heavy-bag-plain");
    const scored = recordById(VIDEO_LIST_FIXTURE, "fixture-heavy-bag-scored");
    expect(plain?.title).toBe(scored?.title);
    expect(plain?.id).not.toBe(scored?.id);
    expect(visibleScore(plain?.score)).toBeNull();
    expect(visibleScore(scored?.score)).toBe(70);
  });

  it("does not copy score 70 onto the referenced detail", () => {
    const sameTitle = VIDEO_LIST_FIXTURE.filter((row) => row.title === REFERENCED_VIDEO_DETAIL.title);
    expect(sameTitle.some((row) => row.score === 70)).toBe(true);
    const opened = recordById(
      [...VIDEO_LIST_FIXTURE, REFERENCED_VIDEO_DETAIL],
      REFERENCED_VIDEO_DETAIL.id,
    );
    expect(opened?.title).toBe("Heavy bag");
    expect(visibleScore(opened && "score" in opened ? opened.score : null)).toBeNull();
    expect(REFERENCED_VIDEO_DETAIL.processingStatus).toBe("PROCESSED");
    expect(REFERENCED_VIDEO_DETAIL.analysisStatus).toBe("DONE");
    expect(REFERENCED_VIDEO_DETAIL.alertCount).toBe(0);
  });
});

describe("library phases", () => {
  it("separates loading, empty, and error", () => {
    expect(libraryPhase({ loading: true, error: "", items: null })).toBe("loading");
    expect(libraryPhase({ loading: false, error: "", items: [] })).toBe("empty");
    expect(libraryPhase({ loading: false, error: "Không kết nối được", items: null })).toBe("error");
    expect(libraryPhase({ loading: false, error: "", items: [{ id: "a" }] })).toBe("data");
  });
});

describe("analysis versus media", () => {
  it("keeps a finished analysis while media is still loading", () => {
    const panel = analysisPanel({ status: "DONE", alertCount: 0, score: null });
    expect(panel.status?.label).toBe("Xong");
    expect(panel.alertCount).toBe(0);
    expect(panel.score).toBeNull();
    expect(warningText(0)).toBe("0");
    expect(warningText(null)).toBe("—");
  });

  it("does not turn a missing warning count into zero", () => {
    const job = toAnalysisJob({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      status: "DONE",
      score: null,
      videoId: REFERENCED_VIDEO_DETAIL.id,
      createdAt: "2026-09-29T02:00:00.000Z",
      updatedAt: "2026-09-29T02:00:00.000Z",
    });
    expect(job?.alertCount).toBeNull();
    expect(warningText(job?.alertCount ?? null)).toBe("—");
    const panel = analysisPanel(job);
    expect(panel.missing).toBe(false);
    expect(panel.alertCount).toBeNull();
  });
});

describe("upload form", () => {
  const file = {
    uri: "file://clip.mp4",
    filename: "clip.mp4",
    mimeType: "video/mp4",
    durationMs: 12_000,
    fileSizeBytes: 1000,
  };

  function ready() {
    return uploadFormReducer(
      uploadFormReducer(
        uploadFormReducer(
          uploadFormReducer(initialUploadForm(), { type: "title", value: "Giữ tiêu đề" }),
          { type: "description", value: "Giữ mô tả" },
        ),
        { type: "trainingType", value: "HEAVY_BAG" },
      ),
      { type: "cameraAngle", value: "SIDE" },
    );
  }

  it("keeps a typed draft when the picker is canceled or a file is chosen", () => {
    const typed = ready();
    expect(uploadFormReducer(typed, { type: "pickCanceled" })).toEqual(typed);
    const selected = uploadFormReducer(typed, { type: "fileSelected", asset: file });
    expect(selected.title).toBe("Giữ tiêu đề");
    expect(selected.description).toBe("Giữ mô tả");
    expect(selected.asset?.filename).toBe("clip.mp4");
  });

  it("rejects an incomplete draft, ignores a second submit, and keeps the draft after failure", () => {
    const incomplete = uploadFormReducer(initialUploadForm(), { type: "title", value: "Chỉ tiêu đề" });
    expect(uploadFormReducer(incomplete, { type: "invalid", error: "thiếu file" }).title).toBe("Chỉ tiêu đề");
    const sending = uploadFormReducer(ready(), { type: "submitStart" });
    expect(sending.phase).toBe("sending");
    expect(uploadFormReducer(sending, { type: "submitStart" })).toBe(sending);
    const failed = uploadFormReducer(sending, { type: "submitFailure", error: "mạng" });
    expect(failed.phase).toBe("failed");
    expect(failed.title).toBe("Giữ tiêu đề");
    expect(failed.description).toBe("Giữ mô tả");
    expect(failed.asset).toBeNull();
  });

  it("treats upload success as not analysis-complete and ignores a theme change", () => {
    const withFile = uploadFormReducer(ready(), { type: "fileSelected", asset: file });
    const sent = uploadFormReducer(withFile, { type: "submitSuccess" });
    expect(sent.phase).toBe("sent");
    expect(sent.analysisComplete).toBe(false);
    expect(uploadFormReducer(withFile, { type: "appearanceChanged" })).toBe(withFile);
  });
});
