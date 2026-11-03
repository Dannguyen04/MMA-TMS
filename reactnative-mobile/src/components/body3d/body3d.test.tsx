import { act, fireEvent, render } from "@testing-library/react-native";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemePreferenceProvider } from "@/theme/theme-preference";

import { buildJointRows, EXTRA_REGIONS, humaniseCode, JOINT_REGIONS, paintRegions, STATUS_COLOR } from "./regions";
import { BODY_MODEL } from "./model";
import { BODY_JOINTS } from "@/api/types";

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
  it.each(BODY_JOINTS)("highlights only the API injury region %s", joint => {
    const rows = buildJointRows([{ affectedJoint: joint, status: "ACTIVE", injuryType: "Test", severity: "MINOR" }], []);
    const paint = paintRegions(rows);
    expect(Object.keys(paint)).toEqual([JOINT_REGIONS[joint]!.region]);
    expect(paint[JOINT_REGIONS[joint]!.region]!.color).toBe(STATUS_COLOR.injury);
    expect(paintRegions(buildJointRows([], []))).toEqual({});
  });

  it("đủ 13 mã BODY_JOINTS, khớp tên vùng trong regions json của mô hình", () => {
    expect(Object.keys(JOINT_REGIONS)).toHaveLength(13);
    for (const c of Object.values(JOINT_REGIONS)) expect(BODY_MODEL.meta.regions[c.region]).toBeTruthy();
    // SPINE phải là kênh cuối (shader xử lý riêng cột sống ở chỉ số NR-1)
    const sp = BODY_MODEL.meta.regions.SPINE!;
    expect(sp.slot * 4 + sp.ch).toBe(Object.keys(BODY_MODEL.meta.regions).length - 1);
  });

  it("nặng nhất thắng; SUSPECTED không tô; mã lạ → Vùng khác (không hiện mã)", () => {
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
    expect(rows[3]!.label).toBe("Vùng khác");
    expect(humaniseCode("LEFT_BIG_TOE")).toBe("left big toe");
    const paint = paintRegions(rows);
    expect(Object.keys(paint).sort()).toEqual(["R_KNEE", "SPINE"]);
    expect(paint.R_KNEE!.color).toBe(STATUS_COLOR.injury);
    expect(paint.SPINE).toEqual({ color: STATUS_COLOR.healed, R: 0.05, core: 0.1 });
  });
});

async function renderSection(showBack = false) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BodyMapSection } = require("./body-map-section");
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 375, height: 667 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemePreferenceProvider>
        <BodyMapSection
          injuries={[{ affectedJoint: "RIGHT_KNEE", status: "ACTIVE", injuryType: "Căng dây chằng", severity: "MODERATE" }, ...(showBack ? [{ affectedJoint: "SPINE_CORE", status: "RESOLVED", injuryType: "Đau thắt lưng", severity: "MINOR" }] : [])]}
          jointStates={[{ id: "1", joint: "LEFT_HAND", currentState: "CONFIRMED_IMPAIRMENT", stateUpdatedAt: "", notes: null }]}
          stateText={id}
          severityText={id}
        />
      </ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}

describe("vùng phụ đầu/cổ/ngực/sườn", () => {
  it("chuẩn hoá mã, nhãn tiếng Việt, tô bằng màu trạng thái; 13 khớp không đổi", () => {
    const rows = buildJointRows(
      [
        { affectedJoint: "head", status: "ACTIVE", injuryType: "Chấn động não", severity: "MODERATE" },
        { affectedJoint: "NECK", status: "RECOVERING", injuryType: "", severity: "" },
        { affectedJoint: "CHEST", status: "RESOLVED", injuryType: "", severity: "" },
        { affectedJoint: "RIBS", status: "ACTIVE", injuryType: "", severity: "" },
        { affectedJoint: "LEFT_KNEE", status: "ACTIVE", injuryType: "", severity: "" },
      ],
      [],
      id,
      id,
    );
    expect(rows.map((r) => [r.joint, r.label, r.mapped])).toEqual([
      ["HEAD", "Đầu", true],
      ["NECK", "Cổ", true],
      ["CHEST", "Ngực", true],
      ["RIBS", "Xương sườn", true],
      ["LEFT_KNEE", "Gối trái", true],
    ]);
    const paint = paintRegions(rows);
    expect(paint.HEAD).toEqual({ color: STATUS_COLOR.injury, R: EXTRA_REGIONS.HEAD!.R, core: 0.25 });
    expect(paint.NECK!.color).toBe(STATUS_COLOR.recovering);
    expect(paint.CHEST!.color).toBe(STATUS_COLOR.healed);
    expect(paint.L_KNEE!.R).toBe(0.08);
    for (const k of Object.keys(EXTRA_REGIONS)) expect(BODY_MODEL.meta.regions[k]).toBeUndefined();
  });
});

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
    expect(s.getAllByText("Vùng khác")[0]).toBeTruthy();
    expect(s.getByLabelText("Về mô hình 3D")).toBeTruthy();
  });

  it("giảm chuyển động → SVG", async () => {
    mockReduced = true;
    const s = await renderSection();
    expect(s.getByTestId("body-fallback")).toBeTruthy();
    expect(s.queryByTestId("body3d-frame")).toBeNull();
  });

  it("thẻ nguồn: dòng ngắn, dòng 'Nguồn và giấy phép', CC BY 4.0 mở trang giấy phép chính thức", async () => {
    mockReduced = true;
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const s = await renderSection();
    await fireEvent.press(s.getByText("Về mô hình 3D"));
    expect(s.getByText("Mô hình cơ thể")).toBeTruthy();
    expect(s.getByText("Nguồn và giấy phép")).toBeTruthy();
    expect(s.getByText('Dựa trên "Male base muscular anatomy" của Harshit Prajapati,')).toBeTruthy();
    expect(s.getByText(", đã được chỉnh sửa.")).toBeTruthy();
    await fireEvent.press(s.getByLabelText("Mở giấy phép CC BY 4.0"));
    expect(open).toHaveBeenCalledWith("https://creativecommons.org/licenses/by/4.0/");
    await fireEvent.press(s.getByText("Mở trang mô hình"));
    expect(open).toHaveBeenLastCalledWith(expect.stringContaining("sketchfab.com/3d-models/male-base-muscular-anatomy"));
    open.mockRestore();
  });

  it("có vùng cột sống thì khôi phục lời nhắc xoay để xem phía sau", async () => {
    const s = await renderSection(true);
    expect(await s.findByLabelText("Có vùng ở phía sau. Xoay để xem")).toBeTruthy();
    expect(s.getByText("Cột sống")).toBeTruthy();
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
