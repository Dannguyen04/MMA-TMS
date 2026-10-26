import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Linking, PanResponder, Pressable, Text, View } from "react-native";
import { useReducedMotion } from "./reduced-motion";

import type { MedicalJointState } from "@/api/types";
import { BottomSheet } from "@/components/filter-sheet";
import { Icon } from "@/components/icon";
import { BodyMap } from "@/components/visuals/charts";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useThemePreference } from "@/theme";

import type { ViewState } from "./body-scene";
import { BODY_MODEL_CREDIT } from "./model";
import { buildJointRows, paintRegions, STATUS_COLOR, STATUS_TEXT, type JointRow, type PaintStatus } from "./regions";

// Nạp khung GL trễ (three/R3F chỉ được đánh giá khi cần); require để chạy được cả trong Jest.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BodyCanvas = lazy(() => Promise.resolve().then(() => require("./body-canvas") as typeof import("./body-canvas")));

export const LOAD_TIMEOUT_MS = 5000;

export const bodyText = {
  title: "Sơ đồ cơ thể",
  none: "Chưa ghi nhận vấn đề ở khớp nào",
  frameA11y: "Mô hình cơ thể 3D. Kéo ngang để xoay",
  info: "Về mô hình 3D",
  creditTitle: "Nguồn mô hình 3D",
  credit: (c: typeof BODY_MODEL_CREDIT) => `Mô hình “${c.title}” của ${c.author} trên ${c.site}, giấy phép ${c.license}.`,
  changes: "Đã chỉnh sửa cho ứng dụng: lược giản lưới, thêm dữ liệu vùng khớp để tô màu.",
  openSource: "Mở trang mô hình",
  close: "Đóng",
} as const;

class GlBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Mode = "3d" | "fallback";

/** Chọn 3D hay SVG: giảm chuyển động / lỗi GL / quá 5 s chưa tải → SVG. */
export function useBodyMode(reduced: boolean, timeoutMs: number = LOAD_TIMEOUT_MS) {
  const [mode, setMode] = useState<Mode>(reduced ? "fallback" : "3d");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (reduced) setMode("fallback");
  }, [reduced]);
  useEffect(() => {
    if (mode !== "3d" || ready) return;
    const t = setTimeout(() => setMode("fallback"), timeoutMs);
    return () => clearTimeout(t);
  }, [mode, ready, timeoutMs]);
  const fail = useCallback(() => setMode("fallback"), []);
  const onReady = useCallback(() => setReady(true), []);
  return { mode, ready, fail, onReady };
}

export function BodyMapSection({
  injuries,
  jointStates,
  stateText,
  severityText,
  height = 380,
  zoom,
}: {
  injuries: readonly { affectedJoint: string; status: string; injuryType: string; severity: string }[];
  jointStates: readonly MedicalJointState[];
  stateText: (s: string) => string;
  severityText: (s: string) => string;
  height?: number;
  zoom?: { factor: number; y: number };
}) {
  const { colors, resolvedScheme } = useThemePreference();
  const p = useFighterPalette();
  const light = resolvedScheme === "light" || (!resolvedScheme && isLightHex(colors.bg));
  const reduced = useReducedMotion();
  const rows = useMemo(() => buildJointRows(injuries, jointStates, stateText, severityText), [injuries, jointStates, stateText, severityText]);
  const paint = useMemo(() => paintRegions(rows), [rows]);
  const body = useBodyMode(!!reduced);
  const [fps, setFps] = useState<number | null>(null);
  const [info, setInfo] = useState(false);
  const view = useRef<ViewState>({ angle: 0, target: 0 });
  const lastDx = useRef(0);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => {
          lastDx.current = 0;
        },
        onPanResponderMove: (_e, g) => {
          const a = dragAngle(view.current.angle, g.dx - lastDx.current);
          lastDx.current = g.dx;
          view.current.angle = a;
          view.current.target = a;
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  if (rows.length === 0) return <Text style={{ fontSize: 16, lineHeight: 24, color: colors.ink }}>{bodyText.none}</Text>;

  const frameBg = colors.surfaceMuted;
  return (
    <View style={{ gap: 12 }}>
      {body.mode === "3d" ? (
        <View
          {...pan.panHandlers}
          accessible
          accessibilityLabel={bodyText.frameA11y}
          testID="body3d-frame"
          style={{ height, borderRadius: 12, overflow: "hidden", backgroundColor: frameBg }}
        >
          <GlBoundary onError={body.fail}>
            <Suspense fallback={null}>
              <BodyCanvas paint={paint} view={view} light={light} background={frameBg} onReady={body.onReady} onFps={__DEV__ ? setFps : undefined} zoom={zoom} />
            </Suspense>
          </GlBoundary>
          {__DEV__ && fps != null ? (
            <View style={{ position: "absolute", top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.surface }}>
              <Text style={{ fontSize: 12, color: colors.ink, fontVariant: ["tabular-nums"] }}>{`${fps} FPS`}</Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={bodyText.info}
            onPress={() => setInfo(true)}
            style={{ position: "absolute", top: 2, right: 2, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="info" size={20} />
          </Pressable>
        </View>
      ) : (
        <View testID="body-fallback" style={{ gap: 8 }}>
          <BodyMap colors={colors} jointStates={rows.filter((r) => r.mapped).map((r) => ({ joint: r.joint, currentState: svgState(r.status) }))} injuries={[]} />
        </View>
      )}
      <Legend />
      <JointList rows={rows} />
      {body.mode === "fallback" ? (
        <Pressable accessibilityRole="button" onPress={() => setInfo(true)} style={{ minHeight: 48, justifyContent: "center", alignSelf: "flex-start" }}>
          <Text style={{ fontSize: 14, color: p.link, fontWeight: "600" }}>{bodyText.info}</Text>
        </Pressable>
      ) : null}
      <BottomSheet visible={info} onClose={() => setInfo(false)} title={bodyText.creditTitle}>
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 16, lineHeight: 24, color: colors.ink }}>{bodyText.credit(BODY_MODEL_CREDIT)}</Text>
          <Text style={{ fontSize: 16, lineHeight: 24, color: colors.ink }}>{bodyText.changes}</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(BODY_MODEL_CREDIT.source)} style={{ minHeight: 48, justifyContent: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: p.link }}>{bodyText.openSource}</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
}

function isLightHex(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const n = parseInt(h.slice(0, 6), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 140;
}

/** SVG dự phòng dùng mức trạng thái khớp có sẵn của BodyMap. */
function svgState(s: PaintStatus | null): string {
  return s === "injury" ? "CONFIRMED_IMPAIRMENT" : s === "recovering" ? "SUSPECTED_AVOIDANCE" : s === "healed" ? "HEALTHY" : "SUSPECTED";
}

/** Radian xoay cho mỗi dp kéo ngang. */
export const DRAG_RAD_PER_DP = 0.01;

/**
 * Góc camera sau khi kéo ngang `ddx` dp. Camera quay ngược chiều ngón tay để mô hình
 * xoay cùng chiều ngón tay (kéo sang phải → mặt trước trôi sang phải).
 */
export function dragAngle(angle: number, ddx: number): number {
  return angle - ddx * DRAG_RAD_PER_DP;
}

export function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "").slice(0, 6);
  return `#${h}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
}

function Legend() {
  const { colors } = useThemePreference();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {(Object.keys(STATUS_COLOR) as PaintStatus[]).map((k) => (
        <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: STATUS_COLOR[k] }} />
          <Text style={{ fontSize: 14, color: colors.ink }}>{STATUS_TEXT[k]}</Text>
        </View>
      ))}
    </View>
  );
}

function JointList({ rows }: { rows: readonly JointRow[] }) {
  const { colors } = useThemePreference();
  return (
    <View>
      {rows.map((r, i) => (
        <View
          key={r.joint}
          accessible
          accessibilityLabel={[r.label, r.statusText, r.detail].filter(Boolean).join(", ")}
          style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}
        >
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: r.status ? STATUS_COLOR[r.status] : "transparent", borderWidth: r.status ? 0 : 1.5, borderColor: colors.ink }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: "600", color: colors.ink }}>{r.label}</Text>
            {r.detail ? <Text style={{ fontSize: 14, lineHeight: 20, color: colors.ink }}>{r.detail}</Text> : null}
          </View>
          <Text style={{ fontSize: 14, color: colors.ink }}>{r.statusText}</Text>
        </View>
      ))}
    </View>
  );
}
