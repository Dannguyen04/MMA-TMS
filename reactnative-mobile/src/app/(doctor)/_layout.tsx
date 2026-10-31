import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { doctor } from "@/i18n/doctor";
import { SelectedFighterProvider } from "@/screens/doctor/selected-fighter";
import { RoleLayoutGate } from "@/session/role-gate";
import { useThemePreference } from "@/theme";

export default function DoctorLayout() {
  const { colors } = useThemePreference();

  return (
    <RoleLayoutGate allow="doctor">
    <SelectedFighterProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          title: "",
          tabBarActiveTintColor: colors.lotus,
          tabBarInactiveTintColor: colors.inkMuted,
          tabBarStyle: {
            backgroundColor: colors.bg,
            borderTopColor: colors.line,
          },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: doctor.tabs.fighters,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="karate" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="medical"
          options={{
            title: doctor.tabs.medical,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="stethoscope" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="me"
          options={{
            title: doctor.tabs.me,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="account-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="examinations" options={{ href: null, title: "Khám" }} />
        <Tabs.Screen name="injuries" options={{ href: null, title: "Chấn thương" }} />
        <Tabs.Screen name="recovery" options={{ href: null, title: "Hồi phục" }} />
        <Tabs.Screen name="clearance" options={{ href: null, title: "Giấy phép" }} />
        <Tabs.Screen name="records" options={{ href: null, title: "Hồ sơ" }} />
        <Tabs.Screen name="ai-alerts" options={{ href: null, title: "Cảnh báo AI" }} />
        <Tabs.Screen name="thong-bao" options={{ href: null, title: "Thông báo" }} />
      </Tabs>
    </SelectedFighterProvider>
    </RoleLayoutGate>
  );
}
