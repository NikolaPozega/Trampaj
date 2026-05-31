import { Feather } from "@expo/vector-icons";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const ANDROID_URL = "https://play.google.com/store/apps/details?id=hr.trampaj.app";
const IOS_URL = "https://apps.apple.com/hr/app/trampaj/id0000000000";

interface Props {
  title?: string;
  subtitle?: string;
}

export function WebDownloadScreen({
  title = "Ova funkcija zahtijeva aplikaciju",
  subtitle = "Trampa je mobilna aplikacija.\nPreuzmi je besplatno za iOS ili Android.",
}: Props) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.secondary + "22", borderColor: colors.secondary + "44" }]}>
          <Feather name="smartphone" size={40} color={colors.secondary} />
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>

        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: colors.foreground, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => void Linking.openURL(IOS_URL)}
          >
            <Feather name="download" size={18} color={colors.background} />
            <Text style={[styles.btnText, { color: colors.background }]}>App Store</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: colors.secondary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => void Linking.openURL(ANDROID_URL)}
          >
            <Feather name="smartphone" size={18} color={colors.background} />
            <Text style={[styles.btnText, { color: colors.background }]}>Google Play</Text>
          </Pressable>
        </View>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Oglase možeš pregledavati i ovdje — za objavu i kontakt trebaš app.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 16,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
  },
});
