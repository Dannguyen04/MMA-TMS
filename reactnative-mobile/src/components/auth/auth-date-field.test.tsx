import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { FlatList, Keyboard } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  AUTH_DATE_WHEEL_ITEM,
  AuthDateField,
} from "@/components/auth/auth-date-field";
import { ThemePreferenceProvider } from "@/theme";
import { vi } from "@/i18n/vi";

const insets = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe("AuthDateField", () => {
  it("dismisses the keyboard before opening and keeps the helper visible", async () => {
    const dismiss = jest.spyOn(Keyboard, "dismiss");
    const helper = "Gợi ý chọn ngày";
    await render(
      <SafeAreaProvider initialMetrics={insets}>
        <ThemePreferenceProvider>
          <AuthDateField
            label={vi.register.dateOfBirth}
            value="2000-01-15"
            helper={helper}
            onChangeText={jest.fn()}
          />
        </ThemePreferenceProvider>
      </SafeAreaProvider>,
    );
    expect(screen.getByText(helper)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(`${vi.register.dateOfBirth}. 15/01/2000`));
    expect(dismiss).toHaveBeenCalled();
    expect(screen.getByLabelText(`${vi.register.day} 15`).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByLabelText(`${vi.register.year} 2000`).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByLabelText(`${vi.register.month} 01`).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByTestId("auth-field-frame").props.style).toEqual(
      expect.objectContaining({ borderWidth: 0, borderRadius: 0 }),
    );
    dismiss.mockRestore();
  });

  it("scrolls wheels to the selected offset when the sheet opens and when month changes", async () => {
    const scrollToOffset = jest.fn();
    const proto = FlatList.prototype as { scrollToOffset?: (args: unknown) => void };
    const previous = proto.scrollToOffset;
    proto.scrollToOffset = scrollToOffset;

    await render(
      <SafeAreaProvider initialMetrics={insets}>
        <ThemePreferenceProvider>
          <AuthDateField
            label={vi.register.dateOfBirth}
            value="2000-01-15"
            onChangeText={jest.fn()}
          />
        </ThemePreferenceProvider>
      </SafeAreaProvider>,
    );

    await fireEvent.press(screen.getByLabelText(`${vi.register.dateOfBirth}. 15/01/2000`));

    const maxYear = new Date().getFullYear();
    const yearIndex = maxYear - 2000;
    await waitFor(() => {
      expect(scrollToOffset).toHaveBeenCalledWith(
        expect.objectContaining({ offset: yearIndex * AUTH_DATE_WHEEL_ITEM, animated: false }),
      );
      expect(scrollToOffset).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 0, animated: false }),
      );
      expect(scrollToOffset).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 14 * AUTH_DATE_WHEEL_ITEM, animated: false }),
      );
    });

    scrollToOffset.mockClear();
    await fireEvent.press(screen.getByLabelText(`${vi.register.month} 02`));

    await waitFor(() => {
      expect(scrollToOffset).toHaveBeenCalledWith(
        expect.objectContaining({ offset: AUTH_DATE_WHEEL_ITEM, animated: false }),
      );
    });

    proto.scrollToOffset = previous;
  });
});
