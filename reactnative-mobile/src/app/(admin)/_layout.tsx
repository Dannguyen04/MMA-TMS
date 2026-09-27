import { Stack } from "expo-router";

import { RoleLayoutGate } from "@/session/role-gate";

export default function AdminLayout() {
  return (
    <RoleLayoutGate allow="admin">
      <Stack screenOptions={{ headerShown: false, title: "" }} />
    </RoleLayoutGate>
  );
}
