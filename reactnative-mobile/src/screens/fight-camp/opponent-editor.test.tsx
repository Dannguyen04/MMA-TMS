/// <reference types="jest" />
import { fireEvent, render } from "@testing-library/react-native";
import { campApi, type CampDetail } from "@/api/fight-camp";
import { previewBout } from "./camp-preview";
import { CampTwoColumnsProvider } from "./camp-columns";
import { OpponentEditor } from "./opponent-editor";

jest.mock("@/theme", () => ({
  useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light }),
  fonts: { display: "display" },
}));
jest.mock("@/theme/typography", () => ({ readableTextStyle: () => ({}) }));
jest.mock("@/api/training", () => ({ listTrainingSessions: jest.fn() }));
jest.mock("@/api/fight-camp", () => ({ campApi: { saveAnalysis: jest.fn(), prior: jest.fn() } }));
jest.mock("./camp-ui", () => require("./camp-test-ui").campUiMock());

const api = campApi as jest.Mocked<typeof campApi>;
const bout = (patch: Partial<CampDetail> = {}): CampDetail => ({ ...structuredClone(previewBout), id: "b1", fighterId: "f1", status: "CAMP", ...patch });
beforeEach(() => { jest.clearAllMocks(); });

describe("Opponent scouting sheet", () => {
  it("shows the record, then observations as a ledger with kind, code and evidence state", async () => {
    const ui = await render(<OpponentEditor bout={bout()} preview={false} onSaved={() => undefined}/>);
    expect(ui.getByLabelText("Số trận thắng").props.value).toBe("8");
    expect(ui.getByText("Sơ hở")).toBeTruthy();
    expect(ui.getByText("QS 1")).toBeTruthy();
    expect(ui.getByText("Hạ tay phải khi lùi sau tổ hợp đòn.")).toBeTruthy();
    // Only the summary line on a phone; traits open on demand.
    expect(ui.queryByText("Lối đánh")).toBeNull();
    await fireEvent.press(ui.getByLabelText("Sửa hồ sơ đối thủ"));
    expect(ui.getByText("Lối đánh")).toBeTruthy();
  });

  it("lists tactics with the observations they rest on and whether they were trained", async () => {
    const ui = await render(<OpponentEditor bout={bout()} preview={false} onSaved={() => undefined}/>);
    await fireEvent.press(ui.getByRole("tab", { name: /Chiến thuật/ }));
    expect(ui.getByText("CT 2")).toBeTruthy();
    expect(ui.getAllByText(/dựa trên QS 1/)).toHaveLength(2);
    expect(ui.getByText("đã luyện 1 buổi")).toBeTruthy();
    expect(ui.getByText("chưa luyện")).toBeTruthy();
  });

  it("keeps save off until something changes, then saves the edited observation", async () => {
    const b = bout();
    api.saveAnalysis.mockImplementation(async (_id, input) => ({ opponentAnalysis: input, tacticsWithoutSessions: [] }) as never);
    const onSaved = jest.fn();
    const ui = await render(<OpponentEditor bout={b} preview={false} onSaved={onSaved}/>);
    expect(ui.getByLabelText("Lưu phân tích").props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(ui.getByText("Hạ tay phải khi lùi sau tổ hợp đòn."));
    await fireEvent.changeText(ui.getByLabelText("Đã thấy gì"), "  Hạ tay phải khi lùi.  ");
    expect(ui.getByText("Có thay đổi chưa lưu")).toBeTruthy();
    await fireEvent.press(ui.getByLabelText("Lưu phân tích"));
    await ui.findByText("Đã lưu phân tích đối thủ");
    const sent = api.saveAnalysis.mock.calls[0]![1];
    expect(sent.observations[0]!.text).toBe("Hạ tay phải khi lùi.");
    expect(sent.profile.wins).toBe(8);
    expect(onSaved).toHaveBeenCalled();
    expect(ui.getByLabelText("Lưu phân tích").props.accessibilityState.disabled).toBe(true);
  });

  it("blocks a new observation without evidence and explains why", async () => {
    const ui = await render(<OpponentEditor bout={bout()} preview={false} onSaved={() => undefined}/>);
    await fireEvent.press(ui.getByLabelText("Thêm quan sát"));
    await fireEvent.changeText(ui.getByLabelText("Đã thấy gì"), "Đứng yên sau jab đôi.");
    expect(ui.getByText("Cần ghi chú hoặc đường dẫn")).toBeTruthy();
    await fireEvent.press(ui.getByLabelText("Lưu phân tích"));
    await ui.findByText("Chưa lưu được phân tích");
    expect(api.saveAnalysis).not.toHaveBeenCalled();
  });

  it("links a tactic to observations with checkboxes, and needs an observation before a tactic", async () => {
    const empty = bout({ opponentAnalysis: { profile: {}, observations: [], tactics: [] } });
    const ui = await render(<OpponentEditor bout={empty} preview={false} onSaved={() => undefined}/>);
    await fireEvent.press(ui.getByRole("tab", { name: /Chiến thuật/ }));
    expect(ui.getByText("cần một quan sát trước")).toBeTruthy();
    expect(ui.getByLabelText("Thêm chiến thuật").props.accessibilityState.disabled).toBe(true);

    const full = await render(<OpponentEditor bout={bout()} preview={false} onSaved={() => undefined}/>);
    await fireEvent.press(full.getByRole("tab", { name: /Chiến thuật/ }));
    await fireEvent.press(full.getByText("Đổi góc sau jab; không đứng lại trước mặt đối thủ."));
    const link = full.getByRole("checkbox", { name: /QS 1/ });
    expect(link.props.accessibilityState.checked).toBe(true);
  });

  it("on two columns shows the ledger beside the editor of the selected item", async () => {
    const ui = await render(<CampTwoColumnsProvider value><OpponentEditor bout={bout()} preview={false} onSaved={() => undefined}/></CampTwoColumnsProvider>);
    expect(ui.getByText("Chọn một quan sát bên trái để sửa, hoặc thêm quan sát mới.")).toBeTruthy();
    expect(ui.getByText("Lối đánh")).toBeTruthy();
    await fireEvent.press(ui.getByText("Hạ tay phải khi lùi sau tổ hợp đòn."));
    expect(ui.getByLabelText("Đã thấy gì")).toBeTruthy();
    expect(ui.getByText("Hạ tay phải khi lùi sau tổ hợp đòn.")).toBeTruthy();
  });
});
