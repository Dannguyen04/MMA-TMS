import { fireEvent, render, screen } from "@testing-library/react-native";

import { cleanInitials, ClampText, KeyValueList, StatGrid } from "@/screens/doctor/doctor-ui";
import { ThemePreferenceProvider } from "@/theme/theme-preference";

describe("doctor-ui", () => {
  it("chữ cái đầu bỏ ngoặc và ký tự lạ", () => {
    expect(cleanInitials("UX Fighter", "[TEST]")).toBe("UT");
    expect(cleanInitials("Minh", "Nguyễn Nhật")).toBe("MN");
    expect(cleanInitials("", "")).toBe("?");
  });

  it("KeyValueList ẩn dòng rỗng, StatGrid có nhãn đọc màn hình", async () => {
    await render(
      <ThemePreferenceProvider>
        <KeyValueList rows={[{ label: "Có", value: "1" }, { label: "Trống", value: null }, { label: "Gạch", value: "—" }]} />
        <StatGrid items={[{ label: "Cân nặng", value: "68.5", unit: "kg" }]} />
      </ThemePreferenceProvider>,
    );
    expect(await screen.findByText("Có")).toBeTruthy();
    expect(screen.queryByText("Trống")).toBeNull();
    expect(screen.queryByText("Gạch")).toBeNull();
    expect(screen.getByLabelText("Cân nặng: 68.5 kg")).toBeTruthy();
  });

  it("ClampText mở/thu gọn văn bản dài", async () => {
    await render(
      <ThemePreferenceProvider>
        <ClampText text={"x".repeat(200)} />
      </ThemePreferenceProvider>,
    );
    await fireEvent.press(await screen.findByText("Xem thêm"));
    expect(screen.getByText("Thu gọn")).toBeTruthy();
  });
});
