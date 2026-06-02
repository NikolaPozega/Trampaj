import { Feather } from "@expo/vector-icons";
import { router, Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { searchBus } from "@/utils/searchBus";

export default function TabLayout() {
  const colors = useColors();
  const { user, isLoading } = useAuth();
  const { unreadCount } = useChat();
  const insets = useSafeAreaInsets();
  const wasLoggedIn = useRef(false);

  // Track if user was ever logged in; on logout go back to browse (not login)
  useEffect(() => {
    if (user) {
      wasLoggedIn.current = true;
    } else if (!isLoading && wasLoggedIn.current) {
      wasLoggedIn.current = false;
      router.replace("/(tabs)");
    }
  }, [user, isLoading]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#F5C100",
        tabBarInactiveTintColor: "#8CA4BE",
        headerShown: false,
        tabBarStyle: user ? {
          backgroundColor: "#0D2045",
          borderTopWidth: 1,
          borderTopColor: "rgba(56,189,248,0.22)",
          elevation: 0,
          shadowOpacity: 0,
          height: Platform.OS === "web" ? 62 : 54 + insets.bottom,
          paddingBottom: Platform.OS === "web" ? 8 : insets.bottom + 6,
          paddingTop: 6,
        } : { display: "none" },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Oglasi",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
        listeners={{ tabPress: () => searchBus.clearSearch?.() }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: "Objavi",
          tabBarLabel: () => null,
          tabBarButton: user ? undefined : () => null,
          tabBarIcon: () => (
            <View style={[styles.postIcon, { backgroundColor: colors.primary }]}>
              <Feather name="plus" size={22} color={colors.primaryForeground} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarButton: user ? undefined : () => null,
          tabBarIcon: ({ color, size }) => (
            <View>
              <Feather name="user" size={size} color={color} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  postIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#E85D25",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 13,
  },
});
