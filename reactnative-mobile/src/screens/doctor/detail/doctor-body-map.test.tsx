/// <reference types="jest" />
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { MedicalDossier } from "@/api/types";
import { doctorRoApi } from "@/api/doctor-ro";
import { ThemePreferenceProvider } from "@/theme";
import { OverviewTab } from "./doctor-detail-tabs";

const mockBodyMap = jest.fn();
jest.mock("@/components/body3d/body-map-section", () => ({
  bodyText: { title: "Sơ đồ cơ thể" },
  BodyMapSection: (props: unknown) => {
    mockBodyMap(props);
    const { Text } = jest.requireActual("react-native");
    return <Text>Model cơ thể đã hiển thị</Text>;
  },
}));
jest.mock("@/api/doctor-ro", () => ({ doctorRoApi: {
  getMedicalSummary: jest.fn(), listDoctors: jest.fn(),
} }));

jest.mock("@/screens/video-ai/ai-ui", () => ({ AiAlertsBlock: () => null }));

describe("Doctor original body map", () => {
  beforeEach(() => jest.clearAllMocks());
  it("does not display the previous fighter's injuries while another fighter loads", async () => {
    const injuries = [{ affectedJoint: "RIGHT_KNEE", status: "ACTIVE", injuryType: "Căng cơ", severity: "MINOR" }];
    let resolveSecond!: (value: unknown) => void;
    (doctorRoApi.getMedicalSummary as jest.Mock).mockImplementation((id: string) => id === "first"
      ? Promise.resolve({ activeInjuries: injuries, jointStates: [] })
      : new Promise(resolve => { resolveSecond = resolve; }));
    (doctorRoApi.listDoctors as jest.Mock).mockResolvedValue({ data: [] });
    const dossier = { activeInjuries: [], activeClearances: [], activeRecoveryPlans: [], openReviewRequests: [] } as unknown as MedicalDossier;
    const view = (fighterId: string) => <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemePreferenceProvider><OverviewTab fighterId={fighterId} enabled dossier={{ data: dossier, loading: false, error: "", reload: jest.fn(), refresh: jest.fn() }}/></ThemePreferenceProvider>
    </SafeAreaProvider>;
    const ui = await render(view("first"));
    await screen.findByText("Model cơ thể đã hiển thị");
    expect(mockBodyMap).toHaveBeenLastCalledWith(expect.objectContaining({ injuries }));
    mockBodyMap.mockClear();
    await ui.rerender(view("second"));
    await waitFor(() => expect(doctorRoApi.getMedicalSummary).toHaveBeenCalledWith("second"));
    expect(screen.queryByText("Model cơ thể đã hiển thị")).toBeNull();
    expect(mockBodyMap).not.toHaveBeenCalled();
    await act(async () => { resolveSecond({ activeInjuries: [], jointStates: [] }); });
    await screen.findByText("Model cơ thể đã hiển thị");
    expect(mockBodyMap).toHaveBeenLastCalledWith(expect.objectContaining({ injuries: [], jointStates: [] }));
  });

  it("loads the medical summary and renders the original body regions", async () => {
    const injuries = [{ id: "injury-1", affectedJoint: "RIGHT_SHOULDER", status: "ACTIVE", injuryType: "Căng cơ", severity: "MILD", occurredAt: "2026-10-25T00:00:00Z" }];
    const jointStates = [{ id: "joint-1", joint: "LEFT_KNEE", currentState: "SUSPECTED_AVOIDANCE", stateUpdatedAt: "2026-10-25T00:00:00Z", notes: null }];
    (doctorRoApi.getMedicalSummary as jest.Mock).mockResolvedValue({ activeInjuries: injuries, jointStates });
    (doctorRoApi.listDoctors as jest.Mock).mockResolvedValue({ data: [] });
    const dossier = {
      activeInjuries: injuries, activeClearances: [], activeRecoveryPlans: [], openReviewRequests: [],
      eligibility: { training: { eligible: true, reasons: [] }, competition: { eligible: true, reasons: [] } },
    } as unknown as MedicalDossier;
    await render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemePreferenceProvider><OverviewTab fighterId="fighter-1" enabled dossier={{ data: dossier, loading: false, error: "", reload: jest.fn(), refresh: jest.fn() }}/></ThemePreferenceProvider>
    </SafeAreaProvider>);
    expect(await screen.findByText("Model cơ thể đã hiển thị")).toBeTruthy();
    await waitFor(() => expect(doctorRoApi.getMedicalSummary).toHaveBeenCalledWith("fighter-1"));
    expect(mockBodyMap).toHaveBeenLastCalledWith(expect.objectContaining({ injuries, jointStates }));
  });
});
