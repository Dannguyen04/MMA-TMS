import { render, screen } from "@testing-library/react-native";

import { AuthTextField } from "@/components/auth/auth-text-field";
import { vi } from "@/i18n/vi";
import { ThemePreferenceProvider } from "@/theme";

describe("AuthTextField", () => {
  it("keeps the label inside the underline field without a boxed border", async () => {
    await render(
      <ThemePreferenceProvider>
        <AuthTextField label="Email" value="" />
      </ThemePreferenceProvider>,
    );

    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();

    const frame = screen.getByTestId("auth-field-frame");
    expect(frame.props.style).toEqual(
      expect.objectContaining({
        borderWidth: 0,
        borderRadius: 0,
        backgroundColor: "transparent",
      }),
    );
    expect(screen.getByTestId("auth-field-underline")).toBeTruthy();
  });

  it("keeps the password toggle inside the field row", async () => {
    await render(
      <ThemePreferenceProvider>
        <AuthTextField label="Mật khẩu" value="secret" secureToggle />
      </ThemePreferenceProvider>,
    );

    expect(screen.getByLabelText(vi.a11y.showPassword).props.style).toEqual(
      expect.objectContaining({ width: 44, height: 44 }),
    );
  });
});
