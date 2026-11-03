import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";

import { FilterSelect } from "@/components/filter-sheet";
import { ThemePreferenceProvider } from "@/theme/theme-preference";

const OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "A", label: "Đã lên lịch" },
  { value: "B", label: "Đã xong" },
] as const;

function Single({ spy }: { spy: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <FilterSelect label="Trạng thái" options={OPTIONS} value={v} allValue="" onChange={(n) => { setV(n); spy(n); }} />
  );
}

function Multi({ spy }: { spy: (v: string[]) => void }) {
  const [v, setV] = useState<string[]>([]);
  return (
    <FilterSelect multiple label="Loại" options={OPTIONS.slice(1)} value={v} onChange={(n) => { setV(n); spy(n); }} />
  );
}

describe("FilterSelect", () => {
  it("chọn một: hiện lựa chọn hiện tại và áp dụng ngay", async () => {
    const spy = jest.fn();
    await render(<ThemePreferenceProvider><Single spy={spy} /></ThemePreferenceProvider>);
    await fireEvent.press(await screen.findByLabelText("Trạng thái: Tất cả. Mở bộ lọc"));
    await fireEvent.press(await screen.findByText("Đã xong"));
    expect(spy).toHaveBeenCalledWith("B");
    expect(await screen.findByLabelText("Trạng thái: Đã xong. Mở bộ lọc")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("chọn nhiều: chỉ áp dụng khi bấm Áp dụng; Xoá lọc bỏ hết", async () => {
    const spy = jest.fn();
    await render(<ThemePreferenceProvider><Multi spy={spy} /></ThemePreferenceProvider>);
    await fireEvent.press(await screen.findByLabelText("Loại: Tất cả. Mở bộ lọc"));
    await fireEvent.press(await screen.findByText("Đã lên lịch"));

    await fireEvent.press(screen.getByText("Đã xong"));
    expect(spy).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Áp dụng (2)"));
    expect(spy).toHaveBeenCalledWith(["A", "B"]);
    await fireEvent.press(await screen.findByLabelText("Loại: Đã lên lịch +1. Mở bộ lọc"));
    await fireEvent.press(await screen.findByText("Xoá lọc"));
    await fireEvent.press(screen.getByText("Áp dụng"));
    expect(spy).toHaveBeenLastCalledWith([]);
  });
});
