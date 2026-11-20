import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { adminApi } from "@/api/admin/admin";
import { USER_ROLES, type UserRole } from "@/api/types";
import { Icon } from "@/components/icon";
import { StaggerList } from "@/components/motion/motion";
import { EmptyLine, RolePage } from "@/components/navigation/role-page";
import { adminRest as t } from "@/i18n/admin/admin-rest";
import { FilterChips } from "@/screens/coach/fighters/fighters-list";
import { useCoachEnabled, useDebounced } from "@/screens/coach/readonly/use-coach";
import { usePagedList } from "@/screens/coach/readonly/use-paged-list";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useThemePreference } from "@/theme";
import { readableTextStyle } from "@/theme/typography";

import { roleLabel, toPaginated, userDisplayName } from "./admin-format";

type StatusFilter = "ACTIVE" | "INACTIVE" | "";

export const ADMIN_USER_PAGE = "/(admin)/nguoi-dung/chi-tiet";

/** Two letters from a display name ("Thu Lê" → "TL"; one word → its first two letters). */
export function userInitials(name: string): string {
  const words = name.trim().split(/[\s._-]+/).filter((w) => /^\p{L}/u.test(w));
  const s = words.length > 1 ? `${words[0]!.charAt(0)}${words[words.length - 1]!.charAt(0)}` : (words[0] ?? "").slice(0, 2);
  return s.toLocaleUpperCase("vi") || "•";
}

/**
 * Admin Người dùng (redesign step 22): search, role and status chips that apply on tap, one row per account
 * (initials, name, role · email; a locked account starts its line with a red "Đã khóa"). Read only.
 */
export function AdminUsersListScreen() {
  const enabled = useCoachEnabled();
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [status, setStatus] = useState<StatusFilter>("");
  const q = useDebounced(search.trim(), 400);
  const params = useLocalSearchParams<{ role?: string; status?: string; t?: string }>();

  // Tổng quan opens the list with a role or status preset (a new `t` on every tap).
  useEffect(() => {
    if (params.t === undefined) return;
    setSearch("");
    setRole(params.role && (USER_ROLES as readonly string[]).includes(params.role) ? (params.role as UserRole) : "");
    setStatus(params.status === "ACTIVE" || params.status === "INACTIVE" ? params.status : "");
  }, [params.t, params.role, params.status]);

  const list = usePagedList(enabled, `u|${q}|${role}|${status}`, (page) =>
    adminApi.listUsers({ page, limit: 20, search: q || undefined, role: role || undefined, status: status || undefined }).then(toPaginated),
  );
  const roles = useMemo(() => [{ value: "" as UserRole | "", label: t.allRoles }, ...USER_ROLES.map((r) => ({ value: r as UserRole | "", label: roleLabel(r) }))], []);
  const statuses = useMemo(() => [
    { value: "" as StatusFilter, label: t.allStatuses },
    { value: "ACTIVE" as StatusFilter, label: t.active },
    { value: "INACTIVE" as StatusFilter, label: t.locked },
  ], []);
  const firstLoad = !list.loaded || (list.loading && list.items.length === 0 && !list.error);
  const filtered = Boolean(q || role || status);
  const empty = list.loaded && !list.loading && !list.error && list.items.length === 0;

  return <RolePage testID="admin-users" title={t.users} onRefresh={list.refresh}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 12, borderWidth: 1.5, borderColor: c.controlBorder }}>
      <Icon name="search" size={20} color={c.inkMuted}/>
      <TextInput testID="admin-user-search" value={search} onChangeText={setSearch} placeholder={t.search} placeholderTextColor={c.inkSubtle} accessibilityLabel={t.search}
        autoCapitalize="none" style={{ ...readableTextStyle(15), flex: 1, minWidth: 0, color: c.ink, paddingVertical: 10 }}/>
    </View>
    <FilterChips testID="filter-role" label={t.roleGroup} options={roles} value={role} onChange={setRole}/>
    <FilterChips label={t.statusGroup} options={statuses} value={status} onChange={setStatus}/>

    {list.error && !list.items.length ? <RetryRow message={t.loadFailed} retry={t.retry} onRetry={() => void list.reload()}/> : null}
    {firstLoad && !list.error ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {empty ? <View style={{ gap: 10 }}>
      <EmptyLine testID="admin-users-empty" title={filtered ? t.emptyFiltered : t.empty}/>
      {filtered ? <Pressable accessibilityRole="button" onPress={() => { setSearch(""); setRole(""); setStatus(""); }} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
        <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{t.clear}</Text>
      </Pressable> : null}
    </View> : null}
    {list.items.length ? <StaggerList testID="admin-users-list">
      {list.items.map((u, k) => {
        const name = userDisplayName(u);
        const line = `${roleLabel(u.role)} · ${u.email}`;
        return <SlipRow key={u.id} testID={`admin-user-${u.id}`} lead={userInitials(name)} leadTone={u.isActive ? undefined : "dim"} title={name}
          word={u.isActive ? undefined : t.locked} wordTone="warn" line={line} a11y={[name, u.isActive ? "" : t.locked, line].filter(Boolean).join(", ")}
          last={k === list.items.length - 1} onPress={() => router.push({ pathname: ADMIN_USER_PAGE, params: { id: u.id } } as never)}/>;
      })}
    </StaggerList> : null}
    {list.hasNext ? <Pressable accessibilityRole="button" onPress={list.loadMore} disabled={list.loadingMore} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
      {list.loadingMore ? <ActivityIndicator color={c.lotus}/> : <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{t.more}</Text>}
    </Pressable> : null}
  </RolePage>;
}
