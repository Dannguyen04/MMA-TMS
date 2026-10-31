import { Tabs } from "expo-router";

import { RoleTabBar } from "@/components/role-tab-bar";
import { TabIcon } from "@/components/tab-icon";
import { doctorRo } from "@/i18n/doctor-ro";
import { DoctorRosterProvider } from "@/screens/doctor/redesign/doctor-roster";
import { badgeText, DoctorUnreadProvider, useDoctorUnread } from "@/screens/doctor/redesign/doctor-unread";
import { activeInkOn } from "@/screens/fighter/redesign/palette";

import { doctor } from "@/i18n/doctor";
import { DoctorOsNotificationProvider } from "@/notifications/doctor-os-notifications";
import { DoctorInboxProvider } from "@/screens/doctor/inbox-context";
import { SelectedFighterProvider } from "@/screens/doctor/selected-fighter";
import { RoleLayoutGate } from "@/session/role-gate";
import { useThemePreference } from "@/theme";

export default function DoctorLayout() {
  return (
    <RoleLayoutGate allow="doctor">
    <SelectedFighterProvider>
    <DoctorOsNotificationProvider>
    <DoctorInboxProvider>
      <DoctorRosterProvider>
      <DoctorUnreadProvider>
        <DoctorTabs />
      </DoctorUnreadProvider>
      </DoctorRosterProvider>
    </DoctorInboxProvider>
    </DoctorOsNotificationProvider>
    </SelectedFighterProvider>
    </RoleLayoutGate>
  );
}

function DoctorTabs() {
  const { colors } = useThemePreference();
  const unread = useDoctorUnread();
  const badge = badgeText(unread.count);

  return (
      <Tabs
        tabBar={(props) => <RoleTabBar {...props} />}
        initialRouteName="vo-si"
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          title: "",
          tabBarActiveTintColor: activeInkOn(colors),
          tabBarInactiveTintColor: colors.inkSubtle,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.line,
          },
          tabBarLabelStyle: { fontSize: 12 },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen
          name="vo-si"
          options={{
            title: doctorRo.tabs.fighters,
            tabBarIcon: ({ color, focused }) => <TabIcon name="fighters" focused={focused} color={color} />,
          }}
        />
        <Tabs.Screen
          name="thong-bao"
          options={{
            title: doctorRo.tabs.notifications,
            tabBarBadge: badge ?? undefined,
            tabBarAccessibilityLabel: badge
              ? `${doctorRo.tabs.notifications}, ${doctorRo.notifications.unreadBadge(unread.count)}`
              : undefined,
            tabBarIcon: ({ color, focused }) => <TabIcon name="notifications" focused={focused} color={color} />,
          }}
        />
        <Tabs.Screen
          name="me"
          options={{
            title: doctorRo.tabs.me,
            tabBarIcon: ({ color, focused }) => <TabIcon name="me" focused={focused} color={color} />,
          }}
        />
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="medical" options={{ href: null, title: doctor.tabs.medical }} />
        <Tabs.Screen name="examinations" options={{ href: null, title: "Khám" }} />
        <Tabs.Screen name="injuries" options={{ href: null, title: "Chấn thương" }} />
        <Tabs.Screen name="recovery" options={{ href: null, title: "Hồi phục" }} />
        <Tabs.Screen name="clearance" options={{ href: null, title: "Giấy phép" }} />
        <Tabs.Screen name="records" options={{ href: null, title: "Hồ sơ" }} />
        <Tabs.Screen name="ai-alerts" options={{ href: null, title: "Cảnh báo AI" }} />
      </Tabs>
  );
}
