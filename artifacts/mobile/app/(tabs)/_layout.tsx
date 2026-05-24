import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#F5C100",
        tabBarInactiveTintColor: "#8CA4BE",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0D2045",
          borderTopWidth: 1,
          borderTopColor: "rgba(56,189,248,0.22)",
          elevation: 0,
          shadowOpacity: 0,
          height: Platform.OS === "web" ? 62 : 86,
          paddingBottom: Platform.OS === "web" ? 8 : 30,
          paddingTop: 6,
        },
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
      />
      <Tabs.Screen
        name="post"
        options={{
          title: "Objavi",
          tabBarLabel: () => null,
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
