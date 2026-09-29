import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text, TextInput } from "react-native";

import { AuthStepPager, shouldClaimAuthSwipe } from "@/components/auth/auth-step-pager";

describe("AuthStepPager", () => {
  it("renders children for the current step", async () => {
    await render(
      <AuthStepPager step={2} direction={1}>
        <Text>Tài khoản pane</Text>
      </AuthStepPager>,
    );
    expect(screen.getByText("Tài khoản pane")).toBeTruthy();
    expect(screen.getByTestId("auth-step-pager")).toBeTruthy();
  });

  it("never attaches pan handlers that can steal TextInput presses", async () => {
    const onFocus = jest.fn();
    await render(
      <AuthStepPager step={1} direction={1} swipeEnabled onSwipe={jest.fn()}>
        <TextInput testID="register-field" accessibilityLabel="Họ" onFocus={onFocus} />
      </AuthStepPager>,
    );
    const host = screen.getByTestId("auth-step-pager");
    expect(host.props.onStartShouldSetResponder).toBeUndefined();
    expect(host.props.onMoveShouldSetResponder).toBeUndefined();
    expect(host.props.onStartShouldSetResponderCapture).toBeUndefined();
    fireEvent(screen.getByTestId("register-field"), "focus");
    expect(onFocus).toHaveBeenCalled();
  });

  it("does not attach swipe handlers while locked", async () => {
    await render(
      <AuthStepPager step={1} direction={1} swipeEnabled={false} onSwipe={jest.fn()}>
        <Text>Bạn pane</Text>
      </AuthStepPager>,
    );
    expect(screen.getByTestId("auth-step-pager").props.onMoveShouldSetResponder).toBeUndefined();
  });

  it("documents the old idle-swipe lock without claiming taps", () => {
    expect(shouldClaimAuthSwipe(true, 20, 4)).toBe(true);
    expect(shouldClaimAuthSwipe(true, 20, 24)).toBe(false);
    expect(shouldClaimAuthSwipe(false, 20, 4)).toBe(false);
  });
});
