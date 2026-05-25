import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupNotifications(): Promise<boolean> {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await Notifications.getPermissionsAsync() as any;
  if (existing.granted || existing.status === "granted") return true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await Notifications.requestPermissionsAsync() as any;
  return result.granted || result.status === "granted";
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, string>
) {
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
