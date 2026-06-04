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

// ID aktivnog razgovora — zadržano za kompatibilnost, više se ne koristi za suppress logiku
let _activeConversationId: string | null = null;

export function setActiveConversationId(id: string | null) {
  _activeConversationId = id;
}

if (Notifications) {
  // Chat poruke su tihe dok je app otvoren — korisnik već vidi bedževe na ikonama.
  // Sve ostale notifikacije (oglas odobren, ponuda, itd.) prikazuju banner.
  Notifications.setNotificationHandler({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleNotification: async (notification: any) => {
      try {
        const type = notification?.request?.content?.data?.type as string | undefined;
        const isChat = type === "message" || type === "chat";
        return {
          shouldShowAlert: !isChat,
          shouldPlaySound: !isChat,
          shouldSetBadge: false,
          shouldShowBanner: !isChat,
          shouldShowList: !isChat,
        };
      } catch {
        return {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }
    },
  });
}

export async function setupNotifications(): Promise<boolean> {
  if (!Notifications || !Device) return false;

  try {
    if (Platform.OS === "android") {
      const AndroidImportance = Notifications.AndroidImportance;
      await Notifications.setNotificationChannelAsync("poruke", {
        name: "Poruke",
        importance: AndroidImportance?.HIGH ?? 4,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: "#F5C100",
        sound: "default",
        showBadge: true,
      });
    }

    if (!Device.isDevice) return false;

    const existing = await Notifications.getPermissionsAsync();
    if (existing?.granted || existing?.status === "granted") return true;

    const result = await Notifications.requestPermissionsAsync();
    return result?.granted || result?.status === "granted";
  } catch {
    // Notifications not available or permission API threw (e.g. emulator/web)
    return false;
  }
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

export async function getExpoPushToken(): Promise<string | null> {
  if (!Notifications || !Device) return null;
  try {
    if (!Device.isDevice) return null;
    const perm = await Notifications.getPermissionsAsync();
    const granted = perm?.granted || perm?.status === "granted";
    if (!granted) return null;
    // Koristi raw FCM token — server šalje direktno na Firebase Admin SDK
    const tokenData = await Notifications.getDevicePushTokenAsync();
    return tokenData?.data ?? null;
  } catch {
    return null;
  }
}
