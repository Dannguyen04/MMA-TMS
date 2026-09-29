import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { SafeAreaProvider } from "react-native-safe-area-context";



import { register } from "@/api/auth";

import { toFighterRegisterBody } from "@/auth/fighter-register-body";

import { RegisterScreen } from "@/screens/auth/register";

import { useSession } from "@/session/session-context";

import { ThemePreferenceProvider } from "@/theme";

import { vi } from "@/i18n/vi";



jest.mock("@/api/auth", () => ({

  register: jest.fn(),

}));



jest.mock("@/api/tokens", () => ({

  persistSession: jest.fn(),

}));



jest.mock("@/session/session-context", () => ({

  useSession: jest.fn(),

  homeHrefForGate: () => "/",

}));



jest.mock("@/components/auth/auth-date-field", () => {

  const React = require("react");

  const { TextInput } = require("react-native");

  return {

    AuthDateField: ({

      label,

      value,

      onChangeText,

    }: {

      label: string;

      value: string;

      onChangeText: (next: string) => void;

    }) =>

      React.createElement(TextInput, {

        accessibilityLabel: label,

        value,

        onChangeText,

      }),

  };

});



jest.mock("@/components/auth/auth-select-field", () => {

  const React = require("react");

  const { Pressable, Text } = require("react-native");

  return {

    AuthSelectField: ({

      label,

      value,

      placeholder,

      helper,

      onChange,

    }: {

      label: string;

      value: string;

      placeholder: string;

      helper?: string;

      onChange: (next: string) => void;

    }) =>

      React.createElement(

        Pressable,

        {

          accessibilityLabel: value ? `${label}. ${value}` : `${label}. ${placeholder}`,

          onPress: () => onChange("LIGHTWEIGHT"),

        },

        helper ? React.createElement(Text, null, helper) : null,

        React.createElement(Text, null, value || placeholder),

      ),

  };

});



const insets = {

  frame: { x: 0, y: 0, width: 390, height: 844 },

  insets: { top: 47, left: 0, right: 0, bottom: 34 },

};



function renderRegister() {

  return render(

    <SafeAreaProvider initialMetrics={insets}>

      <ThemePreferenceProvider>

        <RegisterScreen />

      </ThemePreferenceProvider>

    </SafeAreaProvider>,

  );

}



async function completeStep1() {

  await fireEvent.changeText(screen.getByLabelText(vi.register.lastName), "Nguyen");

  await fireEvent.changeText(screen.getByLabelText(vi.register.firstName), "An");

  await fireEvent.changeText(screen.getByLabelText(vi.register.dateOfBirth), "2000-01-01");

  await fireEvent.press(

    screen.getByLabelText(`${vi.register.weightClass}. ${vi.register.weightClassPlaceholder}`),

  );

  await fireEvent.press(screen.getByTestId("register-continue"));

  await screen.findByLabelText(vi.register.email);

}



describe("RegisterScreen", () => {

  const applyRegisteredSession = jest.fn(() => "fighter");



  beforeEach(() => {

    jest.clearAllMocks();

    (useSession as jest.Mock).mockReturnValue({

      applyRegisteredSession,

      signIn: jest.fn(),

      enterDemo: jest.fn(),

    });

    (register as jest.Mock).mockResolvedValue({

      confirmationRequired: true,

      session: null,

      user: { id: "u1", email: "fighter@example.com", role: "FIGHTER" },

    });

  });



  it("walks 1→2, preserves values on back, and submits required fields only", async () => {

    await renderRegister();

    expect(screen.getByText(vi.register.title)).toBeTruthy();

    expect(screen.queryByText("Hồ sơ võ sĩ — điền từng bước.")).toBeNull();

    expect(screen.queryByText("Bắt buộc")).toBeNull();

    expect(screen.queryByText(vi.register.skipAndCreate)).toBeNull();

    expect(screen.queryByLabelText(vi.register.gym)).toBeNull();

    expect(screen.queryByLabelText(vi.register.nationality)).toBeNull();



    await completeStep1();

    expect(screen.getByLabelText("2. Tài khoản").props.accessibilityState).toEqual(

      expect.objectContaining({ selected: true }),

    );



    await fireEvent.changeText(screen.getByLabelText(vi.register.email), "fighter@example.com");

    await fireEvent.changeText(screen.getByLabelText(vi.register.password), "strong-password");

    await fireEvent.changeText(screen.getByLabelText(vi.register.confirm), "strong-password");



    await fireEvent.press(screen.getByLabelText(vi.register.backStep));

    expect(screen.getByDisplayValue("Nguyen")).toBeTruthy();

    expect(screen.queryByText("Bắt buộc")).toBeNull();



    await fireEvent.press(screen.getByTestId("register-continue"));

    expect(screen.getByDisplayValue("fighter@example.com")).toBeTruthy();



    await fireEvent.press(screen.getByTestId("register-submit"));



    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));

    expect(register).toHaveBeenCalledWith(

      toFighterRegisterBody({

        email: "fighter@example.com",

        password: "strong-password",

        firstName: "An",

        lastName: "Nguyen",

        dateOfBirth: "2000-01-01",

        weightClass: "LIGHTWEIGHT",

      }),

    );

    const body = (register as jest.Mock).mock.calls[0][0];

    expect(body.profile).not.toHaveProperty("gym");

    expect(body.profile).not.toHaveProperty("nationality");

    expect(body.profile).not.toHaveProperty("heightCm");

  });



  it("requires weight class before continue", async () => {

    await renderRegister();

    await fireEvent.changeText(screen.getByLabelText(vi.register.lastName), "Nguyen");

    await fireEvent.changeText(screen.getByLabelText(vi.register.firstName), "An");

    await fireEvent.changeText(screen.getByLabelText(vi.register.dateOfBirth), "2000-01-01");

    await fireEvent.press(screen.getByTestId("register-continue"));

    expect(screen.queryByLabelText(vi.register.email)).toBeNull();

    expect(register).not.toHaveBeenCalled();



    await fireEvent.press(

      screen.getByLabelText(`${vi.register.weightClass}. ${vi.register.weightClassPlaceholder}`),

    );

    await fireEvent.press(screen.getByTestId("register-continue"));

    await screen.findByLabelText(vi.register.email);

  });



  it("shows a spinner on the create action", async () => {

    let finish = () => undefined;

    (register as jest.Mock).mockImplementation(

      () =>

        new Promise((resolve) => {

          finish = () =>

            resolve({

              confirmationRequired: true,

              session: null,

              user: { id: "u1", email: "fighter@example.com", role: "FIGHTER" },

            });

        }),

    );

    await renderRegister();

    await completeStep1();

    await fireEvent.changeText(screen.getByLabelText(vi.register.email), "fighter@example.com");

    await fireEvent.changeText(screen.getByLabelText(vi.register.password), "strong-password");

    await fireEvent.changeText(screen.getByLabelText(vi.register.confirm), "strong-password");

    await fireEvent.press(screen.getByTestId("register-submit"));

    expect(screen.getByTestId("register-submit").props.accessibilityState).toEqual(

      expect.objectContaining({ busy: true, disabled: true }),

    );

    finish();

    await waitFor(() => expect(register).toHaveBeenCalled());

  });



  it("disables Quay lại while register submit is pending, then re-enables on error", async () => {

    let rejectRegister!: (error: Error) => void;

    (register as jest.Mock).mockImplementation(

      () =>

        new Promise((_resolve, reject) => {

          rejectRegister = reject;

        }),

    );

    await renderRegister();

    await completeStep1();

    await fireEvent.changeText(screen.getByLabelText(vi.register.email), "fighter@example.com");

    await fireEvent.changeText(screen.getByLabelText(vi.register.password), "strong-password");

    await fireEvent.changeText(screen.getByLabelText(vi.register.confirm), "strong-password");



    expect(screen.getByLabelText(vi.register.backStep).props.accessibilityState).not.toEqual(

      expect.objectContaining({ disabled: true }),

    );



    await fireEvent.press(screen.getByTestId("register-submit"));



    expect(screen.getByLabelText(vi.register.backStep).props.accessibilityState).toEqual(

      expect.objectContaining({ disabled: true }),

    );



    rejectRegister(new Error("Email đã được sử dụng"));

    await waitFor(() =>

      expect(screen.getByLabelText(vi.register.backStep).props.accessibilityState).not.toEqual(

        expect.objectContaining({ disabled: true }),

      ),

    );

  });

});

