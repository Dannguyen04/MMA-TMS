import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { getMe, requestAdmissionEmailCode, verifyAdmissionEmail } from "@/api/auth";
import { ApiError } from "@/api/errors";
import { clearSession, persistSession } from "@/api/tokens";
import { RegisterScreen } from "@/screens/auth/register";
import { useSession } from "@/session/session-context";
import { ThemePreferenceProvider } from "@/theme";
import { vi } from "@/i18n/vi";

jest.mock("@/api/auth", () => ({
  getMe: jest.fn(),
  requestAdmissionEmailCode: jest.fn(),
  verifyAdmissionEmail: jest.fn(),
}));

jest.mock("@/api/tokens", () => ({
  persistSession: jest.fn(),
  clearSession: jest.fn(),
}));

jest.mock("@/session/session-context", () => ({
  useSession: jest.fn(),
  homeHrefForGate: () => "/ho-so",
}));

const insets = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={insets}>
      <ThemePreferenceProvider>
        <RegisterScreen />
      </ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}

describe("RegisterScreen", () => {
  jest.setTimeout(20000);
  const applyRegisteredSession = jest.fn(() => "guest");

  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({ applyRegisteredSession });
    (requestAdmissionEmailCode as jest.Mock).mockResolvedValue({ requested: true });
    (verifyAdmissionEmail as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "GUEST" },
      session: { accessToken: "a", refreshToken: "r", expiresAt: null, expiresIn: 60, tokenType: "bearer" },
    });
    (getMe as jest.Mock).mockResolvedValue({ id: "u1", role: "GUEST", email: "fighter@example.com" });
    (persistSession as jest.Mock).mockResolvedValue(undefined);
    (clearSession as jest.Mock).mockResolvedValue(undefined);
    globalThis.__authRouter = { replace: jest.fn(), back: jest.fn() };
  });

  it("sends an email code and does not collect a password or profile", async () => {
    const view = await renderScreen();
    expect(view.queryByLabelText(vi.register.password)).toBeNull();
    expect(view.queryByLabelText(vi.register.firstName)).toBeNull();
    expect(view.queryByLabelText(vi.register.weightClass)).toBeNull();
    expect(view.queryByText(vi.register.codeSent)).toBeNull();
    expect(view.queryByText(vi.register.intro)).toBeNull();
    expect(view.queryByText(vi.theme.light)).toBeNull();
    expect(requestAdmissionEmailCode).not.toHaveBeenCalled();
    await fireEvent.changeText(view.getByLabelText(vi.register.emailField), "Fighter@Example.com");
    await fireEvent.press(view.getByTestId("register-send-code"));
    await waitFor(() => {
      expect(requestAdmissionEmailCode).toHaveBeenCalledWith("Fighter@Example.com");
    });
    await waitFor(() => {
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success", text1: vi.register.codeSent }),
      );
    });
    expect(view.queryByText(vi.register.codeSent)).toBeNull();
    expect(verifyAdmissionEmail).not.toHaveBeenCalled();
  });

  it("verifies the code and keeps the draft when verification fails", async () => {
    (verifyAdmissionEmail as jest.Mock).mockRejectedValueOnce(
      new ApiError(401, "INVALID_CREDENTIALS", "Email, password, or session is invalid"),
    );
    const view = await renderScreen();
    await fireEvent.changeText(view.getByLabelText(vi.register.emailField), "fighter@example.com");
    await fireEvent.press(view.getByTestId("register-send-code"));
    await view.findByLabelText(vi.register.codeLabel);
    await fireEvent.changeText(view.getByLabelText(vi.register.codeLabel), "123456");
    expect(verifyAdmissionEmail).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId("register-verify"));
    await waitFor(() => expect(verifyAdmissionEmail).toHaveBeenCalled());
    expect(verifyAdmissionEmail).toHaveBeenCalledWith({
      email: "fighter@example.com",
      token: "123456",
    });
    await waitFor(() => {
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error", text1: vi.register.codeRejected }),
      );
    });
    expect(view.queryByText(vi.register.codeRejected)).toBeNull();
    expect(view.queryByText(vi.api.invalidCredentials)).toBeNull();
    expect(view.getByLabelText(vi.register.codeLabel).props.value).toBe("123456");
    expect(persistSession).not.toHaveBeenCalled();
  });

  it("opens the guest home after the code is accepted", async () => {
    const view = await renderScreen();
    await fireEvent.changeText(view.getByLabelText(vi.register.emailField), "fighter@example.com");
    await fireEvent.press(view.getByTestId("register-send-code"));
    await view.findByLabelText(vi.register.codeLabel);
    await fireEvent.changeText(view.getByLabelText(vi.register.codeLabel), "123456");
    await fireEvent.press(view.getByTestId("register-verify"));
    await waitFor(() => {
      expect(globalThis.__authRouter?.replace).toHaveBeenCalledWith("/ho-so");
    });
    expect(persistSession).toHaveBeenCalled();
    expect(applyRegisteredSession).toHaveBeenCalledWith({
      id: "u1",
      role: "GUEST",
      email: "fighter@example.com",
    });
  });

  it("returns to the email step with the draft when changing email", async () => {
    const view = await renderScreen();
    await fireEvent.changeText(view.getByLabelText(vi.register.emailField), "fighter@example.com");
    await fireEvent.press(view.getByTestId("register-send-code"));
    await view.findByLabelText(vi.register.codeLabel);
    await fireEvent.changeText(view.getByLabelText(vi.register.codeLabel), "123456");
    await fireEvent.press(view.getByText(vi.register.changeEmail));
    expect(view.getByLabelText(vi.register.emailField).props.value).toBe("fighter@example.com");
    expect(view.queryByLabelText(vi.register.codeLabel)).toBeNull();
    expect(requestAdmissionEmailCode).toHaveBeenCalledTimes(1);
  });
});
