import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ChatMessage, DeliveryInfo, MessageType } from "@/context/ChatContext";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { useListings } from "@/context/ListingsContext";

const { width: SW } = Dimensions.get("window");

const C = {
  bg: "#06101F",
  header: "rgba(6,16,31,0.97)",
  primary: "#F5C100",
  secondary: "#38BDF8",
  myBg: "rgba(245,193,0,0.12)",
  myBorder: "rgba(245,193,0,0.4)",
  theirBg: "rgba(56,189,248,0.07)",
  theirBorder: "rgba(56,189,248,0.25)",
  inputBg: "rgba(8,21,46,0.95)",
  inputBorder: "rgba(56,189,248,0.32)",
  mutedBg: "#132846",
  muted: "#7B91A8",
  text: "#FFFFFF",
  red: "#EF4444",
};

type HsStatus = "idle" | "pending_me" | "pending_them" | "accepted" | "rejected";

function getHsStatus(messages: ChatMessage[]): HsStatus {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m.type || m.type === "text") continue;
    if (m.type === "handshake_accepted") return "accepted";
    if (m.type === "handshake_rejected") return "rejected";
    if (m.type === "handshake_request") return m.fromMe ? "pending_me" : "pending_them";
  }
  return "idle";
}

// ─── Compact fixed Handshake Bar ─────────────────────────────────────────────
function HandshakeBar({ onPress }: { onPress: () => void }) {
  const offsetL = useRef(new Animated.Value(0)).current;
  const offsetR = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(offsetL, { toValue: 7, duration: 700, useNativeDriver: true }),
          Animated.timing(offsetR, { toValue: -7, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(offsetL, { toValue: 0, duration: 700, useNativeDriver: true }),
          Animated.timing(offsetR, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]),
      ])
    );
    a.start();
    return () => a.stop();
  }, [offsetL, offsetR]);

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [styles.hsBar, { opacity: pressed ? 0.75 : 1 }]}
    >
      <Animated.Text style={[styles.hsBarFist, { transform: [{ translateX: offsetL }] }]}>🫱</Animated.Text>
      <Animated.Text style={[styles.hsBarFist, { transform: [{ translateX: offsetR }] }]}>🫲</Animated.Text>
      <Text style={styles.hsBarLabel}>Zaključi trampu</Text>
    </Pressable>
  );
}

// ─── Reaching hand (from them) ───────────────────────────────────────────────
function ReachingHand({
  otherName,
  onAccept,
  onReject,
}: {
  otherName: string;
  onAccept: () => void;
  onReject: () => void;
}) {
  const reach = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(reach, { toValue: 16, duration: 700, useNativeDriver: true }),
        Animated.timing(reach, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [reach]);

  return (
    <View style={styles.reachBox}>
      <View style={styles.reachFists}>
        <Text style={styles.hsFist}>🫱</Text>
        <Animated.Text style={[styles.hsFist, { transform: [{ translateX: reach }] }]}>
          🫲
        </Animated.Text>
      </View>
      <Text style={styles.reachName}>{otherName} želi zaključiti trampu</Text>
      <View style={styles.reachBtns}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onReject();
          }}
          style={styles.rejectBtn}
        >
          <Feather name="x" size={16} color={C.red} />
          <Text style={styles.rejectText}>Odbij</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onAccept();
          }}
          style={styles.acceptBtn}
        >
          <Text style={styles.acceptText}>Prihvati  🤝</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Mini badge (pending_me, top-right) ──────────────────────────────────────
function MiniBadge() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [scale]);
  return (
    <Animated.View style={[styles.miniBadge, { transform: [{ scale }] }]}>
      <Text style={{ fontSize: 18 }}>🫱</Text>
    </Animated.View>
  );
}

// ─── Disclaimer modal ────────────────────────────────────────────────────────
function DisclaimerModal({ onAccept, onSkip }: { onAccept: () => void; onSkip: () => void }) {
  return (
    <View style={styles.overlay}>
      <View style={[styles.dealCard, { padding: 24, gap: 0, maxHeight: "82%" }]}>
        <Text style={styles.modalLabel}>UVJETI TRAMPE</Text>
        <Text style={styles.modalTitle}>Odricanje odgovornosti</Text>
        <ScrollView style={{ maxHeight: 280, marginTop: 8 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.disclaimerBody}>
            <Text style={styles.disclaimerBold}>Trampaj.hr</Text>
            {" posreduje isključivo u oglašavanju i međusobnom povezivanju korisnika koji žele izvršiti razmjenu (trampu) predmeta.\n\n"}
            <Text style={styles.disclaimerBold}>Trampaj.hr nije stranka ovog dogovora</Text>
            {" i ne preuzima nikakvu odgovornost za:\n\n"}
            {"• Stanje, ispravnost ili točnost opisa predmeta\n"}
            {"• Gubitak ili oštećenje predmeta u dostavi\n"}
            {"• Postupke, propuste ili prijevarno ponašanje ikoje stranke\n"}
            {"• Sporove nastale između korisnika platforme\n\n"}
            {"Trampu obavljate "}
            <Text style={styles.disclaimerBold}>na vlastitu odgovornost</Text>
            {". Savjetujemo snimanje predmeta pri pakiranju i čuvanje potvrda o slanju."}
          </Text>
        </ScrollView>
        <Pressable
          onPress={onAccept}
          style={({ pressed }) => [styles.dealBtn, { marginTop: 20, width: "100%", opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.dealBtnText}>Razumijem i prihvaćam ✓</Text>
        </Pressable>
        <Pressable
          onPress={onSkip}
          style={({ pressed }) => [{ marginTop: 10, padding: 8, opacity: pressed ? 0.7 : 1, alignSelf: "center" }]}
        >
          <Text style={{ fontSize: 12, color: C.muted, fontFamily: "Inter_400Regular" }}>Zatvori</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Delivery modal ───────────────────────────────────────────────────────────
function DeliveryModal({
  otherName,
  isLargeItem,
  onDone,
  onSkip,
}: {
  otherName: string;
  isLargeItem?: boolean;
  onDone: (info: DeliveryInfo) => void;
  onSkip: () => void;
}) {
  const [method, setMethod] = useState<DeliveryInfo["method"] | null>(null);

  // Veliki predmeti → automatski osobno preuzimanje
  if (isLargeItem) {
    return (
      <View style={styles.overlay}>
        <View style={[styles.dealCard, { padding: 28, gap: 0 }]}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🤝</Text>
          <Text style={styles.modalLabel}>DOSTAVA</Text>
          <Text style={styles.modalTitle}>Osobno preuzimanje</Text>
          <Text style={[styles.disclaimerBody, { marginTop: 10 }]}>
            {"Predmet je velik pa se dogovarate direktno o terminu i načinu preuzimanja.\n\nDogovorite se u chatu gdje i kada."}
          </Text>
          <Pressable
            onPress={() => onDone({ method: "personal", escrowActive: false })}
            style={({ pressed }) => [styles.dealBtn, { marginTop: 20, width: "100%", opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.dealBtnText}>Razumijemo →</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.dealCard, { padding: 24, gap: 0, width: SW - 40 }]}>
        <Text style={styles.modalLabel}>ORGANIZACIJA DOSTAVE</Text>
        <Text style={styles.modalTitle}>Kako šaljete pakete?</Text>

        <Text style={[styles.deliverySection, { marginTop: 14 }]}>Odaberite način dostave:</Text>

        <Pressable
          onPress={() => setMethod("courier")}
          style={[styles.deliveryOption, method === "courier" && styles.deliveryOptionSelected]}
        >
          <Text style={[styles.deliveryOptionLabel, method === "courier" && { color: C.primary }]}>
            🚐 Kurirska dostava
          </Text>
          <Text style={styles.deliveryOptionSub}>Box Now ili GLS kućna dostava</Text>
        </Pressable>

        <Pressable
          onPress={() => setMethod("personal")}
          style={[styles.deliveryOption, method === "personal" && styles.deliveryOptionSelected]}
        >
          <Text style={[styles.deliveryOptionLabel, method === "personal" && { color: C.primary }]}>
            🤝 Osobno preuzimanje
          </Text>
          <Text style={styles.deliveryOptionSub}>Dogovorite se u chatu gdje i kada</Text>
        </Pressable>

        {method === "courier" && (
          <View style={styles.deliveryInfoBox}>
            <Text style={styles.deliveryInfoText}>
              💡 <Text style={{ color: C.text }}>Svaki korisnik plaća svoju dostavu</Text>
              {" — vi platite kuru za paket koji dobivate, "}
              {otherName}
              {" plati kuru za paket koji dobiva. Nema dijeljenja troškova."}
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => method ? onDone({ method, escrowActive: false }) : null}
          style={({ pressed }) => [
            styles.dealBtn,
            { marginTop: 20, width: "100%", opacity: method ? (pressed ? 0.85 : 1) : 0.4 },
          ]}
        >
          <Text style={styles.dealBtnText}>Potvrdi →</Text>
        </Pressable>
        <Pressable
          onPress={onSkip}
          style={({ pressed }) => [{ marginTop: 10, padding: 8, opacity: pressed ? 0.7 : 1, alignSelf: "center" }]}
        >
          <Text style={{ fontSize: 12, color: C.muted, fontFamily: "Inter_400Regular" }}>Preskoči</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Escrow / delivery-payment modal ─────────────────────────────────────────
const API_BASE = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
  : "http://localhost:8080/api";

type ShippingInfo = { label: string; amountEur: string; emoji: string };

const SHIPPING: Record<string, ShippingInfo> = {
  small: { label: "Box Now paketomat", amountEur: "3,99 €", emoji: "📦" },
  medium: { label: "GLS kućna dostava", amountEur: "5,99 €", emoji: "🚚" },
};

function EscrowModal({
  onDone,
  onSkip,
  deliveryMethod,
  packageSize,
  conversationId,
  listingId,
}: {
  onDone: () => void;
  onSkip: () => void;
  deliveryMethod?: "courier" | "personal";
  packageSize?: string | null;
  conversationId: string;
  listingId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const isCourier = deliveryMethod === "courier";
  const shipping = packageSize ? SHIPPING[packageSize] : null;

  const handlePay = async () => {
    if (!shipping) return;
    setLoading(true);
    setErrMsg(null);
    try {
      const successUrl = Linking.createURL("payment/success");
      const cancelUrl = Linking.createURL("payment/cancel");

      const resp = await fetch(`${API_BASE}/payments/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          listingId,
          packageSize: packageSize ?? "small",
          successUrl,
          cancelUrl,
        }),
      });
      const data = await resp.json() as { url?: string; error?: string; code?: string };

      if (!resp.ok || !data.url) {
        if (data.code === "stripe_not_connected") {
          setErrMsg("Plaćanje karticom uskoro dostupno! Platforma je u fazi testiranja.");
        } else {
          setErrMsg(data.error ?? "Greška pri otvaranju plaćanja.");
        }
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, Linking.createURL("payment"));
      if (result.type === "success" && result.url?.includes("payment/success")) {
        setPaid(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (result.type === "cancel" || (result.type === "success" && result.url?.includes("payment/cancel"))) {
        setErrMsg("Plaćanje otkazano.");
      }
    } catch (e) {
      setErrMsg("Greška. Pokušaj ponovo ili kontaktiraj podršku.");
    } finally {
      setLoading(false);
    }
  };

  if (paid) {
    return (
      <View style={styles.overlay}>
        <View style={[styles.dealCard, { padding: 28, gap: 0, maxWidth: SW - 40 }]}>
          <Text style={{ fontSize: 48, marginBottom: 8 }}>✅</Text>
          <Text style={styles.modalLabel}>PLAĆANJE USPJEŠNO</Text>
          <Text style={styles.modalTitle}>Dostava plaćena!</Text>
          <Text style={[styles.disclaimerBody, { marginTop: 10 }]}>
            {"Nalepnica za dostavu će ti biti poslana na e-mail.\n\nUpakuj predmet i odnesi ga na Box Now paketomat ili predaj GLS kuriru."}
          </Text>
          <Pressable
            onPress={onDone}
            style={({ pressed }) => [
              styles.dealBtn,
              { marginTop: 20, width: "100%", backgroundColor: "#22C55E", opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.dealBtnText, { color: "#fff" }]}>Super, nastavi! 🎉</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!isCourier) {
    return (
      <View style={styles.overlay}>
        <View style={[styles.dealCard, { padding: 28, gap: 0, maxWidth: SW - 40 }]}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🤝</Text>
          <Text style={styles.modalLabel}>OSOBNO PREUZIMANJE</Text>
          <Text style={styles.modalTitle}>Dogovorite se direktno</Text>
          <Text style={[styles.disclaimerBody, { marginTop: 12 }]}>
            {"Dogovorite se u chatu o terminu i mjestu preuzimanja.\n\n"}
            {"Za sigurniju trampu, u budućnosti planiramo i opciju sigurnosnog depozita."}
          </Text>
          <Pressable
            onPress={onDone}
            style={({ pressed }) => [styles.dealBtn, { marginTop: 20, width: "100%", opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.dealBtnText}>Razumijem →</Text>
          </Pressable>
          <Pressable
            onPress={onSkip}
            style={({ pressed }) => [{ marginTop: 10, padding: 8, opacity: pressed ? 0.7 : 1, alignSelf: "center" }]}
          >
            <Text style={{ fontSize: 12, color: C.muted, fontFamily: "Inter_400Regular" }}>Zatvori</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.dealCard, { padding: 28, gap: 0, maxWidth: SW - 40 }]}>
        <Text style={{ fontSize: 36, marginBottom: 8 }}>{shipping?.emoji ?? "📦"}</Text>
        <Text style={styles.modalLabel}>PLAĆANJE DOSTAVE</Text>
        <Text style={styles.modalTitle}>{shipping?.label ?? "Dostava"}</Text>

        <View style={{ marginTop: 16, backgroundColor: "rgba(56,189,248,0.07)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(56,189,248,0.18)", width: "100%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 13 }}>Dostava</Text>
            <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{shipping?.amountEur ?? "—"}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 13 }}>Platformska naknada</Text>
            <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 13 }}>uključena</Text>
          </View>
          <View style={{ height: 1, backgroundColor: "rgba(56,189,248,0.15)", marginVertical: 6 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: C.text, fontFamily: "Inter_700Bold", fontSize: 15 }}>Ukupno</Text>
            <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 15 }}>{shipping?.amountEur ?? "—"}</Text>
          </View>
        </View>

        <Text style={[styles.disclaimerBody, { marginTop: 12, fontSize: 12 }]}>
          {"Plaćanje je sigurno putem Stripe platforme. Nalepinica za dostavu stiže na tvoj e-mail. 🔒"}
        </Text>

        {errMsg && (
          <View style={{ marginTop: 10, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", width: "100%" }}>
            <Text style={{ color: "#EF4444", fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center" }}>{errMsg}</Text>
          </View>
        )}

        <Pressable
          onPress={handlePay}
          disabled={loading}
          style={({ pressed }) => [
            styles.dealBtn,
            { marginTop: 16, width: "100%", backgroundColor: loading ? C.mutedBg : C.secondary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          {loading
            ? <Text style={[styles.dealBtnText, { color: C.muted }]}>Učitavanje…</Text>
            : <Text style={[styles.dealBtnText, { color: "#08152E" }]}>Plati {shipping?.amountEur ?? ""} karticom →</Text>
          }
        </Pressable>
        <Pressable
          onPress={onSkip}
          style={({ pressed }) => [{ marginTop: 10, padding: 8, opacity: pressed ? 0.7 : 1, alignSelf: "center" }]}
        >
          <Text style={{ fontSize: 12, color: C.muted, fontFamily: "Inter_400Regular" }}>Plati kasni­je / preskoči</Text>
        </Pressable>
      </View>
    </View>
  );
}

const QUICK_AMOUNTS = [5, 10, 20, 50];

function fmtEur(cents: number) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

// ─── Deposit modal (dogovorni escrow hold) ────────────────────────────────────
function DepositModal({
  onDone,
  onSkip,
  conversationId,
  token,
}: {
  onDone: () => void;
  onSkip: () => void;
  conversationId: string;
  token: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [amountText, setAmountText] = useState("");

  const amountEur = parseFloat(amountText.replace(",", ".")) || 0;
  const amountCents = Math.round(amountEur * 100);
  const isValid = amountCents >= 100 && amountCents <= 50000;

  const handleDeposit = async () => {
    if (!isValid) {
      setErrMsg("Unesi iznos između 1€ i 500€.");
      return;
    }
    setLoading(true);
    setErrMsg(null);
    try {
      const successUrl = Linking.createURL("escrow/success");
      const cancelUrl = Linking.createURL("escrow/cancel");

      const resp = await fetch(`${API_BASE}/escrow/checkout/${conversationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ successUrl, cancelUrl, amount: amountEur }),
      });
      const data = await resp.json() as {
        url?: string;
        alreadyPaid?: boolean;
        status?: string;
        amount?: number;
        error?: string;
        code?: string;
      };

      if (data.alreadyPaid) {
        setPaidAmount(data.amount ?? amountCents);
        setPaid(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      if (!resp.ok || !data.url) {
        if (data.code === "stripe_not_connected") {
          setErrMsg("Sigurnosni depozit uskoro dostupan! Platforma je u fazi testiranja.");
        } else {
          setErrMsg(data.error ?? "Greška pri otvaranju plaćanja.");
        }
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, Linking.createURL("escrow"));

      if (result.type === "success" && result.url?.includes("escrow/success")) {
        const sessionId = data.url.match(/cs_[a-zA-Z0-9_]+/)?.[0];
        if (sessionId) {
          await fetch(`${API_BASE}/escrow/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ checkoutSessionId: sessionId, conversationId }),
          });
        }
        setPaidAmount(amountCents);
        setPaid(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (result.type === "cancel" || (result.type === "success" && result.url?.includes("escrow/cancel"))) {
        setErrMsg("Plaćanje otkazano.");
      }
    } catch {
      setErrMsg("Greška. Pokušaj ponovo.");
    } finally {
      setLoading(false);
    }
  };

  if (paid) {
    return (
      <View style={styles.overlay}>
        <View style={[styles.dealCard, { padding: 28, gap: 0, maxWidth: SW - 40 }]}>
          <Text style={{ fontSize: 48, marginBottom: 8 }}>🔐</Text>
          <Text style={styles.modalLabel}>DEPOZIT AKTIVAN</Text>
          <Text style={styles.modalTitle}>{fmtEur(paidAmount)} zadržano</Text>
          <Text style={[styles.disclaimerBody, { marginTop: 10, textAlign: "center" }]}>
            {"Novac je sigurno zadržan na tvojoj kartici — nismo ga naplatili.\n\n"}
            {"Kada obje strane potvrde primitak paketa, iznos se automatski oslobađa.\n\n"}
            <Text style={styles.disclaimerBold}>Pritisni "Potvrdi primitak"</Text>
            {" u chatu čim dobiješ paket."}
          </Text>
          <Pressable
            onPress={onDone}
            style={({ pressed }) => [
              styles.dealBtn,
              { marginTop: 20, width: "100%", backgroundColor: "#22C55E", opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.dealBtnText, { color: "#fff" }]}>Savršeno! 🎉</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.dealCard, { padding: 24, gap: 0, maxWidth: SW - 40 }]}>
        <Text style={{ fontSize: 36, marginBottom: 6 }}>🔒</Text>
        <Text style={styles.modalLabel}>ZAŠTITA TRAMPE</Text>
        <Text style={styles.modalTitle}>Sigurnosni depozit</Text>

        <View style={{ marginTop: 14, width: "100%", gap: 10 }}>
          {[
            { icon: "💳", text: "Drži se na kartici — NE naplaćuje se" },
            { icon: "✅", text: "Kad obje strane potvrde primitak — automatski se vraća" },
            { icon: "⚠️", text: "Ako pošiljatelj ne pošalje — iznos se dodjeljuje tebi" },
          ].map((row, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <Text style={{ fontSize: 18, lineHeight: 22 }}>{row.icon}</Text>
              <Text style={{ color: C.text, fontFamily: "Inter_400Regular", fontSize: 13, flex: 1, lineHeight: 20 }}>{row.text}</Text>
            </View>
          ))}
        </View>

        {/* Iznos — brzi odabir */}
        <View style={{ marginTop: 16, width: "100%" }}>
          <Text style={{ color: C.muted, fontFamily: "Inter_600SemiBold", fontSize: 12, marginBottom: 8 }}>IZNOS DEPOZITA</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            {QUICK_AMOUNTS.map((q) => {
              const selected = amountText === String(q);
              return (
                <Pressable
                  key={q}
                  onPress={() => setAmountText(String(q))}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: selected ? C.primary : C.mutedBg,
                    borderRadius: 8,
                    paddingVertical: 8,
                    alignItems: "center",
                    opacity: pressed ? 0.8 : 1,
                    borderWidth: 1,
                    borderColor: selected ? C.primary : "transparent",
                  })}
                >
                  <Text style={{ color: selected ? "#08152E" : C.text, fontFamily: "Inter_700Bold", fontSize: 13 }}>{q} €</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={amountText}
            onChangeText={(t) => {
              setAmountText(t.replace(/[^0-9,.]/, ""));
              setErrMsg(null);
            }}
            placeholder="Ili unesi iznos (npr. 15)"
            placeholderTextColor={C.muted}
            keyboardType="decimal-pad"
            style={{
              backgroundColor: C.mutedBg,
              borderRadius: 8,
              padding: 12,
              color: C.text,
              fontFamily: "Inter_400Regular",
              fontSize: 15,
              borderWidth: 1,
              borderColor: amountText && !isValid ? "#EF4444" : "transparent",
            }}
          />
          {amountText !== "" && !isValid && (
            <Text style={{ color: "#EF4444", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 }}>Iznos mora biti između 1€ i 500€</Text>
          )}
        </View>

        {errMsg && (
          <View style={{ marginTop: 10, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", width: "100%" }}>
            <Text style={{ color: "#EF4444", fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center" }}>{errMsg}</Text>
          </View>
        )}

        <Pressable
          onPress={handleDeposit}
          disabled={loading || !isValid}
          style={({ pressed }) => [
            styles.dealBtn,
            { marginTop: 14, width: "100%", backgroundColor: (loading || !isValid) ? C.mutedBg : C.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          {loading
            ? <Text style={[styles.dealBtnText, { color: C.muted }]}>Učitavanje…</Text>
            : <Text style={[styles.dealBtnText, { color: isValid ? "#08152E" : C.muted }]}>
                {isValid ? `Zaštiti trampu — ${amountEur.toFixed(2).replace(".", ",")} € 🔒` : "Odaberi iznos"}
              </Text>
          }
        </Pressable>
        <Pressable
          onPress={onSkip}
          style={({ pressed }) => [{ marginTop: 10, padding: 8, opacity: pressed ? 0.7 : 1, alignSelf: "center" }]}
        >
          <Text style={{ fontSize: 12, color: C.muted, fontFamily: "Inter_400Regular" }}>Preskoči zaštitu</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Escrow banner (persistent u chatu kad su oba depozita aktivna) ───────────
function EscrowBanner({
  conversationId,
  token,
  escrowStatus,
  onRefresh,
}: {
  conversationId: string;
  token: string | null;
  escrowStatus: import("@/context/ChatContext").EscrowStatus;
  onRefresh: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { confirmReceipt } = useChat();

  const myDone = ["confirmed", "released", "captured"].includes(escrowStatus.myStatus);
  const theirDone = ["confirmed", "released", "captured"].includes(escrowStatus.theirStatus);
  const bothDone = escrowStatus.bothConfirmed || escrowStatus.released;

  const handleConfirm = async () => {
    if (myDone) return;
    setConfirming(true);
    try {
      const result = await confirmReceipt(conversationId);
      if (result.released) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onRefresh();
    } finally {
      setConfirming(false);
    }
  };

  if (bothDone) {
    return (
      <View style={{ marginHorizontal: 12, marginBottom: 8, backgroundColor: "rgba(34,197,94,0.12)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(34,197,94,0.3)", flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 20 }}>🎉</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#22C55E", fontFamily: "Inter_700Bold", fontSize: 13 }}>Trampa završena!</Text>
          <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>Obje strane potvrdile primitak. Depoziti su oslobođeni.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginHorizontal: 12, marginBottom: 8, backgroundColor: "rgba(245,193,0,0.08)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(245,193,0,0.25)" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Text style={{ fontSize: 16 }}>🔒</Text>
        <Text style={{ color: C.primary, fontFamily: "Inter_700Bold", fontSize: 13 }}>
          Depozit aktivan{escrowStatus.myAmount > 0 ? ` — ${fmtEur(escrowStatus.myAmount)} zadržano` : ""}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <View style={{ flex: 1, backgroundColor: myDone ? "rgba(34,197,94,0.12)" : "rgba(56,189,248,0.07)", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: myDone ? "rgba(34,197,94,0.3)" : "rgba(56,189,248,0.2)", alignItems: "center" }}>
          <Text style={{ fontSize: 14 }}>{myDone ? "✅" : "⏳"}</Text>
          <Text style={{ color: myDone ? "#22C55E" : C.muted, fontFamily: "Inter_600SemiBold", fontSize: 11, marginTop: 2 }}>Ti</Text>
          <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 1 }}>{myDone ? "Potvrđeno" : "Čeka"}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: theirDone ? "rgba(34,197,94,0.12)" : "rgba(56,189,248,0.07)", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: theirDone ? "rgba(34,197,94,0.3)" : "rgba(56,189,248,0.2)", alignItems: "center" }}>
          <Text style={{ fontSize: 14 }}>{theirDone ? "✅" : "⏳"}</Text>
          <Text style={{ color: theirDone ? "#22C55E" : C.muted, fontFamily: "Inter_600SemiBold", fontSize: 11, marginTop: 2 }}>Druga strana</Text>
          <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 1 }}>{theirDone ? "Potvrđeno" : "Čeka"}</Text>
        </View>
      </View>

      {!myDone && (
        <Pressable
          onPress={handleConfirm}
          disabled={confirming}
          style={({ pressed }) => ({
            backgroundColor: confirming ? C.mutedBg : "#22C55E",
            borderRadius: 8,
            padding: 10,
            alignItems: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 }}>
            {confirming ? "Potvrđujem…" : "✓ Primio/la sam paket"}
          </Text>
        </Pressable>
      )}
      {myDone && !theirDone && (
        <Text style={{ color: C.muted, fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center" }}>
          Čekamo potvrdu druge strane…
        </Text>
      )}
    </View>
  );
}

// ─── Deal overlay (confetti + card) ─────────────────────────────────────────
function DealOverlay({ onDismiss }: { onDismiss: () => void }) {
  const cardScale = useRef(new Animated.Value(0)).current;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const confettiRef = useRef<any>(null);

  useEffect(() => {
    Animated.spring(cardScale, {
      toValue: 1,
      tension: 70,
      friction: 6,
      useNativeDriver: true,
    }).start();
    setTimeout(() => confettiRef.current?.start(), 250);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [cardScale]);

  return (
    <View style={styles.overlay}>
      <ConfettiCannon
        ref={confettiRef}
        count={200}
        origin={{ x: SW / 2, y: -20 }}
        colors={["#F5C100", "#38BDF8", "#ffffff", "#FFD700", "#87CEEB", "#FFA500"]}
        fadeOut
        autoStart={false}
        fallSpeed={3200}
        explosionSpeed={380}
      />
      <Animated.View style={[styles.dealCard, { transform: [{ scale: cardScale }] }]}>
        <Text style={styles.dealEmoji}>🤝</Text>
        <Text style={styles.dealTitle}>Trampa zaključena!</Text>
        <Text style={styles.dealSub}>Sretna zamjena! 🥂</Text>
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [styles.dealBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.dealBtnText}>Super!</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { listingId, listingTitle, otherUser } = useLocalSearchParams<{
    listingId: string;
    listingTitle: string;
    otherUser: string;
  }>();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { listings } = useListings();
  const { conversations, getOrCreateConversation, sendMessage, sendSpecialMessage, markAsRead, markDealShown, acceptDisclaimer, saveDeliveryInfo, deleteConversation, loadEscrowStatus, confirmReceipt } =
    useChat();

  // Auth guard — redirect to login if not logged in
  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
  }, [user]);

  const listing = listings.find((l) => l.id === listingId);
  const isLargeItem = listing?.packageSize === "large";

  const [text, setText] = useState("");
  const [showDeal, setShowDeal] = useState(false);
  const [postDealStep, setPostDealStep] = useState<null | "disclaimer" | "delivery" | "escrow" | "deposit">(null);
  const flatListRef = useRef<FlatList>(null);
  const prevHsRef = useRef<HsStatus | null>(null);

  // Create conversation in effect (not during render) to avoid ChatProvider update-during-render warning
  useEffect(() => {
    if (listingId && !conversations.find((c) => c.listingId === listingId)) {
      getOrCreateConversation(listingId, listingTitle ?? "", otherUser ?? "");
    }
  }, [listingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveConv = conversations.find((c) => c.listingId === listingId);
  const hsStatus = liveConv ? getHsStatus(liveConv.messages) : "idle";

  // Mark as read
  useEffect(() => {
    if (liveConv?.id) markAsRead(liveConv.id);
  }, [liveConv?.id, markAsRead]);

  // Scroll to end
  useEffect(() => {
    if (!liveConv) return;
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [liveConv?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show deal overlay only on live transition (not on re-entry if already shown)
  useEffect(() => {
    if (!liveConv) return;
    if (prevHsRef.current === null) {
      prevHsRef.current = hsStatus;
      return;
    }
    if (hsStatus === "accepted" && prevHsRef.current !== "accepted" && !liveConv.dealShown) {
      setShowDeal(true);
    }
    prevHsRef.current = hsStatus;
  }, [hsStatus, liveConv?.dealShown]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load escrow status when deal is accepted and conversation is loaded
  useEffect(() => {
    if (liveConv?.id && hsStatus === "accepted") {
      loadEscrowStatus(liveConv.id);
    }
  }, [liveConv?.id, hsStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const convId = liveConv?.id ?? "";

  const handleSend = useCallback(() => {
    if (!text.trim() || !convId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(convId, text.trim());
    setText("");
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  }, [text, convId, sendMessage]);

  const handleHandshake = useCallback(() => {
    if (!convId) return;
    sendSpecialMessage(convId, "handshake_request");
  }, [convId, sendSpecialMessage]);

  const handleAccept = useCallback(() => {
    if (!convId) return;
    sendSpecialMessage(convId, "handshake_accepted");
  }, [convId, sendSpecialMessage]);

  const handleReject = useCallback(() => {
    if (!convId) return;
    sendSpecialMessage(convId, "handshake_rejected");
  }, [convId, sendSpecialMessage]);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 12 : 6);

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      if (!liveConv) return null;
      const prev = liveConv.messages[index - 1];
      const showAvatar = !item.fromMe && (!prev || prev.fromMe || prev.type !== "text");

      // Handshake request from them → reaching hand + accept/reject
      if (item.type === "handshake_request" && !item.fromMe) {
        return (
          <ReachingHand
            otherName={liveConv.otherUserName}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        );
      }

      // Handshake request from me → waiting bubble
      if (item.type === "handshake_request" && item.fromMe) {
        return (
          <View style={styles.pendingRow}>
            <Text style={styles.pendingText}>
              🫱 Čekaš potvrdu od {liveConv.otherUserName}…
            </Text>
          </View>
        );
      }

      // Deal accepted
      if (item.type === "handshake_accepted") {
        return (
          <View style={styles.dealDoneRow}>
            <View style={styles.dealDoneLine} />
            <Text style={styles.dealDoneEmoji}>🤝</Text>
            <Text style={styles.dealDoneText}>Trampa zaključena!</Text>
            <View style={styles.dealDoneLine} />
          </View>
        );
      }

      // Deal rejected
      if (item.type === "handshake_rejected") {
        return (
          <View style={styles.rejectedRow}>
            <Text style={styles.rejectedEmoji}>✊</Text>
            <Text style={styles.rejectedText}>Trampa nije zaključena</Text>
          </View>
        );
      }

      // Regular text bubble
      return (
        <View style={[styles.msgRow, item.fromMe && styles.msgRowMe]}>
          {!item.fromMe && (
            <View style={[styles.msgAvatar, { opacity: showAvatar ? 1 : 0 }]}>
              <Text style={styles.msgAvatarText}>
                {liveConv.otherUserName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={[styles.bubble, item.fromMe ? styles.bubbleMe : styles.bubbleThem]}>
            <Text style={[styles.bubbleText, { color: item.fromMe ? C.primary : C.text }]}>
              {item.text}
            </Text>
            <Text style={styles.bubbleTime}>
              {new Date(item.createdAt).toLocaleTimeString("hr", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>
      );
    },
    [liveConv, handleAccept, handleReject]
  );

  if (!liveConv) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: C.muted, fontSize: 13 }}>Učitavanje...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="arrow-left" size={18} color={C.text} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.headerCenter, { opacity: pressed ? 0.75 : 1 }]}
            onPress={() =>
              router.push(`/user/${encodeURIComponent(liveConv.otherUserName)}`)
            }
          >
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {(liveConv.otherUserName || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerName} numberOfLines={1}>
                {liveConv.otherUserName}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {liveConv.listingTitle}
              </Text>
            </View>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {hsStatus === "pending_me" && <MiniBadge />}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert(
                "Obriši razgovor",
                "Obrisati ovaj razgovor? Ova radnja je trajna.",
                [
                  { text: "Odustani", style: "cancel" },
                  {
                    text: "Obriši",
                    style: "destructive",
                    onPress: () => {
                      deleteConversation(liveConv.id);
                      router.back();
                    },
                  },
                ]
              );
            }}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="trash-2" size={16} color={C.red} />
          </Pressable>
        </View>
        </View>

        {/* ── Fixed Handshake Bar (below header, above messages) ── */}
        {(hsStatus === "idle" || hsStatus === "rejected") && (
          <HandshakeBar onPress={handleHandshake} />
        )}

        {/* ── Messages ── */}
        <FlatList
          ref={flatListRef}
          data={liveConv.messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={renderMessage}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>Nema poruka — započni razgovor</Text>
            </View>
          }
        />

        {/* ── Escrow Banner (visible when deposit is held) ── */}
        {hsStatus === "accepted" && liveConv.escrowStatus?.bothHeld && (
          <EscrowBanner
            conversationId={liveConv.id}
            token={token}
            escrowStatus={liveConv.escrowStatus}
            onRefresh={() => loadEscrowStatus(liveConv.id)}
          />
        )}

        {/* ── Input Bar ── */}
        <View style={[styles.inputBar, { paddingBottom: bottomPad }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Napiši poruku..."
            placeholderTextColor={C.muted}
            style={styles.input}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={handleSend}
            disabled={!text.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: text.trim() ? C.primary : C.mutedBg,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather name="send" size={17} color={text.trim() ? "#08152E" : C.muted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ── Deal Overlay ── */}
      {showDeal && (
        <DealOverlay
          onDismiss={() => {
            setShowDeal(false);
            if (!liveConv.disclaimerAccepted) {
              setPostDealStep("disclaimer");
            } else if (!liveConv.deliveryInfo) {
              setPostDealStep("delivery");
            } else {
              markDealShown(liveConv.id);
            }
          }}
        />
      )}

      {/* ── Disclaimer Modal ── */}
      {postDealStep === "disclaimer" && (
        <DisclaimerModal
          onAccept={() => {
            acceptDisclaimer(convId);
            setPostDealStep("delivery");
          }}
          onSkip={() => {
            setPostDealStep(null);
            markDealShown(liveConv.id);
          }}
        />
      )}

      {/* ── Delivery Modal ── */}
      {postDealStep === "delivery" && (
        <DeliveryModal
          otherName={liveConv.otherUserName}
          isLargeItem={isLargeItem}
          onDone={(info) => {
            saveDeliveryInfo(convId, info);
            setPostDealStep("escrow");
          }}
          onSkip={() => {
            setPostDealStep("escrow");
          }}
        />
      )}

      {/* ── Escrow / Delivery Payment Modal ── */}
      {postDealStep === "escrow" && (
        <EscrowModal
          onDone={() => setPostDealStep("deposit")}
          onSkip={() => setPostDealStep("deposit")}
          deliveryMethod={liveConv.deliveryInfo?.method}
          packageSize={listing?.packageSize ?? null}
          conversationId={liveConv.id}
          listingId={listingId ?? ""}
        />
      )}

      {/* ── Deposit Modal (5€ escrow hold) ── */}
      {postDealStep === "deposit" && (
        <DepositModal
          onDone={() => {
            setPostDealStep(null);
            markDealShown(liveConv.id);
            loadEscrowStatus(liveConv.id);
          }}
          onSkip={() => {
            setPostDealStep(null);
            markDealShown(liveConv.id);
          }}
          conversationId={liveConv.id}
          token={token}
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: C.header,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(56,189,248,0.2)",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(56,189,248,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingHorizontal: 8,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(245,193,0,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(245,193,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.primary },
  headerName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.muted },

  miniBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(245,193,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(245,193,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Messages list
  msgList: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 8, gap: 4 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 4 },
  msgRowMe: { flexDirection: "row-reverse" },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    flexShrink: 0,
    backgroundColor: "rgba(56,189,248,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  msgAvatarText: { fontSize: 11, fontFamily: "Inter_700Bold", color: C.secondary },

  bubble: {
    maxWidth: "75%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 2,
    borderWidth: 1,
  },
  bubbleMe: {
    backgroundColor: C.myBg,
    borderColor: C.myBorder,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: C.theirBg,
    borderColor: C.theirBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  bubbleTime: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    alignSelf: "flex-end",
  },

  // Empty state
  emptyChat: { flex: 1, alignItems: "center", paddingTop: 40 },
  emptyChatText: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.muted },

  // Handshake Bar (compact, fixed between header and messages)
  hsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(245,193,0,0.06)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245,193,0,0.18)",
  },
  hsBarFist: { fontSize: 20 },
  hsFist: { fontSize: 30 },
  hsBarLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
    opacity: 0.9,
  },

  // Reaching hand (from them)
  reachBox: {
    alignSelf: "center",
    alignItems: "center",
    backgroundColor: "rgba(56,189,248,0.06)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.28)",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginVertical: 8,
    marginHorizontal: 20,
    gap: 8,
  },
  reachFists: { flexDirection: "row", gap: 4 },
  reachName: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.muted },
  reachBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  rejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
  },
  rejectText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.red },
  acceptBtn: {
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "rgba(245,193,0,0.14)",
    borderWidth: 1,
    borderColor: "rgba(245,193,0,0.45)",
  },
  acceptText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.primary },

  // Pending row (me waiting)
  pendingRow: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  pendingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.muted,
    fontStyle: "italic",
  },

  // Deal done in messages
  dealDoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  dealDoneLine: { flex: 1, height: 1, backgroundColor: "rgba(245,193,0,0.25)" },
  dealDoneEmoji: { fontSize: 32 },
  dealDoneText: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.primary },
  rejectedRow: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 10,
    opacity: 0.55,
  },
  rejectedEmoji: { fontSize: 22 },
  rejectedText: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.muted },

  // Deal overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,16,31,0.88)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99,
  },
  dealCard: {
    backgroundColor: "#0D2045",
    borderWidth: 1.5,
    borderColor: "rgba(245,193,0,0.45)",
    borderRadius: 24,
    padding: 36,
    alignItems: "center",
    gap: 10,
    width: SW - 48,
  },
  dealEmoji: { fontSize: 72, marginBottom: 4 },
  dealTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.primary },
  dealSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.muted },
  dealBtn: {
    marginTop: 14,
    backgroundColor: C.primary,
    paddingVertical: 13,
    paddingHorizontal: 48,
    borderRadius: 24,
  },
  dealBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#08152E" },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: C.inputBg,
    borderTopWidth: 1,
    borderTopColor: C.inputBorder,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.text,
    backgroundColor: "rgba(19,40,70,0.55)",
    maxHeight: 100,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // Modal shared
  modalLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: C.secondary,
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.text,
    marginBottom: 4,
  },
  disclaimerBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.muted,
    lineHeight: 20,
  },
  disclaimerBold: {
    fontFamily: "Inter_700Bold",
    color: C.text,
  },

  // Delivery modal
  deliverySection: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.muted,
    marginTop: 12,
    marginBottom: 6,
  },
  deliveryOption: {
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.22)",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: "#0D2045",
  },
  deliveryOptionSelected: {
    borderColor: C.primary,
    backgroundColor: "rgba(245,193,0,0.07)",
  },
  deliveryOptionLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  deliveryOptionSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.muted,
    marginTop: 3,
  },
  deliveryInfoBox: {
    backgroundColor: "rgba(56,189,248,0.07)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.2)",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  deliveryInfoText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.muted,
    lineHeight: 18,
  },
});
