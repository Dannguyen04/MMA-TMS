import Constants from "expo-constants";
import { Platform } from "react-native";

import { resolveDevApiBaseUrl } from "./dev-api-host";

type Extra = {
  EXPO_PUBLIC_API_URL?: string;
};

function pickNonEmpty(...candidates: Array<string | undefined>): string | undefined {
  for (const raw of candidates) {
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return undefined;
}

function androidLooksLikeEmulator(): boolean {
  if (Platform.OS !== "android") return false;
  const constants = Platform.constants as {
    Brand?: string;
    Fingerprint?: string;
    Model?: string;
    Product?: string;
  };
  const blob = [constants.Brand, constants.Fingerprint, constants.Model, constants.Product]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    blob.includes("generic") ||
    blob.includes("emulator") ||
    blob.includes("sdk_gphone") ||
    blob.includes("google_sdk") ||
    /\bsdk\b/.test(blob)
  );
}

function bundlerHostCandidates(): Array<string | undefined> {
  const go = Constants.expoGoConfig as
    | { debuggerHost?: string; packagerOpts?: { host?: string } }
    | null
    | undefined;
  const legacy = (Constants as { manifest?: { debuggerHost?: string } }).manifest;
  const manifest2 = Constants.manifest2 as
    | { extra?: { expoGo?: { debuggerHost?: string } } }
    | null
    | undefined;
  return [
    Constants.expoConfig?.hostUri,
    Constants.linkingUri,
    go?.debuggerHost,
    go?.packagerOpts?.host,
    legacy?.debuggerHost,
    manifest2?.extra?.expoGo?.debuggerHost,
  ];
}

function readConfiguredApiUrl(): string | undefined {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  return pickNonEmpty(process.env.EXPO_PUBLIC_API_URL, extra?.EXPO_PUBLIC_API_URL);
}

function readApiUrl(): string {
  const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : false;
  const url = resolveDevApiBaseUrl({
    configuredUrl: readConfiguredApiUrl(),
    isDev,
    platform: Platform.OS,
    isPhysicalDevice: Platform.OS === "android" ? !androidLooksLikeEmulator() : false,
    bundlerHosts: bundlerHostCandidates(),
  });
  if (isDev) {
    console.log("[api] base URL", url, Platform.OS);
  }
  return url;
}

/** Nest origin only — no `/api/v1`. */
export const API_BASE_URL = readApiUrl();
