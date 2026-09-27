export type DevApiPlatform = "android" | "ios" | "web" | "windows" | string;

export type ResolveDevApiBaseUrlInput = {
  configuredUrl: string | undefined;
  isDev: boolean;
  platform: DevApiPlatform;
  /** Physical Android/iOS device (not emulator/simulator). */
  isPhysicalDevice: boolean;
  /** Hostnames from Metro/Expo (hostUri, debuggerHost), without port. */
  bundlerHosts: Array<string | undefined>;
};

const DEFAULT_ORIGIN = "http://localhost:3001";
const DEFAULT_PORT = "3001";
const ANDROID_EMU_HOST = "10.0.2.2";

export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
}

export function hostnameFromHostUri(raw: string | undefined): string | undefined {
  if (typeof raw !== "string" || raw.trim().length === 0) return undefined;
  let value = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    value = `http://${value}`;
  }
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    return host.length > 0 ? host : undefined;
  } catch {
    const withoutPath = value.split("/")[0] ?? "";
    const host = withoutPath.split(":")[0]?.trim();
    return host && host.length > 0 ? host : undefined;
  }
}

function firstLanBundlerHost(candidates: Array<string | undefined>): string | undefined {
  for (const raw of candidates) {
    const host = hostnameFromHostUri(raw);
    if (host && !isLoopbackHostname(host)) return host;
  }
  return undefined;
}

function parseOrigin(raw: string): { protocol: string; hostname: string; port: string } {
  const trimmed = raw.trim().replace(/\/$/, "");
  try {
    const url = new URL(trimmed);
    return {
      protocol: url.protocol || "http:",
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? "443" : DEFAULT_PORT),
    };
  } catch {
    return { protocol: "http:", hostname: "localhost", port: DEFAULT_PORT };
  }
}

function origin(protocol: string, hostname: string, port: string): string {
  const hideDefaultHttps = protocol === "https:" && (port === "443" || port === "");
  const hideDefaultHttp = protocol === "http:" && (port === "80" || port === "");
  if (hideDefaultHttps || hideDefaultHttp) {
    return `${protocol}//${hostname}`;
  }
  return `${protocol}//${hostname}:${port}`;
}

/**
 * Resolution order:
 * 1. Production (`isDev === false`): configured URL as-is (or default). Never rewrite.
 * 2. Configured non-loopback host (LAN IP, 10.0.2.2, production hostname): use it.
 * 3. `__DEV__` Android + loopback config + Expo LAN bundler host → that host + Nest port.
 *    Physical phones (and misdetected “emulators”) share Metro over Wi‑Fi; never 10.0.2.2 then.
 * 4. `__DEV__` Android with no LAN bundler (classic emulator / adb reverse) → `10.0.2.2`.
 * 5. iOS (simulator) may keep localhost.
 */
export function resolveDevApiBaseUrl(input: ResolveDevApiBaseUrlInput): string {
  const configured = (input.configuredUrl ?? "").trim().replace(/\/$/, "");
  const raw = configured.length > 0 ? configured : DEFAULT_ORIGIN;
  const parsed = parseOrigin(raw);

  if (!input.isDev) {
    return raw;
  }

  if (!isLoopbackHostname(parsed.hostname)) {
    return origin(parsed.protocol, parsed.hostname, parsed.port);
  }

  if (input.platform === "android") {
    const lan = firstLanBundlerHost(input.bundlerHosts);
    if (lan) {
      return origin(parsed.protocol, lan, parsed.port);
    }
    // No LAN hostUri: emulator alias, or phone without Metro host (set EXPO_PUBLIC_API_URL / adb reverse).
    return origin(parsed.protocol, ANDROID_EMU_HOST, parsed.port);
  }

  return origin(parsed.protocol, parsed.hostname || "localhost", parsed.port);
}

