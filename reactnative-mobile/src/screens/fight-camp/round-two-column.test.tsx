/// <reference types="jest" />
import { fireEvent, render } from "@testing-library/react-native";
import { betweenRound as t } from "@/i18n/between-round";
import { previewBout } from "./camp-preview";
import { resetPreviewRounds } from "./preview-round-store";
import { CampTwoColumnsProvider } from "./camp-columns";
import { RoundScreen } from "./round-screens";

jest.mock("@/api/fight-camp", () => ({ campApi: { rounds: jest.fn(), saveRound: jest.fn() } }));
// Keep presentation out of flow tests. The real store, rules, hook and panel run unchanged.
jest.mock("./camp-ui", () => {
  const React = require("react"); const { Text, View, Pressable, TextInput } = require("react-native");
  const text = ({ children, strike }: { children: unknown; strike?: boolean }) => React.createElement(Text, { style: strike ? { textDecorationLine: "line-through" } : undefined }, children);
  return {
    Copy: text, SvgTitle: text, SectionTitle: text, Frame: ({ children }: { children: unknown }) => React.createElement(View, null, children),
    Busy: () => React.createElement(Text, null, "Loading"),
    Notice: ({ title, children }: { title: string; children: unknown }) => React.createElement(View, null, React.createElement(Text, null, title), React.createElement(Text, null, children)),
    MarkLegend: () => null,
    MarkGroup: ({ title, count, open, onToggle, children }: { title: string; count?: string; open: boolean; onToggle: () => void; children: unknown }) => React.createElement(View, null, React.createElement(Pressable, { accessibilityRole: "button", accessibilityLabel: title, accessibilityState: { expanded: open }, onPress: onToggle }, React.createElement(Text, null, title)), count ? React.createElement(Text, null, count) : null, open ? children : null),
    MarkRow: ({ label, options, onChange }: { label?: string; options: { value: unknown; label: string }[]; onChange: (v: unknown) => void }) => React.createElement(View, null, label ? React.createElement(Text, null, label) : null, ...options.map((o, i) => React.createElement(Pressable, { key: i, onPress: () => onChange(o.value) }, React.createElement(Text, null, o.label)))),
    Choices: ({ label, options, onChange }: { label?: string; options: { value: unknown; label: string }[]; onChange: (v: unknown) => void }) => React.createElement(View, null, label ? React.createElement(Text, null, label) : null, ...options.map((o, i) => React.createElement(Pressable, { key: i, onPress: () => onChange(o.value) }, React.createElement(Text, null, o.label)))),
    Action: ({ label, onPress, disabled, pending }: { label: string; onPress: () => void; disabled?: boolean; pending?: boolean }) => React.createElement(Pressable, { accessibilityLabel: label, disabled: disabled || pending, onPress }, React.createElement(Text, null, label)),
    PlanToggle: ({ label, selected, onPress, disabled }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) => React.createElement(Pressable, { accessibilityRole: "checkbox", accessibilityLabel: label, accessibilityState: { checked: selected }, disabled, onPress }, React.createElement(Text, null, label)),
    Field: ({ label, ...props }: { label: string }) => React.createElement(TextInput, { accessibilityLabel: label, ...props }),
    CampFooter: ({ children }: { children: unknown }) => React.createElement(View, { testID: "camp-footer" }, children),
    CampTop: ({ children }: { children: unknown }) => React.createElement(View, { testID: "camp-top" }, children),
    RoundTabs: ({ total, value, saved, onChange, tabLabel, savedLabel }: { total: number; value: number; saved: number[]; onChange: (n: number) => void; tabLabel: (n: number) => string; savedLabel: (n: number) => string }) => React.createElement(View, { testID: "round-tabs" }, ...Array.from({ length: total }, (_, i) => React.createElement(Pressable, { key: i, accessibilityRole: "radio", accessibilityLabel: saved.includes(i + 1) ? savedLabel(i + 1) : tabLabel(i + 1), accessibilityState: { checked: value === i + 1 }, onPress: () => onChange(i + 1) }, React.createElement(Text, null, tabLabel(i + 1))))),
  };
});

const bout = { ...previewBout, id: "round-two-col", status: "WEIGHED_IN" as const };
beforeEach(() => { jest.clearAllMocks(); resetPreviewRounds(bout.id); });
const extra = (previewBout.opponentAnalysis.tactics?.length ?? 0) + (previewBout.opponentAnalysis.observations?.length ?? 0) > 3;

const tab = (ui: Awaited<ReturnType<typeof render>>, name: RegExp) => fireEvent.press(ui.getByRole("tab", { name }));

describe("Round entry tabs: Hiệp này · Sức khỏe · Hiệp sau (owner 2026-11-11)", () => {
  it("phone: health and note sit in 'Sức khỏe'; every mark shows in 'Hiệp này', counted per group", async () => {
    const ui = await render(<RoundScreen bout={bout} preview/>);
    await ui.findByText("Chốt hiệp 1");
    expect(ui.queryByText(t.knockdowns)).toBeNull();
    expect(ui.queryByTestId("next-round-plan")).toBeNull();
    expect(ui.queryByText(/^Xem thêm \d+ mục$/)).toBeNull();
    const tactics = previewBout.opponentAnalysis.tactics?.length ?? 0;
    const observations = previewBout.opponentAnalysis.observations?.length ?? 0;
    if (extra) expect(ui.getAllByText(t.unseen).length).toBe(observations);
    expect(ui.getByText(t.marked(0, observations))).toBeTruthy();
    expect(ui.getAllByText(t.effective).length).toBeGreaterThanOrEqual(Math.min(tactics, 2));
    await tab(ui, /Sức khỏe/);
    expect(ui.getByTestId("round-health")).toBeTruthy();
    expect(ui.getByText(t.knockdowns)).toBeTruthy();
    expect(ui.getByLabelText(t.note)).toBeTruthy();
    await tab(ui, /Hiệp sau/);
    expect(ui.getByTestId("next-round-plan")).toBeTruthy();
  });
  it("a folded group stays folded after switching to another round and back (owner 2026-11-18)", async () => {
    const ui = await render(<RoundScreen bout={bout} preview/>);
    await ui.findByText("Chốt hiệp 1");
    const tactics = () => ui.getByRole("button", { name: t.scoreTactics });
    expect(ui.getAllByText(t.effective).length).toBeGreaterThan(0);
    await fireEvent.press(tactics());
    expect(ui.queryAllByText(t.effective)).toHaveLength(0);
    await fireEvent.press(ui.getByLabelText("Hiệp 2"));
    await ui.findByText("Chốt hiệp 2");
    expect(ui.getAllByText(t.effective).length).toBeGreaterThan(0);
    await fireEvent.press(ui.getByLabelText("Hiệp 1"));
    await ui.findByText("Chốt hiệp 1");
    expect(ui.queryAllByText(t.effective)).toHaveLength(0);
    expect(tactics().props.accessibilityState).toMatchObject({ expanded: false });
  });
  it("two columns: every mark shows in 'Hiệp này' without a 'Xem thêm' link", async () => {
    const ui = await render(<CampTwoColumnsProvider value><RoundScreen bout={bout} preview/></CampTwoColumnsProvider>);
    await ui.findByText("Chốt hiệp 1");
    expect(ui.queryByText(/^Xem thêm \d+ mục$/)).toBeNull();
    const marks = (previewBout.opponentAnalysis.tactics?.length ?? 0);
    expect(ui.getAllByText(t.effective).length).toBeGreaterThanOrEqual(Math.min(marks, 2));
  });
  it("phone: no 'Xem thêm' when no extra tactic or observation is left", async () => {
    const lean = { ...bout, id: "round-two-col-lean", opponentAnalysis: { ...bout.opponentAnalysis, tactics: bout.opponentAnalysis.tactics?.slice(0, 1), observations: bout.opponentAnalysis.observations?.slice(0, 1) } };
    resetPreviewRounds(lean.id);
    const ui = await render(<RoundScreen bout={lean} preview/>);
    await ui.findByText("Chốt hiệp 1");
    expect(ui.queryByText(/^Xem thêm \d+ mục$/)).toBeNull();
  });
});
