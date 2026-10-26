import { useRef, useState } from "react";
import { View } from "react-native";
import { campApi, type Analysis, type AnalysisInput, type CampDetail, type Observation, type OpponentProfile, type Tactic } from "@/api/fight-camp";
import { listTrainingSessions } from "@/api/training";
import { Action, Choices, Copy, Field, Frame, Notice, SvgTitle } from "./camp-ui";
import { campError, dateLabel, validateAnalysis } from "./camp-rules";
import { useCampResource } from "./use-camp-resource";
import { previewBout } from "./camp-preview";

const makeInput = (a: Analysis): AnalysisInput => ({ profile: { ...a.profile }, observations: (a.observations ?? []).map(o => ({ ...o })), tactics: (a.tactics ?? []).map(({ review: _review, ...t }) => ({ ...t, observationIds: [...t.observationIds], sessionIds: [...t.sessionIds] })) });
const numeric = [{ key: "wins", label: "Số trận thắng" }, { key: "losses", label: "Số trận thua" }, { key: "draws", label: "Số trận hoà" }, { key: "heightCm", label: "Chiều cao (cm)" }, { key: "reachCm", label: "Tầm với (cm)" }] as const;
const profileText = (p: OpponentProfile) => Object.fromEntries(numeric.map(n => [n.key, p[n.key] == null ? "" : String(p[n.key])]));
export function OpponentEditor({ bout, preview, onSaved }: { bout: CampDetail; preview: boolean; onSaved: (a: Analysis, missing: string[]) => void }) {
  const [draft, setDraft] = useState(() => makeInput(bout.opponentAnalysis));
  const [numbers, setNumbers] = useState(() => profileText(bout.opponentAnalysis.profile ?? {}));
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false); const lock = useRef(false);
  const [priorBusy, setPriorBusy] = useState(false);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessions, setSessions] = useState(bout.sessions ?? []);
  const [moreSessions, setMoreSessions] = useState(true); const [sessionBusy, setSessionBusy] = useState(false);
  const readonly = bout.status === "COMPLETED" || bout.status === "CANCELLED";
  const disabled = readonly || pending || priorBusy;
  const obs = (id: string, patch: Partial<Observation>) => { setDraft(d => ({ ...d, observations: d.observations.map(o => o.id === id ? { ...o, ...patch } : o) })); setMessage(""); };
  const tactic = (id: string, patch: Partial<Tactic>) => { setDraft(d => ({ ...d, tactics: d.tactics.map(t => t.id === id ? { ...t, ...patch } : t) })); setMessage(""); };
  const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  async function loadSessions() {
    if (sessionBusy) return; setSessionBusy(true); setError("");
    try {
      if (preview) { setSessions(previewBout.sessions ?? []); setMoreSessions(false); }
      else { const page = await listTrainingSessions({ fighterId: bout.fighterId, page: sessionPage, limit: 20 }); setSessions(p => [...new Map([...p, ...page.data.map(s => ({ id: s.id, title: s.title, scheduledAt: s.scheduledAt }))].map(s => [s.id, s])).values()]); setMoreSessions(page.hasNextPage); setSessionPage(p => p + 1); }
    } catch (e) { setError(campError(e)); } finally { setSessionBusy(false); }
  }
  async function save() {
    if (lock.current || readonly) return; lock.current = true; setPending(true); setError(""); setMessage("");
    try {
      const profile = { ...draft.profile };
      for (const n of numeric) {
        const raw = numbers[n.key]?.trim();
        if (!raw) { delete profile[n.key]; continue; }
        const count = ["wins", "losses", "draws"].includes(n.key);
        if (!(count ? /^\d+$/ : /^\d+([.,]\d)?$/).test(raw)) throw new Error(`${n.label}: nhập ${count ? "số nguyên không âm" : "số dương"}.`);
        const value = Number(raw.replace(",", "."));
        if (!Number.isFinite(value) || (count ? value < 0 : value <= 0)) throw new Error(`${n.label} chưa hợp lệ.`);
        profile[n.key] = value;
      }
      const input: AnalysisInput = { profile, observations: draft.observations.map(o => ({ ...o, text: o.text.trim(), evidenceUrl: o.evidenceUrl?.trim() || null, evidenceNote: o.evidenceNote?.trim() || null })), tactics: draft.tactics.map(t => ({ ...t, text: t.text.trim() })) };
      validateAnalysis(input, bout.scheduledRounds);
      const saved = preview ? { opponentAnalysis: input, tacticsWithoutSessions: input.tactics.filter(t => !t.sessionIds.length).map(t => t.id) } : await campApi.saveAnalysis(bout.id, input);
      onSaved(saved.opponentAnalysis, saved.tacticsWithoutSessions); setDraft(makeInput(saved.opponentAnalysis)); setMessage("Đã lưu phân tích đối thủ");
    } catch (e) { setError(campError(e)); } finally { lock.current = false; setPending(false); }
  }
  return <>
    {readonly ? <Notice title="Hồ sơ chỉ đọc">Không sửa phân tích khi trận đã kết thúc hoặc bị huỷ. Đánh giá chiến thuật nằm ở báo cáo trận.</Notice> : null}
    {!readonly && bout.opponentName ? <Action label="Chép trận trước, thay bản đang soạn" secondary pending={priorBusy} disabled={pending} onPress={() => {
      if (priorBusy) return; setPriorBusy(true); setError(""); setMessage("");
      void (preview ? Promise.resolve({ copyableAnalysis: { opponentAnalysis: previewBout.opponentAnalysis } }) : campApi.prior(bout.fighterId, bout.opponentName!)).then(data => {
        if (!data.copyableAnalysis) { setMessage("Chưa có phân tích trận trước để chép."); return; }
        const a = makeInput(data.copyableAnalysis.opponentAnalysis); setDraft(a); setNumbers(profileText(a.profile)); setMessage("Đã chép vào bản đang soạn. Bấm lưu để ghi thay đổi.");
      }).catch(e => setError(campError(e))).finally(() => setPriorBusy(false));
    }}/> : null}
    <SvgTitle small>Hồ sơ đối thủ</SvgTitle>
    <Copy large strong>{bout.opponentName || "Chưa xác định đối thủ"}</Copy>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{numeric.map(n => <View key={n.key} style={{ flexBasis: "45%", flexGrow: 1 }}><Field label={n.label} inputMode="decimal" maxLength={6} value={numbers[n.key] ?? ""} editable={!disabled} onChangeText={v => { setNumbers(p => ({ ...p, [n.key]: v })); setMessage(""); }}/></View>)}</View>
    <Choices<OpponentProfile["stance"]> label="Tư thế" value={draft.profile.stance} disabled={disabled} onChange={stance => setDraft(d => ({ ...d, profile: { ...d.profile, stance } }))} options={[{ value: undefined, label: "Chưa rõ" }, { value: "ORTHODOX", label: "Thuận phải" }, { value: "SOUTHPAW", label: "Thuận trái" }, { value: "SWITCH", label: "Đổi thế" }]}/>
    <Choices<OpponentProfile["style"]> label="Lối đánh" value={draft.profile.style} disabled={disabled} onChange={style => setDraft(d => ({ ...d, profile: { ...d.profile, style } }))} options={[{ value: undefined, label: "Chưa rõ" }, { value: "STRIKER", label: "Đánh đứng" }, { value: "WRESTLER", label: "Vật" }, { value: "GRAPPLER", label: "Địa chiến" }, { value: "ALL_ROUND", label: "Toàn diện" }]}/>
    <Field label="Nguồn hồ sơ (tuỳ chọn)" value={draft.profile.source ?? ""} editable={!disabled} maxLength={500} onChangeText={source => setDraft(d => ({ ...d, profile: { ...d.profile, source } }))}/>
    <SvgTitle small>Quan sát có căn cứ</SvgTitle><Copy muted>{draft.observations.length}/6 quan sát</Copy>
    {draft.observations.map((o, i) => <Frame key={o.id}>
      <Copy strong>Quan sát {i + 1}</Copy>
      <Choices<Observation["kind"]> value={o.kind} disabled={disabled} onChange={kind => obs(o.id, { kind })} options={[{ value: "STRENGTH", label: "Điểm mạnh" }, { value: "OPENING", label: "Sơ hở" }, { value: "HABIT", label: "Thói quen" }]}/>
      <Field label="Nội dung quan sát" value={o.text} onChangeText={text => obs(o.id, { text })} multiline maxLength={300} editable={!disabled}/>
      <Choices<Observation["confidence"]> label="Số lần quan sát" value={o.confidence} disabled={disabled} onChange={confidence => obs(o.id, { confidence })} options={[{ value: "ONCE", label: "Một lần" }, { value: "REPEATED", label: "Lặp lại" }]}/>
      <Field label="Đường dẫn bằng chứng" value={o.evidenceUrl ?? ""} onChangeText={evidenceUrl => obs(o.id, { evidenceUrl })} inputMode="url" autoCapitalize="none" maxLength={2000} editable={!disabled}/>
      <Field label="Ghi chú bằng chứng" helper="Cần ít nhất đường dẫn hoặc ghi chú bằng chứng." value={o.evidenceNote ?? ""} onChangeText={evidenceNote => obs(o.id, { evidenceNote })} multiline maxLength={1000} editable={!disabled}/>
      <Field label="Mốc thời gian trong video (tuỳ chọn)" value={o.evidenceTime ?? ""} placeholder="Ví dụ 02:14" onChangeText={evidenceTime => obs(o.id, { evidenceTime })} maxLength={30} editable={!disabled}/>
      {!readonly ? <Action label={`Bỏ quan sát ${i + 1}`} secondary disabled={disabled} onPress={() => setDraft(d => ({ ...d, observations: d.observations.filter(x => x.id !== o.id), tactics: d.tactics.map(t => ({ ...t, observationIds: t.observationIds.filter(id => id !== o.id) })) }))}/> : null}
    </Frame>)}
    {!readonly ? <Action label="Thêm quan sát" secondary disabled={disabled || draft.observations.length >= 6} onPress={() => setDraft(d => ({ ...d, observations: [...d.observations, { id: newId("o"), text: "", kind: "OPENING", confidence: "ONCE", evidenceNote: "" }] }))}/> : null}
    <SvgTitle small>Chiến thuật và buổi tập</SvgTitle><Copy muted>{draft.tactics.length}/5 chiến thuật</Copy>
    {draft.tactics.map((t, i) => <Frame key={t.id}>
      <Field label={`Chiến thuật ${i + 1}`} value={t.text} onChangeText={text => tactic(t.id, { text })} multiline maxLength={1000} editable={!disabled}/>
      <Choices<number | null> label="Hiệp áp dụng" value={t.round} disabled={disabled} onChange={round => tactic(t.id, { round })} options={[{ value: null, label: "Mọi hiệp" }, ...Array.from({ length: bout.scheduledRounds ?? 12 }, (_, n) => ({ value: n + 1, label: `Hiệp ${n + 1}` }))]}/>
      <Copy strong>Quan sát làm căn cứ (chọn ít nhất một)</Copy>
      {draft.observations.map((o, n) => <Choices key={o.id} label={`${n + 1}. ${o.text || "Quan sát chưa có nội dung"}`} value={t.observationIds.includes(o.id) ? "yes" : "no"} disabled={disabled} options={[{ value: "no", label: "Không chọn" }, { value: "yes", label: "Làm căn cứ" }]} onChange={v => tactic(t.id, { observationIds: v === "yes" ? [...t.observationIds.filter(id => id !== o.id), o.id] : t.observationIds.filter(id => id !== o.id) })}/>)}
      <Copy strong>Buổi tập đã luyện</Copy>
      {sessions.map(s => <Choices key={s.id} label={`${s.title} · ${dateLabel(s.scheduledAt)}`} value={t.sessionIds.includes(s.id) ? "yes" : "no"} disabled={disabled} options={[{ value: "no", label: "Không gắn" }, { value: "yes", label: "Gắn buổi tập" }]} onChange={v => tactic(t.id, { sessionIds: v === "yes" ? [...t.sessionIds.filter(id => id !== s.id), s.id] : t.sessionIds.filter(id => id !== s.id) })}/>)}
      {!sessions.length ? <Copy muted>Chưa tải buổi tập. Chiến thuật chưa gắn buổi tập sẽ hiện “Chưa luyện”.</Copy> : null}
      <Field label="Dặn bạn tập (tuỳ chọn)" value={t.partnerBrief ?? ""} onChangeText={partnerBrief => tactic(t.id, { partnerBrief })} multiline maxLength={1000} editable={!disabled}/>
      {!readonly ? <Action label={`Bỏ chiến thuật ${i + 1}`} secondary disabled={disabled} onPress={() => setDraft(d => ({ ...d, tactics: d.tactics.filter(x => x.id !== t.id) }))}/> : null}
    </Frame>)}
    {!readonly ? <>
      {moreSessions ? <Action label="Tải thêm buổi tập để gắn chiến thuật" secondary pending={sessionBusy} disabled={disabled} onPress={() => void loadSessions()}/> : null}
      <Action label="Thêm chiến thuật" secondary disabled={disabled || draft.tactics.length >= 5 || !draft.observations.length} onPress={() => setDraft(d => ({ ...d, tactics: [...d.tactics, { id: newId("t"), text: "", round: null, observationIds: [], sessionIds: [], partnerBrief: null }] }))}/>
    </> : null}
    {error ? <Notice title="Chưa lưu được phân tích" danger>{error}</Notice> : null}{message ? <Notice title={message}/> : null}
    {!readonly ? <Action label="Lưu phân tích đối thủ" pending={pending} disabled={priorBusy} onPress={() => void save()}/> : null}
  </>;
}
