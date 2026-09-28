import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

import { blocked } from "@/i18n/blocked";
import { vi } from "@/i18n/vi";
import { AdminLink, AdminPage } from "@/screens/admin/admin-page";
import { useSession } from "@/session/session-context";
import { type, useThemePreference } from "@/theme";

const LINKS = [
  { href: "/quan-tri/nhap-hoc" as const, label: "Hồ sơ nhập học" },
  { href: "/quan-tri/nguoi-dung" as const, label: blocked.users },
  { href: "/quan-tri/vai-tro" as const, label: blocked.roles },
  { href: "/quan-tri/video" as const, label: blocked.adminVideos },
  { href: "/quan-tri/job-ai" as const, label: blocked.aiJobs },
  { href: "/quan-tri/mo-hinh" as const, label: blocked.aiModels },
  { href: "/quan-tri/nhat-ky" as const, label: blocked.audit },
  { href: "/quan-tri/thong-bao" as const, label: blocked.broadcast },
  { href: "/quan-tri/cai-dat" as const, label: blocked.settings },
];

export function AdminHomeScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { signOut } = useSession();

  return (
    <AdminPage title={blocked.adminHome} extra={blocked.adminUsers} onBack={false}>
      {LINKS.map((item) => (
        <AdminLink key={item.href} href={item.href} label={item.label} />
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void signOut().then(() => router.replace("/login"));
        }}
      >
        <Text style={[type.link, { color: colors.lotus }]}>{vi.dashboard.logout}</Text>
      </Pressable>
    </AdminPage>
  );
}
