import { Text, View } from "react-native";

import type { TrainingSessionSummary } from "@/api/types";
import { sessionTypeName } from "@/components/medical/medical-format";
import { TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { coachRo } from "@/i18n/coach-ro";
import { groupByDay, SESSION_CHIP, timeHm } from "./ro-format";
import { RoRow, SectionTitle, Stack } from "./ro-ui";

/** Buổi tập nhóm theo ngày; `names` có thì hiện tên võ sĩ. */
export function SessionGroups({
  sessions,
  names,
  onOpen,
}: {
  sessions: readonly TrainingSessionSummary[];
  names?: Record<string, string>;
  onOpen?: (id: string) => void;
}) {
  const groups = groupByDay(sessions);
  return (
    <Stack gap={24}>
      {groups.map((g) => (
        <Stack key={g.key} gap={8}>
          <SectionTitle>{g.label}</SectionTitle>
          <Stack>
            {g.items.map((s) => (
              <SessionRow key={s.id} s={s} name={names?.[s.fighterId]} onOpen={onOpen} />
            ))}
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}

function SessionRow({ s, name, onOpen }: { s: TrainingSessionSummary; name?: string; onOpen?: (id: string) => void }) {
  const p = useFighterPalette();
  const lines = [
    [sessionTypeName(s.sessionType), name ? `${coachRo.schedule.fighter}: ${name}` : null].filter(Boolean).join(" · "),
    s.location ?? "",
  ].filter(Boolean);
  return (
    <RoRow
      title={s.title}
      lines={lines}
      chip={SESSION_CHIP[s.status]}
      onPress={onOpen ? () => onOpen(s.id) : undefined}
      leading={
        <View style={{ minWidth: 52 }}>
          <Text style={[TEXT.bodyBold, { color: p.ink }]}>{timeHm(s.scheduledAt)}</Text>
        </View>
      }
      label={`${timeHm(s.scheduledAt)}, ${s.title}, ${lines.join(", ")}, ${SESSION_CHIP[s.status].label}`}
    />
  );
}
