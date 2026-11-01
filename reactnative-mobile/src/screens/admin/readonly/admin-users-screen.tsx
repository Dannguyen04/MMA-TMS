import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { adminApi } from "@/api/admin";
import { USER_ROLES, type UserRole } from "@/api/types";

type StatusFilter = "ACTIVE" | "INACTIVE" | "";
import { FilterSelect, type FilterOption } from "@/components/filter-sheet";
import { adminRo } from "@/i18n/admin-ro";
import { ActionButton, ConnectionBanner, MessageCard, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { Avatar, LoadMore, RoRow, RoScreen, RowSkeletons, SearchBar, Stack, useGo } from "@/screens/coach/readonly/ro-ui";
import { useCoachEnabled, useDebounced } from "@/screens/coach/readonly/use-coach";
import { usePagedList } from "@/screens/coach/readonly/use-paged-list";
import { roleLabel, statusChip, toPaginated, userDisplayName } from "./admin-format";

/** A-2: danh sách người dùng (chỉ đọc), tìm kiếm + lọc vai trò bằng bottom sheet. */
export function AdminUsersListScreen() {
  const enabled = useCoachEnabled();
  const go = useGo();
  const p = useFighterPalette();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [status, setStatus] = useState<StatusFilter>("");
  const chipRow = useRef<ScrollView>(null);
  const q = useDebounced(search.trim(), 400);
  const params = useLocalSearchParams<{ role?: string; status?: string; t?: string }>();

  // Tổng quan mở danh sách với vai trò / trạng thái đặt sẵn (mỗi lần bấm có `t` mới).
  useEffect(() => {
    if (params.t === undefined) return;
    setSearch("");
    setRole(params.role && (USER_ROLES as readonly string[]).includes(params.role) ? (params.role as UserRole) : "");
    const next: StatusFilter = params.status === "ACTIVE" || params.status === "INACTIVE" ? params.status : "";
    setStatus(next);
    requestAnimationFrame(() => (next ? chipRow.current?.scrollToEnd({ animated: false }) : chipRow.current?.scrollTo({ x: 0, animated: false })));
  }, [params.t, params.role, params.status]);

  const list = usePagedList(enabled, `u|${q}|${role}|${status}`, (page) =>
    adminApi.listUsers({ page, limit: 20, search: q || undefined, role: role || undefined, status: status || undefined }).then(toPaginated),
  );
  const statusOptions = useMemo<FilterOption<StatusFilter>[]>(
    () => [
      { value: "", label: adminRo.users.allStatuses },
      { value: "ACTIVE", label: adminRo.active },
      { value: "INACTIVE", label: adminRo.users.locked },
    ],
    [],
  );
  const options = useMemo<FilterOption<UserRole | "">[]>(
    () => [{ value: "", label: adminRo.users.allRoles }, ...USER_ROLES.map((r) => ({ value: r, label: roleLabel(r) }))],
    [],
  );
  const firstLoad = !list.loaded || (list.loading && list.items.length === 0 && !list.error);
  const skeleton = useDelayedFlag(firstLoad);
  const filtered = Boolean(q || role || status);
  const empty = list.loaded && !list.loading && !list.error && list.items.length === 0;

  return (
    <RoScreen title={adminRo.users.title} onRefresh={list.refresh} refreshing={list.loading && list.items.length === 0}>
      <Stack>
        <SearchBar value={search} onChangeText={setSearch} placeholder={adminRo.users.search} />
        <ScrollView ref={chipRow} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipRow}>
          <FilterSelect mutedColor={p.filterMuted} label={adminRo.users.roleFilter} value={role} onChange={setRole} options={options} allValue="" style={styles.chip} />
          <FilterSelect mutedColor={p.filterMuted} label={adminRo.users.statusFilter} value={status} onChange={setStatus} options={statusOptions} allValue="" style={styles.chip} />
        </ScrollView>
        {list.error ? (
          <ConnectionBanner error={list.error} onRetry={() => void list.reload()} retrying={list.loading} hasData={list.items.length > 0} />
        ) : null}
        {firstLoad && !list.error && skeleton ? <RowSkeletons count={5} height={96} /> : null}
        {empty ? (
          <MessageCard
            icon="fighters"
            title={filtered ? adminRo.users.emptyFilteredTitle : adminRo.users.emptyTitle}
            description={filtered ? adminRo.users.emptyFilteredDesc : adminRo.users.emptyDesc}
          >
            {filtered ? (
              <ActionButton
                label={adminRo.users.clear}
                variant="secondary"
                icon="close"
                onPress={() => {
                  setSearch("");
                  setRole("");
                  setStatus("");
                }}
              />
            ) : null}
          </MessageCard>
        ) : null}
        {list.items.length > 0 ? (
          <Stack>
            {list.items.map((u) => {
              const name = userDisplayName(u);
              return (
                <RoRow
                  key={u.id}
                  leading={<Avatar name={name} uri={u.profile?.profileImageUrl} />}
                  title={name}
                  lines={[u.email, adminRo.users.roleLine(roleLabel(u.role))]}
                  chip={statusChip(u)}
                  onPress={() => go("/(admin)/nguoi-dung/chi-tiet", u.id)}
                />
              );
            })}
            {list.hasNext ? <LoadMore onPress={list.loadMore} loading={list.loadingMore} /> : null}
          </Stack>
        ) : null}
      </Stack>
    </RoScreen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexGrow: 0 },
  chips: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2, paddingRight: 16 },
  chip: { minHeight: 48, height: 48, maxWidth: 360 },
});
