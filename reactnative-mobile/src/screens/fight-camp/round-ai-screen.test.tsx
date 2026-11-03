/// <reference types="jest" />
import { useState } from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { campApi, type AiSuggestion, type CampRound, type RoundsResponse } from "@/api/fight-camp";
import { ApiError } from "@/api/errors";
import { previewBout } from "./camp-preview";
import { previewRoundAdvice } from "./round-advice-preview";
import { resetPreviewRounds } from "./preview-round-store";
import { RoundScreen, type RoundDraftState } from "./round-screens";

jest.mock("@/api/fight-camp", () => ({ campApi: { rounds: jest.fn(), saveRound: jest.fn(), roundAdvice: jest.fn(), decideAi: jest.fn(), aiHistory: jest.fn() } }));
jest.mock("./camp-ui", () => {
  const React = require("react"); const { Text, View, Pressable, TextInput } = require("react-native");
  const text = ({ children, strike }: { children: unknown; strike?: boolean }) => React.createElement(Text, { style: strike ? { textDecorationLine: "line-through" } : undefined }, children);
  return {
    Copy: text, SvgTitle: text, Frame: ({ children }: { children: unknown }) => React.createElement(View, null, children),
    Busy: () => React.createElement(Text, null, "Loading"),
    Notice: ({ title, children }: { title: string; children: unknown }) => React.createElement(View, null, React.createElement(Text, null, title), React.createElement(Text, null, children)),
    Choices: ({ label, options, onChange }: { label?: string; options: { value: unknown; label: string }[]; onChange: (v: unknown) => void }) => React.createElement(View, null, label ? React.createElement(Text, null, label) : null, ...options.map((o, i) => React.createElement(Pressable, { key: i, onPress: () => onChange(o.value) }, React.createElement(Text, null, o.label)))),
    Action: ({ label, onPress, disabled, pending }: { label: string; onPress: () => void; disabled?: boolean; pending?: boolean }) => React.createElement(Pressable, { accessibilityLabel: label, disabled: disabled || pending, onPress }, React.createElement(Text, null, label)),
    PlanToggle: ({ label, selected, onPress, disabled, tag }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean; tag?: string }) => React.createElement(Pressable, { accessibilityRole: "checkbox", accessibilityLabel: tag ? `${tag}: ${label}` : label, accessibilityState: { checked: selected }, disabled, onPress }, React.createElement(Text, null, label)),
    Field: ({ label, ...props }: { label: string }) => React.createElement(TextInput, { accessibilityLabel: label, ...props }),
    CampFooter: ({ children }: { children: unknown }) => React.createElement(View, { testID: "camp-footer" }, children),
    RoundTabs: ({ total, value, saved, onChange, tabLabel, savedLabel }: { total: number; value: number; saved: number[]; onChange: (n: number) => void; tabLabel: (n: number) => string; savedLabel: (n: number) => string }) => React.createElement(View, { testID: "round-tabs" }, ...Array.from({ length: total }, (_, i) => React.createElement(Pressable, { key: i, accessibilityRole: "radio", accessibilityLabel: saved.includes(i + 1) ? savedLabel(i + 1) : tabLabel(i + 1), accessibilityState: { checked: value === i + 1 }, onPress: () => onChange(i + 1) }, React.createElement(Text, null, tabLabel(i + 1))))),
  };
});


const bout = { ...previewBout, id: "11111111-1111-4111-8111-111111111111", status: "WEIGHED_IN" as const };
const r1: CampRound = { id: "r1", roundNo: 1, selfScore: "LOSS", knockdownsAgainst: 0, stunned: false, bleeding: false, fatigued: false, tacticMarks: {}, observationMarks: {}, note: null,
  nextRoundPlan: { focusTacticIds: [], addedTactics: [], instructions: [{ code: "SAFETY_CHECK" }, { code: "MUST_WIN_ROUND" }] } };
const withR1 = (round: CampRound = r1): RoundsResponse => ({ scheduledRounds: 3, rounds: [round], advice: previewRoundAdvice(bout.opponentAnalysis, [round], 3) });
const suggestion = (over: Partial<AiSuggestion> = {}): AiSuggestion => ({ id: "22222222-2222-4222-8222-222222222222", kind: "BETWEEN_ROUNDS", roundNo: 2, status: "OK", errorCode: null, model: "m", cached: false, createdAt: "2026-10-31T12:00:00.000Z",
  output: { instructions: [{ id: "ai1", text: "Giữ tay trước cao" }, { id: "ai2", text: "Đánh thân trước" }, { id: "ai3", text: "Bước sang trái" }] }, ...over });
/** Open on tab 1 with round 1 saved: the state right after "Chốt hiệp 1" (1A). */
function OnTab1() {
  const [state, setState] = useState<RoundDraftState>({ round: 1, values: {} });
  return <RoundScreen bout={bout} preview={false} onAdvice={() => undefined} draftState={state} onDraftStateChange={setState}/>;
}
const onTab1 = async () => {
  const ui = await render(<OnTab1/>);
  await ui.findByText("Lưu lại hiệp 1");
  return ui;
};
const checked = (el: { props: { accessibilityState?: { checked?: boolean } } }) => !!el.props.accessibilityState?.checked;

beforeEach(() => { jest.clearAllMocks(); jest.useRealTimers(); resetPreviewRounds(bout.id); jest.mocked(campApi.aiHistory).mockResolvedValue({ suggestions: [] }); });
const history = (s: AiSuggestion, decision: "ACCEPTED" | "PARTIAL" | "REJECTED" | null = null, acceptedItemIds: string[] = []) => ({ ...s, cached: false, decision, acceptedItemIds, decidedAt: decision ? "2026-10-31T12:05:00.000Z" : null });
describe("T-038 B2 AI advice on the round-entry screen", () => {
  it("offers AI only on the last saved round, inside 'Hiệp n+1: làm gì', and stays on tab n after saving", async () => {
    jest.mocked(campApi.rounds).mockResolvedValueOnce({ scheduledRounds: 3, rounds: [], advice: null }).mockResolvedValue(withR1());
    jest.mocked(campApi.saveRound).mockResolvedValue(r1);
    const ui = await render(<RoundScreen bout={bout} preview={false} onAdvice={() => undefined}/>);
    await ui.findByText("Chốt hiệp 1");
    expect(ui.queryByText("AI dặn")).toBeNull();
    await fireEvent.press(ui.getByText("Thua")); await fireEvent.press(ui.getByText("Chốt hiệp 1"));
    await ui.findByText("Đã lưu hiệp 1");
    expect(ui.getByText("Ghi hiệp 1")).toBeTruthy();
    expect(ui.getByText('Chọn lời dặn AI rồi bấm "Lưu lại hiệp 1", hoặc chuyển sang hiệp 2 ở thanh chọn hiệp.')).toBeTruthy();
    expect(ui.getByText("AI dặn")).toBeTruthy();
    expect(campApi.roundAdvice).not.toHaveBeenCalled(); // never asked automatically the first time
    await fireEvent.press(ui.getByLabelText("Hiệp 2"));
    expect(ui.queryByText("AI dặn")).toBeNull();
  });
  it("does not offer AI before weigh-in", async () => {
    jest.mocked(campApi.rounds).mockResolvedValue(withR1());
    const ui = await render(<RoundScreen bout={{ ...bout, status: "FIGHT_WEEK" }} preview={false} onAdvice={() => undefined} draftState={{ round: 1, values: {} }} onDraftStateChange={() => undefined}/>);
    await ui.findByText("Lưu lại hiệp 1");
    expect(ui.queryByText("AI dặn")).toBeNull();
  });
  it("shows up to 3 AI lines; they only take free slots and SAFETY_CHECK can still be unticked", async () => {
    jest.mocked(campApi.rounds).mockResolvedValue(withR1());
    jest.mocked(campApi.roundAdvice).mockResolvedValue({ suggestion: suggestion() });
    const ui = await onTab1();
    await fireEvent.press(ui.getByText("AI dặn"));
    await ui.findByText("Lời dặn của AI");
    expect(campApi.roundAdvice).toHaveBeenCalledWith(bout.id, 2, expect.anything());
    expect(ui.getByText("Lời dặn đề xuất · đã chọn 2/3")).toBeTruthy();
    await fireEvent.press(ui.getByLabelText("AI: Giữ tay trước cao"));
    expect(ui.getByText("Lời dặn đề xuất · đã chọn 3/3")).toBeTruthy();
    expect(ui.getByLabelText("AI: Đánh thân trước").props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(ui.getByLabelText("Kiểm tra võ sĩ trước khi cho đánh tiếp"));
    expect(ui.getByLabelText("AI: Đánh thân trước").props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(ui.getByLabelText("AI: Đánh thân trước"));
    expect(checked(ui.getByLabelText("AI: Đánh thân trước"))).toBe(true);
    expect(ui.getByText("Lời dặn đề xuất · đã chọn 3/3")).toBeTruthy();
  });
  it("hides lines over 140 characters and says so", async () => {
    jest.mocked(campApi.rounds).mockResolvedValue(withR1());
    jest.mocked(campApi.roundAdvice).mockResolvedValue({ suggestion: suggestion({ output: { instructions: [{ id: "ai1", text: "y".repeat(141) }, { id: "ai2", text: "Đánh thân trước" }] } }) });
    const ui = await onTab1();
    await fireEvent.press(ui.getByText("AI dặn"));
    await ui.findByText("Đã ẩn 1 lời dặn AI dài hơn 140 ký tự.");
    expect(ui.queryByLabelText(`AI: ${"y".repeat(141)}`)).toBeNull();
    expect(ui.getByLabelText("AI: Đánh thân trước")).toBeTruthy();
  });
  it("on save sends PARTIAL with the picked ids, keeps the picks as CUSTOM, and reads history instead of calling AI again (7A option C)", async () => {
    let stored = r1;
    jest.mocked(campApi.rounds).mockImplementation(async () => withR1(stored));
    jest.mocked(campApi.roundAdvice).mockResolvedValue({ suggestion: suggestion() });
    jest.mocked(campApi.decideAi).mockResolvedValue({ suggestion: suggestion() });
    jest.mocked(campApi.saveRound).mockImplementation(async (_id, _n, body) => (stored = { ...r1, ...body } as CampRound));
    const ui = await onTab1();
    await fireEvent.press(ui.getByText("AI dặn")); await ui.findByText("Lời dặn của AI");
    await fireEvent.press(ui.getByLabelText("Cần thắng hiệp sau")); // free a slot
    await fireEvent.press(ui.getByLabelText("AI: Đánh thân trước"));
    await fireEvent.press(ui.getByText("Lưu lại hiệp 1"));
    await ui.findByText("Đã lưu hiệp 1");
    expect(campApi.saveRound).toHaveBeenCalledWith(bout.id, 1, expect.objectContaining({ nextRoundPlan: expect.objectContaining({ instructions: [{ code: "SAFETY_CHECK" }, { code: "CUSTOM", text: "Đánh thân trước" }] }) }));
    expect(campApi.decideAi).toHaveBeenCalledWith(bout.id, "22222222-2222-4222-8222-222222222222", { decision: "PARTIAL", acceptedItemIds: ["ai2"] });
    await waitFor(() => expect(campApi.aiHistory).toHaveBeenCalledWith(bout.id, "BETWEEN_ROUNDS"));
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(campApi.roundAdvice).toHaveBeenCalledTimes(1); // no Gemini call after saving
    // Same suggestion as on screen: picks stay attached, no "restored" note.
    expect(ui.getByLabelText("AI: Đánh thân trước").props.accessibilityState.checked).toBe(true);
    expect(ui.queryByText("Gợi ý lấy lại từ lần trước")).toBeNull();
  });
  it("sends REJECTED when the coach saves without picking, and nothing if the coach leaves without saving", async () => {
    jest.mocked(campApi.rounds).mockResolvedValue(withR1());
    jest.mocked(campApi.roundAdvice).mockResolvedValue({ suggestion: suggestion() });
    jest.mocked(campApi.decideAi).mockResolvedValue({ suggestion: suggestion() });
    jest.mocked(campApi.saveRound).mockResolvedValue(r1);
    const ui = await onTab1();
    await fireEvent.press(ui.getByText("AI dặn")); await ui.findByText("Lời dặn của AI");
    await fireEvent.press(ui.getByLabelText("AI: Bước sang trái"));
    await ui.unmount();
    expect(campApi.decideAi).not.toHaveBeenCalled();
    const again = await onTab1();
    await fireEvent.press(again.getByText("AI dặn")); await again.findByText("Lời dặn của AI");
    await fireEvent.press(again.getByText("Lưu lại hiệp 1")); await again.findByText("Đã lưu hiệp 1");
    expect(campApi.decideAi).toHaveBeenCalledWith(bout.id, expect.any(String), { decision: "REJECTED", acceptedItemIds: [] });
  });
  it("treats 409 BOUT_AI_ALREADY_DECIDED as success and a failed PATCH never blocks the save", async () => {
    jest.mocked(campApi.rounds).mockResolvedValue(withR1());
    jest.mocked(campApi.roundAdvice).mockResolvedValue({ suggestion: suggestion() });
    jest.mocked(campApi.decideAi).mockRejectedValueOnce(new ApiError(409, "BOUT_AI_ALREADY_DECIDED", "already")).mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "offline"));
    jest.mocked(campApi.saveRound).mockResolvedValue(r1);
    const ui = await onTab1();
    await fireEvent.press(ui.getByText("AI dặn")); await ui.findByText("Lời dặn của AI");
    await fireEvent.press(ui.getByText("Lưu lại hiệp 1")); await ui.findByText("Đã lưu hiệp 1");
    expect(ui.queryByText("Chưa lưu được hiệp")).toBeNull();
    expect(ui.queryByText(/already|offline/)).toBeNull();
    // Same suggestion again (cached): already decided, so no second PATCH.
    await fireEvent.press(ui.getByText("Lưu lại hiệp 1")); await ui.findByText("Đã lưu hiệp 1");
    expect(campApi.decideAi).toHaveBeenCalledTimes(1);
  });
  it("hides the AI block on timeout after 12 s and still saves", async () => {
    jest.useFakeTimers();
    jest.mocked(campApi.rounds).mockResolvedValue(withR1());
    jest.mocked(campApi.roundAdvice).mockImplementation(() => new Promise(() => undefined));
    jest.mocked(campApi.saveRound).mockResolvedValue(r1);
    const ui = await onTab1();
    await fireEvent.press(ui.getByText("AI dặn"));
    expect(ui.getByText("AI đang soạn lời dặn…")).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(11_999); });
    expect(ui.queryByText("AI không trả lời kịp")).toBeNull();
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(ui.getByText("AI không trả lời kịp")).toBeTruthy();
    expect(ui.queryByText("AI dặn")).toBeNull(); // 2A: no retry button
    await fireEvent.press(ui.getByText("Lưu lại hiệp 1"));
    await waitFor(() => expect(campApi.saveRound).toHaveBeenCalled());
    expect(campApi.decideAi).not.toHaveBeenCalled();
  });
  it.each([
    [{ suggestion: suggestion({ status: "FAILED", errorCode: "NOT_CONFIGURED", output: {} }) }, "AI chưa được bật"],
    [{ suggestion: suggestion({ status: "FAILED", errorCode: "QUOTA", output: {} }) }, "AI tạm hết lượt"],
    [new ApiError(422, "BOUT_ROUND_OUT_OF_RANGE", "Round out of range"), "Hiệp này nằm ngoài số hiệp của trận hoặc chưa đến lượt."],
  ])("shows one Vietnamese line for %#", async (answer, text) => {
    jest.mocked(campApi.rounds).mockResolvedValue(withR1());
    if (answer instanceof ApiError) jest.mocked(campApi.roundAdvice).mockRejectedValue(answer); else jest.mocked(campApi.roundAdvice).mockResolvedValue(answer);
    const ui = await onTab1();
    await fireEvent.press(ui.getByText("AI dặn"));
    await ui.findByText(text);
    expect(ui.queryByText("AI dặn")).toBeNull();
    expect(ui.queryByText(/Round out of range|NOT_CONFIGURED|QUOTA/)).toBeNull();
  });
  it("re-entry restores the newest OK suggestion for n+1 with the saved picks, and does not PATCH a decided one", async () => {
    const picked: CampRound = { ...r1, nextRoundPlan: { focusTacticIds: [], addedTactics: [], instructions: [{ code: "SAFETY_CHECK" }, { code: "CUSTOM", text: "Bước sang trái" }] } };
    jest.mocked(campApi.rounds).mockResolvedValue(withR1(picked));
    jest.mocked(campApi.saveRound).mockResolvedValue(picked);
    jest.mocked(campApi.aiHistory).mockResolvedValue({ suggestions: [
      history(suggestion({ id: "33333333-3333-4333-8333-333333333333", roundNo: 3 })),                                 // other round: ignored
      history(suggestion({ id: "44444444-4444-4444-8444-444444444444", status: "FAILED", errorCode: "TIMEOUT", output: {} })), // newest for round 2 but FAILED
      history(suggestion(), "PARTIAL", ["ai3"]),
    ] });
    const ui = await onTab1();
    await ui.findByText("Gợi ý lấy lại từ lần trước");
    expect(campApi.roundAdvice).not.toHaveBeenCalled();
    expect(ui.getByLabelText("AI: Bước sang trái").props.accessibilityState.checked).toBe(true);
    expect(ui.queryByText("AI dặn")).toBeNull();
    await fireEvent.press(ui.getByText("Lưu lại hiệp 1")); await ui.findByText("Đã lưu hiệp 1");
    expect(campApi.decideAi).not.toHaveBeenCalled(); // decided on the server already
  });
  it("re-entry PATCHes an undecided restored suggestion against its own id", async () => {
    jest.mocked(campApi.rounds).mockResolvedValue(withR1());
    jest.mocked(campApi.saveRound).mockResolvedValue(r1);
    jest.mocked(campApi.decideAi).mockResolvedValue({ suggestion: suggestion() });
    jest.mocked(campApi.aiHistory).mockResolvedValue({ suggestions: [history(suggestion({ id: "55555555-5555-4555-8555-555555555555" }))] });
    const ui = await onTab1();
    await ui.findByText("Lời dặn của AI");
    await fireEvent.press(ui.getByText("Lưu lại hiệp 1")); await ui.findByText("Đã lưu hiệp 1");
    expect(campApi.decideAi).toHaveBeenCalledWith(bout.id, "55555555-5555-4555-8555-555555555555", { decision: "REJECTED", acceptedItemIds: [] });
  });
  it("a failed history read is silent and keeps what is on screen", async () => {
    jest.mocked(campApi.rounds).mockResolvedValue(withR1());
    jest.mocked(campApi.aiHistory).mockRejectedValue(new ApiError(500, "INTERNAL", "boom"));
    jest.mocked(campApi.roundAdvice).mockResolvedValue({ suggestion: suggestion() });
    jest.mocked(campApi.saveRound).mockResolvedValue(r1);
    const ui = await onTab1();
    await waitFor(() => expect(campApi.aiHistory).toHaveBeenCalled());
    expect(ui.getByText("AI dặn")).toBeTruthy();
    await fireEvent.press(ui.getByText("AI dặn")); await ui.findByText("Lời dặn của AI");
    await fireEvent.press(ui.getByText("Lưu lại hiệp 1")); await ui.findByText("Đã lưu hiệp 1");
    expect(ui.getByText("Lời dặn của AI")).toBeTruthy();
    expect(ui.queryByText(/boom|Không thực hiện/)).toBeNull();
  });
  it("shows the faint cached note", async () => {
    jest.mocked(campApi.rounds).mockResolvedValue(withR1());
    jest.mocked(campApi.roundAdvice).mockResolvedValue({ suggestion: suggestion({ cached: true }) });
    const ui = await onTab1();
    await fireEvent.press(ui.getByText("AI dặn"));
    await ui.findByText("Gợi ý lấy lại từ lần trước");
  });
  it("demo mode uses the labelled sample and never calls the server", async () => {
    const ui = await render(<RoundScreen bout={{ ...bout, id: "demo-ai" }} preview onAdvice={() => undefined}/>);
    await ui.findByText("Chốt hiệp 1");
    await fireEvent.press(ui.getByText("Thua")); await fireEvent.press(ui.getByText("Chốt hiệp 1"));
    await ui.findByText("Đã lưu hiệp 1");
    await fireEvent.press(ui.getByText("AI dặn"));
    await ui.findByText("Gợi ý mẫu (demo)", {}, { timeout: 3000 });
    expect(campApi.roundAdvice).not.toHaveBeenCalled(); expect(campApi.decideAi).not.toHaveBeenCalled();
    resetPreviewRounds("demo-ai");
  });
});
