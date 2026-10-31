import { useCallback } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { videoAiApi } from "@/api/video-ai";
import { Icon } from "@/components/icon";
import { vai } from "@/i18n/video-ai";
import { vnDate } from "@/screens/coach/readonly/ro-format";
import { RoCard, RowSkeletons, StatusChip } from "@/screens/coach/readonly/ro-ui";
import { ActionButton, TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useLoad } from "@/screens/fighter/use-load";

import { useOpenVideo } from "./ai-data";
import { currentStep, durationShort, impairmentRows, jobChip, jointText, latestJobFor, newestFirst, severityChip, trainingText } from "./ai-model";

/** Khung 16:9 nhỏ 96×54: nền surfaceMuted + icon phát (API không có ảnh thu nhỏ). */
export function VideoThumb({ durationMs }: { durationMs?: number | null }) {
  const p = useFighterPalette();
  const d = durationShort(durationMs);
  return (
    <View style={[styles.thumb, { backgroundColor: p.surface2, borderColor: p.line }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Icon name="video" size={24} color={p.ink} />
      {d ? (
        <View style={[styles.thumbTime, { backgroundColor: p.surface }]}>
          <Text style={[TEXT.captionBold, { color: p.ink }]}>{d}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Tiến trình 4 bước; bước hiện tại có vòng xoay. Không phải lỗi → không dùng màu đỏ. */
export function StepProgress({ status }: { status: string }) {
  const p = useFighterPalette();
  const now = currentStep(status);
  return (
    <View style={styles.steps} testID="ai-steps">
      {vai.steps.map((label, i) => {
        const done = i < now;
        const active = i === now;
        const state = done ? vai.stepDone : active ? vai.stepNow : vai.stepNext;
        return (
          <View key={label} style={styles.step} accessible accessibilityLabel={vai.stepA11y(i, label, state)}>
            <View style={[styles.dot, { borderColor: done || active ? p.info : p.line, backgroundColor: done ? p.info : p.surface }]}>
              {done ? <Icon name="check" size={14} color={p.surface} /> : active ? <ActivityIndicator size="small" color={p.info} /> : null}
            </View>
            <Text style={[active ? TEXT.bodyBold : TEXT.body, { color: p.ink, flex: 1 }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Nút chữ "Xem tất cả" cao 48dp. */
export function SeeAll({ onPress, label = vai.seeAll, testID }: { onPress: () => void; label?: string; testID?: string }) {
  const p = useFighterPalette();
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.seeAll, { opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[TEXT.bodyBold, { color: p.link }]}>{label}</Text>
      <Icon name="chevron" size={20} color={p.link} />
    </Pressable>
  );
}

function BlockError({ onRetry, loading }: { onRetry: () => void; loading: boolean }) {
  const p = useFighterPalette();
  return (
    <View style={{ gap: 8 }}>
      <Text style={[TEXT.body, { color: p.ink }]}>Chưa tải được dữ liệu.</Text>
      <ActionButton label={vai.retry} variant="secondary" icon="retry" onPress={onRetry} loading={loading} />
    </View>
  );
}

/** Khối "Video gần đây" ở chi tiết võ sĩ (HLV, Admin): 3 video mới nhất + Xem tất cả. */
export function RecentVideosBlock({ fighterId, enabled, onSeeAll }: { fighterId: string; enabled: boolean; onSeeAll: () => void }) {
  const p = useFighterPalette();
  const open = useOpenVideo();
  const run = useCallback(async () => {
    const [page, jobs] = await Promise.all([videoAiApi.listVideos({ fighterId, limit: 3 }), videoAiApi.listJobs().catch(() => [])]);
    return { items: newestFirst(page.items).slice(0, 3), jobs, more: page.hasNextPage || page.total > 3 };
  }, [fighterId]);
  const load = useLoad(enabled && !!fighterId, `vai-recent|${fighterId}`, run, { keepOnError: true });
  return (
    <RoCard title={vai.recent}>
      {load.loading && !load.data ? <RowSkeletons count={2} height={72} /> : null}
      {load.error && !load.data ? <BlockError onRetry={load.reload} loading={load.loading} /> : null}
      {load.data && load.data.items.length === 0 ? <Text style={[TEXT.body, { color: p.ink }]}>{vai.recentEmpty}</Text> : null}
      {load.data?.items.map((v) => {
        const job = latestJobFor(load.data!.jobs, v.id);
        const meta = [trainingText(v.trainingType), vnDate(v.createdAt)].filter(Boolean).join(" · ");
        const chip = jobChip(job?.status);
        return (
          <Pressable
            key={v.id}
            accessibilityRole="button"
            accessibilityLabel={[v.title || vai.untitled, meta, chip.label].join(", ")}
            onPress={() => open(v.id, job?.id)}
            style={({ pressed }) => [styles.mini, { opacity: pressed ? 0.85 : 1 }]}
          >
            <VideoThumb durationMs={v.durationMs} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[TEXT.bodyBold, { color: p.ink }]} numberOfLines={2}>
                {v.title || vai.untitled}
              </Text>
              {meta ? <Text style={[TEXT.detail, { color: p.ink }]}>{meta}</Text> : null}
              <StatusChip spec={chip} />
            </View>
          </Pressable>
        );
      })}
      {load.data && load.data.items.length > 0 ? <SeeAll testID="recent-see-all" onPress={onSeeAll} /> : null}
    </RoCard>
  );
}

/** Khối "Cảnh báo AI" trong tab Y tế (HLV, Doctor): tối đa 3 cảnh báo suy giảm mới nhất của võ sĩ. */
export function AiAlertsBlock({ fighterId, enabled, onSeeAll }: { fighterId: string; enabled: boolean; onSeeAll: () => void }) {
  const p = useFighterPalette();
  const open = useOpenVideo();
  const run = useCallback(async () => {
    const jobs = newestFirst((await videoAiApi.listImpairmentJobs()).filter((j) => j.fighterId === fighterId));
    const top = jobs.slice(0, 3);
    const alerts = await Promise.allSettled(top.map((j) => videoAiApi.getHealthAlerts(j.id)));
    const map = Object.fromEntries(
      top.map((j, i) => {
        const r = alerts[i]!;
        return [j.id, r.status === "fulfilled" ? r.value.alerts : []];
      }),
    );
    return { rows: impairmentRows(top, map), total: jobs.length };
  }, [fighterId]);
  const load = useLoad(enabled && !!fighterId, `vai-imp|${fighterId}`, run, { keepOnError: true });
  return (
    <RoCard title={vai.aiBlock}>
      {load.loading && !load.data ? <RowSkeletons count={2} height={56} /> : null}
      {load.error && !load.data ? <BlockError onRetry={load.reload} loading={load.loading} /> : null}
      {load.data && load.data.rows.length === 0 ? (
        <View style={styles.okLine}>
          <Icon name="success" size={20} color={p.success} />
          <Text style={[TEXT.body, { color: p.ink, flex: 1 }]}>{vai.aiNone}</Text>
        </View>
      ) : null}
      {load.data?.rows.map((r) => {
        const sev = r.severity ? severityChip(r.severity) : null;
        const label = [jointText(r.joint), sev?.label, vnDate(r.createdAt)].filter(Boolean).join(", ");
        return (
          <Pressable
            key={r.jobId}
            accessibilityRole={r.videoId ? "button" : undefined}
            accessibilityLabel={label}
            disabled={!r.videoId}
            onPress={() => r.videoId && open(r.videoId, r.jobId, "alerts")}
            style={({ pressed }) => [styles.alertRow, { borderColor: p.line, opacity: pressed ? 0.85 : 1 }]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[TEXT.bodyBold, { color: p.ink }]}>{jointText(r.joint)}</Text>
              <View style={styles.chips}>
                {sev ? <StatusChip spec={sev} /> : null}
                <Text style={[TEXT.detail, { color: p.ink }]}>{vnDate(r.createdAt)}</Text>
              </View>
            </View>
            {r.videoId ? <Icon name="chevron" size={24} color={p.ink} /> : null}
          </Pressable>
        );
      })}
      {load.data && load.data.total > 0 ? <SeeAll testID="ai-see-all" onPress={onSeeAll} /> : null}
      <Text style={[TEXT.caption, { color: p.ink }]}>{vai.aiDisclaimer}</Text>
    </RoCard>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 96, height: 54, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  thumbTime: { position: "absolute", right: 4, bottom: 4, borderRadius: 4, paddingHorizontal: 4 },
  steps: { gap: 10 },
  step: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 28 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  seeAll: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  mini: { flexDirection: "row", gap: 12, alignItems: "center", minHeight: 72 },
  okLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 56, borderTopWidth: 1, paddingTop: 8 },
  chips: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
});
