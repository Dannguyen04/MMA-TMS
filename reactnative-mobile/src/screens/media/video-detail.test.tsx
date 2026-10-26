import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { getAnalysisJob, getVideo, listAnalysisJobs } from "@/api/media";
import { getMemorySession } from "@/api/tokens";
import { ThemePreferenceProvider } from "@/theme";

import { REFERENCED_VIDEO_DETAIL, VIDEO_LIST_FIXTURE } from "./video-model";
import { VideoDetailContent } from "./video-detail";

jest.mock("expo-video", () => ({
  useVideoPlayer: (_source: unknown, setup?: (player: { pause: () => void; timeUpdateEventInterval: number }) => void) => {
    const player = {
      pause: jest.fn(),
      timeUpdateEventInterval: 0,
      addListener: (name: string, listener: (event: { status?: string; currentTime?: number }) => void) => {
        if (name === "statusChange") listener({ status: "loading" });
        if (name === "timeUpdate") listener({ currentTime: 0 });
        return { remove: jest.fn() };
      },
    };
    setup?.(player);
    return player;
  },
  VideoView: () => null,
}));

jest.mock("@/api/evidence", () => ({
  getCoachingState: jest.fn().mockRejectedValue(new Error("x")),
  getMovementReviews: jest.fn().mockRejectedValue(new Error("x")),
  getJobResult: jest.fn().mockResolvedValue({ fps: 30, durationMs: 1000, width: null, height: null, frames: [], strikes: [], findings: [], movementEvidence: null, avgScore: null }),
}));

jest.mock("@/api/tokens", () => ({
  getMemorySession: jest.fn(),
}));

jest.mock("@/api/media", () => {
  const actual = jest.requireActual("@/api/media");
  return {
    ...actual,
    getVideo: jest.fn(),
    listAnalysisJobs: jest.fn(),
    getAnalysisJob: jest.fn(),
    createAnalysisJob: jest.fn(),
    resolveVideoStream: jest.fn().mockResolvedValue({ uri: "https://storage.example/signed.mp4" }),
  };
});

const insets = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe("VideoDetailContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMemorySession as jest.Mock).mockReturnValue({ accessToken: "token" });
    (getVideo as jest.Mock).mockResolvedValue({
      id: REFERENCED_VIDEO_DETAIL.id,
      fighterId: "fighter-1",
      uploadedById: "user-1",
      sessionId: null,
      title: REFERENCED_VIDEO_DETAIL.title,
      description: null,
      trainingType: REFERENCED_VIDEO_DETAIL.trainingType,
      cameraAngle: REFERENCED_VIDEO_DETAIL.cameraAngle,
      status: REFERENCED_VIDEO_DETAIL.processingStatus,
      originalFilename: "clip.mp4",
      fileSizeBytes: 1000,
      mimeType: "video/mp4",
      durationMs: 1000,
      sourceUrl: `/videos/${REFERENCED_VIDEO_DETAIL.id}/content`,
      createdAt: REFERENCED_VIDEO_DETAIL.createdAt,
      updatedAt: REFERENCED_VIDEO_DETAIL.createdAt,
    });
    (listAnalysisJobs as jest.Mock).mockResolvedValue([
      {
        id: "job-referenced",
        status: "DONE",
        score: null,
        fighterId: "fighter-1",
        sessionId: null,
        videoId: REFERENCED_VIDEO_DETAIL.id,
        alertCount: 0,
        hasImpairment: false,
        createdAt: REFERENCED_VIDEO_DETAIL.createdAt,
        updatedAt: REFERENCED_VIDEO_DETAIL.createdAt,
      },
      {
        id: "job-other-heavy-bag",
        status: "DONE",
        score: 70,
        fighterId: "fighter-1",
        sessionId: null,
        videoId: VIDEO_LIST_FIXTURE[3]!.id,
        alertCount: 0,
        hasImpairment: false,
        createdAt: VIDEO_LIST_FIXTURE[3]!.createdAt,
        updatedAt: VIDEO_LIST_FIXTURE[3]!.createdAt,
      },
    ]);
    (getAnalysisJob as jest.Mock).mockImplementation(async (id: string) => {
      if (id !== "job-referenced") throw new Error("wrong job");
      return {
        id,
        status: "DONE",
        score: null,
        fighterId: "fighter-1",
        sessionId: null,
        videoId: REFERENCED_VIDEO_DETAIL.id,
        alertCount: 0,
        hasImpairment: false,
        createdAt: REFERENCED_VIDEO_DETAIL.createdAt,
        updatedAt: REFERENCED_VIDEO_DETAIL.createdAt,
      };
    });
  });

  it("shows media loading and a finished analysis with zero warnings, not score 70", async () => {
    const view = await render(
      <SafeAreaProvider initialMetrics={insets}>
        <ThemePreferenceProvider>
          <VideoDetailContent videoId={REFERENCED_VIDEO_DETAIL.id} canRequestAnalysis onBack={jest.fn()} />
        </ThemePreferenceProvider>
      </SafeAreaProvider>,
    );
    expect(await view.findByText("Đang tải video…")).toBeTruthy();
    await fireEvent.press(await view.findByTestId("tab-metrics"));
    expect(await view.findByText("Xong")).toBeTruthy();
    expect(view.getAllByText("0").length).toBeGreaterThan(0);
    expect(view.queryByText("70")).toBeNull();
    expect(view.queryByText("Điểm 70")).toBeNull();
    await waitFor(() => expect(getAnalysisJob).toHaveBeenCalledWith("job-referenced"));
  });

  it("shows Diễn biến with strikes and hides Nhận xét for doctors", async () => {
    const { getJobResult } = jest.requireMock("@/api/evidence") as { getJobResult: jest.Mock };
    getJobResult.mockResolvedValueOnce({
      fps: 30,
      durationMs: 2000,
      width: 540,
      height: 960,
      frames: [],
      strikes: [
        { actionId: "a1", family: "punch", technique: "cross", side: "right", startMs: 1000, impactMs: 1250, endMs: 1400, score: 90, confidence: 0.9, peakSpeed: 2, angle: 170, guardKept: true },
      ],
      findings: [],
      movementEvidence: null,
      avgScore: 90,
    });
    const view = await render(
      <SafeAreaProvider initialMetrics={insets}>
        <ThemePreferenceProvider>
          <VideoDetailContent videoId={REFERENCED_VIDEO_DETAIL.id} canRequestAnalysis={false} onBack={jest.fn()} role="doctor" />
        </ThemePreferenceProvider>
      </SafeAreaProvider>,
    );
    expect(await view.findByTestId("tab-timeline")).toBeTruthy();
    expect(view.getAllByText("Cross phải").length).toBeGreaterThan(0);
    expect(view.queryByTestId("tab-review")).toBeNull();
  });
});
