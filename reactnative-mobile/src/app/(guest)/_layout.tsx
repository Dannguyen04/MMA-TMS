import { Stack } from "expo-router";

import { RoleLayoutGate } from "@/session/role-gate";

export default function GuestLayout() {
  return (
    <RoleLayoutGate allow="guest">
      <Stack screenOptions={{ headerShown: false, title: "" }} />
    </RoleLayoutGate>
  );
}
