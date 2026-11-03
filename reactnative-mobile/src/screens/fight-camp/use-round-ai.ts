import { useCallback, useEffect, useRef, useState } from "react";
import { campApi, type AiSuggestion } from "@/api/fight-camp";
import { AI_TIMEOUT_MS, aiLines, aiProblem, aiRequestError, sampleRoundAdvice, type AiLine } from "./round-ai";

export type RoundAiState =
  | { phase: "idle" }
  | { phase: "loading" }
  /** `restored`: read back from GET ai/suggestions, not from a new request. */
  | { phase: "ready"; suggestion: AiSuggestion; lines: AiLine[]; hidden: number; sample: boolean; restored?: boolean }
  | { phase: "problem"; text: string };
const IDLE: RoundAiState = { phase: "idle" };
const SAMPLE_DELAY_MS = 700;

/**
 * AI advice per target round (n+1). One request at a time; a newer request or the 12 s timer wins,
 * late answers are dropped. Nothing here can block or undo a round save.
 */
export function useRoundAi(boutId: string, preview: boolean) {
  const [states, setStates] = useState<Record<number, RoundAiState>>({});
  const seq = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const alive = useRef(true);
  /** Suggestion ids that already have a decision (local PATCH or server history): never PATCH them again. */
  const decided = useRef(new Set<string>());
  useEffect(() => { alive.current = true; return () => { alive.current = false; abort.current?.abort(); }; }, []);
  const put = useCallback((n: number, s: RoundAiState) => { if (alive.current) setStates(prev => ({ ...prev, [n]: s })); }, []);
  const ask = useCallback(async (roundNo: number) => {
    abort.current?.abort();
    const mine = ++seq.current;
    const controller = new AbortController(); abort.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (mine === seq.current) { seq.current++; put(roundNo, { phase: "problem", text: aiRequestError(null, true) }); }
      controller.abort();
    }, AI_TIMEOUT_MS);
    put(roundNo, { phase: "loading" });
    try {
      const suggestion = preview
        ? await new Promise<AiSuggestion>(resolve => setTimeout(() => resolve(sampleRoundAdvice(roundNo)), SAMPLE_DELAY_MS))
        : (await campApi.roundAdvice(boutId, roundNo, controller.signal)).suggestion;
      if (mine !== seq.current) return;
      const problem = aiProblem(suggestion);
      put(roundNo, problem ? { phase: "problem", text: problem } : { phase: "ready", suggestion, ...aiLines(suggestion), sample: preview });
    } catch (error) {
      if (mine === seq.current) put(roundNo, { phase: "problem", text: aiRequestError(error, timedOut) });
    } finally { clearTimeout(timer); }
  }, [boutId, preview, put]);
  /**
   * 7A option C: show the newest OK suggestion for roundNo from history. No Gemini call.
   * A failed read changes nothing; a request started meanwhile wins.
   */
  const restore = useCallback(async (roundNo: number) => {
    if (preview) return;
    const mine = seq.current;
    try {
      const { suggestions } = await campApi.aiHistory(boutId, "BETWEEN_ROUNDS");
      if (!alive.current || mine !== seq.current || !Array.isArray(suggestions)) return;
      for (const s of suggestions) if (s.decision) decided.current.add(s.id);
      const hit = suggestions.find(s => s.roundNo === roundNo && s.status === "OK" && aiLines(s).lines.length > 0);
      if (!hit) return;
      setStates(prev => {
        const current = prev[roundNo];
        if (current?.phase === "loading" || (current?.phase === "ready" && current.suggestion.id === hit.id)) return prev;
        return { ...prev, [roundNo]: { phase: "ready", suggestion: hit, ...aiLines(hit), sample: false, restored: true } };
      });
    } catch { /* silent: keep what is on screen */ }
  }, [boutId, preview]);
  const get = useCallback((roundNo: number | null): RoundAiState => (roundNo == null ? IDLE : states[roundNo] ?? IDLE), [states]);
  return { get, ask, restore, decided };
}
