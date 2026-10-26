import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from "react-native";

import { appearance } from "@/i18n/appearance";
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from "@/theme/appearance/color-math";
import { radius, spacing, type, useThemePreference } from "@/theme";

const THUMB = 28;

function snap(value: number, min: number, max: number, step: number) {
  const clamped = Math.min(max, Math.max(min, value));
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Math.round(snapped * 1000) / 1000;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  accessibilityLabel: string;
}) {
  const { colors } = useThemePreference();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.segmented, { borderColor: colors.line, backgroundColor: colors.surfaceMuted }]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: colors.cta }]}
          >
            <Text
              numberOfLines={1}
              style={[type.label, { color: selected ? colors.onCta : colors.ink }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Horizontal slider on RN's PanResponder (no native slider module, so no
 * rebuild). −/+ buttons and screen-reader increment/decrement give the same
 * control without dragging.
 */
export function TrackSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  track,
  onSlidingChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  formatValue: (value: number) => string;
  track?: ReactNode;
  onSlidingChange?: (active: boolean) => void;
}) {
  const { colors } = useThemePreference();
  const [width, setWidth] = useState(0);
  const latest = useRef({ value, min, max, step, width, onChange, onSlidingChange });
  latest.current = { value, min, max, step, width, onChange, onSlidingChange };
  const startX = useRef(0);

  const responder = useMemo(() => {
    const emit = (x: number) => {
      const s = latest.current;
      if (s.width <= 0) return;
      const ratio = Math.min(1, Math.max(0, x / s.width));
      const next = snap(s.min + ratio * (s.max - s.min), s.min, s.max, s.step);
      if (next !== s.value) s.onChange(next);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        startX.current = event.nativeEvent.locationX;
        latest.current.onSlidingChange?.(true);
        emit(startX.current);
      },
      onPanResponderMove: (_event, gesture) => emit(startX.current + gesture.dx),
      onPanResponderRelease: () => latest.current.onSlidingChange?.(false),
      onPanResponderTerminate: () => latest.current.onSlidingChange?.(false),
    });
  }, []);

  const ratio = max === min ? 0 : (value - min) / (max - min);
  const nudge = (dir: 1 | -1) => {
    const next = snap(value + dir * step, min, max, step);
    if (next !== value) onChange(next);
  };
  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment") nudge(1);
    if (event.nativeEvent.actionName === "decrement") nudge(-1);
  };

  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHead}>
        <Text style={[type.label, { color: colors.ink }]}>{label}</Text>
        <Text style={[type.label, { color: colors.inkMuted }]}>{formatValue(value)}</Text>
      </View>
      <View style={styles.sliderRow}>
        <StepButton icon="minus" label={`${appearance.decrease} ${label}`} onPress={() => nudge(-1)} />
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: formatValue(value) }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={onAction}
          onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
          style={styles.trackHit}
          {...responder.panHandlers}
        >
          <View pointerEvents="none" style={[styles.track, { backgroundColor: colors.surfaceMuted, borderColor: colors.line }]}>
            {track ?? (
              <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: colors.lotus }]} />
            )}
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                left: Math.max(0, ratio * width - THUMB / 2),
                backgroundColor: colors.surface,
                borderColor: colors.ink,
              },
            ]}
          />
        </View>
        <StepButton icon="plus" label={`${appearance.increase} ${label}`} onPress={() => nudge(1)} />
      </View>
    </View>
  );
}

function StepButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useThemePreference();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.step, { borderColor: colors.line, backgroundColor: colors.surface }]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={colors.ink} />
    </Pressable>
  );
}

export function SwatchRow({
  swatches,
  value,
  onChange,
  label,
}: {
  swatches: readonly string[];
  value: string | null;
  onChange: (next: string | null) => void;
  label: string;
}) {
  const { colors } = useThemePreference();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.swatchRow}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: value === null }}
        accessibilityLabel={appearance.colorDefault}
        onPress={() => onChange(null)}
        style={[
          styles.defaultChip,
          {
            borderColor: value === null ? colors.ink : colors.line,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <Text style={[type.caption, { color: colors.ink }]}>{appearance.colorDefault}</Text>
      </Pressable>
      {swatches.map((hex) => {
        const selected = value === hex;
        return (
          <Pressable
            key={hex}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={hex}
            onPress={() => onChange(hex)}
            style={[
              styles.swatchHit,
              { borderColor: selected ? colors.ink : "transparent" },
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: hex, borderColor: colors.line }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function HexField({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (hex: string) => void;
}) {
  const { colors } = useThemePreference();
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(value);
    setInvalid(false);
  }, [value]);

  const commit = () => {
    const hex = normalizeHex(text);
    if (!hex) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onCommit(hex);
  };

  return (
    <View style={styles.hexBlock}>
      <Text style={[type.label, { color: colors.ink }]}>{appearance.hexLabel}</Text>
      <View style={styles.hexRow}>
        <View style={[styles.hexPreview, { backgroundColor: normalizeHex(text) ?? value, borderColor: colors.line }]} />
        <TextInput
          accessibilityLabel={appearance.hexLabel}
          value={text}
          onChangeText={setText}
          onSubmitEditing={commit}
          onBlur={commit}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          placeholder="#RRGGBB"
          placeholderTextColor={colors.inkSubtle}
          style={[
            type.body,
            styles.hexInput,
            {
              color: colors.ink,
              borderColor: invalid ? colors.danger : colors.controlBorder,
              backgroundColor: colors.surface,
            },
          ]}
        />
      </View>
      {invalid ? <Text style={[type.caption, { color: colors.danger }]}>{appearance.hexInvalid}</Text> : null}
    </View>
  );
}

const HUE_STOPS = Array.from({ length: 24 }, (_, i) => hsvToHex({ h: i * 15, s: 100, v: 100 }));

function StopsTrack({ stops }: { stops: string[] }) {
  return (
    <View style={styles.stops}>
      {stops.map((hex, i) => (
        <View key={`${hex}-${i}`} style={[styles.stop, { backgroundColor: hex }]} />
      ))}
    </View>
  );
}

/** Self-written HSV picker built from three sliders; no color-picker dependency. */
export function HsvPicker({
  value,
  onChange,
  onSlidingChange,
}: {
  value: string;
  onChange: (hex: string) => void;
  onSlidingChange?: (active: boolean) => void;
}) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setHsv(hexToHsv(value));
    }
  }, [value]);

  const update = (patch: Partial<Hsv>) => {
    const next = { ...hsv, ...patch };
    setHsv(next);
    const hex = hsvToHex(next);
    lastEmitted.current = hex;
    onChange(hex);
  };

  const satStops = useMemo(
    () => Array.from({ length: 12 }, (_, i) => hsvToHex({ h: hsv.h, s: (i / 11) * 100, v: hsv.v })),
    [hsv.h, hsv.v],
  );
  const valStops = useMemo(
    () => Array.from({ length: 12 }, (_, i) => hsvToHex({ h: hsv.h, s: hsv.s, v: (i / 11) * 100 })),
    [hsv.h, hsv.s],
  );

  return (
    <View style={styles.picker}>
      <TrackSlider
        label={appearance.hue}
        value={Math.round(hsv.h)}
        min={0}
        max={359}
        step={1}
        onChange={(h) => update({ h })}
        formatValue={(v) => `${v}°`}
        track={<StopsTrack stops={HUE_STOPS} />}
        onSlidingChange={onSlidingChange}
      />
      <TrackSlider
        label={appearance.saturation}
        value={Math.round(hsv.s)}
        min={0}
        max={100}
        step={1}
        onChange={(s) => update({ s })}
        formatValue={(v) => `${v}%`}
        track={<StopsTrack stops={satStops} />}
        onSlidingChange={onSlidingChange}
      />
      <TrackSlider
        label={appearance.brightnessChannel}
        value={Math.round(hsv.v)}
        min={0}
        max={100}
        step={1}
        onChange={(v) => update({ v })}
        formatValue={(v) => `${v}%`}
        track={<StopsTrack stops={valStops} />}
        onSlidingChange={onSlidingChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: radius.field,
    borderCurve: "continuous",
    padding: 2,
    gap: 2,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.field - 2,
    borderCurve: "continuous",
    paddingHorizontal: spacing.xs,
  },
  sliderBlock: { gap: spacing.xs },
  sliderHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  trackHit: { flex: 1, height: 44, justifyContent: "center" },
  track: {
    height: 10,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  fill: { height: "100%" },
  thumb: {
    position: "absolute",
    top: (44 - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
  },
  step: {
    width: 44,
    height: 44,
    borderRadius: radius.field,
    borderCurve: "continuous",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, alignItems: "center" },
  defaultChip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchHit: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 1 },
  hexBlock: { gap: spacing.xs },
  hexRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  hexPreview: { width: 44, height: 44, borderRadius: radius.field, borderWidth: 1 },
  hexInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.field,
    borderCurve: "continuous",
    paddingHorizontal: spacing.md,
  },
  picker: { gap: spacing.sm },
  stops: { flexDirection: "row", height: "100%" },
  stop: { flex: 1 },
});
