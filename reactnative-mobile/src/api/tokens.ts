import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { SESSION_KEY } from "@/bootstrap/load-core";

import type { AuthSession } from "./types";

let memory: AuthSession | null = null;

function isSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== "object") return false;
  const row = value as AuthSession;
  return (
    typeof row.accessToken === "string" &&
    typeof row.refreshToken === "string" &&
    typeof row.tokenType === "string" &&
    typeof row.expiresIn === "number"
  );
}

function parseSession(raw: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function secureEnabled(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export function getMemorySession(): AuthSession | null {
  return memory;
}

export async function loadStoredSession(): Promise<AuthSession | null> {
  if (memory) return memory;

  if (await secureEnabled()) {
    try {
      const fromSecure = parseSession(await SecureStore.getItemAsync(SESSION_KEY));
      if (fromSecure) {
        memory = fromSecure;
        return fromSecure;
      }
    } catch {
      /* fall through to AsyncStorage */
    }
  }

  const fromAsync = parseSession(await AsyncStorage.getItem(SESSION_KEY));
  memory = fromAsync;
  return fromAsync;
}

/** Persist after bootstrap — keeps `SESSION_KEY` readable by `loadCoreApp`. */
export async function persistSession(session: AuthSession): Promise<void> {
  memory = session;
  const raw = JSON.stringify(session);
  await AsyncStorage.setItem(SESSION_KEY, raw);
  if (await secureEnabled()) {
    try {
      await SecureStore.setItemAsync(SESSION_KEY, raw);
    } catch {
      /* AsyncStorage already written */
    }
  }
}

export async function clearSession(): Promise<void> {
  memory = null;
  await AsyncStorage.removeItem(SESSION_KEY);
  if (await secureEnabled()) {
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
}
