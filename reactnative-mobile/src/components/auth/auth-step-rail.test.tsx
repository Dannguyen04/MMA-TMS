import { fireEvent, render, screen } from "@testing-library/react-native";

import { AuthStepRail } from "@/components/auth/auth-step-rail";
import { ThemePreferenceProvider } from "@/theme";

const labels: [string, string] = ["Bạn", "Tài khoản"];

describe("AuthStepRail", () => {
  it("calls onSelect on press and marks the current step selected", async () => {
    const onSelect = jest.fn();
    await render(
      <ThemePreferenceProvider>
        <AuthStepRail step={2} labels={labels} onSelect={onSelect} />
      </ThemePreferenceProvider>,
    );
    fireEvent.press(screen.getByLabelText("1. Bạn"));
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(screen.getByLabelText("2. Tài khoản").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });

  it("disables future steps until they are valid", async () => {
    const onSelect = jest.fn();
    await render(
      <ThemePreferenceProvider>
        <AuthStepRail
          step={1}
          labels={labels}
          onSelect={onSelect}
          enabled={[true, false]}
        />
      </ThemePreferenceProvider>,
    );
    expect(screen.getByLabelText("2. Tài khoản").props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
    fireEvent.press(screen.getByLabelText("2. Tài khoản"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keeps a 44pt hit target in compact IME mode", async () => {
    await render(
      <ThemePreferenceProvider>
        <AuthStepRail step={1} labels={labels} onSelect={jest.fn()} compact />
      </ThemePreferenceProvider>,
    );
    expect(screen.getByLabelText("1. Bạn").props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ minHeight: 44 }),
        expect.objectContaining({ minHeight: 44 }),
      ]),
    );
  });
});
