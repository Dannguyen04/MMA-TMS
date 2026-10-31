import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { isApiError } from "@/api";
import { listAnalysisJobs, listVideos, type AnalysisJob, type VideoRecord } from "@/api/media";
import { useToastMessage } from "@/components/toast/app-toast";
import { media } from "@/i18n/media";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import {
  formatVideoDate,
  jobForVideo,
  libraryPhase,
  listBadge,
  listMeta,
  videoCountLabel,
  visibleScore,
} from "@/screens/media/video-model";
import { useTypography } from "@/theme";
import { SkeletonRows } from "@/components/loading";

function messageFor(error: unknown): string {
  if (!isApiError(error)) return media.generic;
  if (error.status === 0 || error.code === "NETWORK_ERROR") return media.network;
  if (error.status === 403) return media.forbidden;
  if (error.status === 404) return media.notFound;
  return media.generic;
}

function StatusBadge({ label, tone }: { label: string; tone: "success" | "danger" | "neutral" }) {
  const colors = useFighterPalette();
  const background =
    tone === "success" ? colors.successSoft : tone === "danger" ? colors.warningSoft : colors.surface2;
  const ink = tone === "success" ? colors.success : tone === "danger" ? colors.warning : colors.muted;
  const icon = tone === "success" ? "checkmark-circle" : tone === "danger" ? "close-circle" : "ellipse-outline";
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Ionicons name={icon} size={13} color={ink} />
      <Text style={[styles.badgeText, { color: ink }]}>{label}</Text>
    </View>
  );
}

export function VideoLibraryContent({
  fighterId,
  onOpen,
  onUpload,
}: {
  fighterId?: string;
  onOpen: (videoId: string) => void;
  onUpload?: () => void;
}) {
  const colors = useFighterPalette();
  const live = useTypography();
  const [items, setItems] = useState<VideoRecord[] | null>(null);
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void Promise.all([listVideos({ fighterId, limit: 50 }), listAnalysisJobs()])
      .then(([page, jobRows]) => {
        if (cancelled) return;
        setItems(page.items);
        setJobs(jobRows);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setItems(null);
        setError(messageFor(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fighterId]);

  useFocusEffect(
    useCallback(() => {
      const stop = load();
      return () => {
        stop?.();
      };
    }, [load]),
  );

  const phase = libraryPhase({ loading, error, items });

  return (
    <View style={styles.list}>
      {onUpload ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={media.upload}
          onPress={onUpload}
          style={[styles.upload, { backgroundColor: colors.accent }]}
        >
          <Ionicons name="cloud-upload-outline" size={20} color={colors.onAccent} />
          <Text style={[styles.uploadLabel, { color: colors.onAccent, fontFamily: live.faces.semibold }]}>
            {media.upload}
          </Text>
        </Pressable>
      ) : null}

      {phase === "loading" ? <SkeletonRows rows={4} /> : null}

      {phase === "error" ? (
        <Pressable accessibilityRole="button" accessibilityLabel={media.retry} onPress={load}>
          <Text style={{ color: colors.accent, fontWeight: "700" }}>{media.retry}</Text>
        </Pressable>
      ) : null}

      {phase === "empty" ? <Text style={{ color: colors.muted }}>{media.emptyVideos}</Text> : null}

      {phase === "data" && items ? (
        <View style={styles.group}>
          <View style={styles.heading}>
            <Text style={[styles.headingTitle, { color: colors.ink, fontFamily: live.faces.semibold }]}>
              {media.yourVideos}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{videoCountLabel(items.length)}</Text>
          </View>
          {items.map((video) => {
            const job = jobForVideo(jobs, video.id);
            const badge = listBadge(video.status, job);
            const score = visibleScore(job?.score);
            const when = formatVideoDate(video.createdAt);
            return (
              <Pressable
                key={video.id}
                testID={`video-row-${video.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${video.title}, ${when}, ${listMeta(video)}, ${badge.label}${score == null ? "" : `, ${media.score} ${score}`}`}
                onPress={() => onOpen(video.id)}
                style={[styles.card, { borderColor: colors.line, backgroundColor: colors.surface }]}
              >
                <View style={styles.identity}>
                  <View style={[styles.tile, { backgroundColor: colors.bg }]}>
                    <Ionicons name="film-outline" size={24} color={colors.muted} accessibilityElementsHidden />
                  </View>
                  <View style={styles.identityText}>
                    <Text style={[styles.cardTitle, { color: colors.ink, fontFamily: live.faces.semibold }]}>
                      {video.title}
                    </Text>
                    {when ? <Text style={[styles.date, { color: colors.muted }]}>{when}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </View>
                <View style={styles.metaRow}>
                  <Text style={[styles.meta, { color: colors.muted }]}>{listMeta(video)}</Text>
                  <View style={styles.result}>
                    <StatusBadge label={badge.label} tone={badge.tone} />
                    {score != null ? (
                      <Text style={[styles.score, { color: colors.accent }]}>
                        {media.score} {score}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
        <Text style={[styles.noteText, { color: colors.muted }]}>{media.liveLimit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 20, paddingTop: 12 },
  upload: {
    minHeight: 50,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  uploadLabel: { fontSize: 15 },
  centerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  group: { gap: 12 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headingTitle: { fontSize: 16, flexShrink: 1 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  identity: { flexDirection: "row", alignItems: "center", gap: 12 },
  tile: { width: 54, height: 54, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  identityText: { flex: 1, gap: 4, minWidth: 0 },
  cardTitle: { fontSize: 16 },
  date: { fontSize: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  meta: { fontSize: 12, flexShrink: 1 },
  result: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: "600" },
  score: { fontSize: 12, fontWeight: "600" },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
