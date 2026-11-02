import { useCallback } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { adminApi } from "@/api/admin";
import { isFighterProfile } from "@/api/types";
import { coachRo } from "@/i18n/coach-ro";
import { adminRo } from "@/i18n/admin-ro";
import { vi } from "@/i18n/vi";
import { ActionButton, ConnectionBanner, MessageCard, TEXT, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useLoad } from "@/screens/fighter/use-load";
import { Avatar, InfoLine, RoCard, RoRow, RoScreen, RowSkeletons, StatusChip, Stack, useGo } from "@/screens/coach/readonly/ro-ui";
import { ageFromDob, vnDate } from "@/screens/coach/readonly/ro-format";
import { useCoachEnabled } from "@/screens/coach/readonly/use-coach";
import { fighterIdOf, roleLabel, statusChip, userDisplayName } from "./admin-format";

const weightLabels = vi.weightClass as Record<string, string>;
const stanceLabels = (vi as unknown as { stance?: Record<string, string> }).stance ?? {};

/** A-3: chi tiết người dùng (chỉ đọc). Mở bằng /nguoi-dung/chi-tiet?id=... */
export function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const uid = typeof id === "string" ? id : "";
  const enabled = useCoachEnabled() && Boolean(uid);
  const router = useRouter();
  const go = useGo();
  const p = useFighterPalette();
  const run = useCallback(() => adminApi.getUser(uid), [uid]);
  const { data: u, error, loading, reload, refresh } = useLoad(enabled, `ud|${uid}`, run, { keepOnError: true });
  const skeleton = useDelayedFlag(loading && !u);
  const profile = u?.profile ?? null;
  const fighterId = u ? fighterIdOf(u) : null;
  const name = u ? userDisplayName(u) : "";

  return (
    <RoScreen title={adminRo.user.title} back onRefresh={refresh} refreshing={loading && !u}>
      <Stack>
        {error ? <ConnectionBanner error={error} onRetry={reload} retrying={loading} hasData={Boolean(u)} /> : null}
        {!uid ? (
          <MessageCard icon="fighters" title={adminRo.user.notFoundTitle} description={adminRo.user.notFoundDesc}>
            <ActionButton label={adminRo.user.back} variant="secondary" icon="back" onPress={() => router.back()} />
          </MessageCard>
        ) : null}
        {!u && !error && loading && skeleton ? <RowSkeletons count={3} height={128} /> : null}
        {u ? (
          <>
            <RoCard>
              <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
                <Avatar name={name} uri={profile?.profileImageUrl} size={64} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[TEXT.cardTitle, { color: p.ink }]}>{name}</Text>
                  <Text style={[TEXT.body, { color: p.ink }]}>{roleLabel(u.role)}</Text>
                </View>
              </View>
              <StatusChip spec={statusChip(u)} />
            </RoCard>
            <RoCard title={adminRo.user.account}>
              <InfoLine label={adminRo.user.email} value={u.email} />
              <InfoLine label={adminRo.user.role} value={roleLabel(u.role)} />
              <InfoLine label={adminRo.user.status} value={u.isActive ? adminRo.active : adminRo.inactive} />
              <InfoLine label={adminRo.user.created} value={vnDate(u.createdAt)} />
              <InfoLine label={adminRo.user.updated} value={vnDate(u.updatedAt)} />
            </RoCard>
            <RoCard title={adminRo.user.profile}>
              {isFighterProfile(profile) ? (
                <>
                  <InfoLine label={adminRo.user.weightClass} value={weightLabels[profile.weightClass] ?? profile.weightClass} />
                  <InfoLine
                    label={adminRo.user.dob}
                    value={`${vnDate(profile.dateOfBirth)}${ageFromDob(profile.dateOfBirth) != null ? ` · ${coachRo.detail.age(ageFromDob(profile.dateOfBirth)!)}` : ""}`}
                  />
                  {profile.nationality ? <InfoLine label={adminRo.user.nationality} value={profile.nationality} /> : null}
                  {profile.heightCm ? <InfoLine label={adminRo.user.height} value={coachRo.detail.height(profile.heightCm)} /> : null}
                  {profile.reachCm ? <InfoLine label={adminRo.user.reach} value={coachRo.detail.height(profile.reachCm)} /> : null}
                  {profile.dominantStance && stanceLabels[profile.dominantStance] ? (
                    <InfoLine label={adminRo.user.stance} value={stanceLabels[profile.dominantStance]!} />
                  ) : null}
                  {profile.gym ? <InfoLine label={adminRo.user.gym} value={profile.gym} /> : null}
                </>
              ) : profile ? (
                <>
                  {"isHeadCoach" in profile && profile.isHeadCoach != null ? (
                    <InfoLine label={adminRo.user.headCoach} value={profile.isHeadCoach ? adminRo.user.yes : adminRo.user.no} />
                  ) : null}
                  {profile.specialization ? <InfoLine label={adminRo.user.specialization} value={profile.specialization} /> : null}
                  {profile.licenseNumber ? <InfoLine label={adminRo.user.license} value={profile.licenseNumber} /> : null}
                </>
              ) : (
                <Text style={[TEXT.body, { color: p.ink }]}>{adminRo.user.noProfile}</Text>
              )}
            </RoCard>
            {fighterId ? (
              <RoRow title={adminRo.user.openFighter} lines={[adminRo.user.openFighterDesc]} onPress={() => go("/(admin)/vo-si/chi-tiet", fighterId)} />
            ) : null}
          </>
        ) : null}
      </Stack>
    </RoScreen>
  );
}
