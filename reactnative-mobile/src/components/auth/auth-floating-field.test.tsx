import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { AuthFloatingField, floatingFieldMetrics } from "@/components/auth/auth-floating-field";
import { authPalette } from "@/components/auth/auth-vision-tokens";
import { vi } from "@/i18n/vi";

// Màn trước đăng nhập luôn tối cố định, bất kể Sáng/Tối/Hệ thống.
const dark = authPalette("dark");

describe("AuthFloatingField", () => {
  it("shows the label as the only hint until focused, then reveals the placeholder", async () => {
    const onFocusChange = jest.fn();
    await render(<AuthFloatingField label="Email" placeholder="ban@vidu.com" value="" onFocusChange={onFocusChange} />);

    const input = screen.getByLabelText("Email");
    expect(screen.getByText("Email")).toBeTruthy();
    expect(input.props.placeholder).toBeUndefined();

    await fireEvent(input, "focus");
    expect(onFocusChange).toHaveBeenCalledWith(true);
    expect(screen.getByLabelText("Email").props.placeholder).toBe("ban@vidu.com");
  });

  it("draws a 1px underline with no pill background or border", async () => {
    await render(<AuthFloatingField label="Email" value="" />);
    const frame = StyleSheet.flatten(screen.getByTestId("auth-floating-field").props.style);
    expect(frame.backgroundColor).toBeUndefined();
    expect(frame.borderWidth).toBeUndefined();
    expect(StyleSheet.flatten(screen.getByTestId("auth-floating-line").props.style).height).toBe(1);
    expect(StyleSheet.flatten(screen.getByTestId("auth-floating-line-active").props.style).height).toBe(2);
  });

  it("turns the line red and shows the error under it", async () => {
    await render(<AuthFloatingField label="Email" value="x" error="Sai email" />);
    expect(screen.getByText("Sai email")).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId("auth-floating-line").props.style).backgroundColor).toBe(dark.danger);
    expect(screen.queryByTestId("auth-floating-line-active")).toBeNull();
  });

  it("keeps a 44px password toggle and a 56px field", async () => {
    await render(<AuthFloatingField label="Mật khẩu" value="secret" secureToggle />);
    expect(StyleSheet.flatten(screen.getByLabelText(vi.a11y.showPassword).props.style)).toEqual(
      expect.objectContaining({ width: 44, height: 44 }),
    );
    expect(floatingFieldMetrics(false)).toEqual({ labelBand: 12, row: 44, height: 56 });
    expect(floatingFieldMetrics(true).height).toBe(56);
  });
});