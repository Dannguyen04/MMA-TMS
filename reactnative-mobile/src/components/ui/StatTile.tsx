import { Card } from "./Card";
import { Text, type TextTone } from "./Text";
import { cx, type StatusTone } from "./tokens";

export type StatTileProps = {
  label: string;
  value: string | number;
  /** Optional unit rendered after the value, e.g. "kg", "%". */
  unit?: string;
  hint?: string;
  /** Only set when the number itself expresses a status; otherwise the value stays neutral. */
  status?: StatusTone;
  className?: string;
};

export function StatTile({ label, value, unit, hint, status, className }: StatTileProps) {
  const tone: TextTone = status ?? "default";
  return (
    <Card className={cx("gap-xs", className)}>
      <Text variant="label">{label}</Text>
      <Text variant="display" tone={tone} numeric numberOfLines={1}>
        {value}
        {unit ? (
          <Text variant="body" tone="muted">
            {` ${unit}`}
          </Text>
        ) : null}
      </Text>
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}
