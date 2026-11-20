import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { MedicalExamination } from "@/api/types";
import { doctorClinical as c } from "@/i18n/doctor-clinical";
import { ThemePreferenceProvider } from "@/theme/theme-preference";

import { examHref, examView } from "./exam-model";

const mockParams: Record<string, string> = {};
const mockPush = jest.fn();
let mockSelected: { id: string } | null = null;
const mockRedirect = jest.fn();

jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("@/components/body3d/body-canvas", () => ({ __esModule: true, default: () => null }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: unknown }) => { mockRedirect(href); return null; },
}));
jest.mock("@/api/doctor/doctor-ro", () => ({ doctorRoApi: jest.requireActual("@/api/doctor/doctor-ro.mock").mockDoctorRoApi }));
jest.mock("@/screens/doctor/redesign/doctor-roster", () => ({
  useDoctorRoster: () => ({ items: [{ id: "cf-4", firstName: "Huy", lastName: "Phạm" }], loaded: true, loading: false, error: "", enabled: true }),
}));
jest.mock("@/screens/doctor/selected-fighter", () => ({ useSelectedFighter: () => ({ fighter: mockSelected }) }));

jest.setTimeout(30000);

async function wrap(node: ReactNode) {
  return await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemePreferenceProvider>{node}</ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}

/* eslint-disable @typescript-eslint/no-require-imports */
const tabs = () => require("./doctor-detail-tabs") as typeof import("./doctor-detail-tabs");
const page = () => require("./exam-page") as typeof import("./exam-page");
const old = () => require("./old-route") as typeof import("./old-route");

beforeEach(() => {
  for (const k of Object.keys(mockParams)) delete mockParams[k];
  mockPush.mockReset(); mockRedirect.mockReset(); mockSelected = null;
});

describe("doctor clinical tabs (redesign step 20)", () => {
  it("an exam row reads 'Tập luyện #3', the decision word, then date · type · follow-up · joints", () => {
    const e = {
      id: "x", sequenceNo: 3, scope: "TRAINING", decision: "NOT_ELIGIBLE", examinedAt: "2026-11-02T03:00:00Z", validUntil: null,
      restrictions: { excludedJoints: ["RIGHT_KNEE"] }, details: { examinationType: "POST_INJURY", followUpDate: "2026-11-16" },
    } as unknown as MedicalExamination;
    const v = examView(e);
    expect(v.title).toBe("Tập luyện #3");
    expect(v.word).toBe("Không đạt");
    expect(v.tone).toBe("warn");
    expect(v.mark).toBe("!");
    expect(v.line).toMatch(/^02\/11 · .+ · tái khám 16\/11 · tránh gối phải$/);
    expect(examView({ ...e, decision: "ELIGIBLE", details: null, restrictions: null, validUntil: "2026-11-30T00:00:00Z" } as MedicalExamination).line).toBe("02/11 · đến 30/11");
  });

  it("Khám: one row per exam with the word; a row opens the exam page", async () => {
    const { ExamsTab } = tabs();
    const ui = await wrap(<ExamsTab fighterId="cf-4" enabled bind={() => undefined}/>);
    await waitFor(() => expect(ui.getByTestId("exam-ex-3")).toBeTruthy(), { timeout: 3000 });
    expect(ui.getByTestId("exam-ex-3").props.accessibilityLabel).toContain("Không đạt");
    expect(within(ui.getByTestId("exam-requests")).getByText(/Võ sĩ báo đau khi xoay gối/)).toBeTruthy();
    fireEvent.press(ui.getByTestId("exam-ex-3"));
    expect(mockPush).toHaveBeenCalledWith(examHref("ex-3", "cf-4"));
  });

  it("Tổng quan: a clearance row opens the revoke sheet; nothing is sent", async () => {
    const { OverviewTab } = tabs();
    const { mockDoctorRoApi } = jest.requireActual("@/api/doctor/doctor-ro.mock");
    const dossier = await mockDoctorRoApi.getDossier("cf-1");
    const ui = await wrap(<OverviewTab fighterId="cf-1" enabled dossier={{ data: dossier, loading: false, error: "", reload: jest.fn(), refresh: jest.fn(async () => undefined) }}/>);
    expect(ui.getByTestId("elig-training").props.accessibilityLabel).toMatch(new RegExp(`^${c.training}, (${c.allowed}|${c.notAllowed})`));
    fireEvent.press(ui.getByTestId("clearance-cl-1c"));
    expect(await ui.findByText("Thu hồi giấy phép?", { exact: false })).toBeTruthy();
    ui.unmount();
  });
});

describe("doctor exam page (redesign step 20)", () => {
  it("decision row, vitals strip, abnormal area first, restrictions; no save button", async () => {
    mockParams.id = "ex-3"; mockParams.fighterId = "cf-4";
    const { DoctorExamPage } = page();
    const ui = await wrap(<DoctorExamPage/>);
    await waitFor(() => expect(ui.getByTestId("exam-decision")).toBeTruthy(), { timeout: 3000 });
    expect(ui.getByTestId("exam-decision").props.accessibilityLabel).toMatch(/^Không đạt, Tái khám /);
    expect(ui.getByText(/Huy Phạm · Tập luyện #3 · /)).toBeTruthy();
    expect(ui.getByLabelText("Cân nặng: 78,4kg")).toBeTruthy();
    expect(ui.getByTestId("area-0").props.accessibilityLabel).toMatch(/^Gối phải, /);
    expect(ui.getByLabelText(`${c.avoidJoints}: Gối phải`)).toBeTruthy();
    expect(ui.queryByText(/Phiên bản/)).toBeNull();
    expect(ui.queryByRole("button", { name: /Lưu/ })).toBeNull();
  });

  it("an id that is not in the list says so", async () => {
    mockParams.id = "nope"; mockParams.fighterId = "cf-4";
    const { DoctorExamPage } = page();
    const ui = await wrap(<DoctorExamPage/>);
    expect(await ui.findByTestId("exam-missing", {}, { timeout: 3000 })).toBeTruthy();
  });
});

describe("old doctor routes (redesign step 20)", () => {
  it("go to the fighter page tab, the exam page, or the Võ sĩ list", async () => {
    const { DoctorOldRoute } = old();
    await wrap(<DoctorOldRoute tab="history"/>);
    expect(mockRedirect).toHaveBeenLastCalledWith("/(doctor)/vo-si");
    mockSelected = { id: "cf-4" };
    await wrap(<DoctorOldRoute tab="history"/>);
    expect(mockRedirect).toHaveBeenLastCalledWith({ pathname: "/(doctor)/vo-si/chi-tiet", params: { id: "cf-4", tab: "history" } });
    await wrap(<DoctorOldRoute/>);
    expect(mockRedirect).toHaveBeenLastCalledWith({ pathname: "/(doctor)/vo-si/chi-tiet", params: { id: "cf-4" } });
    mockParams.examId = "ex-3";
    await wrap(<DoctorOldRoute tab="exams" exam/>);
    expect(mockRedirect).toHaveBeenLastCalledWith(examHref("ex-3", "cf-4"));
  });
});

describe("date ranges (step 20 app check)", () => {
  it("no end date reads 'từ dd/mm', never a dash", () => {
    const { dateRange } = tabs();
    expect(dateRange("2026-11-10T00:00:00Z", null)).toBe("từ 10/11");
    expect(dateRange("2026-10-05T00:00:00Z", "2026-11-24T00:00:00Z")).toBe("05/10 – 24/11/2026");
  });
});
