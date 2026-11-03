import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, StyleSheet, Switch, Text, View } from "react-native";

import {
  createUser,
  deleteUser,
  isFighterProfile,
  listUsers,
  updateUser,
  type CreateUserInput,
  type PublicUser,
  type UpdateUserInput,
  type UserRole,
} from "@/api";
import { WEIGHT_CLASSES, type WeightClass } from "@/constants/weight-classes";
import { confirmDestructive } from "@/components/confirm";
import { Icon } from "@/components/icon";
import { FadeInView, hapticSuccess, PressableScale, SkeletonList } from "@/components/motion";
import { StateView } from "@/components/state-view";
import { useToastMessage } from "@/components/toast/app-toast";
import { manager } from "@/i18n/manager";
import { states } from "@/i18n/unavailable";
import { vi } from "@/i18n/vi";
import { formatDay } from "@/screens/admin/admin-applications";
import { useAdminType } from "@/screens/admin/admin-page";
import {
  AdminButton,
  AdminButtonRow,
  AdminCard,
  AdminField,
  AdminInput,
  AdminNotice,
  AdminScreen,
  AdminSection,
  AdminSegments,
  AdminTag,
  Initials,
} from "@/screens/admin/admin-ui";
import { mapApiMessage } from "@/session/map-api-message";
import { spacing, useThemePreference } from "@/theme";
import { FilterSelect } from "@/components/filter-sheet";
import { SkeletonFooter } from "@/components/loading";

const t = manager.users;
const PAGE = 20;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type RoleFilter = "ALL" | UserRole;
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type EditableRole = "FIGHTER" | "COACH" | "DOCTOR";
type CreatableRole = EditableRole | "ADMIN";

const ROLE_FILTERS: readonly { value: RoleFilter; label: string }[] = [
  { value: "ALL", label: t.roleAll },
  { value: "FIGHTER", label: t.roles.FIGHTER },
  { value: "COACH", label: t.roles.COACH },
  { value: "DOCTOR", label: t.roles.DOCTOR },
  { value: "ADMIN", label: t.roles.ADMIN },
  { value: "GUEST", label: t.roles.GUEST },
];
const STATUS_FILTERS: readonly { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: t.statusAll },
  { value: "ACTIVE", label: t.active },
  { value: "INACTIVE", label: t.inactive },
];
const CREATE_ROLES: readonly { value: CreatableRole; label: string }[] = [
  { value: "FIGHTER", label: t.roles.FIGHTER },
  { value: "COACH", label: t.roles.COACH },
  { value: "DOCTOR", label: t.roles.DOCTOR },
  { value: "ADMIN", label: t.roles.ADMIN },
];
const WEIGHT_OPTIONS = WEIGHT_CLASSES.map((value) => ({ value, label: vi.weightClass[value] }));

export function userDisplayName(user: PublicUser): string {
  const p = user.profile;
  return p && "firstName" in p ? `${p.lastName} ${p.firstName}`.trim() : user.email;
}

export function isActiveUser(user: Pick<PublicUser, "isActive" | "deletedAt">): boolean {
  return user.isActive && !user.deletedAt;
}

/** Form hồ sơ: chuỗi rỗng = không nhập. */
type Draft = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  weightClass: WeightClass;
  nationality: string;
  gym: string;
  specialization: string;
  licenseNumber: string;
  isHeadCoach: boolean;
};

function draftFrom(user: PublicUser | null): Draft {
  const p = user?.profile ?? null;
  const fighter = p && isFighterProfile(p) ? p : null;
  const named = p && !fighter ? p : null;
  return {
    firstName: p?.firstName ?? "",
    lastName: p?.lastName ?? "",
    dateOfBirth: fighter?.dateOfBirth ?? "",
    weightClass: fighter?.weightClass ?? "LIGHTWEIGHT",
    nationality: fighter?.nationality ?? "",
    gym: fighter?.gym ?? "",
    specialization: (named && "specialization" in named ? named.specialization : null) ?? "",
    licenseNumber: (named && "licenseNumber" in named ? named.licenseNumber : undefined) ?? "",
    isHeadCoach: named && "isHeadCoach" in named ? named.isHeadCoach === true : false,
  };
}

const opt = (value: string) => (value.trim() ? value.trim() : null);

/** Chỉ gửi trường đã đổi (updateUserSchema yêu cầu partial khác rỗng). */
export function buildUpdate(role: EditableRole, before: Draft, after: Draft): UpdateUserInput | null {
  const changed = <K extends keyof Draft>(key: K) => before[key] !== after[key];
  const base: Record<string, unknown> = {};
  if (changed("firstName")) base.firstName = after.firstName.trim();
  if (changed("lastName")) base.lastName = after.lastName.trim();
  if (role === "FIGHTER") {
    if (changed("dateOfBirth")) base.dateOfBirth = after.dateOfBirth.trim();
    if (changed("weightClass")) base.weightClass = after.weightClass;
    if (changed("nationality")) base.nationality = opt(after.nationality);
    if (changed("gym")) base.gym = opt(after.gym);
  } else {
    if (changed("specialization")) base.specialization = opt(after.specialization);
    if (role === "COACH" && changed("isHeadCoach")) base.isHeadCoach = after.isHeadCoach;
    if (role === "DOCTOR" && changed("licenseNumber")) base.licenseNumber = after.licenseNumber.trim();
  }
  if (Object.keys(base).length === 0) return null;
  return { role, profile: base } as UpdateUserInput;
}

/** Kiểm tra trường bắt buộc theo vai trò; trả về thông báo lỗi hoặc null. */
export function validateDraft(role: CreatableRole, draft: Draft): string | null {
  if (role === "ADMIN") return null;
  if (!draft.firstName.trim() || !draft.lastName.trim()) return t.required;
  if (role === "FIGHTER" && !DATE_RE.test(draft.dateOfBirth.trim())) return t.dobInvalid;
  if (role === "DOCTOR" && !draft.licenseNumber.trim()) return t.required;
  return null;
}

export function buildCreate(role: CreatableRole, email: string, password: string, d: Draft): CreateUserInput {
  const creds = { email: email.trim(), password };
  if (role === "ADMIN") return { ...creds, role };
  const names = { firstName: d.firstName.trim(), lastName: d.lastName.trim() };
  if (role === "FIGHTER") {
    return {
      ...creds,
      role,
      profile: {
        ...names,
        dateOfBirth: d.dateOfBirth.trim(),
        weightClass: d.weightClass,
        ...(opt(d.nationality) ? { nationality: opt(d.nationality) } : {}),
        ...(opt(d.gym) ? { gym: opt(d.gym) } : {}),
      },
    };
  }
  if (role === "COACH") {
    return { ...creds, role, profile: { ...names, isHeadCoach: d.isHeadCoach, ...(opt(d.specialization) ? { specialization: opt(d.specialization) } : {}) } };
  }
  return {
    ...creds,
    role,
    profile: { ...names, licenseNumber: d.licenseNumber.trim(), ...(opt(d.specialization) ? { specialization: opt(d.specialization) } : {}) },
  };
}

function ProfileFields({ role, draft, onChange }: { role: CreatableRole; draft: Draft; onChange: (next: Draft) => void }) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  if (role === "ADMIN") return null;
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  return (
    <>
      <AdminInput label={`${t.lastName} *`} value={draft.lastName} onChangeText={(lastName) => set({ lastName })} maxLength={100} />
      <AdminInput label={`${t.firstName} *`} value={draft.firstName} onChangeText={(firstName) => set({ firstName })} maxLength={100} />
      {role === "FIGHTER" ? (
        <>
          <AdminInput
            label={`${t.dob} *`}
            value={draft.dateOfBirth}
            onChangeText={(dateOfBirth) => set({ dateOfBirth })}
            placeholder="2000-01-31"
            autoCapitalize="none"
            maxLength={10}
          />
          <Text style={[at.metaStrong, { color: colors.ink }]}>{`${t.weightClass} *`}</Text>
          <AdminSegments options={WEIGHT_OPTIONS} value={draft.weightClass} onChange={(weightClass) => set({ weightClass })} scroll />
          <AdminInput label={t.nationality} value={draft.nationality} onChangeText={(nationality) => set({ nationality })} maxLength={100} />
          <AdminInput label={t.gym} value={draft.gym} onChangeText={(gym) => set({ gym })} maxLength={200} />
        </>
      ) : null}
      {role === "DOCTOR" ? (
        <AdminInput label={`${t.license} *`} value={draft.licenseNumber} onChangeText={(licenseNumber) => set({ licenseNumber })} maxLength={100} autoCapitalize="characters" />
      ) : null}
      {role === "COACH" || role === "DOCTOR" ? (
        <AdminInput label={t.specialization} value={draft.specialization} onChangeText={(specialization) => set({ specialization })} maxLength={200} />
      ) : null}
      {role === "COACH" ? (
        <View style={styles.switchRow}>
          <Text style={[at.body, styles.flex, { color: colors.ink }]}>{t.headCoach}</Text>
          <Switch
            accessibilityLabel={t.headCoach}
            value={draft.isHeadCoach}
            onValueChange={(isHeadCoach) => set({ isHeadCoach })}
            trackColor={{ true: colors.cta, false: colors.surfaceMuted }}
          />
        </View>
      ) : null}
    </>
  );
}

function UserDetail({ user, onClose, onChanged }: { user: PublicUser; onClose: () => void; onChanged: (next: PublicUser | null) => void }) {
  const original = useMemo(() => draftFrom(user), [user]);
  const [draft, setDraft] = useState(original);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useToastMessage(error, "error");
  useToastMessage(notice, "success");
  const editable = (user.role === "FIGHTER" || user.role === "COACH" || user.role === "DOCTOR") && user.profile != null;
  const deleted = !!user.deletedAt;

  const save = () => {
    if (!editable || busy) return;
    const role = user.role as EditableRole;
    const invalid = validateDraft(role, draft);
    if (invalid) return setError(invalid);
    const body = buildUpdate(role, original, draft);
    if (!body) return setError(t.noChange);
    setBusy(true);
    setError("");
    void updateUser(user.id, body)
      .then((next) => {
        hapticSuccess();
        setNotice(t.saved);
        onChanged(next);
      })
      .catch((cause: unknown) => setError(mapApiMessage(cause)))
      .finally(() => setBusy(false));
  };

  const remove = () => {
    void confirmDestructive({ title: t.deleteTitle, message: t.deleteBody(user.email), confirmLabel: t.delete, cancelLabel: t.cancel }).then((ok) => {
      if (!ok) return;
      setBusy(true);
      void deleteUser(user.id)
        .then(() => {
          setNotice(t.deleted);
          onChanged(null);
        })
        .catch((cause: unknown) => setError(mapApiMessage(cause)))
        .finally(() => setBusy(false));
    });
  };

  return (
    <AdminScreen
      title={userDisplayName(user)}
      onBackPress={onClose}
      footer={
        deleted ? null : (
          <AdminButtonRow>
            <AdminButton title={t.delete} icon="trash" variant="danger" disabled={busy} onPress={remove} />
            {editable ? <AdminButton title={t.save} loading={busy} onPress={save} /> : null}
          </AdminButtonRow>
        )
      }
    >
      <View style={styles.tags}>
        <AdminTag label={t.roles[user.role]} tone="accent" />
        <AdminTag label={isActiveUser(user) ? t.active : t.inactive} tone={isActiveUser(user) ? "success" : "danger"} />
      </View>
      <AdminCard>
        <AdminField label={t.email} value={user.email} />
        <AdminField label={t.createdAt} value={formatDay(user.createdAt)} />
        {user.deletedAt ? <AdminField label={t.deletedAt} value={formatDay(user.deletedAt)} /> : null}
      </AdminCard>
      {editable && !deleted ? (
        <AdminSection title={t.edit}>
          <ProfileFields role={user.role as EditableRole} draft={draft} onChange={setDraft} />
        </AdminSection>
      ) : user.role === "ADMIN" ? (
        <AdminNotice icon="info" body={t.adminNoProfile} />
      ) : null}
    </AdminScreen>
  );
}

function UserCreate({ onClose, onCreated }: { onClose: () => void; onCreated: (user: PublicUser) => void }) {
  const [role, setRole] = useState<CreatableRole>("COACH");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState<Draft>(() => draftFrom(null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useToastMessage(error, "error");

  const submit = () => {
    if (busy) return;
    if (!email.trim() || !password) return setError(t.required);
    if (password.length < 8) return setError(t.passwordShort);
    const invalid = validateDraft(role, draft);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError("");
    void createUser(buildCreate(role, email, password, draft))
      .then((user) => {
        hapticSuccess();
        onCreated(user);
      })
      .catch((cause: unknown) => setError(mapApiMessage(cause)))
      .finally(() => setBusy(false));
  };

  return (
    <AdminScreen title={t.add} onBackPress={onClose} footer={<AdminButton title={t.create} icon="userPlus" loading={busy} onPress={submit} />}>
      <AdminSection title={t.role}>
        <AdminSegments options={CREATE_ROLES} value={role} onChange={setRole} />
      </AdminSection>
      <AdminInput label={`${t.email} *`} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="off" maxLength={254} />
      <AdminInput label={`${t.password} *`} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" maxLength={128} placeholder={t.passwordHint} />
      <ProfileFields role={role} draft={draft} onChange={setDraft} />
    </AdminScreen>
  );
}

/** Người dùng — dùng API thật: GET/POST/PATCH/DELETE /users (quyền users.*). */
export function AdminUsersScreen() {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PublicUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PublicUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  useToastMessage(error, "error");
  useToastMessage(notice, "success");

  useEffect(() => {
    const handle = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const load = useCallback(
    (nextPage: number, mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setError("");
      if (nextPage === 1 && mode === "initial") setLoaded(false);
      if (nextPage > 1) setLoadingMore(true);
      return listUsers({
        page: nextPage,
        limit: PAGE,
        ...(role === "ALL" ? {} : { role }),
        ...(status === "ALL" ? {} : { status }),
        ...(query ? { search: query.slice(0, 100) } : {}),
      })
        .then((result) => {
          setItems((current) => (nextPage === 1 ? result.items : [...current, ...result.items]));
          setTotal(result.total);
          setPage(nextPage);
          setLoaded(true);
        })
        .catch((cause: unknown) => {
          setLoaded(true);
          if (mode === "refresh") throw cause;
          setError(mapApiMessage(cause));
        })
        .finally(() => setLoadingMore(false));
    },
    [role, status, query],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const replace = (next: PublicUser | null, id: string) => {
    if (next) {
      setItems((current) => current.map((row) => (row.id === id ? next : row)));
      setSelected(next);
    } else {
      setSelected(null);
      void load(1);
    }
  };

  return (
    <AdminScreen title={t.title} action={{ label: t.addShort, onPress: () => setCreating(true) }} onRefresh={() => load(1, "refresh")}>
      <View style={styles.lead}>
        <Text style={[at.section, { color: colors.ink }]}>{loaded && !error ? t.count(total) : t.title}</Text>
        <AdminInput label={t.searchLabel} value={search} onChangeText={setSearch} placeholder={t.search} autoCapitalize="none" returnKeyType="search" maxLength={100} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <FilterSelect label="Vai trò" options={ROLE_FILTERS} value={role} allValue="ALL" onChange={setRole} />
        <FilterSelect label="Trạng thái" options={STATUS_FILTERS} value={status} allValue="ALL" onChange={setStatus} />
      </View>
      {!loaded ? <SkeletonList rows={5} height={72} /> : null}
      {loaded && error && items.length === 0 ? (
        <StateView kind="error" title={states.loadFailed} description={error} actionLabel={states.retry} onAction={() => load(1)} compact />
      ) : null}
      {loaded && !error && items.length === 0 ? <StateView kind="empty" title={t.empty} compact /> : null}
      {loaded && items.length > 0 ? (
        <View>
          {items.map((user, index) => (
            <FadeInView key={user.id} index={index}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${userDisplayName(user)}, ${t.roles[user.role]}`}
                onPress={() => setSelected(user)}
                scaleTo={0.985}
                style={[styles.row, { borderBottomColor: colors.line }]}
              >
                <Initials name={userDisplayName(user)} />
                <View style={styles.body}>
                  <Text style={[at.rowTitle, { color: colors.ink }]} numberOfLines={1}>{userDisplayName(user)}</Text>
                  <Text style={[at.meta, { color: colors.inkMuted }]} numberOfLines={1}>{user.email}</Text>
                  <View style={styles.tags}>
                    <AdminTag label={t.roles[user.role]} />
                    {!isActiveUser(user) ? <AdminTag label={t.inactive} tone="danger" /> : null}
                  </View>
                </View>
                <Icon name="chevron" size={20} tone="muted" />
              </PressableScale>
            </FadeInView>
          ))}
          <SkeletonFooter active={loadingMore} />
          {items.length < total && !loadingMore ? <AdminButton title={t.loadMore} variant="outline" onPress={() => void load(page + 1)} style={styles.more} /> : null}
        </View>
      ) : null}

      <Modal visible={selected != null} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected ? <UserDetail key={selected.id + selected.updatedAt} user={selected} onClose={() => setSelected(null)} onChanged={(next) => replace(next, selected.id)} /> : null}
      </Modal>
      <Modal visible={creating} animationType="slide" onRequestClose={() => setCreating(false)}>
        {creating ? (
          <UserCreate
            onClose={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              setNotice(t.created);
              load(1);
            }}
          />
        ) : null}
      </Modal>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lead: { gap: spacing.md },
  row: { minHeight: 84, flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { flex: 1, gap: 4 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  switchRow: { flexDirection: "row", alignItems: "center", minHeight: 48 },
  more: { marginTop: spacing.lg },
});
