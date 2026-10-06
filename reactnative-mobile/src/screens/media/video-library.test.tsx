import { fireEvent, render } from "@testing-library/react-native";

import { listAnalysisJobs, listVideos, type VideoRecord } from "@/api/media";
import { ThemePreferenceProvider } from "@/theme";

import { VIDEO_LIST_FIXTURE } from "./video-model";
import { VideoLibraryContent } from "./video-library";

jest.mock("@/api/media", () => {
  const actual = jest.requireActual("@/api/media");
  return { ...actual, listVideos: jest.fn(), listAnalysisJobs: jest.fn() };
});

function record(index: number): VideoRecord {
  const row = VIDEO_LIST_FIXTURE[index]!;
  return {
    id: row.id,
    fighterId: "fighter-1",
    uploadedById: "user-1",
    sessionId: null,
    title: row.title,
    description: null,
    trainingType: row.trainingType,
    cameraAngle: row.cameraAngle,
    status: row.analysisStatus === "FAILED" ? "FAILED" : "PROCESSED",
    originalFilename: "clip.mp4",
    fileSizeBytes: 1000,
    mimeType: "video/mp4",
    durationMs: 1000,
    sourceUrl: `/videos/${row.id}/content`,
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
  };
}

function jobs() {
  return VIDEO_LIST_FIXTURE.map((row) => ({
    id: `job-${row.id}`,
    status: row.analysisStatus,
    score: row.score,
    fighterId: "fighter-1",
    sessionId: null,
    videoId: row.id,
    alertCount: row.analysisStatus === "FAILED" ? null : 0,
    hasImpairment: false,
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
  }));
}

async function renderLibrary(onOpen = jest.fn()) {
  return render(
    <ThemePreferenceProvider>
      <VideoLibraryContent fighterId="fighter-1" onOpen={onOpen} onUpload={jest.fn()} />
    </ThemePreferenceProvider>,
  );
}

describe("VideoLibraryContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listVideos as jest.Mock).mockReset();
    (listAnalysisJobs as jest.Mock).mockReset();
  });

  it("navigates duplicate titles by id and shows score 70 only on record 4", async () => {
    (listVideos as jest.Mock).mockResolvedValue({ items: VIDEO_LIST_FIXTURE.map((_, index) => record(index)), pageInfo: { hasNextPage: false, endCursor: null }, total: 4 });
    (listAnalysisJobs as jest.Mock).mockResolvedValue(jobs());
    const onOpen = jest.fn();
    const view = await renderLibrary(onOpen);
    expect(await view.findByText("4 video")).toBeTruthy();
    const scores = view.getAllByText("Điểm 70");
    expect(scores).toHaveLength(1);
    expect(view.getByText("Thất bại")).toBeTruthy();
    fireEvent.press(view.getByTestId("video-row-fixture-heavy-bag-plain"));
    fireEvent.press(view.getByTestId("video-row-fixture-heavy-bag-scored"));
    expect(onOpen).toHaveBeenNthCalledWith(1, "fixture-heavy-bag-plain");
    expect(onOpen).toHaveBeenNthCalledWith(2, "fixture-heavy-bag-scored");
  });

});
