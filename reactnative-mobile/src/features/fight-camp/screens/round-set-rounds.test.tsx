/// <reference types="jest" />
import { fireEvent, render } from "@testing-library/react-native";
import { campApi, type CampDetail } from "@/features/fight-camp/api";
import { previewBout } from "@/features/fight-camp/state/camp-preview";
import { RoundScreen } from "./round-screens";

jest.mock("@/features/fight-camp/api", () => ({ campApi: { rounds: jest.fn(), saveRound: jest.fn(), update: jest.fn() } }));
jest.mock("@/shared/ui/camp-ui", () => {
  const ui = require("@/features/fight-camp/testing/camp-test-ui").campUiMock();
  const React = require("react"); const { View } = require("react-native");
  return { ...ui, RoundTabs: () => React.createElement(View, { testID: "round-tabs" }) };
});

const api = campApi as jest.Mocked<typeof campApi>;
const bout = (): CampDetail => ({ ...structuredClone(previewBout), id: "b-no-rounds", status: "WEIGHED_IN", scheduledRounds: null });
beforeEach(() => { jest.clearAllMocks(); });

describe("Round entry when the bout has no round count", () => {
  it("asks for the rounds in place, saves them, and opens round entry", async () => {
    const b = bout();
    api.rounds.mockResolvedValueOnce({ scheduledRounds: null, rounds: [], advice: null }).mockResolvedValue({ scheduledRounds: 3, rounds: [], advice: null });
    api.update.mockResolvedValue({ ...b, scheduledRounds: 3 });
    const onBoutChange = jest.fn();
    const ui = await render(<RoundScreen bout={b} preview={false} onBoutChange={onBoutChange}/>);
    await ui.findByText("Trận chưa đặt số hiệp");
    expect(ui.queryByText("Chưa đặt số hiệp nên chưa có lời dặn.")).toBeNull();
    await fireEvent.press(ui.getByText("3 hiệp"));
    await fireEvent.press(ui.getByLabelText("Đặt 3 hiệp"));
    expect(api.update).toHaveBeenCalledWith("b-no-rounds", { scheduledRounds: 3 });
    await ui.findByTestId("round-tabs");
    expect(onBoutChange).toHaveBeenCalledWith(expect.objectContaining({ scheduledRounds: 3 }));
  });

  it("accepts another count from 1 to 12 and rejects anything else", async () => {
    api.rounds.mockResolvedValue({ scheduledRounds: null, rounds: [], advice: null });
    const ui = await render(<RoundScreen bout={bout()} preview={false}/>);
    await ui.findByText("Trận chưa đặt số hiệp");
    await fireEvent.changeText(ui.getByLabelText("Số hiệp khác"), "15");
    await fireEvent.press(ui.getByLabelText("Đặt số hiệp"));
    expect(ui.getByText("Nhập số hiệp từ 1 đến 12.")).toBeTruthy();
    expect(api.update).not.toHaveBeenCalled();
  });
});
