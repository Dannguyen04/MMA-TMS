/// <reference types="jest" />
import { StyleSheet, Text } from "react-native";
import { render } from "@testing-library/react-native";
import { READABLE_MAX_WIDTH } from "@/components/layout/readable-width";
import { CampShell } from "@/shared/ui/camp-ui";

let mockDims = { width: 390, height: 844, scale: 2, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({ __esModule: true, default: () => mockDims }));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const sizes = [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }];

describe("CampShell column (Phase 5 batches A and D)", () => {
  it.each(sizes)("uses the shared readable width at $width×$height, with header and footer inside the column", async ({ width, height }) => {
    mockDims = { width, height, scale: 2, fontScale: 1 };
    const ui = await render(<CampShell title="Trận thi đấu" onBack={() => undefined} footer={<Text>Chân trang</Text>}><Text>Nội dung</Text></CampShell>);
    const column = ui.getByTestId("camp-column");
    expect(StyleSheet.flatten(column.props.style).maxWidth).toBe(READABLE_MAX_WIDTH);
    expect(READABLE_MAX_WIDTH).toBe(640);
    const inside = (label: string) => { let n: typeof column | null = ui.getByText(label); while (n && n !== column) n = n.parent; return n === column; };
    expect(inside("Chân trang")).toBe(true);
    expect(ui.getByLabelText("Quay lại")).toBeTruthy();
    let back: typeof column | null = ui.getByLabelText("Quay lại"); while (back && back !== column) back = back.parent;
    expect(back).toBe(column);
  });
  it("puts the screen title in the header bar in place of 'Fight Camp', once", async () => {
    mockDims = { width: 390, height: 844, scale: 2, fontScale: 1 };
    const ui = await render(<CampShell title="Trận thi đấu" subtitle="Cân chính thức, chuẩn bị góc đài và ghi hiệp." onBack={() => undefined}><Text>Nội dung</Text></CampShell>);
    const headers = ui.getAllByRole("header");
    expect(headers).toHaveLength(1);
    let n: ReturnType<typeof ui.getByTestId> | null = headers[0]!; while (n && n.props.testID !== "camp-header") n = n.parent;
    expect(n?.props.testID).toBe("camp-header");
    expect(ui.getByText("Trận thi đấu")).toBeTruthy();
    expect(ui.queryByText("Fight Camp")).toBeNull();
    expect(ui.getByText("Cân chính thức, chuẩn bị góc đài và ghi hiệp.")).toBeTruthy();
  });
  it.each([{ width: 844, height: 390, header: 44 }, { width: 1180, height: 820, header: 54 }, { width: 1280, height: 800, header: 54 }])("compacts the header and footer only when the window is shorter than 500 ($width×$height)", async ({ width, height, header }) => {
    mockDims = { width, height, scale: 2, fontScale: 1 };
    const ui = await render(<CampShell title="Ghi hiệp" onBack={() => undefined} footer={<Text>Chốt hiệp</Text>}><Text>Nội dung</Text></CampShell>);
    expect(StyleSheet.flatten(ui.getByTestId("camp-header").props.style).minHeight).toBe(header);
    expect(StyleSheet.flatten(ui.getByTestId("camp-footer-bar").props.style).paddingTop).toBe(header === 44 ? 6 : 12);
    expect(ui.getByText("Chốt hiệp")).toBeTruthy();
  });
});
