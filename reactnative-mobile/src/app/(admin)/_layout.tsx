import { Tabs } from "expo-router";
import { useNavRail } from "@/components/nav-rail";

import { RoleTabBar } from "@/components/role-tab-bar";
import { useTabFade } from "@/components/tab-fade";
import { TabIcon } from "@/components/tab-icon";
import { adminRo } from "@/i18n/admin-ro";
import { activeInkOn } from "@/screens/fighter/redesign/palette";
import { AdminUnreadProvider, useAdminUnread } from "@/screens/admin/admin-unread";
import { badgeText } from "@/screens/doctor/redesign/doctor-unread";
import { RoleLayoutGate } from "@/session/role-gate";
import { useThemePreference } from "@/theme";
import { fz } from "@/theme/typography";

export default function AdminLayout() {
  return (
    <RoleLayoutGate allow="admin">
      <AdminUnreadProvider>
        <AdminTabs />
      </AdminUnreadProvider>
    </RoleLayoutGate>
  );
}

/** Tabs; Thông báo carries the unread count (redesign step 22). */
function AdminTabs() {
  const { colors } = useThemePreference();
  const rail = useNavRail();
  const fade = useTabFade();
  const unread = badgeText(useAdminUnread().count);
  return (
      <Tabs
        tabBar={(props) => <RoleTabBar {...props} />}
      initialRouteName="index"
        screenOptions={{
          ...fade,
          headerShown: false,
          tabBarPosition: rail ? "left" : "bottom",
          tabBarActiveTintColor: activeInkOn(colors),
          tabBarInactiveTintColor: colors.inkSubtle,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
          tabBarLabelStyle: { fontSize: fz(12) },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: adminRo.tabs.overview,
            tabBarIcon: ({ color, focused }) => <TabIcon name="home" focused={focused} color={color} />,
          }}
        />
        <Tabs.Screen
          name="nguoi-dung"
          options={{
            title: adminRo.tabs.users,
            tabBarIcon: ({ color, focused }) => <TabIcon name="fighters" focused={focused} color={color} />,
          }}
        />
        <Tabs.Screen
          name="vo-si"
          options={{
            title: adminRo.tabs.fighters,
            tabBarIcon: ({ color, focused }) => <TabIcon name="martialArts" focused={focused} color={color} />,
          }}
        />
        <Tabs.Screen
          name="thong-bao"
          options={{
            title: adminRo.tabs.notifications,
            tabBarBadge: unread ?? undefined,
            tabBarIcon: ({ color, focused }) => <TabIcon name="notifications" focused={focused} color={color} />,
          }}
        />
        <Tabs.Screen
          name="me"
          options={{
            title: adminRo.tabs.me,
            tabBarIcon: ({ color, focused }) => <TabIcon name="me" focused={focused} color={color} />,
          }}
        />
        <Tabs.Screen name="quan-tri" options={{ href: null, title: "Quản trị" }} />
      </Tabs>
  );
}
