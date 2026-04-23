import React from "react";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, ListChecks, MapPinned, UserRound } from "lucide-react-native";
import { Colors } from "@/constants/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.tabIconDefault,
        headerShown: true,
        headerStyle: {
          backgroundColor: Colors.background,
        },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 18,
        },
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          headerShown: false,
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen name="availability" options={{ href: null }} />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Assigned Orders",
          tabBarLabel: "Orders",
          tabBarIcon: ({ color, size }) => (
            <ListChecks size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="pickup-map"
        options={{
          title: "Live Map",
          headerShown: false,
          tabBarLabel: "Map",
          tabBarIcon: ({ color, size }) => (
            <MapPinned size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => (
            <UserRound size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}
