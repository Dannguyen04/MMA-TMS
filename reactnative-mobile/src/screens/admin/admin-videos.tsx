import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { deleteVideo, listVideos, VIDEO_TRAINING_TYPES, type VideoRecord, type VideoTrainingType } from "@/api/media";
import { confirmDestructive } from "@/components/confirm";
import { Icon } from "@/components/icon";
import { FadeInView, hapticSuccess, PressableScale, SkeletonList } from "@/components/motion";
import { StateView } from "@/components/state-view";
import { useToastMessage } from "@/components/toast/app-toast";
import { manager } from "@/i18n/manager";
import { states } from "@/i18n/unavailable";
import { formatDay } from "@/screens/admin/admin-applications";
import { useAdminType } from "@/screens/admin/admin-page";
import { AdminButton, AdminInput, AdminScreen, AdminTag } from "@/screens/admin/admin-ui";
import { mapApiMessage } from "@/session/map-api-message";
import { radius, spacing, useThemePreference } from "@/theme";
import { FilterSelect } from "@/components/filter-sheet";
import { SkeletonFooter } from "@/components/loading";

const t = manager.videos;
type TypeFilter = "ALL" | VideoTrainingType;
const TYPE_FILTERS: readonly { value: TypeFilter; label: string }[] = [
  { value: "ALL", label: t.typeAll },
  ...VIDEO_TRAINING_TYPES.map((value) => ({ value: value as TypeFilter, label: t.types[value] })),
];

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Video hệ thống — GET /videos (cursor) + DELETE /videos/:id, quyền ADMIN. */
export function AdminVideosScreen() {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const [type, setType] = useState<TypeFilter>("ALL");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<VideoRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useToastMessage(error, "error");
  useToastMessage(notice, "success");

  useEffect(() => {
    const handle = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const load = useCallback(
    (after: string | null, mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setError("");
      if (!after && mode === "initial") setLoaded(false);
      if (after) setLoadingMore(true);
      return listVideos({
        limit: 20,
        ...(type === "ALL" ? {} : { trainingType: type }),
        ...(query ? { search: query.slice(0, 200) } : {}),
        ...(after ? { cursor: after } : {}),
      })
        .then((page) => {
          setItems((current) => (after ? [...current, ...page.items] : page.items));
          setTotal(page.total);
          setCursor(page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null);
          setLoaded(true);
        })
        .catch((cause: unknown) => {
          setLoaded(true);
          if (mode === "refresh") throw cause;
          setError(mapApiMessage(cause));
        })
        .finally(() => setLoadingMore(false));
    },
    [type, query],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const remove = (video: VideoRecord) => {
    void confirmDestructive({ title: t.deleteTitle, message: t.deleteBody(video.title), confirmLabel: t.delete, cancelLabel: t.cancel }).then((ok) => {
      if (!ok) return;
      setBusyId(video.id);
      void deleteVideo(video.id)
        .then(() => {
          hapticSuccess();
          setNotice(t.deleted);
          setItems((current) => current.filter((row) => row.id !== video.id));
          setTotal((n) => Math.max(0, n - 1));
        })
        .catch((cause: unknown) => setError(mapApiMessage(cause)))
        .finally(() => setBusyId(null));
    });
  };

  return (
    <AdminScreen title={t.title} onRefresh={() => load(null, "refresh")}>
      <View style={styles.lead}>
        <Text style={[at.section, { color: colors.ink }]}>{loaded && !error ? t.count(total) : t.title}</Text>
        <AdminInput label={t.searchLabel} value={search} onChangeText={setSearch} placeholder={t.search} returnKeyType="search" maxLength={200} />
      </View>
      <FilterSelect label="Loại video" options={TYPE_FILTERS} value={type} allValue="ALL" onChange={setType} />
      {!loaded ? <SkeletonList rows={4} height={96} /> : null}
      {loaded && error && items.length === 0 ? (
        <StateView kind="error" title={states.loadFailed} description={error} actionLabel={states.retry} onAction={() => load(null)} compact />
      ) : null}
      {loaded && !error && items.length === 0 ? <StateView kind="empty" title={t.empty} compact /> : null}
      {loaded && items.length > 0 ? (
        <View style={styles.list}>
          {items.map((video, index) => (
            <FadeInView key={video.id} index={index}>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <View accessible accessibilityLabel={video.title} style={styles.cardMain}>
                  <View style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]}>
                    <Icon name="film" size={22} tone="accent" />
                  </View>
                  <View style={styles.body}>
                    <Text style={[at.rowTitle, { color: colors.ink }]} numberOfLines={2}>{video.title}</Text>
                    <Text style={[at.meta, { color: colors.inkMuted }]} numberOfLines={1}>
                      {formatDay(video.createdAt)} · {formatDuration(video.durationMs)} · {formatBytes(video.fileSizeBytes)}
                    </Text>
                    <View style={styles.tags}>
                      <AdminTag label={t.types[video.trainingType as VideoTrainingType] ?? video.trainingType} />
                      <AdminTag label={t.angles[video.cameraAngle as keyof typeof t.angles] ?? video.cameraAngle} />
                    </View>
                  </View>
                </View>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`${t.delete}: ${video.title}`}
                  disabled={busyId === video.id}
                  onPress={() => remove(video)}
                  hitSlop={6}
                  style={[styles.trash, { borderColor: colors.line }]}
                >
                  <Icon name="trash" size={20} tone={busyId === video.id ? "muted" : "danger"} />
                </PressableScale>
              </View>
            </FadeInView>
          ))}
          <SkeletonFooter active={loadingMore} />
          {cursor && !loadingMore ? <AdminButton title={t.loadMore} variant="outline" onPress={() => void load(cursor)} /> : null}
        </View>
      ) : null}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  lead: { gap: spacing.md },
  list: { gap: spacing.md },
  card: { flexDirection: "row", alignItems: "center", borderRadius: radius.field, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: spacing.md },
  cardMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: radius.field, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 4 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  trash: { width: 44, height: 44, borderRadius: radius.field, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
});
