import { Feather } from "@expo/vector-icons";
import { router, Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { searchBus } from "@/utils/searchBus";

export default function TabLayout() {
  const colors = useColors();
  const { user, isLoading } = useAuth();
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
          height: Platform.OS === "web" ? 62 : 86,
          paddingBottom: Platform.OS === "web" ? 8 : 30,
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
            <Feather name="user" size={size} color={color} />
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
});
