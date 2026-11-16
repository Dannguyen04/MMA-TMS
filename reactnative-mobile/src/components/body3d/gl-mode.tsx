import { Component, useCallback, useEffect, useState, type ReactNode } from "react";

/** 3D or SVG, shared by every body map: reduced motion, a GL error or no frame within 5 s → SVG. */
export const LOAD_TIMEOUT_MS = 5000;

export class GlBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
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

export type Mode = "3d" | "fallback";

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

/** Radian xoay cho mỗi dp kéo ngang. */
export const DRAG_RAD_PER_DP = 0.01;

/**
 * Góc camera sau khi kéo ngang `ddx` dp. Camera quay ngược chiều ngón tay để mô hình
 * xoay cùng chiều ngón tay (kéo sang phải → mặt trước trôi sang phải).
 */
export function dragAngle(angle: number, ddx: number): number {
  return angle - ddx * DRAG_RAD_PER_DP;
}

