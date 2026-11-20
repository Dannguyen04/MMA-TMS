/// <reference types="jest" />
import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { CountUp, LeavingRow, Swap } from "./motion-kit";

describe("motion kit", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("counts to the new value and ends exactly on it", async () => {
    const ui = await render(<CountUp testID="n" value={3}/>);
    expect(ui.getByTestId("n").props.children).toBe(3);
    await ui.rerender(<CountUp testID="n" value={1}/>);
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(ui.getByTestId("n").props.children).toBe(1);
    expect(ui.getByTestId("n").props.accessibilityLabel).toBe("1");
  });

  it("jumps straight to the value with reduced motion", async () => {
    const spy = jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const ui = await render(<CountUp testID="n" value={2}/>);
    await ui.rerender(<CountUp testID="n" value={9}/>);
    expect(ui.getByTestId("n").props.children).toBe(9);
    spy.mockRestore();
  });

  it("renders swapped and leaving content without hiding it", async () => {
    const ui = await render(<><Swap swapKey="a" testID="swap"><Text>A</Text></Swap><LeavingRow><Text>Row</Text></LeavingRow></>);
    expect(ui.getByText("A")).toBeTruthy();
    expect(ui.getByText("Row")).toBeTruthy();
  });
});
