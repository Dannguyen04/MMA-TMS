import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import Toast from "react-native-toast-message";
import { ActivityIndicator, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { enterFullscreenOrientation, exitFullscreenOrientation } from "@/screens/media/evidence/fullscreen-orientation";

import type { VideoStream } from "@/api/media";
import { BottomSheet } from "@/components/filter-sheet";
import { frameIndexAt, strikeAt, type WorkerResult } from "@/components/video/pose-model";
import { PoseOverlay, type OverlayLayers } from "@/components/video/pose-overlay";
import { ev } from "@/i18n/video-evidence";
import { media } from "@/i18n/media";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { palettes } from "@/theme/colors";
import { SheetOption } from "@/screens/media/evidence/sheet-option";
import { formatPrecise } from "@/screens/media/evidence/evidence-model";

export type PoseState = "idle" | "loading" | "ready" | "missing" | "error";
export type EvidencePlayerHandle = { seek: (ms: number) => void };

const RATES = [0.25, 0.5, 1] as const;
/** Toast "chưa có khung xương" nằm ngay trên thanh tab, không che header/nút Quay lại. */
const NO_POSE_TOAST_OFFSET = 96;
const CONTROLS_HIDE_MS = 3000;
const SWIPE_EXIT_DY = 80;

export { formatPrecise } from "@/screens/media/evidence/evidence-model";

type Props = {
  source: VideoStream;
  mimeType: string;
  /** Stacked layout: fixed stage height. Ignored when `fit` is set. */
  height: number;
  /**
   * Compact layout (video detail): fixed-height black stage (contain), controls hidden until the video is tapped,
   * thin 3dp progress at the bottom edge, "Phóng to" for fullscreen (swipe down to exit), and a 64dp mini bar
   * (`fit.mini`) that keeps the same player playing while the page is scrolled.
   */
  fit?: { height: number; mini?: boolean; miniTitle?: string };
  result: WorkerResult | null;
  poseState: PoseState;
  fallbackDurationMs: number;
  onRetry: () => void;
  /** Called when the playhead moves to another pose frame (or every ~250 ms without poses). */
  onTime?: (ms: number) => void;
  /** Drawn on top of the seek track, e.g. markers. Receives the track width. */
  renderTrack?: (width: number, durationMs: number) => ReactNode;
};

export const EvidencePlayer = forwardRef<EvidencePlayerHandle, Props>(function EvidencePlayer(
  { source, mimeType, height, fit, result, poseState, fallbackDurationMs, onRetry, onTime, renderTrack },
  ref,
) {
  const c = useFighterPalette();
  const well = c.scheme === "light" ? c.ink : palettes.dark.bg;
  const onWell = c.scheme === "light" ? c.bg : c.ink;
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [rate, setRate] = useState<(typeof RATES)[number]>(1);
  const [layers, setLayers] = useState<OverlayLayers>({ skeleton: true, angle: true, label: true });
  const [sheet, setSheet] = useState<"layers" | "speed" | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [trackWidth, setTrackWidth] = useState(0);
  const [aspect, setAspectRaw] = useState(16 / 9);
  const [aspectKnown, setAspectKnown] = useState(false);
  const [shown, setShown] = useState(false);
  const [fs, setFs] = useState(false);
  const setAspect = (a: number) => {
    setAspectRaw(a);
    setAspectKnown(true);
  };
  const [durationMs, setDurationMs] = useState(fallbackDurationMs);
  const onTimeRef = useRef(onTime);
  onTimeRef.current = onTime;

  const player = useVideoPlayer(source.headers ? { uri: source.uri, headers: source.headers } : { uri: source.uri }, (p) => {
    p.pause();
    p.timeUpdateEventInterval = 0.25;
  });

  const frames = result?.frames ?? [];
  const frameMs = 1000 / (result?.fps || 30);
  const lastIndex = useRef(-2);
  const lastReport = useRef(-1000);

  const report = (ms: number, force = false) => {
    const index = frameIndexAt(frames, ms);
    const changed = index !== lastIndex.current;
    if (!force && !changed && Math.abs(ms - lastReport.current) < 250) return;
    lastIndex.current = index;
    lastReport.current = ms;
    setTimeMs(ms);
    onTimeRef.current?.(ms);
  };
  const reportRef = useRef(report);
  reportRef.current = report;

  useEffect(() => {
    const subs = [
      player.addListener("statusChange", (e) => {
        if (e.status === "readyToPlay") {
          setPhase("ready");
          readWebAspect(player, setAspect);
          if (player.duration > 0) setDurationMs(player.duration * 1000);
        } else if (e.status === "error") setPhase("error");
      }),
      player.addListener("sourceLoad", (e) => applySize(e.availableVideoTracks?.[0]?.size, setAspect)),
      player.addListener("videoTrackChange", (e) => applySize(e.videoTrack?.size, setAspect)),
      player.addListener("playingChange", (e) => setPlaying(e.isPlaying)),
      player.addListener("timeUpdate", (e) => reportRef.current(e.currentTime * 1000)),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      player.pause();
    };
  }, [player]);

  // While playing, follow the decoder clock every display frame so the pose stays on the body.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const loop = () => {
      reportRef.current(player.currentTime * 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, player]);

  useEffect(() => {
    player.playbackRate = rate;
  }, [player, rate]);

  const seek = (ms: number) => {
    if (!Number.isFinite(ms)) return;
    const clamped = Math.max(0, Math.min(ms, durationMs || ms));
    player.currentTime = clamped / 1000;
    reportRef.current(clamped, true);
  };
  useImperativeHandle(ref, () => ({ seek }));

  const step = (dir: -1 | 1) => {
    player.pause();
    seek(player.currentTime * 1000 + dir * frameMs);
  };

  const index = frameIndexAt(frames, timeMs);
  const frame = index >= 0 ? frames[index]! : null;
  const strike = result ? strikeAt(result.strikes, timeMs) : null;
  const progress = durationMs > 0 ? Math.min(1, timeMs / durationMs) : 0;

  // Điều khiển tự ẩn sau vài giây khi đang phát.
  useEffect(() => {
    if (!shown || !playing) return;
    const t = setTimeout(() => setShown(false), CONTROLS_HIDE_MS);
    return () => clearTimeout(t);
  }, [shown, playing, timeMs > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const openFullscreen = () => {
    setFs(true);
    setShown(false);
    void enterFullscreenOrientation(result?.width && result?.height ? result.width / result.height : aspect);
  };
  const closeFullscreen = () => {
    setFs(false);
    setShown(false);
    void exitFullscreenOrientation();
  };
  const closeRef = useRef(closeFullscreen);
  closeRef.current = closeFullscreen;
  // Vuốt xuống để thoát toàn màn hình.
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
        onPanResponderRelease: (_e, g) => {
          if (g.dy > SWIPE_EXIT_DY) closeRef.current();
        },
      }),
    [],
  );

  const onBox = (e: LayoutChangeEvent) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  const webMov = Platform.OS === "web" && mimeType.toLowerCase() === "video/quicktime";

  const overlay = fit != null;
  // Đã phân tích nhưng không có điểm khung xương: Lớp mờ đi, chạm thì báo.
  const noPose = poseState === "missing";
  const ink = overlay ? palettes.dark.ink : c.ink;
  const layersPress = () => (noPose ? Toast.show({ type: "info", text1: ev.noSkeleton, position: "bottom", bottomOffset: NO_POSE_TOAST_OFFSET }) : setSheet("layers"));
  const togglePlay = () => (playing ? player.pause() : player.play());

  const controls = (
    <View testID="evidence-controls" style={[styles.controls, { backgroundColor: c.surface, borderColor: c.line }]} pointerEvents="box-none">
      <View testID="evidence-track" style={styles.trackHit} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel={ev.seek}
          accessibilityValue={{ min: 0, max: Math.round(durationMs), now: Math.round(timeMs) }}
          onPress={(e) => {
            // Web press events can omit locationX; fall back to the DOM offset.
            const n = e.nativeEvent as typeof e.nativeEvent & { offsetX?: number };
            const x = Number.isFinite(n.locationX) ? n.locationX : (n.offsetX ?? NaN);
            if (trackWidth > 0) seek((x / trackWidth) * durationMs);
          }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={[styles.track, { backgroundColor: c.surface2 }]}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: c.accent }]} />
        </View>
        {trackWidth > 0 && renderTrack ? (
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {renderTrack(trackWidth, durationMs)}
          </View>
        ) : null}
        <View pointerEvents="none" style={[styles.head, { left: progress * trackWidth - 1, backgroundColor: ink }]} />
      </View>
      <View style={styles.row}>
        <IconButton icon={playing ? "pause" : "play"} label={playing ? ev.pause : ev.play} onPress={togglePlay} strong />
        <IconButton icon="play-skip-back-outline" label={ev.prevFrame} onPress={() => step(-1)} ink={ink} />
        <IconButton icon="play-skip-forward-outline" label={ev.nextFrame} onPress={() => step(1)} ink={ink} />
        <Text style={[styles.clock, { color: ink }]} numberOfLines={1} testID="evidence-clock">
          {formatPrecise(timeMs)}
          {/* Narrow phones keep one line: the track already shows the length. */}
          {trackWidth >= 320 ? <Text style={{ color: c.muted }}>{` / ${formatPrecise(durationMs)}`}</Text> : null}
        </Text>
        <Chip label={`${rate}×`} a11y={ev.speedTitle} onPress={() => setSheet("speed")} />
        <Chip label={ev.layers} a11y={noPose ? ev.noSkeleton : ev.layersTitle} onPress={layersPress} icon="layers-outline" testID="layers-button" dimmed={noPose} />
      </View>
      {poseState === "missing" ? <Text style={{ color: c.muted, fontSize: 12 }}>{ev.poseMissing}</Text> : null}
    </View>
  );

  /** Lớp phủ của khung video thu gọn / toàn màn hình (ẩn mặc định, chạm video để hiện). */
  const overlayLayer = (full: boolean) => (
    <>
      <Pressable
        testID={full ? "fs-tap" : "stage-tap"}
        accessibilityRole="button"
        accessibilityLabel={shown ? ev.hideControls : ev.showControls}
        onPress={() => setShown((v) => !v)}
        style={StyleSheet.absoluteFill}
      />
      {shown && phase !== "error" ? (
        <View testID="evidence-controls" style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]} />
          <View style={styles.ovTop} pointerEvents="box-none">
            <Chip label={`${rate}×`} a11y={ev.speedTitle} onPress={() => setSheet("speed")} dark />
            <Chip label={ev.layers} a11y={noPose ? ev.noSkeleton : ev.layersTitle} onPress={layersPress} icon="layers-outline" testID="layers-button" dark dimmed={noPose} />
          </View>
          <View style={styles.ovCenter} pointerEvents="box-none">
            <IconButton icon="play-skip-back-outline" label={ev.prevFrame} onPress={() => step(-1)} ink={palettes.dark.ink} />
            <IconButton icon={playing ? "pause" : "play"} label={playing ? ev.pause : ev.play} onPress={togglePlay} strong big />
            <IconButton icon="play-skip-forward-outline" label={ev.nextFrame} onPress={() => step(1)} ink={palettes.dark.ink} />
          </View>
          <Text style={styles.ovClock} numberOfLines={1} testID="evidence-clock">
            {`${formatPrecise(timeMs)} / ${formatPrecise(durationMs)}`}
          </Text>
          <View
            testID="evidence-track"
            style={styles.ovSeek}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          >
            <Pressable
              accessibilityRole="adjustable"
              accessibilityLabel={ev.seek}
              accessibilityValue={{ min: 0, max: Math.round(durationMs), now: Math.round(timeMs) }}
              onPress={(e) => {
                const n = e.nativeEvent as typeof e.nativeEvent & { offsetX?: number };
                const x = Number.isFinite(n.locationX) ? n.locationX : (n.offsetX ?? NaN);
                if (trackWidth > 0) seek((x / trackWidth) * durationMs);
              }}
              style={StyleSheet.absoluteFill}
            />
            {trackWidth > 0 && renderTrack ? (
              <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { top: undefined, height: 48 }]}>
                {renderTrack(trackWidth, durationMs)}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      <Pressable
        testID={full ? "fullscreen-exit" : "fullscreen-button"}
        accessibilityRole="button"
        accessibilityLabel={full ? ev.exitFullscreen : ev.fullscreen}
        onPress={() => (full ? closeFullscreen() : openFullscreen())}
        style={({ pressed }) => [styles.zoom, { opacity: pressed ? 0.75 : 1 }]}
      >
        <Ionicons name={full ? "contract-outline" : "expand-outline"} size={16} color={palettes.dark.ink} />
        <Text style={styles.zoomText}>{full ? ev.exitFullscreen : ev.fullscreen}</Text>
      </Pressable>
      {/* Thanh tiến độ mảnh 3dp, màu nhấn, sát mép dưới video. */}
      <View pointerEvents="none" testID="thin-progress" style={styles.thinTrack}>
        <View style={{ height: 3, width: `${progress * 100}%`, backgroundColor: c.accent }} />
      </View>
    </>
  );

  const stageBody = (full: boolean) => (
    <>
      {/* Web renders a bare <video>: absolute offsets alone keep its intrinsic size, so size it explicitly. */}
      <VideoView player={player} style={styles.video} nativeControls={false} contentFit="contain" />
      {phase === "ready" && !(overlay && fit.mini && !full) ? (
        <PoseOverlay
          frame={frame}
          strike={strike}
          width={box.width}
          height={box.height}
          // Kết quả không ghi kích thước: dùng tỉ lệ thật của video để khớp vùng letterbox (contain).
          sourceWidth={result?.width ?? (aspectKnown ? aspect * 1000 : null)}
          sourceHeight={result?.height ?? (aspectKnown ? 1000 : null)}
          layers={layers}
          boneColor={palettes.dark.ink}
          activeColor={c.accent}
          labelInk={c.onAccent}
        />
      ) : null}
      {overlay && fit.mini && !full ? null : overlay ? (
        overlayLayer(full)
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={playing ? ev.pause : ev.play} onPress={togglePlay} style={StyleSheet.absoluteFill} />
      )}
      {phase === "loading" ? (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={onWell} />
          {overlay && fit.mini && !full ? null : <Text style={{ color: onWell, fontSize: 13 }}>{media.mediaLoading}</Text>}
        </View>
      ) : null}
      {phase === "error" ? (
        <View style={[styles.center, { backgroundColor: well }]}>
          <Text style={{ color: onWell, fontSize: 13, textAlign: "center" }}>{webMov ? media.mediaFormatWeb : media.mediaError}</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8} style={{ minHeight: 48, justifyContent: "center" }}>
            <Text style={{ color: onWell, fontWeight: "700", textDecorationLine: "underline" }}>{media.retry}</Text>
          </Pressable>
        </View>
      ) : null}
      {phase === "ready" && poseState === "loading" && !(overlay && fit.mini && !full) ? (
        <View style={[styles.pill, overlay ? { top: 10, bottom: undefined } : null, { backgroundColor: palettes.dark.surface }]} pointerEvents="none">
          <ActivityIndicator size="small" color={palettes.dark.ink} />
          <Text style={styles.pillText}>{ev.poseLoading}</Text>
        </View>
      ) : null}
    </>
  );

  const stageH = overlay ? fit.height : height;
  const mini = overlay && fit.mini;

  return (
    <View testID="evidence-player">
      {mini ? (
        <View testID="mini-bar" style={[styles.mini, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View testID="evidence-stage" style={[styles.miniThumb]} onLayout={onBox}>
            {fs ? null : stageBody(false)}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.ink, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>
              {fit.miniTitle ?? ""}
            </Text>
            <Text style={{ color: c.ink, fontSize: 13, fontVariant: ["tabular-nums"] }} numberOfLines={1} testID="mini-clock">
              {`${formatPrecise(timeMs)} / ${formatPrecise(durationMs)}`}
            </Text>
          </View>
          <IconButton icon={playing ? "pause" : "play"} label={playing ? ev.pause : ev.play} onPress={togglePlay} strong />
          <View pointerEvents="none" style={styles.thinTrack}>
            <View style={{ height: 3, width: `${progress * 100}%`, backgroundColor: c.accent }} />
          </View>
        </View>
      ) : (
        <View
          testID="evidence-stage"
          style={[styles.stage, overlay ? styles.stageFit : null, { height: stageH, backgroundColor: overlay ? "#000" : well }]}
          onLayout={onBox}
        >
          {fs ? null : stageBody(false)}
        </View>
      )}

      {overlay ? null : controls}

      {overlay ? (
        <Modal visible={fs} animationType="fade" onRequestClose={closeFullscreen} supportedOrientations={["portrait", "landscape"]} statusBarTranslucent>
          <View testID="fullscreen" style={styles.fsRoot} {...swipe.panHandlers}>
            <View style={StyleSheet.absoluteFill} onLayout={onBox}>
              {fs ? stageBody(true) : null}
            </View>
          </View>
        </Modal>
      ) : null}

      <BottomSheet visible={sheet === "layers"} onClose={() => setSheet(null)} title={ev.layersTitle}>
        {(["skeleton", "angle", "label"] as const).map((key) => (
          <SheetOption
            key={key}
            kind="check"
            testID={`layer-${key}`}
            label={ev[key]}
            selected={layers[key]}
            onPress={() => setLayers((cur) => ({ ...cur, [key]: !cur[key] }))}
          />
        ))}
      </BottomSheet>
      <BottomSheet visible={sheet === "speed"} onClose={() => setSheet(null)} title={ev.speedTitle}>
        {RATES.map((r) => (
          <SheetOption
            key={r}
            label={`${r}×`}
            selected={rate === r}
            onPress={() => {
              setRate(r);
              setSheet(null);
            }}
          />
        ))}
      </BottomSheet>
    </View>
  );
});

function IconButton({ icon, label, onPress, strong, ink, big }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; strong?: boolean; ink?: string; big?: boolean }) {
  const c = useFighterPalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.icon,
        big ? { width: 56, height: 56, borderRadius: 28 } : null,
        strong ? { backgroundColor: c.accent } : null,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={strong ? 20 : 18} color={strong ? c.onAccent : ink ?? c.ink} />
    </Pressable>
  );
}

function Chip({ label, a11y, onPress, icon, testID, dark, dimmed }: { label: string; a11y: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; testID?: string; dark?: boolean; dimmed?: boolean }) {
  const c = useFighterPalette();
  const fg = dark ? palettes.dark.ink : c.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        dark ? { borderColor: "rgba(255,255,255,0.4)", backgroundColor: "rgba(0,0,0,0.45)" } : { borderColor: c.line, backgroundColor: c.surface2 },
        { opacity: dimmed ? 0.45 : pressed ? 0.7 : 1 },
      ]}
      accessibilityState={dimmed ? { disabled: true } : undefined}
    >
      {icon ? <Ionicons name={icon} size={15} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  video: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%" },
  stage: { width: "100%", overflow: "hidden", borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  stageFit: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  ovTop: { position: "absolute", top: 8, right: 8, flexDirection: "row", gap: 8 },
  ovCenter: { position: "absolute", left: 0, right: 0, top: "50%", marginTop: -28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 },
  ovClock: { position: "absolute", left: 12, bottom: 52, color: palettes.dark.ink, fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
  ovSeek: { position: "absolute", left: 0, right: 112, bottom: 0, height: 48 },
  zoom: { position: "absolute", right: 8, bottom: 6, minHeight: 48, minWidth: 48, paddingHorizontal: 12, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.6)" },
  zoomText: { color: palettes.dark.ink, fontSize: 14, fontWeight: "700" },
  thinTrack: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: "rgba(255,255,255,0.25)" },
  mini: { height: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 8, borderBottomWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  miniThumb: { width: 114, height: 64, backgroundColor: "#000", overflow: "hidden" },
  fsRoot: { flex: 1, backgroundColor: "#000" },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 10, padding: 16 },
  pill: { position: "absolute", left: 10, bottom: 10, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { color: palettes.dark.ink, fontSize: 12, fontWeight: "600" },
  controls: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderTopWidth: 0, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  trackHit: { height: 48, justifyContent: "center" },
  track: { height: 4, borderRadius: 99, overflow: "hidden" },
  fill: { height: 4 },
  head: { position: "absolute", top: 16, width: 2, height: 16, borderRadius: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  clock: { flex: 1, fontSize: 13, fontVariant: ["tabular-nums"], fontWeight: "600" },
  chip: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 99, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth },
});

type Size = { width: number; height: number } | null | undefined;
function applySize(size: Size, set: (a: number) => void) {
  if (size && size.width > 0 && size.height > 0) set(size.width / size.height);
}
/** expo-video on web exposes no track size; read it from the mounted <video> element. */
function readWebAspect(player: unknown, set: (a: number) => void) {
  if (Platform.OS !== "web") return;
  const el = [...((player as { _mountedVideos?: Set<HTMLVideoElement> })._mountedVideos ?? [])][0];
  if (el) applySize({ width: el.videoWidth, height: el.videoHeight }, set);
}
