import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { forgotPassword } from "@/api/auth";
import { vi } from "@/i18n/vi";
import { ForgotPasswordScreen } from "@/screens/auth/forgot-password";
import { ThemePreferenceProvider } from "@/theme";

jest.mock("@/api/auth", () => ({
  forgotPassword: jest.fn(),
}));

const insets = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={insets}>
      <ThemePreferenceProvider>
        <ForgotPasswordScreen />
      </ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}

describe("ForgotPasswordScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stays disabled until an email is entered and does not call the API", async () => {
    await renderScreen();
    expect(screen.getByTestId("forgot-submit")).toBeDisabled();
    await fireEvent.press(screen.getByTestId("forgot-submit"));
    expect(forgotPassword).not.toHaveBeenCalled();
    expect(screen.queryByText(vi.field.required)).toBeNull();
  });

  it("sends the trimmed email and shows the neutral success copy", async () => {
    (forgotPassword as jest.Mock).mockResolvedValue({ requested: true });
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText(vi.forgot.email), " Fighter@Example.com ");
    await fireEvent.press(screen.getByTestId("forgot-submit"));
    await waitFor(() =>
      expect(forgotPassword).toHaveBeenCalledWith({ email: "Fighter@Example.com" }),
    );
    await waitFor(() => {
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success", text1: vi.forgot.sent }),
      );
    });
    expect(screen.queryByText(vi.forgot.sent)).toBeNull();
  });
});
