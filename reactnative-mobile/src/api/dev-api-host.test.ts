import { hostnameFromHostUri, resolveDevApiBaseUrl } from "@/api/dev-api-host";

describe("hostnameFromHostUri", () => {
  it("parses Expo hostUri without a scheme", () => {
    expect(hostnameFromHostUri("192.168.1.20:8081")).toBe("192.168.1.20");
  });
});

describe("resolveDevApiBaseUrl", () => {
  const bundler = ["192.168.1.20:8081"];

  it("rewrites loopback to the Expo bundler LAN IP on a physical Android device", () => {
    expect(
      resolveDevApiBaseUrl({
        configuredUrl: "http://127.0.0.1:3001",
        isDev: true,
        platform: "android",
        isPhysicalDevice: true,
        bundlerHosts: bundler,
      }),
    ).toBe("http://192.168.1.20:3001");

    expect(
      resolveDevApiBaseUrl({
        configuredUrl: "http://localhost:3001",
        isDev: true,
        platform: "android",
        isPhysicalDevice: true,
        bundlerHosts: bundler,
      }),
    ).toBe("http://192.168.1.20:3001");
  });

  it("uses 10.0.2.2 for the Android emulator when the config is loopback", () => {
    expect(
      resolveDevApiBaseUrl({
        configuredUrl: "http://localhost:3001",
        isDev: true,
        platform: "android",
        isPhysicalDevice: false,
        bundlerHosts: ["127.0.0.1:8081"],
      }),
    ).toBe("http://10.0.2.2:3001");
  });

  it("keeps loopback on a USB-connected physical Android device for adb reverse", () => {
    expect(
      resolveDevApiBaseUrl({
        configuredUrl: "http://localhost:3001",
        isDev: true,
        platform: "android",
        isPhysicalDevice: true,
        bundlerHosts: ["localhost:8081"],
      }),
    ).toBe("http://localhost:3001");
  });

  it("prefers the Metro LAN IP over 10.0.2.2 when Android is on Wi-Fi", () => {
    expect(
      resolveDevApiBaseUrl({
        configuredUrl: "http://localhost:3001",
        isDev: true,
        platform: "android",
        isPhysicalDevice: false,
        bundlerHosts: ["10.87.34.242:8081"],
      }),
    ).toBe("http://10.87.34.242:3001");
  });

  it("lets an explicit non-loopback env URL win", () => {
    expect(
      resolveDevApiBaseUrl({
        configuredUrl: "http://192.168.0.50:3001",
        isDev: true,
        platform: "android",
        isPhysicalDevice: true,
        bundlerHosts: bundler,
      }),
    ).toBe("http://192.168.0.50:3001");

    expect(
      resolveDevApiBaseUrl({
        configuredUrl: "http://10.0.2.2:3001",
        isDev: true,
        platform: "android",
        isPhysicalDevice: true,
        bundlerHosts: bundler,
      }),
    ).toBe("http://10.0.2.2:3001");
  });

  it("keeps production URLs unchanged", () => {
    expect(
      resolveDevApiBaseUrl({
        configuredUrl: "https://api.example.com",
        isDev: false,
        platform: "android",
        isPhysicalDevice: true,
        bundlerHosts: bundler,
      }),
    ).toBe("https://api.example.com");
  });

  it("keeps localhost on iOS simulator", () => {
    expect(
      resolveDevApiBaseUrl({
        configuredUrl: "http://localhost:3001",
        isDev: true,
        platform: "ios",
        isPhysicalDevice: false,
        bundlerHosts: bundler,
      }),
    ).toBe("http://localhost:3001");
  });
});
