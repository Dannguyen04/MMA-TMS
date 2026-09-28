import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { coach } from "@/i18n/coach";
import { RoleLayoutGate } from "@/session/role-gate";
import { useThemePreference } from "@/theme";

export default function CoachTabsLayout() {
  const { colors } = useThemePreference();

  return (
    <RoleLayoutGate allow="coach">
    <Tabs
      initialRouteName="fighters"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lotus,
        tabBarInactiveTintColor: colors.inkSubtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="fighters"
        options={{
          title: coach.tabs.fighters,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-group-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: coach.tabs.schedule,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-month-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: coach.tabs.plans,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-text-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: coach.tabs.me,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen name="video-analysis" options={{ href: null, title: "Video" }} />
      <Tabs.Screen name="goals" options={{ href: null, title: "Mục tiêu" }} />
      <Tabs.Screen name="performance" options={{ href: null, title: "Hiệu suất" }} />
      <Tabs.Screen name="clearance" options={{ href: null, title: "Giấy phép" }} />
      <Tabs.Screen name="thong-bao" options={{ href: null, title: "Thông báo" }} />
      <Tabs.Screen name="danh-gia" options={{ href: null, title: "Nhập học" }} />
    </Tabs>
    </RoleLayoutGate>
  );
}
