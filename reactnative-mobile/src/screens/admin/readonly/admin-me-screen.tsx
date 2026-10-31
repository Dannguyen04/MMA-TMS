import { useRouter, type Href } from "expo-router";

import { adminRo } from "@/i18n/admin-ro";
import { ActionButton } from "@/screens/fighter/bout-states";
import { InfoLine, RoCard, RoRow, RoScreen, Stack } from "@/screens/coach/readonly/ro-ui";
import { useSession } from "@/session/session-context";

/** Tab "Tôi" của Admin: tài khoản, giao diện, đăng xuất. */
export function AdminMeScreen() {
  const router = useRouter();
  const { user, signOut } = useSession();
  return (
    <RoScreen title={adminRo.me.title}>
      <Stack>
        <RoCard>
          <InfoLine label={adminRo.me.email} value={user?.email ?? "—"} />
          <InfoLine label={adminRo.me.role} value={adminRo.me.roleAdmin} />
        </RoCard>
        <RoRow title={adminRo.me.appearance} lines={[adminRo.me.appearanceDesc]} onPress={() => router.push("/appearance" as Href)} />
        <ActionButton
          label={adminRo.me.logout}
          icon="logout"
          variant="secondary"
          onPress={() => {
            void signOut().then(() => router.replace("/login"));
          }}
        />
      </Stack>
    </RoScreen>
  );
}
