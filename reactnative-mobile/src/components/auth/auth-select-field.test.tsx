import { fireEvent, render, screen } from "@testing-library/react-native";
import { Keyboard } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthSelectField } from "@/components/auth/auth-select-field";
import { ThemePreferenceProvider } from "@/theme";

const insets = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe("AuthSelectField", () => {
  it("opens the sheet from an underline field without a boxed border", async () => {
    const dismiss = jest.spyOn(Keyboard, "dismiss");
    await render(
      <SafeAreaProvider initialMetrics={insets}>
        <ThemePreferenceProvider>
          <AuthSelectField
            label="Hạng cân"
            value=""
            placeholder="Chọn hạng"
            options={[{ value: "fly", label: "Fly" }]}
            onChange={jest.fn()}
          />
        </ThemePreferenceProvider>
      </SafeAreaProvider>,
    );

    const frame = screen.getByTestId("auth-field-frame");
    expect(frame.props.style).toEqual(
      expect.objectContaining({ borderWidth: 0, borderRadius: 0 }),
    );
    await fireEvent.press(screen.getByLabelText("Hạng cân. Chọn hạng"));
    expect(dismiss).toHaveBeenCalled();
    expect(screen.getByText("Fly")).toBeTruthy();
    dismiss.mockRestore();
  });
});
