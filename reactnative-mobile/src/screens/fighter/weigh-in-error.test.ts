import { ApiError } from "@/api/errors";

import { weighInErrorMessage } from "./weigh-in-error";

describe("weighInErrorMessage", () => {
  it("403 → báo huấn luyện viên", () => {
    expect(weighInErrorMessage(new ApiError(403, "FORBIDDEN", "x"))).toBe(
      "Tài khoản chưa được phép ghi cân. Hãy báo huấn luyện viên.",
    );
  });
  it("lỗi mạng và lỗi khác", () => {
    expect(weighInErrorMessage(new ApiError(0, "NETWORK_ERROR", "x"))).toMatch(/kết nối/);
    expect(weighInErrorMessage(new Error("boom"))).toMatch(/Chưa lưu được/);
  });
});
