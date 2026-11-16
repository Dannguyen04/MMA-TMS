import { Tabs } from "expo-router";
import { useNavRail } from "@/components/nav-rail";
import { RoleTabBar } from "@/components/role-tab-bar";
import { useTabFade } from "@/components/tab-fade";
import { TabIcon } from "@/components/tab-icon";

import { vi } from "@/i18n/vi";
import { RoleLayoutGate } from "@/session/role-gate";
import { activeInkOn } from "@/screens/fighter/redesign/palette";
import { coachRo } from "@/i18n/coach-ro";
import { useThemePreference } from "@/theme";
import { RoHeaderAction } from "@/screens/coach/readonly/ro-ui";
import { CoachBell, CoachUnreadProvider } from "@/screens/coach/nav/coach-unread";
import { pendingVi } from "@/i18n/pending-vi";
import { todayText } from "@/i18n/coach-today";
import { fz } from "@/theme/typography";

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

/** Redesign 2026-11: 5 tab Hôm nay · Võ sĩ · Lịch · Giáo án · Tôi (Trận đấu nằm trong Hôm nay); Thông báo mở từ chuông ở header; Video mở từ chi tiết võ sĩ / thông báo / thẻ Cần duyệt. */
function CoachTabs() {
  const { colors } = useThemePreference();
  const rail = useNavRail();
  const fade = useTabFade();

  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <RoleTabBar {...props} />}
      initialRouteName="hom-nay"
      screenOptions={{
        ...fade,
        headerShown: false,
        tabBarPosition: rail ? "left" : "bottom",
        tabBarActiveTintColor: activeInkOn(colors),
        tabBarInactiveTintColor: colors.inkSubtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontSize: fz(12) },
      }}
    >
      <Tabs.Screen
        name="hom-nay"
        options={{
          title: todayText.tab,
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" focused={focused} color={color} solid />,
        }}
      />
      <Tabs.Screen
        name="fighters"
        options={{
          title: coachRo.tabs.fighters,
          tabBarIcon: ({ color, focused }) => <TabIcon name="fighters" focused={focused} color={color} solid />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: coachRo.tabs.schedule,
          tabBarIcon: ({ color, focused }) => <TabIcon name="schedule" focused={focused} color={color} solid />,
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: coachRo.tabs.plans,
          tabBarIcon: ({ color, focused }) => <TabIcon name="plans" focused={focused} color={color} solid />,
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
          tabBarIcon: ({ color, focused }) => <TabIcon name="me" focused={focused} color={color} solid />,
        }}
      />
      <Tabs.Screen name="thong-bao" options={{ href: null, title: coachRo.tabs.notifications }} />
      <Tabs.Screen name="fight-camp" options={{ href: null, title: pendingVi.fightCamp }} />
      <Tabs.Screen name="clearance" options={{ href: null, title: "Giấy phép" }} />
      <Tabs.Screen name="danh-gia" options={{ href: null, title: vi.admission.assigned }} />
    </Tabs>
  );
}
