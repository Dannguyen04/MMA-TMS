import { fireEvent, render } from "@testing-library/react-native";

import { FocusEditor } from "./focus-editor";

jest.mock("@/theme/index", () => ({
  useThemePreference: () => ({ colors: { bg: "#000", ink: "#fff", inkMuted: "#aaa", inkSubtle: "#888", lotus: "#f00", line: "#333", ring: "#f00", danger: "#f00" } }),
}));

describe("FocusEditor", () => {
  it("renders nothing while closed", async () => {
    const ui = await render(<FocusEditor visible={false} label="Ghi chú" value="" onChangeText={jest.fn()} onClose={jest.fn()} />);
    expect(ui.queryByLabelText("Ghi chú")).toBeNull();
  });

  it("writes straight to the field and closes on Xong", async () => {
    const change = jest.fn();
    const close = jest.fn();
    const ui = await render(<FocusEditor visible label="Ghi chú" value="" helper="0/300" onChangeText={change} onClose={close} />);
    await fireEvent.changeText(ui.getByLabelText("Ghi chú"), "Hạ tay phải");
    expect(change).toHaveBeenCalledWith("Hạ tay phải");
    expect(ui.getByText("0/300")).toBeTruthy();
    await fireEvent.press(ui.getByRole("button", { name: "Xong" }));
    expect(close).toHaveBeenCalled();
  });
});
