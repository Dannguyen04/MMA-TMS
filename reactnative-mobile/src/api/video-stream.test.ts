import { API_BASE_URL } from "./config";
import { resolveVideoStream } from "./media";

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as { fetch: unknown }).fetch = fetchMock;
});

describe("resolveVideoStream", () => {
  it("dùng signed URL sau redirect và không gửi header cho kho lưu trữ", async () => {
    fetchMock.mockResolvedValue({ status: 200, ok: true, url: "https://x.supabase.co/storage/v1/object/sign/v.mp4?token=t" });
    await expect(resolveVideoStream("/videos/v1/content", "tok")).resolves.toEqual({
      uri: "https://x.supabase.co/storage/v1/object/sign/v.mp4?token=t",
    });
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/videos/v1/content`, {
      method: "HEAD",
      headers: { Authorization: "Bearer tok" },
    });
  });

  it("quay về URL API kèm header khi không đọc được URL cuối", async () => {
    fetchMock.mockResolvedValue({ status: 200, ok: true, url: "" });
    await expect(resolveVideoStream("/videos/v1/content", "tok")).resolves.toEqual({
      uri: `${API_BASE_URL}/videos/v1/content`,
      headers: { Authorization: "Bearer tok" },
    });
  });

  it("báo lỗi quyền khi API trả 401", async () => {
    fetchMock.mockResolvedValue({ status: 401, ok: false, url: "" });
    await expect(resolveVideoStream("/videos/v1/content", "tok")).rejects.toMatchObject({ status: 401 });
  });
});
