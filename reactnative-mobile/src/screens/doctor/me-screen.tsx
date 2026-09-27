import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

import { doctor } from "@/i18n/doctor";
import { useSession } from "@/session/session-context";
import { type, useThemePreference } from "@/theme";

import { DoctorCard, DoctorChrome, doctorStyles, fighterName } from "./doctor-chrome";

export function DoctorMeScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { user, signOut } = useSession();

  const onLogout = () => {
    void signOut().then(() => {
      router.replace("/login");
    });
  };

  const displayName =
    user?.profile && "firstName" in user.profile ? fighterName(user.profile) : user?.email ?? "";

  return (
    <DoctorChrome title={doctor.me.title} requireDoctor={false}>
      <DoctorCard>
        <Text style={[type.body, { color: colors.ink }]}>{displayName}</Text>
        {user?.email ? (
          <Text style={[type.label, { color: colors.inkMuted }]}>{user.email}</Text>
        ) : null}
        {user?.role === "DOCTOR" ? (
          <Text style={[type.label, { color: colors.inkMuted }]}>{doctor.me.role}</Text>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => router.push("/thong-bao")} style={doctorStyles.link}>
          <Text style={[type.link, { color: colors.lotus }]}>Thông báo</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onLogout} style={doctorStyles.link}>
          <Text style={[type.link, { color: colors.lotus }]}>{doctor.me.logout}</Text>
        </Pressable>
      </DoctorCard>
    </DoctorChrome>
  );
}
