import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, Animated,
  Dimensions, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { INTRO_DONE_KEY } from "@/utils/introKey";

const { width: SW } = Dimensions.get("window");

const C = {
  bg: "#08152E",
  primary: "#F5C100",
  secondary: "#38BDF8",
  text: "#F0F4FF",
  muted: "#64748B",
};

const SLIDES = [
  {
    emoji: "🔄",
    title: "Trampa bez novca",
    body: "Ponudi predmete koje više ne trebaš i zamijeni ih za nešto što zaista trebaš.",
    accent: "#F5C100",
  },
  {
    emoji: "🤝",
    title: "Sigurno i jednostavno",
    body: "Chatiraj s korisnicima, dogovori uvjete i koristi escrow sustav za zaštitu trampe.",
    accent: "#38BDF8",
  },
  {
    emoji: "📦",
    title: "Dostava na klik",
    body: "Plati kurirsku dostavu izravno u appu. Naljepnica stiže na e-mail — zapakiraj i predaj!",
    accent: "#22C55E",
  },
];

export default function IntroScreen() {
  const [current, setCurrent] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  const transition = (nextIndex: number) => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setCurrent(nextIndex);
  };

  const goNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (current < SLIDES.length - 1) {
      transition(current + 1);
    } else {
      await finish();
    }
  };

  const finish = async () => {
    await AsyncStorage.setItem(INTRO_DONE_KEY, "1");
    router.replace("/");
  };

  const slide = SLIDES[current]!;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={finish} style={styles.skipBtn}>
          <Text style={styles.skipText}>Preskoči</Text>
        </Pressable>

        <Animated.View style={[styles.content, { opacity }]}>
          <View style={[styles.emojiRing, { borderColor: slide.accent + "44" }]}>
            <Text style={styles.emoji}>{slide.emoji}</Text>
          </View>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>
        </Animated.View>

        <View style={styles.bottom}>
          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <Pressable key={i} onPress={() => { if (i !== current) { Haptics.selectionAsync(); transition(i); } }}>
                <View style={[styles.dot, i === current && { backgroundColor: slide.accent, width: 22 }]} />
              </Pressable>
            ))}
          </View>

          <Pressable onPress={goNext} style={({ pressed }) => [
            styles.btn, { backgroundColor: slide.accent, opacity: pressed ? 0.85 : 1 },
          ]}>
            <Text style={styles.btnText}>
              {current === SLIDES.length - 1 ? "Počnimo 🚀" : "Dalje →"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1, alignItems: "center", paddingHorizontal: 24 },
  skipBtn: { alignSelf: "flex-end", marginTop: 12, padding: 10 },
  skipText: { color: C.muted, fontFamily: "Inter_400Regular", fontSize: 14 },
  content: {
    flex: 1, alignItems: "center", justifyContent: "center",
    gap: 28, paddingHorizontal: 8,
  },
  emojiRing: {
    width: 128, height: 128, borderRadius: 64,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  emoji: { fontSize: 60 },
  title: {
    fontSize: 28, fontFamily: "Inter_700Bold",
    color: C.text, textAlign: "center", lineHeight: 36,
  },
  body: {
    fontSize: 16, fontFamily: "Inter_400Regular",
    color: C.muted, textAlign: "center", lineHeight: 25, maxWidth: SW - 80,
  },
  bottom: { width: "100%", paddingBottom: 36, gap: 22 },
  dots: { flexDirection: "row", gap: 7, justifyContent: "center", alignItems: "center" },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  btn: {
    width: "100%", paddingVertical: 17,
    borderRadius: 14, alignItems: "center",
  },
  btnText: { fontFamily: "Inter_700Bold", fontSize: 17, color: "#08152E" },
});

