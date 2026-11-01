import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemePreferenceProvider } from "@/theme";

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ navigate: mockNavigate, push: jest.fn() }) }));
jest.mock("@/screens/video-ai/ai-data", () => ({
  useAiEnabled: () => true,
  useJobs: () => ({ data: { pending: new Set(["a", "b", "c"]) } }),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = jest.requireActual("fs") as typeof import("fs");

describe("batch45: thẻ Cần duyệt ở Lịch + bỏ tab Video", () => {
  it("thẻ hiện số phân tích chờ duyệt và mở danh sách Cần duyệt", async () => {
    const { PendingReviewCard } = require("./coach-schedule-screen") as typeof import("./coach-schedule-screen");
    const ui = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 384, height: 832 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <ThemePreferenceProvider>
          <PendingReviewCard />
        </ThemePreferenceProvider>
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(ui.getByTestId("pending-review-count")).toBeTruthy());
    expect(ui.getByText("3")).toBeTruthy();
    expect(ui.getByText("Cần duyệt")).toBeTruthy();
    await fireEvent.press(ui.getByTestId("pending-review-card"));
    expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/(coach)/video-analysis", params: expect.objectContaining({ seg: "review" }) }));
  });
  it("thanh tab HLV không còn mục Video (route vẫn còn, href: null)", () => {
    const src = fs.readFileSync(`${__dirname}/../../../app/(coach)/_layout.tsx`, "utf8");
    expect(src).toMatch(/name="video-analysis"[\s\S]{0,200}href: null/);
  });
});
