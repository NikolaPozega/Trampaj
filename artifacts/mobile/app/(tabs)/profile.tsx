import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { useListings } from "@/context/ListingsContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listings, myName, setMyName, markAsTraded, deleteListing } = useListings();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(myName);

  const myListings = listings.filter((l) => l.isMine);
  const activeCount = myListings.filter((l) => l.status === "active").length;
  const tradedCount = myListings.filter((l) => l.status === "traded").length;

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;

  function handleSaveName() {
    if (nameInput.trim()) {
      setMyName(nameInput.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setEditingName(false);
  }

  function handleDelete(id: string) {
    Alert.alert("Obriši oglas", "Jesi li siguran?", [
      { text: "Odustani", style: "cancel" },
      {
        text: "Obriši",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          deleteListing(id);
        },
      },
    ]);
  }

  function handleMarkTraded(id: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markAsTraded(id);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatarRing, { borderColor: colors.secondary }]}>
            <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {myName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={[styles.name, { color: colors.foreground }]}>{myName}</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Feather key={i} name="star" size={14} color={colors.primary} />
            ))}
            <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>5,0</Text>
          </View>

          <Pressable
            onPress={() => { setNameInput(myName); setEditingName(true); }}
            style={({ pressed }) => [styles.editBtn, { borderColor: colors.border, backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="edit-2" size={13} color={colors.mutedForeground} />
            <Text style={[styles.editBtnText, { color: colors.mutedForeground }]}>Uredi profil</Text>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.stats}>
            <StatPill label="Aktivni" value={activeCount} color={colors.primary} textColor={colors.primaryForeground} bg={colors.muted} />
            <StatPill label="Zamijenjeni" value={tradedCount} color={colors.secondary} textColor={colors.secondaryForeground} bg={colors.muted} />
            <StatPill label="Ukupno" value={myListings.length} color={colors.mutedForeground} textColor={colors.foreground} bg={colors.muted} />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Moji oglasi</Text>
      </View>

      <FlatList
        data={myListings}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <ListingCard listing={item} />
            {item.isMine && (
              <View style={styles.actions}>
                {item.status === "active" && (
                  <Pressable
                    onPress={() => handleMarkTraded(item.id)}
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: "#2E7D4F", opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Feather name="check" size={12} color="#fff" />
                    <Text style={styles.actionBtnText}>Zamijenjeno</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => handleDelete(item.id)}
                  style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.muted, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Feather name="trash-2" size={12} color={colors.destructive} />
                </Pressable>
              </View>
            )}
          </View>
        )}
        contentContainerStyle={[
          styles.list,
          myListings.length === 0 && styles.listEmpty,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 60 : 100) },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="package"
            title="Nemaš oglasa"
            subtitle="Postavi oglas i počni trampati!"
          />
        }
      />

      <Modal visible={editingName} transparent animationType="fade" onRequestClose={() => setEditingName(false)}>
        <Pressable style={styles.overlay} onPress={() => setEditingName(false)}>
          <Pressable style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Promijeni ime</Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              style={[styles.modalInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted }]}
              autoFocus
              maxLength={40}
              onSubmitEditing={handleSaveName}
              returnKeyType="done"
            />
            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => setEditingName(false)}
                style={[styles.modalBtn, { backgroundColor: colors.muted }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>Odustani</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveName}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.primaryForeground }]}>Spremi</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function StatPill({ label, value, color, textColor, bg }: { label: string; value: number; color: string; textColor: string; bg: string }) {
  return (
    <View style={[statStyles.pill, { backgroundColor: bg }]}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={[statStyles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  pill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 2,
  },
  value: { fontSize: 20, fontFamily: "Inter_700Bold" },
  label: { fontSize: 10, fontFamily: "Inter_400Regular" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 14 },
  profileCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  avatarRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 28, fontFamily: "Inter_700Bold" },
  name: { fontSize: 20, fontFamily: "Inter_700Bold" },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 13, fontFamily: "Inter_400Regular", marginLeft: 4 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  editBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  divider: { width: "100%", height: 1, marginVertical: 4 },
  stats: { flexDirection: "row", gap: 8, width: "100%" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  list: { paddingHorizontal: 12, paddingTop: 8 },
  listEmpty: { flex: 1 },
  columnWrapper: { gap: 10, paddingHorizontal: 4, marginBottom: 0 },
  cardWrapper: { flex: 1 },
  actions: {
    flexDirection: "row",
    gap: 6,
    marginTop: -8,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: { color: "#fff", fontSize: 11, fontFamily: "Inter_500Medium" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 20, gap: 14 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  modalInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: "Inter_400Regular" },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10 },
  modalBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
