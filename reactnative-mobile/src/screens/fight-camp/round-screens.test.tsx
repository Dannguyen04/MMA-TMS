/// <reference types="jest" />
import { View } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { campApi, type RoundsResponse } from "@/api/fight-camp";
import { ApiError } from "@/api/errors";
import { roundAdvice as t } from "@/i18n/round-advice";
import { previewBout } from "./camp-preview";
import { resetPreviewRounds } from "./preview-round-store";
import { previewRoundAdvice } from "./round-advice-preview";
import { CornerScreen, RoundScreen, type RoundDraftState } from "./round-screens";

jest.mock("@/api/fight-camp", () => ({ campApi: { rounds: jest.fn(), saveRound: jest.fn() } }));
// Keep presentation out of flow tests. The real store, rules, hook and panel run unchanged.
jest.mock("./camp-ui", () => {
  const React = require("react"); const { Text, View, Pressable, TextInput } = require("react-native");
  const text = ({ children, strike }: { children: unknown; strike?: boolean }) => React.createElement(Text, { style: strike ? { textDecorationLine: "line-through" } : undefined }, children);
  return {
    Copy: text, SvgTitle: text, Frame: ({ children }: { children: unknown }) => React.createElement(View, null, children),
    Busy: () => React.createElement(Text, null, "Loading"),
    Notice: ({ title, children }: { title: string; children: unknown }) => React.createElement(View, null, React.createElement(Text, null, title), React.createElement(Text, null, children)),
    Choices: ({ label, options, onChange }: { label?: string; options: { value: unknown; label: string }[]; onChange: (v: unknown) => void }) => React.createElement(View, null, label ? React.createElement(Text, null, label) : null, ...options.map((o, i) => React.createElement(Pressable, { key: i, onPress: () => onChange(o.value) }, React.createElement(Text, null, o.label)))),
    Action: ({ label, onPress, disabled, pending }: { label: string; onPress: () => void; disabled?: boolean; pending?: boolean }) => React.createElement(Pressable, { accessibilityLabel: label, disabled: disabled || pending, onPress }, React.createElement(Text, null, label)),
    Field: ({ label, ...props }: { label: string }) => React.createElement(TextInput, { accessibilityLabel: label, ...props }),
  };
});

const bout = { ...previewBout, id: "round-ui-preview", status: "WEIGHED_IN" as const };
beforeEach(() => { jest.clearAllMocks(); resetPreviewRounds(bout.id); });
describe("Round entry and advice", () => {
  it("shows R21–R24 inline after two saved rounds and can reset the sample", async () => {
    const ui = await render(<RoundScreen bout={bout} preview onAdvice={() => undefined}/>);
    await ui.findByText("Chốt hiệp 1");
    const enter = async (n: number) => {
      await fireEvent.press(ui.getByText("Thua"));
      await fireEvent.press(ui.getByText("Tăng một"));
      await fireEvent.press(ui.getAllByText("Không hiệu quả")[0]);
      await fireEvent.press(ui.getAllByText("Không thấy")[0]);
      await fireEvent.press(ui.getByText(`Chốt hiệp ${n}`));
      await ui.findByText(`Đã lưu hiệp ${n}`);
    };
    await enter(1);
    expect(ui.queryByText(t.hardToWin)).toBeNull(); expect(ui.queryByText(t.dropped)).toBeNull();
    await fireEvent.press(ui.getByText("Hiệp 2")); await enter(2);
    expect(ui.getByText(t.hardToWin)).toBeTruthy();
    expect(ui.getByText(t.dropped)).toBeTruthy();
    expect(ui.getAllByText(t.changed).length).toBeGreaterThan(0);
    expect(ui.getByText(new RegExp(t.safety))).toBeTruthy();
    expect(ui.getByText(t.beforeRound(3))).toBeTruthy();
    expect(campApi.saveRound).not.toHaveBeenCalled(); expect(campApi.rounds).not.toHaveBeenCalled();
    await fireEvent.press(ui.getByText(t.reset));
    expect(ui.getByText(t.noRounds)).toBeTruthy(); expect(ui.queryByText(t.hardToWin)).toBeNull();
  });
  it("live mode GETs advice after PUT and renders the server response", async () => {
    const empty: RoundsResponse = { scheduledRounds: 3, rounds: [], advice: null };
    const record = { id: "saved", roundNo: 1, selfScore: "LOSS" as const, knockdownsAgainst: 0 };
    const serverAdvice = previewRoundAdvice(bout.opponentAnalysis, [record], 3);
    // A server response is authoritative; the client does not derive this field itself.
    serverAdvice.standing = { kind: "AHEAD", selfScored: true };
    jest.mocked(campApi.rounds).mockResolvedValueOnce(empty).mockResolvedValueOnce({ ...empty, rounds: [record], advice: serverAdvice });
    jest.mocked(campApi.saveRound).mockResolvedValue(record);
    const ui = await render(<RoundScreen bout={bout} preview={false} onAdvice={() => undefined}/>);
    await ui.findByText("Chốt hiệp 1");
    await fireEvent.press(ui.getByText("Thua")); await fireEvent.press(ui.getByText("Chốt hiệp 1"));
    await ui.findByText(t.ahead);
    expect(campApi.rounds).toHaveBeenCalledTimes(2);
    expect(campApi.saveRound).toHaveBeenCalledWith(bout.id, 1, expect.objectContaining({ selfScore: "LOSS" }));
  });
  it("preserves the draft after a failed live save", async () => {
    jest.mocked(campApi.rounds).mockResolvedValue({ scheduledRounds: 3, rounds: [], advice: null });
    jest.mocked(campApi.saveRound).mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "offline"));
    const ui = await render(<RoundScreen bout={bout} preview={false} onAdvice={() => undefined}/>);
    await ui.findByText("Chốt hiệp 1");
    await fireEvent.changeText(ui.getByLabelText("Ghi chú nhanh trong hiệp"), "Giữ nội dung khi lỗi");
    await fireEvent.press(ui.getByText("Chốt hiệp 1"));
    await ui.findByText("Chưa lưu được hiệp");
    expect(ui.getByLabelText("Ghi chú nhanh trong hiệp").props.value).toBe("Giữ nội dung khi lỗi");
    expect(ui.queryByText("Đã lưu hiệp 1")).toBeNull();
  });
  it("keeps an in-round note across child screen navigation without sending a round", async () => {
    jest.mocked(campApi.rounds).mockResolvedValue({ scheduledRounds: 3, rounds: [], advice: null });
    let draftState: RoundDraftState = { round: 1, values: {} };
    const keep = (next: RoundDraftState) => { draftState = next; };
    const ui = await render(<RoundScreen bout={bout} preview={false} onAdvice={() => undefined} draftState={draftState} onDraftStateChange={keep}/>);
    await ui.findByText("Chốt hiệp 1");
    await fireEvent.changeText(ui.getByLabelText("Ghi chú nhanh trong hiệp"), "Đổi góc sau jab");
    expect(campApi.saveRound).not.toHaveBeenCalled();
    await ui.rerender(<View/>);
    await ui.rerender(<RoundScreen bout={bout} preview={false} onAdvice={() => undefined} draftState={draftState} onDraftStateChange={keep}/>);
    await ui.findByText("Chốt hiệp 1");
    expect(ui.getByLabelText("Ghi chú nhanh trong hiệp").props.value).toBe("Đổi góc sau jab");
    await fireEvent.press(ui.getByText("Chốt hiệp 1"));
    await waitFor(() => expect(campApi.saveRound).toHaveBeenCalledWith(bout.id, 1, expect.objectContaining({ note: "Đổi góc sau jab" })));
  });
  it("does not offer A4 printing on mobile", async () => {
    const ui = await render(<CornerScreen bout={bout} name="Võ sĩ mẫu" preview onRounds={() => undefined}/>);
    await ui.findByText("Ghi chú và ghi hiệp");
    expect(ui.queryByText(/A4/)).toBeNull();
  });
});
