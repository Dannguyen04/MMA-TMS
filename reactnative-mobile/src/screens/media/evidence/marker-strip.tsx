import { StyleSheet, View } from "react-native";

import type { WorkerResult } from "@/components/video/pose-model";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";

/**
 * Markers drawn over the seek track: evidence windows as faint bands,
 * strikes as accent ticks at impact, findings needing work as warning dots.
 * Purely visual (pointerEvents none) so taps still seek.
 */
export function MarkerStrip({ result, width, durationMs }: { result: WorkerResult; width: number; durationMs: number }) {
  const c = useFighterPalette();
  if (durationMs <= 0 || width <= 0) return null;
  const x = (ms: number) => Math.max(0, Math.min(width, (ms / durationMs) * width));
  const windows = result.movementEvidence?.windows ?? [];
  const fix = result.findings.filter((f) => f.severity === "warning" || f.severity === "critical");
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="marker-strip">
      {windows.map((w) => (
        <View
          key={`w-${w.id}`}
          style={[styles.band, { left: x(w.startMs), width: Math.max(2, x(w.endMs) - x(w.startMs)), backgroundColor: c.ink, opacity: 0.12 }]}
        />
      ))}
      {result.strikes.map((s, i) => (
        <View key={`s-${i}`} style={[styles.tick, { left: x(s.impactMs ?? s.startMs) - 1, backgroundColor: c.accent }]} />
      ))}
      {fix.map((f) => (
        <View key={`f-${f.id}`} style={[styles.dot, { left: x(f.timeMs) - 3, backgroundColor: c.warning, borderColor: c.surface }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { position: "absolute", top: "50%", height: 10, marginTop: -5, borderRadius: 2 },
  tick: { position: "absolute", top: "50%", width: 2, height: 14, marginTop: -7, borderRadius: 1 },
  dot: { position: "absolute", top: 0, width: 7, height: 7, borderRadius: 4, borderWidth: 1 },
});
