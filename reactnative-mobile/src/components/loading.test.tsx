import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { useRefreshable } from "@/components/loading";
import { showAppToast } from "@/components/toast/app-toast";

jest.mock("@/components/toast/app-toast", () => ({ showAppToast: jest.fn() }));

let api: ReturnType<typeof useRefreshable<string>> | null = null;
function Probe({ run }: { run: () => Promise<string> }) {
  const state = useRefreshable(true, "k", run, () => "lỗi đầu");
  api = state;
  return <Text>{state.loading ? "skeleton" : state.error || state.data}</Text>;
}

describe("useRefreshable", () => {
  it("làm mới lỗi thì giữ dữ liệu cũ và báo toast", async () => {
    const run = jest.fn().mockResolvedValueOnce("v1").mockRejectedValueOnce(new Error("x"));
    await render(<Probe run={run} />);
    expect(await screen.findByText("v1")).toBeTruthy();
    await act(async () => {
      api!.refresh();
    });
    expect(screen.getByText("v1")).toBeTruthy();
    expect(showAppToast).toHaveBeenCalled();
  });

  it("lần đầu lỗi thì hiện lỗi", async () => {
    await render(<Probe run={() => Promise.reject(new Error("x"))} />);
    expect(await screen.findByText("lỗi đầu")).toBeTruthy();
  });
});
