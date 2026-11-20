import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { ApplicantApplication, StaffApplication } from "@/api/admissions/admissions";
import { ThemePreferenceProvider } from "@/theme/theme-preference";

import { ageOf, nameInitials, stepCells, vnDay } from "./adm-parts";
import { criterionFromDraft } from "./coach-admissions";

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
const mockAssign = jest.fn((..._a: unknown[]) => Promise.resolve({}));
const mockDecide = jest.fn((..._a: unknown[]) => Promise.resolve({}));
const mockAssess = jest.fn((..._a: unknown[]) => Promise.resolve({}));
const mockSubmit = jest.fn((..._a: unknown[]) => Promise.resolve({ id: "new1" }));
let mockApps: StaffApplication[] = [];
let mockOwn: ApplicantApplication[] = [];

jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("react-native-toast-message", () => ({ __esModule: true, default: { show: jest.fn(), hide: jest.fn() } }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => { const { useEffect } = jest.requireActual("react"); useEffect(cb, [cb]); },
}));
jest.mock("@/session/session-context", () => ({
  useSession: () => ({ isDemo: false, user: { id: "u-g", role: "GUEST", email: "hoa.tran@gmail.com", profile: { id: "c1", firstName: "Hùng", lastName: "Lê" } }, signOut: jest.fn(() => Promise.resolve()), applyRegisteredSession: jest.fn() }),
  homeHrefForGate: () => "/",
}));
jest.mock("@/api/auth/auth", () => ({ getMe: jest.fn() }));
jest.mock("@/api", () => ({
  listUsers: () => Promise.resolve({ items: [
    { id: "u1", email: "hung@lotus-combat.test", role: "COACH", isActive: true, profile: { id: "c1", firstName: "Hùng", lastName: "Lê", specialization: "Muay Thai" } },
    { id: "u2", email: "nam@lotus-combat.test", role: "COACH", isActive: true, profile: { id: "c2", firstName: "Nam", lastName: "Đào", specialization: null } },
  ], total: 2, page: 1, limit: 100 }),
  getUser: () => Promise.resolve({ role: "FIGHTER", profile: { id: "f9" } }),
  listFighterCoaches: () => Promise.resolve([]),
  assignFighterCoach: jest.fn(),
}));
jest.mock("@/api/admissions/admissions", () => ({
  listApplications: (q: { status?: string }) => Promise.resolve({ items: q.status ? mockApps.filter(a => a.status === q.status) : mockApps, total: mockApps.length, page: 1, limit: 100 }),
  getApplication: (id: string) => Promise.resolve(mockApps.find(a => a.id === id)),
  listAssignedApplications: () => Promise.resolve({ items: mockApps, total: mockApps.length, page: 1, limit: 100 }),
  getAssignedApplication: (id: string) => Promise.resolve(mockApps.find(a => a.id === id)),
  assignApplicationCoach: (...a: unknown[]) => mockAssign(...a),
  decideApplication: (...a: unknown[]) => mockDecide(...a),
  resendActivationEmail: jest.fn(() => Promise.resolve({})),
  submitAssessment: (...a: unknown[]) => mockAssess(...a),
  listOwnApplications: () => Promise.resolve({ items: mockOwn, total: mockOwn.length, page: 1, limit: 50 }),
  getOwnApplication: (id: string) => Promise.resolve(mockOwn.find(a => a.id === id)),
  activateAdmission: jest.fn(),
  submitApplication: (...a: unknown[]) => mockSubmit(...a),
}));

jest.setTimeout(30000);

const applicant = { email: "hoa.tran@gmail.com", firstName: "Văn Hòa", lastName: "Trần", dateOfBirth: "2003-03-14", weightClass: "LIGHTWEIGHT" as const,
  nationality: "VN", contactPhone: "+84903112233", trainingBackground: "3 năm Muay Thai", competitionBackground: null, motivation: "Muốn thi đấu chuyên nghiệp." };
const app = (id: string, status: StaffApplication["status"], extra: Partial<StaffApplication> = {}): StaffApplication => ({
  id, guestUserId: `g-${id}`, status, submittedAt: "2026-11-01T03:00:00Z", applicant, accountEmail: null,
  currentAssignment: null, assignmentHistory: [], assessment: null, decision: null, activation: null, ...extra,
});

const wrap = async (el: ReactNode) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
    <ThemePreferenceProvider>{el}</ThemePreferenceProvider>
  </SafeAreaProvider>,
);

/* eslint-disable @typescript-eslint/no-require-imports */
beforeEach(() => {
  mockParams = {}; mockApps = []; mockOwn = [];
  [mockPush, mockReplace, mockAssign, mockDecide, mockAssess, mockSubmit].forEach(m => m.mockClear());
});

describe("admissions (step 24) helpers", () => {
  it("steps, initials, dates, criteria", () => {
    expect(stepCells("SUBMITTED")).toEqual(["done", "now", "todo", "todo"]);
    expect(stepCells("REJECTED")).toEqual(["done", "done", "no", "todo"]);
    expect(stepCells("ACTIVATED")).toEqual(["done", "done", "done", "done"]);
    expect(nameInitials("Trần Văn Hòa")).toBe("TH");
    expect(vnDay("2003-03-14")).toBe("14/03/2003");
    expect(ageOf("2003-03-14", Date.UTC(2026, 10, 13))).toBe(23);
    expect(criterionFromDraft({ name: "Hít đất", method: "Đếm", observation: "", value: "", unit: "", note: "" })).toBe("Hãy điền tên, cách đo và quan sát.");
    expect(criterionFromDraft({ name: "Hít đất", method: "Đếm", observation: "Chuẩn", value: "12,5", unit: "lần", note: "" }))
      .toEqual({ criterionName: "Hít đất", method: "Đếm", observation: "Chuẩn", value: 12.5, unit: "lần" });
  });
});

describe("admin Nhập học", () => {
  it("lists Cần xử lý by default; the Trạng thái sheet switches to Tất cả", async () => {
    mockApps = [app("a1", "SUBMITTED"), app("a2", "APPROVED"), app("a3", "FAILED")];
    const { AdminAdmissionsScreen } = require("./admin-admissions");
    await wrap(<AdminAdmissionsScreen/>);
    expect(await screen.findByTestId("adm-row-a1")).toBeTruthy();
    expect(screen.getByTestId("adm-row-a3")).toBeTruthy();
    expect(screen.queryByTestId("adm-row-a2")).toBeNull();
    await fireEvent.press(screen.getByTestId("adm-filter"));
    await fireEvent.press(screen.getByTestId("adm-filter-opt-ALL"));
    expect(await screen.findByTestId("adm-row-a2")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("adm-row-a1"));
    expect(mockPush).toHaveBeenLastCalledWith("/quan-tri/nhap-hoc/a1");
  });

  it("Đã nộp: choose a coach, then Giao HLV", async () => {
    mockApps = [app("a1", "SUBMITTED")];
    mockParams = { id: "a1" };
    const { AdminAdmissionScreen } = require("./admin-admissions");
    await wrap(<AdminAdmissionScreen/>);
    expect(await screen.findByLabelText("HLV đánh giá: Chọn HLV")).toBeTruthy();
    expect(screen.getByLabelText("Chờ đánh giá, Chưa có HLV đánh giá")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Giao HLV" })).toBeDisabled();
    await fireEvent.press(screen.getByTestId("adm-coach"));
    await fireEvent.press(screen.getByTestId("adm-coach-c2"));
    expect(screen.getByLabelText("HLV đánh giá: Nam Đào")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Giao HLV" }));
    expect(mockAssign).toHaveBeenCalledWith("a1", { coachId: "c2", reassignmentReason: undefined });
  });

  it("Đạt test: Duyệt needs a reason; Từ chối asks first", async () => {
    mockApps = [app("a1", "PASSED", { assessment: { id: "s1", coachId: "c1", conclusion: "PASS", summary: "Nền tảng tốt.", criteria: [{ criterionName: "Hít đất 1 phút", method: "Đếm", observation: "Chuẩn", value: 12, unit: "lần" }], assessedAt: "2026-11-05T03:00:00Z" } })];
    mockParams = { id: "a1" };
    const { AdminAdmissionScreen } = require("./admin-admissions");
    await wrap(<AdminAdmissionScreen/>);
    expect(await screen.findByTestId("adm-assessment")).toBeTruthy();
    expect(screen.getByLabelText("Huấn luyện viên: Hùng Lê")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Duyệt" })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("Lý do"), "Đủ điều kiện.");
    await fireEvent.press(screen.getByRole("button", { name: "Từ chối" }));
    expect(mockDecide).not.toHaveBeenCalled();
    expect(await screen.findByText("Từ chối hồ sơ này?")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("sheet-cancel"));
    await fireEvent.press(screen.getByRole("button", { name: "Duyệt" }));
    expect(mockDecide).toHaveBeenCalledWith("a1", { decision: "APPROVED", reason: "Đủ điều kiện." });
  });
});

describe("coach Đánh giá", () => {
  it("lists only waiting files by default", async () => {
    mockApps = [app("a1", "SUBMITTED"), app("a2", "PASSED", { assessment: { id: "s", coachId: "c1", conclusion: "PASS", summary: "x", criteria: [], assessedAt: "2026-11-02T03:00:00Z" } })];
    const { CoachAdmissionsScreen } = require("./coach-admissions");
    await wrap(<CoachAdmissionsScreen/>);
    expect(await screen.findByLabelText("Trần Văn Hòa, Chờ đánh giá, nộp 01/11")).toBeTruthy();
    expect(screen.queryByTestId("adm-row-a2")).toBeNull();
    await fireEvent.press(screen.getByTestId("adm-show"));
    await fireEvent.press(screen.getByTestId("adm-show-opt-ALL"));
    expect(await screen.findByLabelText("Trần Văn Hòa, Đạt, đánh giá 02/11")).toBeTruthy();
  });

  it("form: add a criterion in the sheet, choose Đạt, write a summary, confirm, send", async () => {
    mockApps = [app("a1", "SUBMITTED")];
    mockParams = { id: "a1" };
    const { CoachAdmissionScreen } = require("./coach-admissions");
    await wrap(<CoachAdmissionScreen/>);
    expect(await screen.findByTestId("adm-form")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gửi đánh giá" })).toBeDisabled();
    await fireEvent.press(screen.getByTestId("adm-add-criterion"));
    await fireEvent.press(screen.getByRole("button", { name: "Lưu tiêu chí" }));
    expect(screen.getByTestId("adm-criterion-error")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Tên tiêu chí"), "Hít đất 1 phút");
    await fireEvent.changeText(screen.getByLabelText("Cách đo"), "Đếm số lần");
    await fireEvent.changeText(screen.getByLabelText("Quan sát"), "Tư thế chuẩn");
    await fireEvent.changeText(screen.getByLabelText("Giá trị"), "12");
    await fireEvent.press(screen.getByRole("button", { name: "Lưu tiêu chí" }));
    expect(await screen.findByTestId("adm-criterion-0")).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: "Đạt" }));
    await fireEvent.changeText(screen.getByLabelText("Tóm tắt"), "Nền tảng tốt.");
    await fireEvent.press(screen.getByRole("button", { name: "Gửi đánh giá" }));
    expect(mockAssess).not.toHaveBeenCalled();
    await fireEvent.press(await screen.findByTestId("sheet-confirm"));
    await waitFor(() => expect(mockAssess).toHaveBeenCalledWith("a1", { conclusion: "PASS", summary: "Nền tảng tốt.",
      criteria: [{ criterionName: "Hít đất 1 phút", method: "Đếm số lần", observation: "Tư thế chuẩn", value: 12 }] }));
  });
});

describe("applicant", () => {
  const own = (id: string, status: ApplicantApplication["status"]): ApplicantApplication => ({ id, status, submittedAt: "2026-11-01T03:00:00Z", applicant, assessment: null, decision: null, activation: null });

  it("guest home: an open file hides Nộp hồ sơ and says so", async () => {
    mockOwn = [own("o1", "SUBMITTED")];
    const { ApplicantHomeScreen } = require("./applicant-screens");
    await wrap(<ApplicantHomeScreen guest/>);
    expect(await screen.findByTestId("adm-own-o1")).toBeTruthy();
    expect(screen.getByText("Bạn đang có một hồ sơ chờ xử lý.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nộp hồ sơ" })).toBeNull();
    expect(screen.getByLabelText("Tài khoản: hoa.tran@gmail.com")).toBeTruthy();
  });

  it("guest home: a closed file leaves Nộp hồ sơ in the footer", async () => {
    mockOwn = [own("o1", "FAILED")];
    const { ApplicantHomeScreen } = require("./applicant-screens");
    await wrap(<ApplicantHomeScreen guest/>);
    await fireEvent.press(await screen.findByRole("button", { name: "Nộp hồ sơ" }));
    expect(mockPush).toHaveBeenLastCalledWith("/ho-so/new");
  });

  it("form: Gửi hồ sơ without the first step sends you back with one line", async () => {
    const { ApplicationFormScreen } = require("./applicant-screens");
    await wrap(<ApplicationFormScreen/>);
    await fireEvent.press(screen.getByRole("button", { name: "Tiếp" }));
    await fireEvent.press(screen.getByRole("button", { name: "Tiếp" }));
    await fireEvent.press(screen.getByRole("button", { name: "Gửi hồ sơ" }));
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("adm-form-error")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Họ"), "Trần");
    await fireEvent.changeText(screen.getByLabelText("Tên"), "Văn Hòa");
    await fireEvent.changeText(screen.getByLabelText("Ngày sinh"), "14/03/2003");
    await fireEvent.press(screen.getByTestId("adm-weight"));
    await fireEvent.press(screen.getByTestId("adm-weight-opt-LIGHTWEIGHT"));
    await fireEvent.press(screen.getByRole("button", { name: "Tiếp" }));
    await fireEvent.press(screen.getByRole("button", { name: "Tiếp" }));
    await fireEvent.press(screen.getByRole("button", { name: "Gửi hồ sơ" }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ lastName: "Trần", firstName: "Văn Hòa", dateOfBirth: "2003-03-14", weightClass: "LIGHTWEIGHT", nationality: "VN" })));
    expect(mockReplace).toHaveBeenLastCalledWith("/ho-so/new1");
  });

  it("applicant page: approved with the password set shows Kích hoạt tài khoản", async () => {
    mockOwn = [{ ...own("o1", "APPROVED"), assessment: { conclusion: "PASS", assessedAt: "2026-11-05T03:00:00Z" }, decision: { decision: "APPROVED", decidedAt: "2026-11-07T03:00:00Z" }, activation: { status: "PASSWORD_SET" } }];
    mockParams = { id: "o1" };
    const { ApplicantScreen } = require("./applicant-screens");
    await wrap(<ApplicantScreen/>);
    expect(await screen.findByRole("button", { name: "Kích hoạt tài khoản" })).toBeTruthy();
    expect(screen.getByLabelText("Đã duyệt, Chờ bạn kích hoạt")).toBeTruthy();
    expect(screen.getByLabelText("Quyết định: Duyệt · 07/11")).toBeTruthy();
  });
});
