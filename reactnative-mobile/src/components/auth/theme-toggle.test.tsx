import { render, screen } from "@testing-library/react-native";

import { ThemeToggle } from "@/components/auth/theme-toggle";
import { ThemePreferenceProvider } from "@/theme";
import { vi } from "@/i18n/vi";

describe("ThemeToggle", () => {
  it("is a single 44pt cycle control", async () => {
    await render(
      <ThemePreferenceProvider>
        <ThemeToggle />
      </ThemePreferenceProvider>,
    );
    const control = screen.getByLabelText(vi.a11y.themeNextDark);
    expect(control.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: 44, height: 44 })]),
    );
    expect(screen.queryByLabelText(vi.a11y.themeNextLight)).toBeNull();
    expect(screen.queryByLabelText(vi.a11y.themeNextSystem)).toBeNull();
  });
});
