import { useRef, useState } from "react";
import { Image, View } from "react-native";
import { campApi, type CampDetail, type RoundInput, type TacticOutcome } from "@/api/fight-camp";
import { Action, Busy, Choices, Copy, Fact, Field, Frame, Notice, SvgTitle } from "./camp-ui";
import { campError, kg } from "./camp-rules";
import { previewReport } from "./camp-preview";
import { useCampResource } from "./use-camp-resource";
import { previewCornerCard } from "./round-advice-preview";
import { readPreviewRounds, resetPreviewRounds, savePreviewRound } from "./preview-round-store";
import { RoundAdvicePanel } from "./round-advice-panel";
import { roundAdvice as adviceCopy } from "@/i18n/round-advice";

const marks: { value: TacticOutcome; label: string }[] = [{ value: "EFFECTIVE", label: "Hiệu quả" }, { value: "INEFFECTIVE", label: "Không hiệu quả" }, { value: "NOT_USED", label: "Chưa dùng" }];
function ResourceError({ error, retry }: { error: string; retry: () => void }) { return error ? <><Notice title="Không tải được dữ liệu" danger>{error}</Notice><Action label="Tải lại" secondary onPress={retry}/></> : null; }

export function CornerScreen({ bout, name, preview, onRounds }: { bout: CampDetail; name: string; preview: boolean; onRounds: () => void }) {
  const state = useCampResource(`corner:${bout.id}:${preview}`, () => preview ? Promise.resolve(previewCornerCard(bout.opponentAnalysis, readPreviewRounds(bout).rounds, bout.acuteLoss)) : campApi.corner(bout.id));
  const [round, setRound] = useState<number | null>(null);
  const c = state.data;
  return <>
    {state.loading && !c ? <Busy/> : null}<ResourceError error={state.error} retry={() => void state.reload()}/>
    {c ? <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1, gap: 9 }}><Copy large strong>{name}</Copy><Copy muted>Đối thủ: {bout.opponentName || "Chưa xác định"}</Copy><Copy>{kg(bout.catchweightKg ?? bout.weightLimitKg)} kg · {bout.scheduledRounds ?? "—"} hiệp</Copy></View>
        <Image source={require("../../../assets/fight-camp/corner-stool.webp")} accessibilityLabel="Góc đài với ghế và khăn" resizeMode="contain" style={{ width: 108, height: 126 }}/>
      </View>
      {c.acuteLossFlag ? <Notice title="Giảm cân cấp tốc vượt ngưỡng" danger>HLV cần lưu ý cảnh báo khi chuẩn bị góc đài.</Notice> : null}
      <Choices<number | null> label="Chiến thuật theo hiệp" value={round} onChange={setRound} options={[{ value: null, label: "Tất cả" }, ...Array.from({ length: bout.scheduledRounds ?? 0 }, (_, i) => ({ value: i + 1, label: `Hiệp ${i + 1}` }))]}/>
      {c.tactics.filter(t => round == null || t.round == null || t.round === round).map((t, i) => <Frame key={t.id}>
        <Copy muted>{t.round == null ? "Mọi hiệp" : `Hiệp ${t.round}`} · {t.basis === "REPEATED" ? "Quan sát lặp lại" : "Quan sát một lần"}</Copy>
        <Copy large strong>{t.text}</Copy>
        {!t.trained ? <Copy strong>Chưa luyện</Copy> : <Copy muted>Đã gắn buổi tập</Copy>}
        {t.partnerBrief ? <Copy muted>Đối luyện: {t.partnerBrief}</Copy> : null}
      </Frame>)}
      {!c.tactics.some(t => round == null || t.round == null || t.round === round) ? <Notice title="Chưa có chiến thuật cho hiệp này"/> : null}
      <Action label="Ghi chú và ghi hiệp" onPress={onRounds}/>
    </> : null}
  </>;
}

export type RoundDraftState = { round: number; values: Record<number, RoundInput> };
export function RoundScreen({ bout, preview, onAdvice, draftState, onDraftStateChange }: { bout: CampDetail; preview: boolean; onAdvice: () => void; draftState?: RoundDraftState; onDraftStateChange?: (s: RoundDraftState) => void }) {
  const state = useCampResource(`rounds:${bout.id}:${preview}`, () => preview ? Promise.resolve(readPreviewRounds(bout)) : campApi.rounds(bout.id));
  const [ownDraftState, setOwnDraftState] = useState<RoundDraftState>({ round: 1, values: {} });
  const currentDraftState = draftState ?? ownDraftState;
  const setDraftState = onDraftStateChange ?? setOwnDraftState;
  const { round, values: drafts } = currentDraftState;
  const [pending, setPending] = useState(false); const lock = useRef(false); const [error, setError] = useState(""); const [saved, setSaved] = useState<number | null>(null);
  const total = state.data?.scheduledRounds ?? bout.scheduledRounds;
  const existing = state.data?.rounds.find(r => r.roundNo === round);
  const draft = drafts[round] ?? existing ?? { selfScore: null, knockdownsAgainst: 0, stunned: false, bleeding: false, fatigued: false, tacticMarks: {}, observationMarks: {}, note: "" };
  function change(patch: Partial<RoundInput>) { setDraftState({ ...currentDraftState, values: { ...drafts, [round]: { ...draft, ...patch } } }); setSaved(null); }
  async function save() {
    if (lock.current || !total || !state.data) return;
    lock.current = true; setPending(true); setError(""); setSaved(null);
    try {
      const body: RoundInput = { selfScore: draft.selfScore ?? null, knockdownsAgainst: draft.knockdownsAgainst ?? 0, stunned: !!draft.stunned, bleeding: !!draft.bleeding, fatigued: !!draft.fatigued, tacticMarks: draft.tacticMarks ?? {}, observationMarks: draft.observationMarks ?? {}, note: draft.note?.trim() || null };
      if (preview) state.setData(savePreviewRound(bout, round, body));
      else {
        const r = await campApi.saveRound(bout.id, round, body);
        // PUT returns one record, not advice. Clear old advice until the new GET resolves.
        state.setData({ ...state.data, rounds: [...state.data.rounds.filter(item => item.roundNo !== round), r].sort((a, b) => a.roundNo - b.roundNo), advice: null });
      }
      setSaved(round);
      if (!preview) await state.reload();
    } catch (e) { setError(campError(e)); } finally { lock.current = false; setPending(false); }
  }
  return <>
    {state.loading && !state.data ? <Busy/> : null}<ResourceError error={state.error} retry={() => void state.reload()}/>
    {total == null && !state.loading ? <Notice title="Chưa đặt số hiệp" danger>Cập nhật số hiệp của trận trước khi ghi. App không tự đặt mặc định.</Notice> : null}
    {state.data && total != null ? <>
      <Choices<number> label="Chọn hiệp đang ghi" value={round} disabled={pending} onChange={n => { setDraftState({ ...currentDraftState, round: n }); setError(""); setSaved(null); }} options={Array.from({ length: total }, (_, i) => ({ value: i + 1, label: `Hiệp ${i + 1}${state.data!.rounds.some(r => r.roundNo === i + 1) ? " ✓" : ""}` }))}/>
      <Copy muted>{state.data.rounds.length}/{total} hiệp đã ghi · Có thể mở lại để chỉnh sửa</Copy>
      <Field label="Ghi chú nhanh trong hiệp" value={draft.note ?? ""} onChangeText={note => change({ note })} multiline maxLength={300} editable={!pending} helper={`Hiệp ${round} · Nháp chưa gửi · ${draft.note?.length ?? 0}/300 ký tự. Chốt hiệp để lưu và nhận lời dặn.`}/>
      <Copy muted>Ghi chú có thể nhập ngay khi hiệp đang diễn ra. Giữ nháp khi đổi hiệp hoặc mở lời dặn trong trận này; thoát trận/đóng app sẽ mất phần chưa chốt.</Copy>
      <Choices<RoundInput["selfScore"]> label="HLV tự chấm" value={draft.selfScore ?? null} onChange={selfScore => change({ selfScore })} disabled={pending} options={[{ value: "WIN", label: "Thắng" }, { value: "CLOSE", label: "Sát nút" }, { value: "LOSS", label: "Thua" }, { value: null, label: "Chưa chấm" }]}/>
      <Frame><Copy strong>Số lần bị đánh ngã</Copy><View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}><View style={{ flex: 1 }}><Action label="Giảm một" icon="minus" secondary disabled={pending || !draft.knockdownsAgainst} onPress={() => change({ knockdownsAgainst: (draft.knockdownsAgainst ?? 0) - 1 })}/></View><Copy large strong>{draft.knockdownsAgainst ?? 0}</Copy><View style={{ flex: 1 }}><Action label="Tăng một" icon="plus" secondary disabled={pending || (draft.knockdownsAgainst ?? 0) >= 10} onPress={() => change({ knockdownsAgainst: (draft.knockdownsAgainst ?? 0) + 1 })}/></View></View></Frame>
      {([{ key: "stunned", label: "Choáng" }, { key: "bleeding", label: "Chảy máu" }, { key: "fatigued", label: "Mệt" }] as const).map(f => <Choices key={f.key} label={f.label} value={draft[f.key] ? "yes" : "no"} onChange={v => change({ [f.key]: v === "yes" })} disabled={pending} options={[{ value: "no", label: "Không" }, { value: "yes", label: "Có" }]}/>)}
      <SvgTitle small>Chiến thuật trong hiệp</SvgTitle>
      {(bout.opponentAnalysis.tactics ?? []).map(t => <Frame key={t.id}><Copy strong>{t.text}</Copy><Choices<TacticOutcome | null> value={draft.tacticMarks?.[t.id] ?? null} onChange={v => { if (v) change({ tacticMarks: { ...draft.tacticMarks, [t.id]: v } }); }} options={marks} disabled={pending}/></Frame>)}
      {!bout.opponentAnalysis.tactics?.length ? <Copy muted>Chưa có chiến thuật được lập cho trận.</Copy> : null}
      <SvgTitle small>Quan sát đối thủ</SvgTitle>
      {(bout.opponentAnalysis.observations ?? []).map(o => <Frame key={o.id}><Copy>{o.text}</Copy><Choices<string | null> value={draft.observationMarks?.[o.id] ?? null} onChange={v => { if (v) change({ observationMarks: { ...draft.observationMarks, [o.id]: v as "SEEN" | "NOT_SEEN" } }); }} options={[{ value: "SEEN", label: "Có thấy" }, { value: "NOT_SEEN", label: "Không thấy" }]} disabled={pending}/></Frame>)}
      {error ? <Notice title="Chưa lưu được hiệp" danger>{error}</Notice> : null}
      {saved === round ? <Notice title={`Đã lưu hiệp ${round}`} success/> : null}
      <Action label={existing ? `Lưu chỉnh sửa hiệp ${round}` : `Chốt hiệp ${round}`} pending={pending} onPress={() => void save()}/>
      {!state.error ? <RoundAdvicePanel data={state.data} refreshing={state.loading}/> : null}
      <Action label="Xem lời dặn giữa hiệp" secondary disabled={pending} onPress={onAdvice}/>
      {preview ? <Action label={adviceCopy.reset} secondary disabled={pending} onPress={() => { resetPreviewRounds(bout.id); state.setData(readPreviewRounds(bout)); setDraftState({ round: 1, values: {} }); setSaved(null); setError(""); }}/> : null}
    </> : null}
  </>;
}

export function AdviceScreen({ bout, preview }: { bout: CampDetail; preview: boolean }) {
  const state = useCampResource(`advice:${bout.id}:${preview}`, () => preview ? Promise.resolve(readPreviewRounds(bout)) : campApi.rounds(bout.id));
  return <>
    {state.loading ? <Busy/> : null}<ResourceError error={state.error} retry={() => void state.reload()}/>
    {state.data && !state.error ? <RoundAdvicePanel data={state.data} refreshing={state.loading} heading={false}/> : null}
  </>;
}

export function ReportScreen({ bout, preview }: { bout: CampDetail; preview: boolean }) {
  const state = useCampResource(`report:${bout.id}:${preview}`, () => preview ? Promise.resolve(previewReport) : campApi.report(bout.id));
  const [reviews, setReviews] = useState<Record<string, { outcome: TacticOutcome; note: string }>>({});
  const [error, setError] = useState(""); const [success, setSuccess] = useState(false); const [pending, setPending] = useState(false); const lock = useRef(false);
  const report = state.data;
  return <>
    {state.loading && !report ? <Busy/> : null}<ResourceError error={state.error} retry={() => void state.reload()}/>
    {report ? <>
      <Frame><Copy muted>Kết quả trận</Copy><Copy large strong>{({ WIN: "Thắng", LOSS: "Thua", DRAW: "Hoà", NO_CONTEST: "Không tính kết quả" } as Record<string, string>)[report.result.result] ?? report.result.result}</Copy><Fact label="Phương thức" value={report.result.method}/><Fact label="Hiệp đã ghi" value={String(report.roundsRecorded)}/></Frame>
      <SvgTitle small>Đánh giá chiến thuật</SvgTitle>
      {!report.roundsRecorded ? <Copy muted>Chưa ghi hiệp nên chưa đủ dữ liệu đánh giá hiệu quả.</Copy> : null}
      {report.tactics.map(t => {
        const draft = reviews[t.id];
        return <Frame key={t.id}><Copy large strong>{t.text}</Copy><Copy muted>{t.effectiveRounds} hiệp hiệu quả · {t.ineffectiveRounds} hiệp không hiệu quả</Copy>
          <Choices<TacticOutcome | null> label="Đánh giá của HLV" value={draft?.outcome ?? t.review?.outcome ?? t.outcome ?? null} disabled={pending} options={marks} onChange={outcome => { if (outcome) { setReviews(p => ({ ...p, [t.id]: { outcome, note: draft?.note ?? t.review?.note ?? "" } })); setSuccess(false); } }}/>
          <Field label="Nhận xét (tuỳ chọn)" multiline maxLength={300} editable={!pending} value={draft?.note ?? t.review?.note ?? ""} onChangeText={note => { setReviews(p => ({ ...p, [t.id]: { outcome: draft?.outcome ?? t.review?.outcome ?? t.outcome ?? "NOT_USED", note } })); setSuccess(false); }}/>
        </Frame>;
      })}
      <SvgTitle small>Điểm cần cải thiện</SvgTitle>
      {report.improvementPoints.length ? report.improvementPoints.map((p, i) => <Notice key={i} title={p.code === "TACTIC_INEFFECTIVE" ? "Chiến thuật chưa hiệu quả" : p.code === "ACUTE_LOSS_EXCEEDED" ? "Giảm cân cấp tốc vượt ngưỡng" : `Mệt từ hiệp ${p.fromRound ?? "—"}`}>{p.text}</Notice>) : <Copy muted>Chưa có điểm cải thiện được ghi nhận từ dữ liệu trận.</Copy>}
      {report.observations.map(o => <Fact key={o.id} label={o.text} value={o.notSeenInBout ? "Không thấy trong trận" : "Đã ghi nhận / chưa đủ dữ liệu"}/>)}
      {error ? <Notice title="Chưa lưu được đánh giá" danger>{error}</Notice> : null}{success ? <Notice title="Đã lưu đánh giá chiến thuật" success/> : null}
      <Action label="Lưu đánh giá chiến thuật" pending={pending} disabled={!Object.keys(reviews).length} onPress={() => {
        if (lock.current) return; lock.current = true; setPending(true); setError("");
        const input = Object.entries(reviews).map(([tacticId, r]) => ({ tacticId, outcome: r.outcome, ...(r.note.trim() ? { note: r.note.trim() } : {}) }));
        void (preview ? Promise.resolve() : campApi.review(bout.id, input)).then(() => { setSuccess(true); if (!preview) void state.reload(); }).catch(e => setError(campError(e))).finally(() => { lock.current = false; setPending(false); });
      }}/>
    </> : null}
  </>;
}
