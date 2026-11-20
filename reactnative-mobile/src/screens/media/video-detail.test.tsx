import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { getAnalysisJob, getVideo, listAnalysisJobs } from "@/api/video/media";
import { getMemorySession } from "@/api/core/tokens";
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

jest.mock("@/api/video/evidence", () => ({
  getCoachingState: jest.fn().mockRejectedValue(new Error("x")),
  getMovementReviews: jest.fn().mockRejectedValue(new Error("x")),
  getJobResult: jest.fn().mockResolvedValue({ fps: 30, durationMs: 1000, width: null, height: null, frames: [], strikes: [], findings: [], movementEvidence: null, avgScore: null }),
}));

jest.mock("@/session/session-context", () => ({
  useSession: () => ({ user: { id: "u-f", role: "FIGHTER" }, isDemo: false, signOut: jest.fn() }),
  useSessionRole: () => "FIGHTER",
}));

jest.mock("@/api/core/tokens", () => ({
  getMemorySession: jest.fn(),
}));

jest.mock("@/api/video/media", () => {
  const actual = jest.requireActual("@/api/video/media");
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
    // Fighter view (redesign step 13): the result is the strip under the title, no tab to open.
    expect(await view.findByTestId("video-strip")).toBeTruthy();
    expect(view.getByText("Xong")).toBeTruthy();
    expect(view.getByLabelText("Cảnh báo: 0")).toBeTruthy();
    expect(view.queryByText("70")).toBeNull();
    expect(view.queryByText("Điểm 70")).toBeNull();
    await waitFor(() => expect(getAnalysisJob).toHaveBeenCalledWith("job-referenced"));
  });

  it("shows Diễn biến with strikes and hides Nhận xét for doctors", async () => {
    const { getJobResult } = jest.requireMock("@/api/video/evidence") as { getJobResult: jest.Mock };
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
    expect(await view.findByTestId("camp-tab-timeline")).toBeTruthy();
    expect(view.getAllByText("Đấm thẳng tay sau, bên phải").length).toBeGreaterThan(0);
    expect(view.queryByTestId("camp-tab-review")).toBeNull();
  });
});
