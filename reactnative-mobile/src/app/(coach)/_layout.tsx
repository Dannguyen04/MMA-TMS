import { Tabs } from "expo-router";
import { RoleTabBar } from "@/components/role-tab-bar";
import { TabIcon } from "@/components/tab-icon";

import { vi } from "@/i18n/vi";
import { RoleLayoutGate } from "@/session/role-gate";
import { activeInkOn } from "@/screens/fighter/redesign/palette";
import { coachRo } from "@/i18n/coach-ro";
import { useThemePreference } from "@/theme";
import { RoHeaderAction } from "@/screens/coach/readonly/ro-ui";
import { CoachBell, CoachUnreadProvider } from "@/screens/coach/nav/coach-unread";

export default function CoachTabsLayout() {
  return (
    <RoleLayoutGate allow="coach">
      <CoachUnreadProvider>
        <RoHeaderAction.Provider value={<CoachBell />}>
          <CoachTabs />
        </RoHeaderAction.Provider>
      </CoachUnreadProvider>
    </RoleLayoutGate>
  );
}

/** coach-nav-v3: 4 tab Võ sĩ · Lịch · Giáo án · Tôi; Thông báo mở từ chuông ở header; Video mở từ chi tiết võ sĩ / thông báo / thẻ Cần duyệt. */
function CoachTabs() {
  const { colors } = useThemePreference();

  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <RoleTabBar {...props} />}
      initialRouteName="fighters"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeInkOn(colors),
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
          title: coachRo.tabs.fighters,
          tabBarIcon: ({ color, focused }) => <TabIcon name="fighters" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: coachRo.tabs.schedule,
          tabBarIcon: ({ color, focused }) => <TabIcon name="schedule" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: coachRo.tabs.plans,
          tabBarIcon: ({ color, focused }) => <TabIcon name="plans" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="video-analysis"
        // batch45: bỏ tab Video khỏi thanh tab; video mở từ chi tiết võ sĩ (Video AI), thông báo và thẻ "Cần duyệt" ở Lịch.
        options={{ href: null, title: coachRo.tabs.video }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: coachRo.tabs.me,
          tabBarIcon: ({ color, focused }) => <TabIcon name="me" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen name="thong-bao" options={{ href: null, title: coachRo.tabs.notifications }} />
      <Tabs.Screen name="fight-camp" options={{ href: null, title: "Fight Camp" }} />
      <Tabs.Screen name="goals" options={{ href: null, title: "Mục tiêu" }} />
      <Tabs.Screen name="performance" options={{ href: null, title: "Hiệu suất" }} />
      <Tabs.Screen name="clearance" options={{ href: null, title: "Giấy phép" }} />
      <Tabs.Screen name="danh-gia" options={{ href: null, title: vi.admission.assigned }} />
    </Tabs>
  );
}
