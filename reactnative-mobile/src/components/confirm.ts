import { Alert, Platform } from "react-native";

/**
 * Hộp thoại xác nhận cho thao tác phá hủy (xóa, từ chối).
 * Native: Alert với nút "destructive"; web: window.confirm (Alert nhiều nút không chạy trên web).
 */
export function confirmDestructive({
  title,
  message,
  confirmLabel,
  cancelLabel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}): Promise<boolean> {
  if (Platform.OS === "web") {
    const host = globalThis as { confirm?: (text: string) => boolean };
    return Promise.resolve(typeof host.confirm === "function" ? host.confirm(`${title}\n\n${message}`) : false);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
        { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
