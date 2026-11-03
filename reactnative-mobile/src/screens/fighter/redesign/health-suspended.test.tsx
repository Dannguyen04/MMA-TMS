/// <reference types="jest" />
import { render } from "@testing-library/react-native";
import type { MedicalDossier } from "@/api/types";
import { ThemePreferenceProvider } from "@/theme";
import { EligibilityTiles, TodayCard } from "@/screens/fighter/redesign/health-status";
import { fighterBody as t } from "@/i18n/fighter-body";

const dossier = {
  fighterId: "f", activeInjuries: [], activeRecoveryPlans: [], activeClearances: [], openReviewRequests: [],
  currentExaminations: { training: { id: "e1", decision: "ELIGIBLE", restrictions: null }, competition: null },
  eligibility: { training: { scope: "TRAINING", eligible: true, reasons: [] }, competition: { scope: "COMPETITION", eligible: true, reasons: [] } },
} as unknown as MedicalDossier;
const wrap = (n: React.ReactNode) => render(<ThemePreferenceProvider>{n}</ThemePreferenceProvider>);

describe("Phase 5 B: medical card reads as the doctor's conclusion and never contradicts a suspension", () => {
  it("no suspension: doctor's conclusion, all clear", async () => {
    const ui = await wrap(<><TodayCard dossier={dossier} onRequest={() => undefined}/><EligibilityTiles dossier={dossier} onRequest={() => undefined}/></>);
    expect(await ui.findByText("Bác sĩ: đủ điều kiện tập luyện")).toBeTruthy();
    expect(ui.getByText(t.today.allClear)).toBeTruthy();
    expect(ui.getByLabelText("Tập luyện: Được")).toBeTruthy();
  });
  it("suspended: points to the suspension card and the training tile reads 'Theo đình chỉ'", async () => {
    const ui = await wrap(<><TodayCard dossier={dossier} onRequest={() => undefined} suspended/><EligibilityTiles dossier={dossier} onRequest={() => undefined} suspended/></>);
    expect(await ui.findByText("Bác sĩ: đủ điều kiện tập luyện")).toBeTruthy();
    expect(ui.getByText(t.today.suspendedNext)).toBeTruthy();
    expect(ui.queryByText(t.today.allClear)).toBeNull();
    expect(ui.queryByText("Bạn có thể tập luyện")).toBeNull();
    expect(ui.getByLabelText("Tập luyện: Theo đình chỉ")).toBeTruthy();
    expect(ui.getByLabelText("Thi đấu: Được")).toBeTruthy();
  });
});
