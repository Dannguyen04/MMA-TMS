/// <reference types="jest" />
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { CampTabs, FitList } from "./camp-lit";
import { Choices, sentences } from "./camp-ui";

describe("Notices: one sentence per line (owner 2026-11-11)", () => {
  it("splits sentences and keeps dates and decimals whole", () => {
    expect(sentences("Thiếu: Xét nghiệm máu. Hết hạn trước ngày thi: Bảo hiểm.")).toEqual(["Thiếu: Xét nghiệm máu.", "Hết hạn trước ngày thi: Bảo hiểm."]);
    expect(sentences("Giảm 6,3% so với 64,0 kg ngày 24/10.")).toEqual(["Giảm 6,3% so với 64,0 kg ngày 24/10."]);
  });
});

describe("In-screen tabs", () => {
  it("marks the selected tab, reads out an alert, and changes on press", async () => {
    const onChange = jest.fn();
    const ui = await render(<CampTabs alertLabel="cần xử lý" value="a" onChange={onChange} tabs={[{ key: "a", label: "Tổng quan" }, { key: "b", label: "Hồ sơ", alert: true }]}/>);
    expect(ui.getByRole("tab", { name: "Tổng quan" }).props.accessibilityState.selected).toBe(true);
    const papers = ui.getByRole("tab", { name: "Hồ sơ, cần xử lý" });
    expect(papers.props.accessibilityState.selected).toBe(false);
    await fireEvent.press(papers);
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("Mark chips", () => {
  it("draws the selected good/bad option with white text, never dark text on a light fill", async () => {
    const ui = await render(<Choices chips label="Đá thấp" value="BAD" onChange={() => undefined} options={[{ value: "GOOD", label: "Hiệu quả", tone: "good" }, { value: "BAD", label: "Không hiệu quả", tone: "bad" }, { value: "NONE", label: "Chưa dùng" }]}/>);
    const bad = ui.getByText("Không hiệu quả");
    expect(bad.props.style.color).toBe("#FFFFFF");
    expect(ui.getByRole("radio", { checked: true })).toBeTruthy();
  });
});

describe("FitList", () => {
  it("shows the first items and a 'Xem thêm' link for the rest", async () => {
    const onMore = jest.fn();
    const ui = await render(<FitList items={["a", "b", "c", "d"]} max={2} moreLabel={n => `Xem thêm ${n} mục`} onMore={onMore} render={x => <Text key={x}>{x}</Text>}/>);
    expect(ui.queryByText("c")).toBeNull();
    await fireEvent.press(ui.getByText("Xem thêm 2 mục"));
    expect(onMore).toHaveBeenCalled();
  });
});
