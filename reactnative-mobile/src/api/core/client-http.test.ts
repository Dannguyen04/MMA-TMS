import { CanceledError, type AxiosAdapter } from "axios";

import { apiFetch } from "./client";
import { API_BASE_URL } from "./config";
import { http } from "./http";

const originalAdapter = http.defaults.adapter;
let adapter: jest.MockedFunction<AxiosAdapter>;

beforeEach(() => {
  adapter = jest.fn(async (config) => ({
    data: '{"success":true,"data":null}', status: 200, statusText: "OK", headers: {}, config,
  }));
  http.defaults.adapter = adapter;
});
afterEach(() => { http.defaults.adapter = originalAdapter; });

it("preserves JSON bytes, headers, URL joining and the default timeout", async () => {
  const body = ' { "title": "round" } ';
  await apiFetch("bouts", { method: "POST", body, skipAuth: true, headers: { "X-Test": "yes" } });
  const config = adapter.mock.calls[0]![0];
  expect(config.url).toBe(`${API_BASE_URL}/bouts`);
  expect(config.data).toBe(body);
  expect(config.headers.getContentType()).toBe("application/json");
  expect(config.headers.get("X-Test")).toBe("yes");
  expect(config.timeout).toBe(90_000);
  expect(config.validateStatus!(503)).toBe(true);
  expect(config.responseType).toBe("text");
});

it("passes absolute URLs through and respects a caller content type", async () => {
  await apiFetch(API_BASE_URL, { skipAuth: true, method: "POST", body: "raw", headers: new Headers({ "Content-Type": "text/plain" }) });
  const config = adapter.mock.calls[0]![0];
  expect(config.url).toBe(API_BASE_URL);
  expect(config.headers.getContentType()).toBe("text/plain");
});

it("sends FormData unchanged without a JSON/form header or upload timeout", async () => {
  const body = new FormData();
  body.append("title", "round");
  await apiFetch("/upload", { skipAuth: true, method: "POST", body });
  const config = adapter.mock.calls[0]![0];
  expect(config.data).toBe(body);
  expect(config.headers.toJSON()["Content-Type"]).toBeUndefined();
  expect(config.timeout).toBe(0);
});

it("keeps the existing Blob video upload MIME type and has no upload timeout", async () => {
  const body = new Blob(["video"], { type: "video/mp4" });
  await apiFetch("/videos/upload", { skipAuth: true, method: "POST", body, headers: { "Content-Type": "video/mp4" } });
  const config = adapter.mock.calls[0]![0];
  expect(config.data).toBe(body);
  expect(config.headers.getContentType()).toBe("video/mp4");
  expect(config.timeout).toBe(0);
});

it("does not add a content type to an empty POST", async () => {
  await apiFetch("/empty", { skipAuth: true, method: "POST" });
  expect(adapter.mock.calls[0]![0].headers.toJSON()["Content-Type"]).toBeUndefined();
});

it.each([
  [204, "", "HTTP_204"],
  [200, "plain text", "HTTP_200"],
  [200, "null", "HTTP_200"],
  [200, '{"success":true}', "HTTP_200"],
  [200, '{"success":false,"error":{"code":"REJECTED"}}', "REJECTED"],
  [503, "unavailable", "HTTP_503"],
  [422, '{"success":false,"error":{"code":"BAD_INPUT","message":"invalid"}}', "BAD_INPUT"],
])("preserves parsing and errors for status %s, body %s", async (status, data, code) => {
  adapter.mockImplementationOnce(async config => ({ data, status, statusText: "", headers: {}, config }));
  await expect(apiFetch("/test", { skipAuth: true })).rejects.toMatchObject({ name: "ApiError", status, code });
});

it("unwraps a successful envelope, including null data", async () => {
  await expect(apiFetch("/test", { skipAuth: true })).resolves.toBeNull();
});

it("keeps pre-aborted requests as NETWORK_ERROR and never sends them", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(apiFetch("/test", { skipAuth: true, signal: controller.signal }))
    .rejects.toMatchObject({ name: "ApiError", status: 0, code: "NETWORK_ERROR" });
  expect(adapter).not.toHaveBeenCalled();
});

it("passes the signal to the transport and maps an in-flight cancellation as before", async () => {
  const controller = new AbortController();
  adapter.mockImplementationOnce(config => new Promise((_resolve, reject) => {
    expect(config.signal).toBe(controller.signal);
    config.signal!.addEventListener!("abort", () => reject(new CanceledError()));
    controller.abort();
  }));
  await expect(apiFetch("/test", { skipAuth: true, signal: controller.signal }))
    .rejects.toMatchObject({ name: "ApiError", status: 0, code: "NETWORK_ERROR" });
});

it("maps offline and timeout failures to NETWORK_ERROR", async () => {
  for (const error of [new TypeError("offline"), Object.assign(new Error("timeout"), { code: "ECONNABORTED" })]) {
    adapter.mockRejectedValueOnce(error);
    await expect(apiFetch("/test", { skipAuth: true }))
      .rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR", message: "Network request failed" });
  }
});
