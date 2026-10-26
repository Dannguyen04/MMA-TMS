import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/** Matches the Android `defaultChannel` in app.json. */
export const DOCTOR_NOTIFICATION_CHANNEL_ID = "default";

export type RemoteDeliveryGap = "no-project" | "no-backend" | "token-failed";

export type OsNotificationPhase =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "rationale" }
  | { kind: "denied" }
  | { kind: "failed" }
  | { kind: "granted"; gap: RemoteDeliveryGap };

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const fromExtra = extra?.eas?.projectId;
  if (typeof fromExtra === "string" && fromExtra.length > 0) return fromExtra;
  const fromEas = Constants.easConfig?.projectId;
  return typeof fromEas === "string" && fromEas.length > 0 ? fromEas : null;
}

function permissionGranted(settings: Notifications.NotificationPermissionsStatus): boolean {
  if (Platform.OS === "ios") {
    const ios = settings.ios?.status;
    return (
      ios === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      ios === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      ios === Notifications.IosAuthorizationStatus.EPHEMERAL
    );
  }
  return settings.status === Notifications.PermissionStatus.GRANTED;
}

function permissionDenied(settings: Notifications.NotificationPermissionsStatus): boolean {
  if (Platform.OS === "ios") {
    return settings.ios?.status === Notifications.IosAuthorizationStatus.DENIED;
  }
  return settings.status === Notifications.PermissionStatus.DENIED;
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(DOCTOR_NOTIFICATION_CHANNEL_ID, {
    name: "Thông báo",
    importance: Notifications.AndroidImportance.MAX,
  });
}

async function finishGranted(): Promise<OsNotificationPhase> {
  const id = projectId();
  if (!id) return { kind: "granted", gap: "no-project" };
  try {
    await Notifications.getExpoPushTokenAsync({ projectId: id });
    return { kind: "granted", gap: "no-backend" };
  } catch {
    return { kind: "granted", gap: "token-failed" };
  }
}

export async function readOsNotificationPhase(): Promise<OsNotificationPhase> {
  if (Platform.OS === "web") return { kind: "unsupported" };
  await ensureAndroidChannel();
  const settings = await Notifications.getPermissionsAsync();
  if (permissionGranted(settings)) return finishGranted();
  if (permissionDenied(settings)) return { kind: "denied" };
  return { kind: "rationale" };
}

export async function requestOsNotificationPhase(): Promise<OsNotificationPhase> {
  if (Platform.OS === "web") return { kind: "unsupported" };
  await ensureAndroidChannel();
  const settings = await Notifications.requestPermissionsAsync();
  if (permissionGranted(settings)) return finishGranted();
  return { kind: "denied" };
}
