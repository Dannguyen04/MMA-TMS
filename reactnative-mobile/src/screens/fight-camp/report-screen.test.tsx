/// <reference types="jest" />
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { campApi, type CampReport } from "@/api/fight-camp";
import { ApiError } from "@/api/errors";
import { boutReport as t } from "@/i18n/bout-report";
import { previewBout } from "./camp-preview";
import { ReportScreen } from "./report-screen";

jest.mock("@/api/fight-camp", () => ({ campApi: { report: jest.fn(), review: jest.fn() } }));
jest.mock("./camp-ui", () => {
  const React = require("react"); const { Text, View, Pressable, TextInput } = require("react-native");
  const text = ({ children }: { children: unknown }) => React.createElement(Text, null, children);
  return {
    Copy: text, SvgTitle: text, CampIcon: () => null, Frame: ({ children }: { children: unknown }) => React.createElement(View, null, children),
    Busy: () => React.createElement(Text, null, "Loading"),
    Fact: ({ label, value }: { label: string; value: string }) => React.createElement(Text, null, `${label}: ${value}`),
    Notice: ({ title, children }: { title: string; children: unknown }) => React.createElement(View, null, React.createElement(Text, null, title), children ? React.createElement(Text, null, children) : null),
    Choices: ({ label, options, onChange }: { label?: string; options: { value: unknown; label: string }[]; onChange: (v: unknown) => void }) => React.createElement(View, null, label ? React.createElement(Text, null, label) : null, ...options.map((o, i) => React.createElement(Pressable, { key: i, onPress: () => onChange(o.value) }, React.createElement(Text, null, o.label)))),
    Action: ({ label, onPress, disabled, pending }: { label: string; onPress: () => void; disabled?: boolean; pending?: boolean }) => React.createElement(Pressable, { accessibilityLabel: label, disabled: disabled || pending, onPress }, React.createElement(Text, null, label)),
    Field: ({ label, helper, error, ...props }: { label: string; helper?: string; error?: string }) => React.createElement(View, null, React.createElement(TextInput, { accessibilityLabel: label, ...props }), error ? React.createElement(Text, null, error) : helper ? React.createElement(Text, null, helper) : null),
  };
});

const bout = { ...previewBout, id: "bout-1", status: "COMPLETED" as const };
const report = (over: Partial<CampReport> = {}): CampReport => ({
  result: { result: "WIN", method: "TKO", resultRound: 2, knockedDown: false },
  tactics: [
    { id: "t1", text: "Giữ khoảng cách", effectiveRounds: 2, ineffectiveRounds: 0, outcome: "EFFECTIVE", review: null },
    { id: "t2", text: "Đổi góc sau jab", effectiveRounds: 0, ineffectiveRounds: 1, outcome: "INEFFECTIVE", review: { outcome: "INEFFECTIVE", note: null, auto: true } },
  ],
  observations: [{ id: "o1", text: "Hạ tay phải khi lùi", notSeenInBout: true }],
  acuteLoss: { status: "EXCEEDED", startKg: 64, startOn: "2026-10-24", lossPct: 6.25, limitPct: 5 },
  improvementPoints: [{ code: "FATIGUE_FROM_ROUND_2", fromRound: 2 }, { code: "ACUTE_LOSS_EXCEEDED" }, { code: "TACTIC_INEFFECTIVE", tacticId: "t2", text: "Đổi góc sau jab" }, { code: "BRAND_NEW_CODE" }],
  roundsRecorded: 2, ...over,
});
const api = campApi as jest.Mocked<typeof campApi>;
beforeEach(() => jest.clearAllMocks());

describe("T-041 màn báo cáo sau trận", () => {
  it("R1/R2/R4: câu tiếng Việt, bỏ mã lạ, nhãn Ứng dụng điền sẵn, kết quả và giảm cân", async () => {
    api.report.mockResolvedValue(report());
    const ui = await render(<ReportScreen bout={bout} preview={false} onRounds={() => undefined}/>);
    await ui.findByText("Đuối sức từ hiệp 2");
    expect(ui.getByText("Giảm cân cấp tốc vượt ngưỡng")).toBeTruthy();
    expect(ui.getByText("Chưa hiệu quả: Đổi góc sau jab")).toBeTruthy();
    expect(ui.queryByText(/BRAND_NEW_CODE|FATIGUE_FROM|TKO$/)).toBeNull();
    expect(ui.getAllByText(t.autoFilled)).toHaveLength(2);
    expect(ui.getByText(`${t.method}: Hạ đo ván kỹ thuật (TKO)`)).toBeTruthy();
    expect(ui.getByText(`${t.resultRound}: Hiệp 2`)).toBeTruthy();
    expect(ui.getByText(`${t.knockedDown}: Không`)).toBeTruthy();
    expect(ui.getByText("Không thấy lại ở trận ngày 30/10")).toBeTruthy();
    expect(ui.getByText(/Giảm 6,3% so với 64,0 kg ngày 24\/10, vượt ngưỡng 5%/)).toBeTruthy();
  });

  it("R3: 409 hiện câu chờ kết quả, không hiện lỗi", async () => {
    api.report.mockRejectedValue(new ApiError(409, "BOUT_INVALID_TRANSITION", "The bout status forbids this operation"));
    const ui = await render(<ReportScreen bout={bout} preview={false} onRounds={() => undefined}/>);
    await ui.findByText(t.notReadyTitle);
    expect(ui.queryByText(t.loadFailed)).toBeNull();
  });

  it("R5: lưu gửi đủ mọi chiến thuật; tải lại thì hết nhãn Ứng dụng điền sẵn", async () => {
    api.report.mockResolvedValueOnce(report()).mockResolvedValueOnce(report({ tactics: report().tactics.map(x => ({ ...x, review: { outcome: x.id === "t1" ? "INEFFECTIVE" : x.outcome!, note: x.id === "t1" ? "Bị bắt bài" : null, auto: false } })) }));
    api.review.mockResolvedValue(undefined as never);
    const ui = await render(<ReportScreen bout={bout} preview={false} onRounds={() => undefined}/>);
    await ui.findByText("Giữ khoảng cách");
    await fireEvent.press(ui.getAllByText("Không hiệu quả")[0]);
    await fireEvent.changeText(ui.getAllByLabelText(t.note)[0], "Bị bắt bài");
    await fireEvent.press(ui.getByLabelText(t.save));
    await ui.findByText(t.saved);
    expect(api.review).toHaveBeenCalledWith("bout-1", [{ tacticId: "t1", outcome: "INEFFECTIVE", note: "Bị bắt bài" }, { tacticId: "t2", outcome: "INEFFECTIVE" }]);
    expect(ui.queryByText(t.autoFilled)).toBeNull();
  });

  it("R5: nút lưu bật ngay cả khi chưa sửa, để HLV xác nhận phần app điền sẵn", async () => {
    api.report.mockResolvedValue(report()); api.review.mockResolvedValue(undefined as never);
    const ui = await render(<ReportScreen bout={bout} preview={false} onRounds={() => undefined}/>);
    await ui.findByText("Giữ khoảng cách");
    await fireEvent.press(ui.getByLabelText(t.save));
    await waitFor(() => expect(api.review).toHaveBeenCalledWith("bout-1", [{ tacticId: "t1", outcome: "EFFECTIVE" }, { tacticId: "t2", outcome: "INEFFECTIVE" }]));
  });

  it("R6: ghi chú 301 ký tự báo lỗi ở form, có bộ đếm, không gửi", async () => {
    api.report.mockResolvedValue(report());
    const ui = await render(<ReportScreen bout={bout} preview={false} onRounds={() => undefined}/>);
    await ui.findByText("Giữ khoảng cách");
    expect(ui.getAllByText(t.noteCount(0)).length).toBe(2);
    await fireEvent.changeText(ui.getAllByLabelText(t.note)[0], "x".repeat(301));
    expect(ui.getByText(t.noteTooLong(301))).toBeTruthy();
    expect(ui.getAllByLabelText(t.note)[0].props.value).toHaveLength(301);
    await fireEvent.press(ui.getByLabelText(t.save));
    expect(ui.getByText(t.fixNotes)).toBeTruthy();
    expect(api.review).not.toHaveBeenCalled();
  });

  it("R7: chưa ghi hiệp thì giải thích và có nút sang ghi hiệp, không hiện bảng", async () => {
    api.report.mockResolvedValue(report({ roundsRecorded: 0, improvementPoints: [], tactics: report().tactics.map(x => ({ ...x, effectiveRounds: 0, ineffectiveRounds: 0, outcome: null, review: null })) }));
    const onRounds = jest.fn();
    const ui = await render(<ReportScreen bout={bout} preview={false} onRounds={onRounds}/>);
    await ui.findByText(t.noRoundsTitle);
    expect(ui.queryByText("Giữ khoảng cách")).toBeNull(); expect(ui.queryByLabelText(t.save)).toBeNull();
    await fireEvent.press(ui.getByLabelText(t.goRounds));
    expect(onRounds).toHaveBeenCalled();
  });

  it("demo: không gọi API, lưu đánh giá trong bộ nhớ", async () => {
    const ui = await render(<ReportScreen bout={{ ...bout, id: "demo-report" }} preview onRounds={() => undefined}/>);
    await ui.findByText(t.noRoundsTitle);
    expect(api.report).not.toHaveBeenCalled();
  });
});
