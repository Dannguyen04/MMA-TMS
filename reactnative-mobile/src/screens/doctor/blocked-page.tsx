import { type ReactNode } from "react";
import { Pressable, Text } from "react-native";
import { useRouter, type Href } from "expo-router";

import { BlockedApiNotice } from "@/components/blocked/blocked-api-notice";
import { DoctorCard, DoctorChrome, DoctorScroll, doctorStyles } from "@/screens/doctor/doctor-chrome";
import { type, useThemePreference } from "@/theme";

export function DoctorBlockedPage({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: string;
  children?: ReactNode;
}) {
  return (
    <DoctorChrome title={title}>
      <DoctorScroll contentContainerStyle={doctorStyles.list}>
        <BlockedApiNotice extra={extra} />
        {children}
      </DoctorScroll>
    </DoctorChrome>
  );
}

export function DoctorNavLink({ href, label }: { href: Href; label: string }) {
  const { colors } = useThemePreference();
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(href)}>
      <Text style={[type.link, { color: colors.lotus }]}>{label}</Text>
    </Pressable>
  );
}

export function DoctorBlockedCard({ children }: { children: ReactNode }) {
  return <DoctorCard>{children}</DoctorCard>;
}
