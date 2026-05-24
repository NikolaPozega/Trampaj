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

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  function handleSaveName() {
    if (nameInput.trim()) {
      setMyName(nameInput.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setEditingName(false);
  }

  function handleDelete(id: string) {
    Alert.alert("Obriši oglas", "Jesi li siguran da želiš obrisati ovaj oglas?", [
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
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <View style={styles.nameRow}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{myName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.nameInfo}>
            <Text style={[styles.name, { color: colors.foreground }]}>{myName}</Text>
            <Text style={[styles.nameSub, { color: colors.mutedForeground }]}>Moj profil</Text>
          </View>
          <Pressable
            onPress={() => { setNameInput(myName); setEditingName(true); }}
            style={({ pressed }) => [styles.editBtn, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="edit-2" size={14} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={styles.stats}>
          <StatPill label="Aktivni" value={activeCount} colors={colors} accent={colors.primary} />
          <StatPill label="Zamijenjeni" value={tradedCount} colors={colors} accent={colors.secondary} />
          <StatPill label="Ukupno" value={myListings.length} colors={colors} accent={colors.mutedForeground} />
        </View>
      </View>

      <FlatList
        data={myListings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View>
            <ListingCard listing={item} />
            {item.isMine && (
              <View style={styles.actions}>
                {item.status === "active" && (
                  <Pressable
                    onPress={() => handleMarkTraded(item.id)}
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.secondary, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Feather name="check" size={13} color="#fff" />
                    <Text style={styles.actionText}>Zamijenjeno</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => handleDelete(item.id)}
                  style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.muted, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Feather name="trash-2" size={13} color={colors.destructive} />
                  <Text style={[styles.actionText, { color: colors.destructive }]}>Obriši</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
        contentContainerStyle={[
          styles.list,
          myListings.length === 0 && styles.listEmpty,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 90) },
        ]}
        scrollEnabled={!!myListings.length}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="package"
            title="Nemaš oglasa"
            subtitle="Postavi oglas i počni mijenjati stvari!"
          />
        }
      />

      <Modal visible={editingName} transparent animationType="fade" onRequestClose={() => setEditingName(false)}>
        <Pressable style={styles.overlay} onPress={() => setEditingName(false)}>
          <Pressable
            style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Promijeni ime</Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              style={[styles.modalInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
              autoFocus
              maxLength={40}
              onSubmitEditing={handleSaveName}
              returnKeyType="done"
            />
            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => setEditingName(false)}
                style={({ pressed }) => [styles.modalBtn, { backgroundColor: colors.muted, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>Odustani</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveName}
                style={({ pressed }) => [styles.modalBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>Spremi</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function StatPill({ label, value, colors, accent }: { label: string; value: number; colors: ReturnType<typeof useColors>; accent: string }) {
  return (
    <View style={[statStyles.pill, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[statStyles.value, { color: accent }]}>{value}</Text>
      <Text style={[statStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  pill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
  },
  value: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 1,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  nameInfo: { flex: 1 },
  name: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  nameSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stats: { flexDirection: "row", gap: 8 },
  list: { padding: 16, paddingTop: 12 },
  listEmpty: { flex: 1 },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: -4,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#fff",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  modalBtns: {
    flexDirection: "row",
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
