import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { useLoad } from "@/screens/fighter/use-load";
import { ThemePreferenceProvider } from "@/theme";
import { FighterHomeSkeleton, HealthDossierSkeleton, MedicalOverviewSkeleton } from "@/components/screen-skeletons";

let api: ReturnType<typeof useLoad<string>> | null = null;
function Probe({ run }: { run: () => Promise<string> }) {
  const state = useLoad(true, "k", run);
  api = state;
  return <Text>{state.data ?? (state.error || "…")}</Text>;
}

describe("useLoad.refresh", () => {
  it("làm mới lỗi thì giữ dữ liệu cũ và reject để hiện toast", async () => {
    const run = jest.fn().mockResolvedValueOnce("v1").mockRejectedValueOnce(new Error("x"));
    await render(<Probe run={run} />);
    expect(await screen.findByText("v1")).toBeTruthy();
    let failed = false;
    await act(async () => {
      await api!.refresh().catch(() => {
        failed = true;
      });
    });
    expect(failed).toBe(true);
    expect(screen.getByText("v1")).toBeTruthy();
  });
});

describe("khung chờ theo hình màn", () => {
  it.each([
    ["trang chủ", FighterHomeSkeleton],
    ["tổng quan y tế", MedicalOverviewSkeleton],
    ["hồ sơ sức khỏe", HealthDossierSkeleton],
  ])("%s có nhãn Đang tải", async (_name, Comp) => {
    await render(
      <ThemePreferenceProvider>
        <Comp />
      </ThemePreferenceProvider>,
    );
    expect(screen.getAllByLabelText("Đang tải").length).toBeGreaterThan(0);
  });
});
