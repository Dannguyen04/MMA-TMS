import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { videoAiApi } from "@/api/video-ai";
import { vai } from "@/i18n/video-ai";
import { Avatar, RoRow, RowSkeletons, StatusChip, Stack } from "@/screens/coach/readonly/ro-ui";
import { vnDate } from "@/screens/coach/readonly/ro-format";
import { ActionButton, ConnectionBanner, MessageCard, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useLoad } from "@/screens/fighter/use-load";

import { useOpenVideo } from "./ai-data";
import { IMPAIRMENT_CHIP, impairmentRows, jointText, severityChip } from "./ai-model";

/** Tải cảnh báo suy giảm (GET /jobs/impairments + /jobs/:id/health-alerts để lấy khớp & mức nặng nhất). */
export async function loadImpairments() {
  const jobs = await videoAiApi.listImpairmentJobs();
  const res = await Promise.allSettled(jobs.map((j) => videoAiApi.getHealthAlerts(j.id)));
  const alerts = Object.fromEntries(
    jobs.map((j, i) => {
      const r = res[i]!;
      return [j.id, r.status === "fulfilled" ? r.value.alerts : []];
    }),
  );
  return impairmentRows(jobs, alerts);
}

export function useImpairments(enabled: boolean) {
  const run = useCallback(() => loadImpairments(), []);
  return useLoad(enabled, "vai-impairments", run, { keepOnError: true });
}

/** Phân đoạn "Cảnh báo AI" ở tab Võ sĩ của Bác sĩ (D-4). Chỉ cảnh báo sức khỏe, không có phần HLV. */
export function DoctorAiAlerts({
  load,
  names,
  fighterId,
  onClearFighter,
}: {
  load: ReturnType<typeof useImpairments>;
  names: Record<string, string>;
  fighterId?: string;
  onClearFighter?: () => void;
}) {
  const open = useOpenVideo();
  const rows = useMemo(() => (load.data ?? []).filter((r) => !fighterId || r.fighterId === fighterId), [load.data, fighterId]);
  const firstLoad = load.loading && !load.data;
  const skeleton = useDelayedFlag(firstLoad);
  const empty = Boolean(load.data) && rows.length === 0;
  return (
    <Stack>
      {fighterId && onClearFighter ? (
        <View style={styles.filter}>
          <StatusChip spec={{ label: names[fighterId] ?? vai.fighter, tone: "info", icon: "info" }} />
          <ActionButton label={vai.clear} variant="secondary" icon="close" onPress={onClearFighter} />
        </View>
      ) : null}
      {load.error ? <ConnectionBanner error={load.error} onRetry={load.reload} retrying={load.loading} hasData={Boolean(load.data)} /> : null}
      {firstLoad && !load.error && skeleton ? <RowSkeletons count={4} height={110} /> : null}
      {empty ? <MessageCard icon="success" title={fighterId ? vai.impEmptyFiltered : vai.impEmptyTitle} description={vai.impEmptyDesc} /> : null}
      {rows.map((r) => {
        const name = names[r.fighterId] ?? vai.fighter;
        const sev = r.severity ? severityChip(r.severity).label : "";
        return (
          <RoRow
            key={r.jobId}
            leading={<Avatar name={name} />}
            title={name}
            lines={[[jointText(r.joint), sev, vnDate(r.createdAt)].filter(Boolean).join(" · ")]}
            chip={IMPAIRMENT_CHIP}
            onPress={r.videoId ? () => open(r.videoId!, r.jobId, "alerts") : undefined}
          />
        );
      })}
    </Stack>
  );
}

const styles = StyleSheet.create({
  filter: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
});
