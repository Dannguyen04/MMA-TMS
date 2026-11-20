/**
 * T-048 F9 (the F2 week-stat cases went with the retired fighter home-screen, 2026-11). Session dates are fixed offsets from the current Monday-start week (fake timers stall the
 * screens' async loads), so "this week" and "next week" never depend on the day the suite runs.: where the fighter suspension card renders, and the separate "Chờ xếp lại" count.
 * Presentation-only modules are stubbed; the screens, the card and the selection rules are real.
 */
import { render, within } from "@testing-library/react-native";
import type { Suspension } from "@/features/fight-camp/api";
import { FighterBodyScreen } from "./body-screen";
import { SuspensionCard } from "@/features/fight-camp/components/camp-suspension";
import { startOfWeek } from "@/screens/fighter/redesign/week";

const week = startOfWeek(new Date());
const at = (day: number, hour: number) => { const d = new Date(week); d.setDate(week.getDate() + day); d.setHours(hour, 0, 0, 0); return d.toISOString(); };

jest.mock("expo-router", () => { const r = { push: jest.fn() }; return { useRouter: () => r, useFocusEffect: () => undefined, useLocalSearchParams: () => ({}) }; });
jest.mock("@/session/session-context", () => { const v = { isDemo: false, gate: "fighter", user: { id: "u1" } }; return { useSession: () => v }; });
jest.mock("@/theme/index", () => ({ ...jest.requireActual("@/theme/index"), useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light }) }));
jest.mock("@/screens/fighter/redesign/palette", () => {
  const p = jest.requireActual("@/theme/colors").palettes.light;
  return { useFighterPalette: () => new Proxy({}, { get: (_t, k) => (p as Record<string, string>)[k as string] ?? "#000" }) };
});
// Stable identities: the screens key their loaders on these objects.
jest.mock("./use-fighter-id", () => { const v = { fighterId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", profile: { firstName: "Long" }, user: null, isDemo: false, gate: "fighter", canFetch: true }; return { useFighterId: () => v }; });
jest.mock("@/screens/fighter/redesign/shell", () => {
  const { Text, View } = require("react-native");
  return { FighterHub: ({ children }: { children: unknown }) => <View>{children as never}</View>, HubHeader: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock("@/components/toast/app-toast", () => ({ useToastMessage: () => undefined }));
jest.mock("@/components/feedback/screen-skeletons", () => ({ FighterHomeSkeleton: () => null, HealthDossierSkeleton: () => null }));
jest.mock("@/components/motion/motion", () => {
  const { View, Pressable } = require("react-native");
  return { FadeInView: ({ children }: { children: unknown }) => <View>{children as never}</View>, PressableScale: (p: object) => <Pressable {...p}/>, Skeleton: () => null };
});
jest.mock("@/screens/fighter/redesign/health-status", () => {
  const { Text } = require("react-native");
  return { TodayCard: () => <Text>TODAY</Text>, EligibilityTiles: () => <Text testID="eligibility-tiles">Cấp phép y tế</Text>, HealthInfoButton: () => null };
});
jest.mock("@/screens/fighter/redesign/exam-requests", () => ({ ExamRequestSection: () => null }));
jest.mock("@/screens/one-tap/medical-review-action", () => ({ MedicalReviewAction: () => null }));
jest.mock("@/shared/ui/camp-ui", () => require("@/features/fight-camp/testing/camp-test-ui").campUiMock());
jest.mock("@/features/fight-camp/api", () => ({ campApi: { suspensions: jest.fn() } }));
jest.mock("./api", () => ({ getMe: jest.fn(), listSessionsForFighter: jest.fn(), listPlansForFighter: jest.fn() }));
jest.mock("@/api/index", () => ({ ...jest.requireActual("@/api/types"), ...jest.requireActual("@/api/core/errors"), getFighterMedical: jest.fn(), listFighterDoctors: jest.fn() }));

const { campApi } = jest.requireMock("@/features/fight-camp/api") as { campApi: { suspensions: jest.Mock } };
const fapi = jest.requireMock("./api") as Record<string, jest.Mock>;
const api = jest.requireMock("@/api/index") as Record<string, jest.Mock>;

const active: Suspension = { id: "s1", reason: "MANDATORY_REST", status: "ACTIVE", startsOn: "2026-10-26", endsOn: "2026-11-01", blockedSessionTypes: ["SPARRING", "GRAPPLING", "PAD_WORK", "HEAVY_BAG", "SHADOW_BOXING", "STRENGTH_CONDITIONING"], requiresClearance: false, clearedAt: null, clearanceNote: null, maxAllowedTier: 1, gradedReturn: null };
const session = (id: string, scheduledAt: string, status: string) => ({ id, fighterId: "f", coachId: null, planId: null, title: id, scheduledAt, plannedDurationSec: 3600, actualDurationSec: null, roundCount: 3, location: null, sessionType: "HEAVY_BAG", status, coachNotes: null, completedAt: null });
const dossier = { fighterId: "f", activeInjuries: [], activeRecoveryPlans: [], activeClearances: [], openReviewRequests: [], currentExaminations: { training: null, competition: null }, eligibility: { training: { scope: "TRAINING", eligible: true, reasons: [] }, competition: { scope: "COMPETITION", eligible: true, reasons: [] } } };

/** Text nodes in render order, so placement can be asserted as "A comes before B". */
function order(ui: Awaited<ReturnType<typeof render>>): string[] {
  const out: string[] = [];
  const walk = (n: unknown) => { if (n == null) return; if (typeof n === "string") { out.push(n); return; } if (Array.isArray(n)) { n.forEach(walk); return; } const o = n as { props?: { testID?: string }; children?: unknown[] }; if (o.props?.testID) out.push(`#${o.props.testID}`); (o.children ?? []).forEach(walk); };
  walk(ui.toJSON()); return out;
}

beforeEach(() => {
  campApi.suspensions.mockResolvedValue({ data: [active], hasNextPage: false, nextCursor: null });
  fapi.getMe.mockResolvedValue({ id: "u1", profile: null });
  fapi.listPlansForFighter.mockResolvedValue({ data: [], total: 0 });
  fapi.listSessionsForFighter.mockResolvedValue({ data: [
    session("done", at(0, 10), "COMPLETED"),
    session("p1", at(2, 17), "PENDING"),
    session("p2", at(6, 17), "PENDING"),
    session("p-next-week", at(8, 17), "PENDING"),
    session("sch", at(6, 8), "SCHEDULED"),
  ], total: 5 });
  api.getFighterMedical.mockResolvedValue(dossier);
  api.listFighterDoctors.mockResolvedValue({ data: [], total: 0 });
});
afterEach(() => { jest.clearAllMocks(); });

describe("T-048 F9: suspension card placement", () => {
  it("Hồ sơ sức khỏe tab: the card comes right after the medical clearance tiles", async () => {
    const ui = await render(<FighterBodyScreen/>);
    await ui.findByText("Đang đình chỉ đến 01/11");
    const t = order(ui);
    expect(t.indexOf("#eligibility-tiles")).toBeLessThan(t.indexOf("#suspension-card"));
  });
  it("Hồ sơ sức khỏe tab: a dossier failure does not hide the card", async () => {
    api.getFighterMedical.mockRejectedValue(new Error("offline"));
    const ui = await render(<FighterBodyScreen/>);
    expect(await ui.findByText("Đang đình chỉ đến 01/11")).toBeTruthy();
  });
  it("coach side (3A): the full record card only gains the Được tập line, no fighter ladder or link", async () => {
    const ui = await render(<SuspensionCard s={active}/>);
    expect(ui.getByText("Hôm nay được tập: phục hồi, vật lý trị liệu")).toBeTruthy();
    expect(ui.queryByTestId("suspension-ladder")).toBeNull();
    expect(ui.queryByText("Xem lịch sử đình chỉ")).toBeNull();
    expect(ui.getByText("Lý do: Nghỉ bắt buộc")).toBeTruthy();
  });
});
