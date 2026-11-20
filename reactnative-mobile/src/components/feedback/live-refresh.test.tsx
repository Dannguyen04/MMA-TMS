/// <reference types="jest" />
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useLiveRefresh } from "./live-refresh";
import { useWeekItems } from "@/components/schedule/use-week";

const mockFocus: { effect: null | (() => void) } = { effect: null };
jest.mock("expo-router", () => ({ useFocusEffect: (e: () => void) => { mockFocus.effect = e; } }));
jest.mock("@/theme/index", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light }) }));

describe("live refresh", () => {
  it("skips the first focus and refetches on every return", async () => {
    const refresh = jest.fn(async () => undefined);
    await renderHook(() => useLiveRefresh(refresh));
    await act(async () => { mockFocus.effect?.(); });
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => { mockFocus.effect?.(); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("pull-to-refresh shows the spinner until the refetch ends, even when it fails", async () => {
    let finish!: () => void;
    const { result } = await renderHook(() => useLiveRefresh(() => new Promise<void>((_, reject) => { finish = () => reject(new Error("x")); })));
    await act(async () => { result.current.onRefresh(); });
    expect(result.current.refreshing).toBe(true);
    await act(async () => { finish(); });
    await waitFor(() => expect(result.current.refreshing).toBe(false));
  });

  it("a quiet week refetch where every source fails keeps the week on screen", async () => {
    const days = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
    const item = { key: "a", date: "2026-11-11", kind: "SESSION", title: "Sức mạnh", who: "", target: { kind: "session", id: "s" } } as never;
    const loader = jest.fn().mockResolvedValueOnce([item]).mockRejectedValue(new Error("down"));
    const loaders = [loader];
    const { result } = await renderHook(() => useWeekItems(true, days, loaders, "k"));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.refresh(); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
