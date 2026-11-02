import { render, screen } from "@testing-library/react-native";

import { FeatureUnavailable } from "@/components/feature-unavailable";
import { ThemePreferenceProvider } from "@/theme/theme-preference";

describe("FeatureUnavailable", () => {
  it("luôn hiện đúng chuỗi chưa khả dụng", async () => {
    await render(
      <ThemePreferenceProvider>
        <FeatureUnavailable description="Mô tả thêm" />
      </ThemePreferenceProvider>,
    );
    expect(await screen.findByText("Tính năng này chưa khả dụng")).toBeTruthy();
    expect(screen.getByText("Mô tả thêm")).toBeTruthy();
  });
});
