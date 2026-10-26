import { fireEvent, render, screen } from "@testing-library/react-native";

import { AuthCodeField } from "@/components/auth/auth-vision-shell";

describe("AuthCodeField", () => {
  it("shows the typed digits and keeps only numbers", async () => {
    const onChange = jest.fn();
    await render(<AuthCodeField testID="code" label="Mã xác minh" value="12" onChangeText={onChange} />);
    expect(await screen.findByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("code"), "12a 34-5678901");
    expect(onChange).toHaveBeenLastCalledWith("1234567890");
  });
});
