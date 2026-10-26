import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { LoginScreen } from "@/screens/auth/login";
import { useSession } from "@/session/session-context";
import { ThemePreferenceProvider } from "@/theme";
import { vi } from "@/i18n/vi";

jest.mock("@/session/session-context", () => ({
  useSession: jest.fn(),
  homeHrefForGate: () => "/",
}));

const insets = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderLogin() {
  return render(
    <SafeAreaProvider initialMetrics={insets}>
      <ThemePreferenceProvider>
        <LoginScreen />
      </ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}

describe("LoginScreen", () => {
  jest.setTimeout(20000);
  const signIn = jest.fn();
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as { __authRouter?: { replace: jest.Mock; back: jest.Mock } }).__authRouter = {
      replace,
      back: jest.fn(),
    };
    (useSession as jest.Mock).mockReturnValue({
      signIn,
      applyRegisteredSession: jest.fn(),
      enterDemo: jest.fn(),
    });
  });

  it("keeps login disabled until email and password are filled", async () => {
    await renderLogin();
    expect(screen.queryByText(vi.theme.light)).toBeNull();
    expect(screen.queryByText(vi.theme.dark)).toBeNull();
    expect(screen.getByTestId("login-submit")).toBeDisabled();
    await fireEvent.press(screen.getByTestId("login-submit"));
    expect(signIn).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
    expect(screen.queryByText(vi.field.required)).toBeNull();
  });

  it("rejects an invalid email", async () => {
    await renderLogin();
    await fireEvent.changeText(screen.getByLabelText(vi.login.email), "not-an-email");
    await fireEvent.changeText(screen.getByLabelText(vi.login.password), "strong-password");
    await fireEvent.press(screen.getByTestId("login-submit"));
    expect(screen.getAllByText(vi.field.invalidEmail).length).toBeGreaterThan(0);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("hides the Demo chip and opens QA roles from the wordmark", async () => {
    await renderLogin();
    expect(screen.queryByText(vi.login.demoMenu)).toBeNull();
    await fireEvent(screen.getByTestId("auth-demo-trigger"), "longPress");
    expect(screen.getByText(vi.login.demoPick)).toBeTruthy();
  });

  it("navigates after a successful sign-in", async () => {
    signIn.mockResolvedValue("fighter");
    await renderLogin();
    await fireEvent.changeText(screen.getByLabelText(vi.login.email), "fighter@example.com");
    await fireEvent.changeText(screen.getByLabelText(vi.login.password), "strong-password");
    await fireEvent.press(screen.getByTestId("login-submit"));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith({
      email: "fighter@example.com",
      password: "strong-password",
    }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});
