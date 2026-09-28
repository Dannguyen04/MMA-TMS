import { type ReactNode } from "react";
import { Pressable, Text } from "react-native";
import { useRouter, type Href } from "expo-router";

import { BlockedApiNotice } from "@/components/blocked/blocked-api-notice";
import { CoachScaffold } from "@/screens/coach/coach-ui";
import { type, useThemePreference } from "@/theme";

export function CoachBlockedPage({
  title,
  extra,
  children,
  inStack = true,
}: {
  title: string;
  extra?: string;
  children?: ReactNode;
  inStack?: boolean;
}) {
  return (
    <CoachScaffold title={title} inStack={inStack}>
      <BlockedApiNotice extra={extra} />
      {children}
    </CoachScaffold>
  );
}

export function CoachNavLink({ href, label }: { href: Href; label: string }) {
  const { colors } = useThemePreference();
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(href)}>
      <Text style={[type.link, { color: colors.lotus }]}>{label}</Text>
    </Pressable>
  );
}
