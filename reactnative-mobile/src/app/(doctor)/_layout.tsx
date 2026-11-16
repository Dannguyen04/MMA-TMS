import { Tabs } from "expo-router";
import { useNavRail } from "@/components/nav-rail";

import { RoleTabBar } from "@/components/role-tab-bar";
import { useTabFade } from "@/components/tab-fade";
import { TabIcon } from "@/components/tab-icon";
import { doctorRo } from "@/i18n/doctor-ro";
import { DoctorRosterProvider } from "@/screens/doctor/redesign/doctor-roster";
import { DoctorUnreadProvider } from "@/screens/doctor/redesign/doctor-unread";
import { activeInkOn } from "@/screens/fighter/redesign/palette";

import { doctor } from "@/i18n/doctor";
import { scheduleText } from "@/i18n/schedule";
import { doctorToday } from "@/i18n/doctor-today";
import { DoctorOsNotificationProvider } from "@/notifications/doctor-os-notifications";
import { DoctorInboxProvider } from "@/screens/doctor/inbox-context";
import { SelectedFighterProvider } from "@/screens/doctor/selected-fighter";
import { RoleLayoutGate } from "@/session/role-gate";
import { useThemePreference } from "@/theme";
import { fz } from "@/theme/typography";

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
  const rail = useNavRail();
  const fade = useTabFade();

  return (
      <Tabs
        tabBar={(props) => <RoleTabBar {...props} />}
        initialRouteName="hom-nay"
        backBehavior="history"
        screenOptions={{
          ...fade,
          headerShown: false,
          title: "",
          tabBarPosition: rail ? "left" : "bottom",
          tabBarActiveTintColor: activeInkOn(colors),
          tabBarInactiveTintColor: colors.inkSubtle,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.line,
          },
          tabBarLabelStyle: { fontSize: fz(12) },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen
          name="hom-nay"
          options={{
            title: doctorToday.tab,
            tabBarIcon: ({ color, focused }) => <TabIcon name="home" focused={focused} color={color} solid />,
          }}
        />
        <Tabs.Screen
          name="vo-si"
          options={{
            title: doctorRo.tabs.fighters,
            tabBarIcon: ({ color, focused }) => <TabIcon name="fighters" focused={focused} color={color} solid />,
          }}
        />
        <Tabs.Screen
          name="lich"
          options={{
            title: scheduleText.tabDoctor,
            tabBarIcon: ({ color, focused }) => <TabIcon name="schedule" focused={focused} color={color} solid />,
          }}
        />
        {/* Redesign 2026-11-11: notifications open from the bell on Hôm nay, not from a tab. */}
        <Tabs.Screen name="thong-bao" options={{ href: null, title: doctorRo.tabs.notifications }} />
        <Tabs.Screen
          name="me"
          options={{
            title: doctorRo.tabs.me,
            tabBarIcon: ({ color, focused }) => <TabIcon name="me" focused={focused} color={color} solid />,
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
