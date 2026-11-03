import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { AppearanceLink } from "@/components/appearance/appearance-link";
import { doctor } from "@/i18n/doctor";
import { useSession } from "@/session/session-context";
import { spacing, type, useThemePreference } from "@/theme";

import { DoctorCard, DoctorChrome, doctorMuted, fighterName } from "./doctor-chrome";
import { DoctorAvatar, cleanInitials, useDoctorText } from "./doctor-ui";
import { StatusBadge } from "./status-badge";

function Row({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors } = useThemePreference();
  const muted = doctorMuted(colors);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={danger ? colors.danger : colors.ink} />
      <Text style={[type.body, { color: danger ? colors.danger : colors.ink, flex: 1 }]}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={18} color={muted} />
    </Pressable>
  );
}

export function DoctorMeScreen() {
  const t = useDoctorText();
  const router = useRouter();
  const { user, signOut } = useSession();

  const onLogout = () => {
    void signOut().then(() => {
      router.replace("/login");
    });
  };

  const profile = user?.profile && "firstName" in user.profile ? user.profile : null;
  const displayName = profile ? fighterName(profile) : user?.email ?? "";
  const specialization = profile && "specialization" in profile && typeof profile.specialization === "string" ? profile.specialization : null;
  const license = profile && "licenseNumber" in profile && typeof profile.licenseNumber === "string" ? profile.licenseNumber : null;
  const credentials = [specialization, license].filter(Boolean).join(" · ");

  return (
    <DoctorChrome title={doctor.me.title} requireDoctor={false}>
      <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg }}>
        <DoctorAvatar initials={profile ? cleanInitials(profile.firstName, profile.lastName) : cleanInitials(user?.email)} size={72} />
        <Text style={[t.heading, { textAlign: "center" }]}>{displayName}</Text>
        {user?.role === "DOCTOR" ? <StatusBadge id="review.RESOLVED" label={doctor.me.role} /> : null}
        {credentials ? <Text style={[t.value, { textAlign: "center" }]}>{credentials}</Text> : null}
        {user?.email && user.email !== displayName ? <Text style={t.meta}>{user.email}</Text> : null}
      </View>
      <DoctorCard>
        <AppearanceLink />
        <Row icon="logout" label={doctor.me.logout} onPress={onLogout} danger />
      </DoctorCard>
    </DoctorChrome>
  );
}
