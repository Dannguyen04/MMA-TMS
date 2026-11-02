/// <reference types="jest" />
import { View } from "react-native";
import * as Haptics from "expo-haptics";
import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
import { campApi, type RoundsResponse } from "@/api/fight-camp";
import { ApiError } from "@/api/errors";
import { roundAdvice as t } from "@/i18n/round-advice";
import { betweenRound } from "@/i18n/between-round";
import { previewBout } from "./camp-preview";
import { resetPreviewRounds } from "./preview-round-store";
import { previewRoundAdvice } from "./round-advice-preview";
import { readPreviewRounds } from "./preview-round-store";
import { AdviceScreen, CornerScreen, RoundScreen, type RoundDraftState } from "./round-screens";

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
    PlanToggle: ({ label, selected, onPress, disabled }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) => React.createElement(Pressable, { accessibilityRole: "checkbox", accessibilityLabel: label, accessibilityState: { checked: selected }, disabled, onPress }, React.createElement(Text, null, label)),
    Field: ({ label, ...props }: { label: string }) => React.createElement(TextInput, { accessibilityLabel: label, ...props }),
    CampFooter: ({ children }: { children: unknown }) => React.createElement(View, { testID: "camp-footer" }, children),
    RoundTabs: ({ total, value, saved, onChange, tabLabel, savedLabel }: { total: number; value: number; saved: number[]; onChange: (n: number) => void; tabLabel: (n: number) => string; savedLabel: (n: number) => string }) => React.createElement(View, { testID: "round-tabs" }, ...Array.from({ length: total }, (_, i) => React.createElement(Pressable, { key: i, accessibilityRole: "radio", accessibilityLabel: saved.includes(i + 1) ? savedLabel(i + 1) : tabLabel(i + 1), accessibilityState: { checked: value === i + 1 }, onPress: () => onChange(i + 1) }, React.createElement(Text, null, tabLabel(i + 1))))),
  };
});

const bout = { ...previewBout, id: "round-ui-preview", status: "WEIGHED_IN" as const };
beforeEach(() => { jest.clearAllMocks(); resetPreviewRounds(bout.id); });
describe("Round entry and advice", () => {
  it("records rounds in compact mode and retains R21–R24 on the advice screen", async () => {
    const ui = await render(<RoundScreen bout={bout} preview onAdvice={() => undefined}/>);
    await ui.findByText("Chốt hiệp 1");
    const enter = async (n: number) => {
      await fireEvent.press(ui.getByText("Ghi thêm"));
      await fireEvent.press(ui.getByText("Thua"));
      await fireEvent.press(ui.getByText("Tăng một"));
      await fireEvent.press(within(ui.getAllByText(bout.opponentAnalysis.tactics![0].text)[0].parent!).getByText("Không hiệu quả"));
      await fireEvent.press(ui.getAllByText("Không thấy")[0]);
      await fireEvent.press(ui.getByText(`Chốt hiệp ${n}`));
      await ui.findByText(`Đã lưu hiệp ${n}`);
      // T-038 B2 (1A): the coach stays on round n and moves to n+1 with the round tabs.
      await fireEvent.press(ui.getByLabelText(`Hiệp ${n + 1}`));
    };
    await enter(1);
    expect(ui.queryByText(t.hardToWin)).toBeNull(); expect(ui.queryByText(t.dropped)).toBeNull();
    await enter(2);
    await ui.rerender(<AdviceScreen bout={bout} preview/>);
    expect(ui.getByText(t.hardToWin)).toBeTruthy();
    expect(ui.getByText(t.dropped)).toBeTruthy();
    expect(ui.getAllByText(t.changed).length).toBeGreaterThan(0);
    expect(ui.getByText(new RegExp(t.safety))).toBeTruthy();
    expect(ui.getByText(t.disclaimer)).toBeTruthy();
    expect(campApi.saveRound).not.toHaveBeenCalled(); expect(campApi.rounds).not.toHaveBeenCalled();
    await ui.rerender(<RoundScreen bout={bout} preview onAdvice={() => undefined}/>);
    await ui.findByText(t.reset); await fireEvent.press(ui.getByText(t.reset));
    await ui.findByText("Chốt hiệp 1");
    expect(ui.queryByText(t.hardToWin)).toBeNull();
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
    await ui.findByText("Đã lưu hiệp 1"); expect(ui.getByText("Ghi hiệp 1")).toBeTruthy();
    await fireEvent.press(ui.getByLabelText("Hiệp 2")); await ui.findByText("Ghi hiệp 2");
    expect(campApi.rounds).toHaveBeenCalledTimes(2);
    expect(campApi.saveRound).toHaveBeenCalledWith(bout.id, 1, expect.objectContaining({ selfScore: "LOSS" }));
  });
  it("preserves the draft after a failed live save", async () => {
    jest.mocked(campApi.rounds).mockResolvedValue({ scheduledRounds: 3, rounds: [], advice: null });
    jest.mocked(campApi.saveRound).mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "offline"));
    const ui = await render(<RoundScreen bout={bout} preview={false} onAdvice={() => undefined}/>);
    await ui.findByText("Chốt hiệp 1");
    await fireEvent.press(ui.getByText("Ghi thêm"));
    await fireEvent.changeText(ui.getByLabelText("Ghi chú nhanh trong hiệp"), "Giữ nội dung khi lỗi");
    await fireEvent.press(ui.getByText("Chốt hiệp 1"));
    await ui.findByText("Chưa lưu được hiệp");
    expect(ui.getByLabelText("Ghi chú nhanh trong hiệp").props.value).toBe("Giữ nội dung khi lỗi");
    expect(ui.queryByText("Đã lưu hiệp 1")).toBeNull();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
  it("retains the note across repeated disclosure toggles without saving", async () => {
    const ui = await render(<RoundScreen bout={bout} preview onAdvice={() => undefined}/>);
    await ui.findByText("Chốt hiệp 1");
    await fireEvent.press(ui.getByText("Ghi thêm"));
    await fireEvent.changeText(ui.getByLabelText("Ghi chú nhanh trong hiệp"), "Giữ nhịp chân");
    for (let i = 0; i < 3; i++) {
      await fireEvent.press(ui.getByText("Ẩn phần ghi thêm"));
      await fireEvent.press(ui.getByText("Ghi thêm"));
    }
    expect(ui.getByLabelText("Ghi chú nhanh trong hiệp").props.value).toBe("Giữ nhịp chân");
    expect(campApi.saveRound).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
  it("keeps an in-round note across child screen navigation without sending a round", async () => {
    jest.mocked(campApi.rounds).mockResolvedValue({ scheduledRounds: 3, rounds: [], advice: null });
    let draftState: RoundDraftState = { round: 1, values: {} };
    const keep = (next: RoundDraftState) => { draftState = next; };
    const ui = await render(<RoundScreen bout={bout} preview={false} onAdvice={() => undefined} draftState={draftState} onDraftStateChange={keep}/>);
    await ui.findByText("Chốt hiệp 1");
    await fireEvent.press(ui.getByText("Ghi thêm"));
    await fireEvent.changeText(ui.getByLabelText("Ghi chú nhanh trong hiệp"), "Đổi góc sau jab");
    expect(campApi.saveRound).not.toHaveBeenCalled();
    await ui.rerender(<View/>);
    await ui.rerender(<RoundScreen bout={bout} preview={false} onAdvice={() => undefined} draftState={draftState} onDraftStateChange={keep}/>);
    await ui.findByText("Chốt hiệp 1");
    await fireEvent.press(ui.getByText("Ghi thêm"));
    expect(ui.getByLabelText("Ghi chú nhanh trong hiệp").props.value).toBe("Đổi góc sau jab");
    await fireEvent.press(ui.getByText("Chốt hiệp 1"));
    await waitFor(() => expect(campApi.saveRound).toHaveBeenCalledWith(bout.id, 1, expect.objectContaining({ note: "Đổi góc sau jab" })));
  });
  it("does not offer A4 printing on mobile", async () => {
    const ui = await render(<CornerScreen bout={bout} name="Võ sĩ mẫu" preview onRounds={() => undefined}/>);
    await ui.findByText("Ghi chú và ghi hiệp");
    expect(ui.queryByText(/A4/)).toBeNull();
  });
  it("defaults to four quick-entry groups and hides extra condition fields and notes", async () => {
    const ui = await render(<RoundScreen bout={bout} preview onAdvice={() => undefined}/>);
    await ui.findByText("Chốt hiệp 1");
    expect(ui.getAllByText("Hiệu quả")).toHaveLength(2);
    expect(ui.getAllByText("Có thấy")).toHaveLength(1);
    expect(ui.getAllByText("HLV tự chấm")).toHaveLength(1);
    expect(ui.queryByLabelText("Ghi chú nhanh trong hiệp")).toBeNull();
    expect(ui.queryByText("Choáng")).toBeNull();
    await fireEvent.press(ui.getByText("Ghi thêm"));
    expect(ui.getByLabelText("Ghi chú nhanh trong hiệp")).toBeTruthy();
    expect(ui.getByText("Choáng")).toBeTruthy();
  });
  it("saves/reopens focus + new tactic + CUSTOM and exposes the tactic in the next round and corner", async () => {
    const ui = await render(<RoundScreen bout={bout} preview onAdvice={() => undefined}/>);
    await ui.findByText("Chốt hiệp 1");
    await fireEvent.press(ui.getByLabelText(bout.opponentAnalysis.tactics![0].text));
    await fireEvent.press(ui.getByText("Chiến thuật mới cho hiệp sau"));
    await fireEvent.press(ui.getByText("Thêm chiến thuật"));
    await fireEvent.changeText(ui.getByLabelText("Chiến thuật mới 1"), "Đổi góc trái");
    await fireEvent.changeText(ui.getByLabelText("Lời dặn tự do"), "Giữ cự ly");
    await fireEvent.press(ui.getByText("Chốt hiệp 1"));
    await ui.findByText("Đã lưu hiệp 1");
    expect(readPreviewRounds(bout).rounds[0].nextRoundPlan).toMatchObject({ focusTacticIds: ["t1"], addedTactics: [{ text: "Đổi góc trái" }], instructions: [{ code: "CUSTOM", text: "Giữ cự ly" }] });
    await fireEvent.press(ui.getByLabelText("Hiệp 1, đã ghi"));
    expect(ui.getByLabelText("Chiến thuật mới 1").props.value).toBe("Đổi góc trái");
    expect(ui.getByLabelText("Lời dặn tự do").props.value).toBe("Giữ cự ly");
    await ui.rerender(<CornerScreen bout={bout} name="Võ sĩ mẫu" preview onRounds={() => undefined}/>);
    await ui.findByText("Trọng tâm"); expect(ui.getByText("Thêm ở hiệp 1")).toBeTruthy();
    await ui.rerender(<RoundScreen bout={bout} preview onAdvice={() => undefined}/>);
    await ui.findByText("Ghi hiệp 2"); await fireEvent.press(ui.getByText("Ghi thêm"));
    await fireEvent.press(within(ui.getAllByText("Đổi góc trái")[0].parent!).getByText("Hiệu quả"));
    await fireEvent.press(ui.getByText("Chốt hiệp 2"));
    await ui.findByText("Đã lưu hiệp 2");
    expect(readPreviewRounds(bout).rounds[1].tacticMarks?.["r1-a1"]).toBe("EFFECTIVE");
    await fireEvent.press(ui.getByLabelText("Hiệp 3"));
    expect(ui.queryByTestId("next-round-plan")).toBeNull();
    await fireEvent.press(ui.getByText("Chốt hiệp 3"));
    await ui.findByText("Đã lưu hiệp 3");
    expect(readPreviewRounds(bout).advice).toBeNull();
  });
  it("sends a plan and round in one PUT, then reloads and restores the server plan", async () => {
    let server: RoundsResponse = { scheduledRounds: 3, rounds: [], advice: null };
    jest.mocked(campApi.rounds).mockImplementation(async () => server);
    jest.mocked(campApi.saveRound).mockImplementation(async (_id, n, body) => {
      const record = { ...body, id: `api-${n}`, roundNo: n };
      server = { scheduledRounds: 3, rounds: [record], advice: previewRoundAdvice(bout.opponentAnalysis, [record], 3) };
      return record;
    });
    const ui = await render(<RoundScreen bout={bout} preview={false} onAdvice={() => undefined}/>);
    await ui.findByText("Chốt hiệp 1");
    await fireEvent.press(ui.getByText("Thắng"));
    await fireEvent.press(ui.getByLabelText(bout.opponentAnalysis.tactics![0].text));
    await fireEvent.press(ui.getByText("Chốt hiệp 1"));
    await ui.findByText("Đã lưu hiệp 1");
    expect(campApi.saveRound).toHaveBeenCalledTimes(1);
    expect(campApi.saveRound).toHaveBeenCalledWith(bout.id, 1, expect.objectContaining({ selfScore: "WIN", nextRoundPlan: expect.objectContaining({ focusTacticIds: ["t1"] }) }));
    expect(campApi.rounds).toHaveBeenCalledTimes(2);
    await fireEvent.press(ui.getByLabelText("Hiệp 1, đã ghi"));
    expect(ui.getByLabelText(bout.opponentAnalysis.tactics![0].text).props.accessibilityState.checked).toBe(true);
  });
  it("uses the server round number and preselects safety ahead of other suggestions", async () => {
    const record = { id: "r", roundNo: 1, knockdownsAgainst: 2 };
    const advice = previewRoundAdvice(bout.opponentAnalysis, [record], 5); advice.nextRound.roundNo = 4;
    jest.mocked(campApi.rounds).mockResolvedValue({ scheduledRounds: 5, rounds: [record], advice });
    const ui = await render(<RoundScreen bout={{ ...bout, scheduledRounds: 5 }} preview={false} onAdvice={() => undefined}/>);
    await ui.findByText("Ghi hiệp 4");
    const boxes = ui.getAllByRole("checkbox");
    const safety = boxes.find(a => a.props.accessibilityLabel === "Kiểm tra võ sĩ trước khi cho đánh tiếp")!;
    expect(safety.props.accessibilityState.checked).toBe(true);
    expect(boxes.indexOf(safety)).toBe(0); // T-037 B: suggestions come first, safety on top
    expect(ui.getByText(t.safety)).toBeTruthy();
  });
  it("retains an unsent plan on API failure and never reports success", async () => {
    jest.mocked(campApi.rounds).mockResolvedValue({ scheduledRounds: 3, rounds: [], advice: null });
    jest.mocked(campApi.saveRound).mockRejectedValue(new ApiError(422, "BOUT_NEXT_ROUND_PLAN_LAST_ROUND", "last"));
    const ui = await render(<RoundScreen bout={bout} preview={false} onAdvice={() => undefined}/>);
    await ui.findByText("Chốt hiệp 1");
    await fireEvent.press(ui.getByLabelText(bout.opponentAnalysis.tactics![0].text));
    await fireEvent.press(ui.getByText("Chiến thuật mới cho hiệp sau"));
    await fireEvent.changeText(ui.getByLabelText("Lời dặn tự do"), "Đừng đứng yên");
    await fireEvent.press(ui.getByText("Chốt hiệp 1"));
    await ui.findByText("Chưa lưu được hiệp");
    expect(ui.getByLabelText("Lời dặn tự do").props.value).toBe("Đừng đứng yên");
    expect(ui.queryByText("Đã lưu hiệp 1")).toBeNull();
    expect(ui.getByText(/Hiệp cuối không có kế hoạch hiệp sau/)).toBeTruthy();
  });
  it("limits focus and added tactics to two and counts CUSTOM toward the three-instruction limit", async () => {
    const record = { id: "first", roundNo: 1 };
    const advice = previewRoundAdvice(bout.opponentAnalysis, [record], 3);
    advice.nextRound.suggested = [{ code: "SAFETY_CHECK" }, { code: "USE_TACTIC", tacticId: "t1" }, { code: "USE_TACTIC", tacticId: "t2" }];
    jest.mocked(campApi.rounds).mockResolvedValue({ scheduledRounds: 3, rounds: [record], advice });
    const ui = await render(<RoundScreen bout={bout} preview={false} onAdvice={() => undefined}/>);
    await ui.findByText("Ghi hiệp 2");
    for (const a of bout.opponentAnalysis.tactics!) await fireEvent.press(ui.getByLabelText(a.text));
    await fireEvent.press(ui.getByText("Chiến thuật mới cho hiệp sau"));
    await fireEvent.press(ui.getByText("Thêm chiến thuật"));
    await fireEvent.changeText(ui.getByLabelText("Chiến thuật mới 1"), "Chiến thuật bổ sung");
    await fireEvent.press(ui.getByLabelText("Chiến thuật bổ sung"));
    expect(ui.getByText("Trọng tâm · 2/2")).toBeTruthy();
    await fireEvent.press(ui.getByText("Thêm chiến thuật"));
    await fireEvent.press(ui.getByLabelText("Thêm chiến thuật"));
    expect(ui.queryByLabelText("Chiến thuật mới 3")).toBeNull();
    expect(ui.getByLabelText("Chiến thuật mới 2").props.maxLength).toBe(140);
    await fireEvent.press(ui.getByLabelText(`Dùng: ${bout.opponentAnalysis.tactics![0].text}`));
    await fireEvent.changeText(ui.getByLabelText("Lời dặn tự do"), "Giữ cự ly");
    await fireEvent.press(ui.getByLabelText(`Dùng: ${bout.opponentAnalysis.tactics![1].text}`));
    expect(ui.getByLabelText(`Dùng: ${bout.opponentAnalysis.tactics![1].text}`).props.accessibilityState.checked).toBe(false);
    await fireEvent.changeText(ui.getByLabelText("Lời dặn tự do"), "");
    await fireEvent.press(ui.getByLabelText(`Dùng: ${bout.opponentAnalysis.tactics![1].text}`));
    expect(ui.getByLabelText(`Dùng: ${bout.opponentAnalysis.tactics![1].text}`).props.accessibilityState.checked).toBe(true);
  });
  it("T-037 B order: suggestions before focus, then extras; save docked in the footer", async () => {
    const data = readPreviewRounds(bout);
    jest.mocked(campApi.rounds).mockResolvedValue({ ...data, rounds: [{ id: "r1", roundNo: 1, selfScore: "LOSS", tacticMarks: {}, observationMarks: {}, nextRoundPlan: { focusTacticIds: [], addedTactics: [], instructions: [] } }], advice: previewRoundAdvice(bout.opponentAnalysis, [{ roundNo: 1, selfScore: "LOSS" }], 3) } as RoundsResponse);
    const ui = await render(<RoundScreen bout={bout} preview={false} onAdvice={() => undefined}/>);
    await ui.findByText("Ghi hiệp 2");
    const plan = within(ui.getByTestId("next-round-plan"));
    const texts = plan.getAllByText(/Lời dặn đề xuất|Trọng tâm ·|Chiến thuật mới cho hiệp sau/).map(n => String(n.props.children instanceof Array ? n.props.children.join("") : n.props.children));
    expect(texts.map(x => x.split(" ·")[0])).toEqual(["Lời dặn đề xuất", "Trọng tâm", "Chiến thuật mới cho hiệp sau"]);
    expect(within(ui.getByTestId("camp-footer")).getByText("Chốt hiệp 2")).toBeTruthy();
  });
  it("free instruction sits next to the suggestions, without opening the new-tactic disclosure", async () => {
    const ui = await render(<RoundScreen bout={bout} preview onAdvice={() => undefined}/>);
    await ui.findByText("Chốt hiệp 1");
    expect(ui.queryByLabelText("Chiến thuật mới 1")).toBeNull();
    expect(ui.getByLabelText("Lời dặn tự do").props.editable).toBe(true);
    expect(ui.getByText("Chiến thuật võ sĩ ưu tiên dùng ở hiệp sau. Chọn tối đa 2.")).toBeTruthy();
  });
  it("round tabs replace the summary rows and reopen a saved round", async () => {
    const ui = await render(<RoundScreen bout={bout} preview onAdvice={() => undefined}/>);
    await ui.findByText("Chốt hiệp 1");
    expect(within(ui.getByTestId("round-tabs")).getAllByRole("radio")).toHaveLength(3);
    await fireEvent.press(ui.getByText("Thắng")); await fireEvent.press(ui.getByText("Chốt hiệp 1"));
    await ui.findByText("Đã lưu hiệp 1");
    expect(ui.queryByText(/Mở lại/)).toBeNull();
    expect(ui.getByLabelText("Hiệp 1, đã ghi")).toBeTruthy();
    // 1A: AI advice for round 2 is valid, so the coach stays on round 1.
    expect(ui.getByLabelText("Hiệp 1, đã ghi").props.accessibilityState.checked).toBe(true);
    await fireEvent.press(ui.getByLabelText("Hiệp 2"));
    expect(ui.getByLabelText("Hiệp 2").props.accessibilityState.checked).toBe(true);
    await fireEvent.press(ui.getByLabelText("Hiệp 1, đã ghi"));
    expect(ui.getByText("Lưu lại hiệp 1")).toBeTruthy();
  });
  it("explains why the free instruction is locked when three are chosen", async () => {
    const data = readPreviewRounds(bout);
    jest.mocked(campApi.rounds).mockResolvedValue({ ...data, rounds: [{ id: "r1", roundNo: 1, selfScore: "LOSS", tacticMarks: {}, observationMarks: {}, nextRoundPlan: { focusTacticIds: [], addedTactics: [], instructions: [] } }], advice: previewRoundAdvice(bout.opponentAnalysis, [{ roundNo: 1, selfScore: "LOSS" }], 3) } as RoundsResponse);
    const ui = await render(<RoundScreen bout={bout} preview={false} onAdvice={() => undefined}/>);
    await ui.findByText("Ghi hiệp 2");
    await fireEvent.press(ui.getByText("Chiến thuật mới cho hiệp sau"));
    expect(ui.getByLabelText("Lời dặn tự do").props.editable).toBe(true);
    const suggestions = within(ui.getByTestId("next-round-plan")).getAllByRole("checkbox").filter(b => /^(Dùng|Bỏ|Cần|Khó|Kiểm|Xem)/.test(b.props.accessibilityLabel));
    expect(suggestions.length).toBeGreaterThanOrEqual(3);
    for (const box of suggestions.slice(0, 3)) await fireEvent.press(box);
    expect(ui.getByText("Lời dặn đề xuất · đã chọn 3/3")).toBeTruthy();
    expect(ui.getByLabelText("Lời dặn tự do").props.editable).toBe(false);
    expect(ui.getByLabelText("Lời dặn tự do").props.helper).toBe(betweenRound.customLocked);
  });
});

describe("T-041: nút xem báo cáo trên màn ghi hiệp", () => {
  it("chỉ hiện khi trận đã kết thúc và mở báo cáo", async () => {
    const onReport = jest.fn();
    const ui = await render(<RoundScreen bout={bout} preview onAdvice={() => undefined} onReport={onReport}/>);
    await ui.findByText("Chốt hiệp 1");
    expect(ui.queryByLabelText("Xem báo cáo trận")).toBeNull();
    await ui.rerender(<RoundScreen bout={{ ...bout, status: "COMPLETED" }} preview onAdvice={() => undefined} onReport={onReport}/>);
    await fireEvent.press(await ui.findByLabelText("Xem báo cáo trận"));
    expect(onReport).toHaveBeenCalledTimes(1);
  });
});
