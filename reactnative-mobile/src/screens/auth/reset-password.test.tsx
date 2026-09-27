import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { resetPassword } from "@/api/auth";
import { vi } from "@/i18n/vi";
import { ResetPasswordScreen } from "@/screens/auth/reset-password";
import { ThemePreferenceProvider } from "@/theme";

jest.mock("@/api/auth", () => ({
  resetPassword: jest.fn(),
}));

const insets = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const token = "recovery-token-hash-value";

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={insets}>
      <ThemePreferenceProvider>
        <ResetPasswordScreen />
      </ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}

describe("ResetPasswordScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.__authParams = { token_hash: token, type: "recovery" };
  });

  it("refuses a link that is not a recovery token", async () => {
    globalThis.__authParams = { token_hash: token, type: "signup" };
    await renderScreen();
    expect(screen.getByText(vi.resetPassword.missingLink)).toBeTruthy();
    expect(screen.getByTestId("reset-submit")).toBeDisabled();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("submits tokenHash and the new password", async () => {
    (resetPassword as jest.Mock).mockResolvedValue({
      passwordUpdated: true,
      admissionActivationReady: false,
    });
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText(vi.register.password), "new-password");
    await fireEvent.changeText(screen.getByLabelText(vi.register.confirm), "new-password");
    await fireEvent.press(screen.getByTestId("reset-submit"));
    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith({
        tokenHash: token,
        newPassword: "new-password",
      }),
    );
    expect(screen.getByText(vi.resetPassword.success)).toBeTruthy();
  });
});
