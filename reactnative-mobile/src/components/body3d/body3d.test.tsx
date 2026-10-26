import { act, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemePreferenceProvider } from "@/theme/theme-preference";

import { buildJointRows, humaniseCode, JOINT_REGIONS, paintRegions, STATUS_COLOR } from "./regions";
import { BODY_MODEL } from "./model";

// Jest không có GL: thay khung 3D bằng View giả; điều khiển lỗi/ready qua biến.
let mockCanvasMode: "ok" | "throw" | "hang" = "ok";
jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("./body-canvas", () => {
  const { useEffect } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: (p: { onReady: () => void }) => {
      if (mockCanvasMode === "throw") throw new Error("GL context lost");
      useEffect(() => {
        if (mockCanvasMode === "ok") {
          p.onReady();
        }
      }, []);
      return <View testID="mock-canvas" />;
    },
  };
});
let mockReduced = false;
jest.mock("./reduced-motion", () => ({ useReducedMotion: () => mockReduced }));

const id = (s: string) => s;

describe("bảng vùng", () => {
  it("đủ 13 mã BODY_JOINTS, khớp tên vùng trong regions json của mô hình", () => {
    expect(Object.keys(JOINT_REGIONS)).toHaveLength(13);
    for (const c of Object.values(JOINT_REGIONS)) expect(BODY_MODEL.meta.regions[c.region]).toBeTruthy();
    // SPINE phải là kênh cuối (shader xử lý riêng cột sống ở chỉ số NR-1)
    const sp = BODY_MODEL.meta.regions.SPINE!;
    expect(sp.slot * 4 + sp.ch).toBe(Object.keys(BODY_MODEL.meta.regions).length - 1);
  });

  it("nặng nhất thắng; SUSPECTED không tô; mã lạ → Vùng khác (chữ thường)", () => {
    const rows = buildJointRows(
      [
        { affectedJoint: "RIGHT_KNEE", status: "RECOVERING", injuryType: "A", severity: "MINOR" },
        { affectedJoint: "RIGHT_KNEE", status: "ACTIVE", injuryType: "B", severity: "MODERATE" },
        { affectedJoint: "SPINE_CORE", status: "RESOLVED", injuryType: "C", severity: "MINOR" },
      ],
      [
        { joint: "LEFT_ANKLE", currentState: "SUSPECTED" },
        { joint: "LEFT_HAND", currentState: "CONFIRMED_IMPAIRMENT" },
        { joint: "LEFT_KNEE", currentState: "HEALTHY" },
      ],
      id,
      id,
    );
    expect(rows.map((r) => [r.joint, r.status, r.mapped])).toEqual([
      ["RIGHT_KNEE", "injury", true],
      ["LEFT_ANKLE", null, true],
      ["SPINE_CORE", "healed", true],
      ["LEFT_HAND", "injury", false],
    ]);
    expect(rows[0]!.detail).toBe("B · MODERATE");
    expect(rows[3]!.label).toBe("Vùng khác (left hand)");
    expect(humaniseCode("LEFT_BIG_TOE")).toBe("left big toe");
    const paint = paintRegions(rows);
    expect(Object.keys(paint).sort()).toEqual(["R_KNEE", "SPINE"]);
    expect(paint.R_KNEE!.color).toBe(STATUS_COLOR.injury);
    expect(paint.SPINE).toEqual({ color: STATUS_COLOR.healed, R: 0.05, core: 0.1 });
  });
});

async function renderSection() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BodyMapSection } = require("./body-map-section");
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 375, height: 667 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemePreferenceProvider>
        <BodyMapSection
          injuries={[{ affectedJoint: "RIGHT_KNEE", status: "ACTIVE", injuryType: "Căng dây chằng", severity: "MODERATE" }]}
          jointStates={[{ id: "1", joint: "LEFT_HAND", currentState: "CONFIRMED_IMPAIRMENT", stateUpdatedAt: "", notes: null }]}
          stateText={id}
          severityText={id}
        />
      </ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}

describe("BodyMapSection", () => {
  afterEach(() => {
    mockCanvasMode = "ok";
    mockReduced = false;
    jest.useRealTimers();
  });

  it("3D + danh sách (có Vùng khác), không còn chip phía sau", async () => {
    const s = await renderSection();
    expect(await s.findByTestId("mock-canvas")).toBeTruthy();
    expect(s.queryByTestId("back-chip")).toBeNull();
    expect(s.queryByText(/phía sau/)).toBeNull();
    expect(s.getByText("Gối phải")).toBeTruthy();
    expect(s.getByText("Vùng khác (left hand)")).toBeTruthy();
    expect(s.getByLabelText("Về mô hình 3D")).toBeTruthy();
  });

  it("giảm chuyển động → SVG", async () => {
    mockReduced = true;
    const s = await renderSection();
    expect(s.getByTestId("body-fallback")).toBeTruthy();
    expect(s.queryByTestId("body3d-frame")).toBeNull();
  });

  it("lỗi GL → SVG (ErrorBoundary)", async () => {
    mockCanvasMode = "throw";
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const s = await renderSection();
    expect(await s.findByTestId("body-fallback")).toBeTruthy();
    spy.mockRestore();
  });

  it("quá 5 s chưa tải → SVG", async () => {
    jest.useFakeTimers();
    mockCanvasMode = "hang";
    const s = await renderSection();
    expect(s.queryByTestId("body-fallback")).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(5100);
    });
    expect(s.getByTestId("body-fallback")).toBeTruthy();
  });
});

describe("kéo để xoay", () => {
  it("kéo sang phải: mô hình xoay cùng chiều ngón tay (camera quay ngược)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { dragAngle, DRAG_RAD_PER_DP } = require("./body-map-section");
    expect(dragAngle(0, 100)).toBeCloseTo(-100 * DRAG_RAD_PER_DP);
    expect(dragAngle(0, -100)).toBeCloseTo(100 * DRAG_RAD_PER_DP);
    // Camera ở (sin a, cos a): a giảm → camera sang trái → điểm trước ngực trôi sang phải trên màn hình.
    const a = dragAngle(0, 50);
    expect(Math.sin(a)).toBeLessThan(0);
  });
});
