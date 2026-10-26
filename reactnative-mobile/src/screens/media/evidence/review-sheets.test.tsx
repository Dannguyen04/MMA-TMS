import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { appendMovementReview, reviewFinding } from "@/api/evidence";
import { ThemePreferenceProvider } from "@/theme";
import { FindingReviewSheet, WindowReviewSheet } from "./review-sheets";

jest.mock("@/api/evidence", () => ({
  reviewFinding: jest.fn().mockResolvedValue({ id: "r" }),
  submitCoachCorrection: jest.fn().mockResolvedValue({ id: "c" }),
  appendMovementReview: jest.fn().mockResolvedValue({ id: "m", revision: 1, replayed: false }),
}));

const insets = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={insets}>
    <ThemePreferenceProvider>{ui}</ThemePreferenceProvider>
  </SafeAreaProvider>
);

describe("review sheets", () => {
  it("sends a corrected finding review with the label", async () => {
    const onSaved = jest.fn();
    const view = await render(
      wrap(
        <FindingReviewSheet
          finding={{ id: "f1", actionId: "act", title: "Tay trái hạ thấp", description: "", severity: "warning", confidence: 1, timeMs: 600, recommendation: "" }}
          analysisId="11111111-1111-4111-8111-111111111111"
          onClose={jest.fn()}
          onSaved={onSaved}
        />,
      ),
    );
    await fireEvent.press(await view.findByTestId("finding-decision-corrected"));
    await fireEvent.changeText(view.getByTestId("finding-label"), "Jab trái");
    await fireEvent.press(view.getByTestId("finding-review-save"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(reviewFinding).toHaveBeenCalledWith({
      analysisId: "11111111-1111-4111-8111-111111111111",
      actionId: "act",
      findingId: "f1",
      status: "corrected",
      correctedLabel: "Jab trái",
    });
  });

  it("requires notes and sends expectedRevision for a window", async () => {
    const onSaved = jest.fn();
    const view = await render(
      wrap(
        <WindowReviewSheet
          jobId="job-1"
          window={{ id: "w1", startMs: 500, endMs: 1000, sampleCount: 30 }}
          expectedRevision={2}
          playheadMs={600}
          onClose={jest.fn()}
          onSaved={onSaved}
        />,
      ),
    );
    await fireEvent.press(await view.findByTestId("window-review-save"));
    expect(appendMovementReview).not.toHaveBeenCalled();
    await fireEvent.changeText(view.getByTestId("window-notes"), "Đúng động tác");
    await fireEvent.press(view.getByTestId("window-review-save"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [jobId, body] = (appendMovementReview as jest.Mock).mock.calls[0];
    expect(jobId).toBe("job-1");
    expect(body).toMatchObject({ windowId: "w1", expectedRevision: 2, decision: "confirmed", notes: "Đúng động tác" });
    expect(body.startMs).toBeUndefined();
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
