import { Platform } from "react-native";

// expo-notifications is not available in Expo Go (SDK 53+).
// Use require() so a missing module never crashes the app.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Notifications: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Device: any = null;
try {
  Notifications = require("expo-notifications");
  Device = require("expo-device");
} catch {
  // Running in Expo Go — notifications not supported, silently skip
}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function setupNotifications(): Promise<boolean> {
  if (!Notifications || !Device) return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("poruke", {
      name: "Poruke",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: "#F5C100",
      sound: "default",
      showBadge: true,
    });
  }

  if (!Device.isDevice) return false;

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted || existing.status === "granted") return true;

  const result = await Notifications.requestPermissionsAsync();
  return result.granted || result.status === "granted";
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, string>
) {
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data ?? {},
      sound: "default",
      badge: 1,
    },
    trigger: null,
  });
}

export function addNotificationResponseListener(
  callback: (response: { notification: { request: { content: { data: Record<string, string> } } } }) => void
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): { remove: () => void } | null {
  if (!Notifications) return null;
  return Notifications.addNotificationResponseReceivedListener(callback);
}
