import { Tabs } from "expo-router";

import { RoleTabBar } from "@/components/role-tab-bar";
import { TabIcon } from "@/components/tab-icon";
import { adminRo } from "@/i18n/admin-ro";
import { activeInkOn } from "@/screens/fighter/redesign/palette";
import { RoleLayoutGate } from "@/session/role-gate";
import { useThemePreference } from "@/theme";

export default function AdminLayout() {
  const { colors } = useThemePreference();
  return (
    <RoleLayoutGate allow="admin">
      <Tabs
        tabBar={(props) => <RoleTabBar {...props} />}
      initialRouteName="index"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: activeInkOn(colors),
          tabBarInactiveTintColor: colors.inkSubtle,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
          tabBarLabelStyle: { fontSize: 12 },
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
    </RoleLayoutGate>
  );
}
