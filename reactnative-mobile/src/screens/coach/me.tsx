import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

import { AppearanceLink } from "@/components/appearance/appearance-link";
import { coach } from "@/i18n/coach";
import { coachProfileId, fighterDisplayName } from "@/screens/coach/coach-error";
import { CoachBanner, CoachCard, CoachScaffold } from "@/screens/coach/coach-ui";
import { useSession } from "@/session/session-context";
import { type, useThemePreference } from "@/theme";
import { coachHref } from "@/navigation/role-href";

export function CoachMeScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { user, signOut } = useSession();
  const profileId = coachProfileId(user);
  const name =
    user?.profile && "firstName" in user.profile
      ? fighterDisplayName(user.profile)
      : coach.noName;

  const onLogout = () => {
    void signOut().then(() => {
      router.replace("/login");
    });
  };

  return (
    <CoachScaffold title={coach.tabs.me}>
      <CoachCard>
        <Text style={[type.title, { color: colors.ink }]}>
          {coach.greeting}
          {name ? `, ${name}` : ""}
        </Text>
        <Text style={[type.body, { color: colors.inkMuted }]}>
          {coach.email}: {user?.email ?? ""}
        </Text>
        <Text style={[type.body, { color: colors.inkMuted }]}>
          {coach.role}: {coach.roleCoach}
        </Text>
        {!profileId ? <CoachBanner message={coach.assignNeedProfile} /> : null}
      </CoachCard>
      <CoachCard>
        <Pressable accessibilityRole="button" onPress={() => router.push(coachHref.assessments)}>
          <Text style={[type.link, { color: colors.lotus }]}>Hồ sơ nhập học</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push(coachHref.videoAnalysis)}>
          <Text style={[type.link, { color: colors.lotus }]}>Duyệt video</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push(coachHref.goals)}>
          <Text style={[type.link, { color: colors.lotus }]}>Mục tiêu</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push(coachHref.performance)}>
          <Text style={[type.link, { color: colors.lotus }]}>Hiệu suất</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push(coachHref.clearance)}>
          <Text style={[type.link, { color: colors.lotus }]}>Giấy phép</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push(coachHref.notifications)}>
          <Text style={[type.link, { color: colors.lotus }]}>Thông báo</Text>
        </Pressable>
      </CoachCard>
      <CoachCard>
        <AppearanceLink />
      </CoachCard>
      <Pressable accessibilityRole="button" onPress={onLogout}>
        <Text style={[type.link, { color: colors.lotus }]}>{coach.logout}</Text>
      </Pressable>
    </CoachScaffold>
  );
}
