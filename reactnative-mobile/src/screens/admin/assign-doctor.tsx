import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import {
  assignFighterDoctor,
  listFighterDoctors,
  listFighters,
  listUsers,
  type DoctorAssignment,
  type PublicFighter,
  type PublicUser,
} from "@/api";
import { Icon, IconBadge } from "@/components/icon";
import { FadeInView, hapticSuccess, PressableScale, SkeletonList } from "@/components/motion";
import { useToastMessage } from "@/components/toast/app-toast";
import { manager } from "@/i18n/manager";
import { vi } from "@/i18n/vi";
import { useAdminType } from "@/screens/admin/admin-page";
import {
  AdminButton,
  AdminCard,
  AdminChoiceList,
  AdminField,
  AdminNotice,
  AdminScreen,
  AdminSection,
} from "@/screens/admin/admin-ui";
import { mapApiMessage } from "@/session/map-api-message";
import { radius, spacing, useThemePreference } from "@/theme";

const t = manager.doctor;

function profileId(user: PublicUser): string | null {
  return user.profile && typeof user.profile.id === "string" ? user.profile.id : null;
}

function displayName(user: PublicUser): string {
  const profile = user.profile;
  if (profile && "firstName" in profile) return `${profile.lastName} ${profile.firstName}`.trim();
  return user.email;
}

function fighterName(row: PublicFighter): string {
  return `${row.lastName} ${row.firstName}`.trim();
}

/** Figma "Manager · Phân công bác sĩ" (+ "Đã có bác sĩ", "Hoàn tất"). */
export function AssignDoctorScreen() {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const router = useRouter();
  const params = useLocalSearchParams<{ fighterId?: string; applicationId?: string }>();
  const initialFighterId = typeof params.fighterId === "string" ? params.fighterId : "";
  const applicationId = typeof params.applicationId === "string" ? params.applicationId : "";
  const [fighters, setFighters] = useState<PublicFighter[]>([]);
  const [doctors, setDoctors] = useState<PublicUser[]>([]);
  const [fighterId, setFighterId] = useState(initialFighterId);
  const [pickerOpen, setPickerOpen] = useState(!initialFighterId);
  const [doctorId, setDoctorId] = useState("");
  const [assignments, setAssignments] = useState<DoctorAssignment[] | null>(null);
  const [done, setDone] = useState<{ fighter: string; doctor: PublicUser | null } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useToastMessage(error, "error");

  const loadAssignments = useCallback((id: string) => {
    if (!id) {
      setAssignments(null);
      return;
    }
    setAssignments(null);
    void listFighterDoctors(id, { page: 1, limit: 20 })
      .then((page) => setAssignments(page.data))
      .catch((cause: unknown) => {
        setAssignments([]);
        setError(mapApiMessage(cause));
      });
  }, []);

  useEffect(() => {
    void listFighters({ page: 1, limit: 50 })
      .then((page) => setFighters(page.data))
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
    void listUsers({ role: "DOCTOR", status: "ACTIVE", page: 1, limit: 100 })
      .then((page) => setDoctors(page.items.filter((row) => profileId(row))))
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
  }, []);

  useEffect(() => {
    loadAssignments(fighterId);
  }, [fighterId, loadAssignments]);

  const fighter = fighters.find((row) => row.id === fighterId) ?? null;
  const active = assignments?.find((row) => row.endsAt == null) ?? null;
  const activeDoctor = active ? doctors.find((row) => profileId(row) === active.doctorId) ?? null : null;

  const onAssign = () => {
    if (busy || !fighterId || !doctorId || active) return;
    setBusy(true);
    setError("");
    void assignFighterDoctor(fighterId, doctorId)
      .then(() => {
        hapticSuccess();
        setDone({
          fighter: fighter ? fighterName(fighter) : fighterId,
          doctor: doctors.find((row) => profileId(row) === doctorId) ?? null,
        });
      })
      .catch((cause: unknown) => {
        setError(mapApiMessage(cause));
        loadAssignments(fighterId);
      })
      .finally(() => setBusy(false));
  };

  const pickOther = () => {
    setFighterId("");
    setDoctorId("");
    setDone(null);
    setPickerOpen(true);
  };

  if (done) {
    return (
      <AdminScreen
        title={t.title}
        footer={
          <>
            {applicationId ? (
              <AdminButton title={t.backToDetail} onPress={() => router.replace(`/quan-tri/nhap-hoc/${applicationId}` as Href)} />
            ) : (
              <AdminButton title={t.otherFighter} onPress={pickOther} />
            )}
            <AdminButton title={manager.backHome} variant="outline" onPress={() => router.replace("/(admin)" as Href)} />
          </>
        }
      >
        <FadeInView style={styles.doneHead}>
          <IconBadge name="success" size={28} tone="success" style={styles.doneBadge} />
          <Text accessibilityRole="header" style={[at.name, { color: colors.ink }]}>{t.doneTitle}</Text>
          <Text style={[at.body, { color: colors.inkMuted }]}>{t.doneBody}</Text>
        </FadeInView>
        <AdminSection title={t.doneInfo}>
          <AdminCard>
            <AdminField label={manager.doctor.fighterSection} value={done.fighter} />
            <AdminField label={t.currentDoctor} value={done.doctor ? displayName(done.doctor) : doctorId} />
            {done.doctor ? <AdminField label={t.doctorEmail} value={done.doctor.email} /> : null}
          </AdminCard>
          <AdminNotice icon="stethoscope" title={t.doneNoteTitle} body={t.doneNoteBody} />
        </AdminSection>
      </AdminScreen>
    );
  }

  return (
    <AdminScreen
      title={t.title}
      footer={
        active ? (
          <AdminButton title={t.otherFighter} variant="outline" onPress={pickOther} />
        ) : (
          <AdminButton title={t.cta} loading={busy} disabled={!fighterId || !doctorId || assignments == null} onPress={onAssign} />
        )
      }
    >
      <Text style={[at.body, { color: colors.inkMuted }]}>{t.lead}</Text>

      <AdminSection title={t.fighterSection}>
        <Text style={[at.metaStrong, { color: colors.ink }]}>{t.fighterLabel}</Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${t.fighterLabel}: ${fighter ? fighterName(fighter) : t.fighterPlaceholder}`}
          accessibilityState={{ expanded: pickerOpen }}
          onPress={() => setPickerOpen((open) => !open)}
          style={[styles.select, { backgroundColor: colors.surfaceMuted, borderColor: colors.line }]}
        >
          <Text style={[at.body, styles.flex, { color: fighter ? colors.ink : colors.inkSubtle }]} numberOfLines={1}>
            {fighter ? fighterName(fighter) : t.fighterPlaceholder}
          </Text>
          <Icon name="chevronDown" size={20} tone="muted" />
        </PressableScale>
        {pickerOpen ? (
          fighters.length === 0 ? (
            <SkeletonList rows={2} height={56} />
          ) : (
            <AdminChoiceList
              value={fighterId}
              onChange={(id) => {
                setFighterId(id);
                setDoctorId("");
                setPickerOpen(false);
              }}
              options={fighters.map((row) => ({ id: row.id, title: fighterName(row), subtitle: vi.weightClass[row.weightClass] ?? row.weightClass }))}
            />
          )
        ) : null}
        {fighterId && assignments == null ? <SkeletonList rows={1} height={56} /> : null}
        {fighterId && assignments && !active ? <AdminNotice icon="me" body={t.noDoctorYet} /> : null}
        {active ? <AdminNotice icon="stethoscope" title={t.hasDoctorTitle} body={t.hasDoctorBody} /> : null}
      </AdminSection>

      {active ? (
        <>
          <AdminSection title={t.currentDoctor}>
            <AdminCard>
              <AdminField label={t.doctor} value={active.doctorName ?? (activeDoctor ? displayName(activeDoctor) : active.doctorId)} />
              {activeDoctor ? <AdminField label={t.email} value={activeDoctor.email} /> : null}
              <AdminField label={t.assignment} value={t.active} />
            </AdminCard>
          </AdminSection>
          <AdminButton title={t.cta} disabled onPress={() => undefined} />
          <Text style={[at.meta, { color: colors.inkMuted }]}>{t.pickOther}</Text>
        </>
      ) : fighterId && assignments ? (
        <>
          <AdminSection title={t.doctorSection} hint={t.doctorHint}>
            {doctors.length === 0 ? (
              <Text style={[at.meta, { color: colors.inkMuted }]}>{t.noDoctors}</Text>
            ) : (
              <AdminChoiceList
                value={doctorId}
                onChange={setDoctorId}
                options={doctors.map((row) => ({ id: profileId(row) ?? row.id, title: displayName(row), subtitle: row.email }))}
              />
            )}
          </AdminSection>
          <AdminNotice icon="stethoscope" title={t.baselineTitle} body={t.baselineBody} />
        </>
      ) : null}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  select: {
    minHeight: 52,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  doneHead: { gap: spacing.md, paddingTop: spacing.lg },
  doneBadge: { width: 64, height: 64, borderRadius: radius.panel },
});
