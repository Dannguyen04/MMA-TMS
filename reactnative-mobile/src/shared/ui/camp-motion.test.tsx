import { useState } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import * as Reanimated from "react-native-reanimated";
import { Choices, Field, PlanToggle } from "./camp-ui";
import { CampReveal } from "./camp-motion";

function Form() {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState(false);
  return <CampReveal disclosure>
    <Field label="Ghi chú" value={text} onChangeText={setText}/>
    <PlanToggle label="Giữ cự ly" selected={selected} onPress={() => setSelected(!selected)}/>
    <Choices label="Chiến thuật" value={selected ? "no" : "yes"} onChange={v => setSelected(v === "no")}
      options={[{ value: "yes", label: "Hiệu quả" }, { value: "no", label: "Không hiệu quả" }, { value: "unused", label: "Chưa dùng" }]}/>
  </CampReveal>;
}

afterEach(() => jest.restoreAllMocks());
it.each([false, true])("keeps the same input and draft through selections (reduced motion: %s)", async reduced => {
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(reduced);
  const ui = await render(<Form/>);
  const input = ui.getByLabelText("Ghi chú");
  await fireEvent.changeText(input, "Đổi góc sau jab");
  await fireEvent.press(ui.getByRole("checkbox", { name: "Giữ cự ly" }));
  expect(ui.getByLabelText("Ghi chú")).toBe(input);
  expect(input.props.value).toBe("Đổi góc sau jab");
  expect(ui.getByRole("radio", { name: "Không hiệu quả" }).props.accessibilityState.checked).toBe(true);
  await fireEvent.press(ui.getByRole("radio", { name: "Hiệu quả" }));
  expect(ui.getByLabelText("Ghi chú")).toBe(input);
  expect(ui.getByRole("checkbox", { name: "Giữ cự ly" }).props.accessibilityState.checked).toBe(false);
});
