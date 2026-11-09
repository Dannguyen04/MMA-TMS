import { useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { campApi, type Analysis, type AnalysisInput, type CampDetail, type Observation, type OpponentProfile, type Tactic } from "@/api/fight-camp";
import { listTrainingSessions } from "@/api/training";
import { fonts, useThemePreference } from "@/theme";
import { readableTextStyle } from "@/theme/typography";
import { Action, CampFooter, CampIcon, Choices, Copy, Field, Frame, Notice, PlanToggle } from "./camp-ui";
import { campError, dateLabel, validateAnalysis } from "./camp-rules";
import { previewBout } from "./camp-preview";
import { CampInputError } from "./camp-input-error";
import { useCampTwoColumns } from "./camp-columns";
import { campText } from "@/i18n/fight-camp";

const t = campText.opponentEditor;
const makeInput = (a: Analysis): AnalysisInput => ({ profile: { ...a.profile }, observations: (a.observations ?? []).map(o => ({ ...o })), tactics: (a.tactics ?? []).map(({ review: _review, ...x }) => ({ ...x, observationIds: [...x.observationIds], sessionIds: [...x.sessionIds] })) });
const numeric = [{ key: "wins", label: t.soTranThang }, { key: "losses", label: t.soTranThua }, { key: "draws", label: t.soTranHoa }, { key: "heightCm", label: t.chieuCaoCm }, { key: "reachCm", label: t.tamVoiCm }] as const;
type Numbers = Record<(typeof numeric)[number]["key"], string>;
const profileText = (p: OpponentProfile): Numbers => Object.fromEntries(numeric.map(n => [n.key, p[n.key] == null ? "" : String(p[n.key])])) as Numbers;
/** What counts as "unsaved": the draft plus the raw number text, compared with the last saved state. */
const snapshot = (d: AnalysisInput, n: Numbers) => JSON.stringify([d, n]);
const KIND: readonly { value: Observation["kind"]; label: string }[] = [{ value: "OPENING", label: t.soHo }, { value: "HABIT", label: t.thoiQuen }, { value: "STRENGTH", label: t.diemManh }];
const CONF: readonly { value: Observation["confidence"]; label: string }[] = [{ value: "ONCE", label: t.motLan }, { value: "REPEATED", label: t.lapLai }];
const STANCE: readonly { value: OpponentProfile["stance"]; label: string }[] = [{ value: "ORTHODOX", label: t.thuanPhai }, { value: "SOUTHPAW", label: t.thuanTrai }, { value: "SWITCH", label: t.doiThe }, { value: undefined, label: t.chuaRo }];
const STYLE: readonly { value: OpponentProfile["style"]; label: string }[] = [{ value: "STRIKER", label: t.danhDung }, { value: "WRESTLER", label: t.vat }, { value: "GRAPPLER", label: t.diaChien }, { value: "ALL_ROUND", label: t.toanDien }, { value: undefined, label: t.chuaRo2 }];
const labelOf = <T,>(list: readonly { value: T; label: string }[], v: T) => list.find(x => x.value === v)?.label;
const hasEvidence = (o: Observation) => !!(o.evidenceUrl?.trim() || o.evidenceNote?.trim());
type Tab = "obs" | "tac";

/**
 * Opponent analysis as a coach's scouting sheet: one slip for the opponent (record and traits), then ruled ledgers of
 * observations and tactics. One item is edited at a time: in place on phones, beside the ledger on two columns.
 */
export function OpponentEditor({ bout, preview, onSaved }: { bout: CampDetail; preview: boolean; onSaved: (a: Analysis, missing: string[]) => void }) {
  const { colors: c } = useThemePreference();
  const wide = useCampTwoColumns();
  const [draft, setDraft] = useState(() => makeInput(bout.opponentAnalysis));
  const [numbers, setNumbers] = useState(() => profileText(bout.opponentAnalysis.profile ?? {}));
  const [saved, setSaved] = useState(() => snapshot(makeInput(bout.opponentAnalysis), profileText(bout.opponentAnalysis.profile ?? {})));
  const [tab, setTab] = useState<Tab>("obs");
  const [open, setOpen] = useState<Record<Tab, string | null>>({ obs: null, tac: null });
  const [profileOpen, setProfileOpen] = useState(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false); const lock = useRef(false);
  const [priorBusy, setPriorBusy] = useState(false);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessions, setSessions] = useState(bout.sessions ?? []);
  const [moreSessions, setMoreSessions] = useState(true); const [sessionBusy, setSessionBusy] = useState(false);
  const readonly = bout.status === "COMPLETED" || bout.status === "CANCELLED";
  const disabled = readonly || pending || priorBusy;
  const dirty = snapshot(draft, numbers) !== saved;
  const edited = () => { setMessage(""); setError(""); };
  const obs = (id: string, patch: Partial<Observation>) => { setDraft(d => ({ ...d, observations: d.observations.map(o => o.id === id ? { ...o, ...patch } : o) })); edited(); };
  const tactic = (id: string, patch: Partial<Tactic>) => { setDraft(d => ({ ...d, tactics: d.tactics.map(x => x.id === id ? { ...x, ...patch } : x) })); edited(); };
  const profile = (patch: Partial<OpponentProfile>) => { setDraft(d => ({ ...d, profile: { ...d.profile, ...patch } })); edited(); };
  const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  const qsNo = (id: string) => draft.observations.findIndex(o => o.id === id) + 1;

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
      const prof = { ...draft.profile };
      for (const n of numeric) {
        const raw = numbers[n.key]?.trim();
        if (!raw) { delete prof[n.key]; continue; }
        const count = ["wins", "losses", "draws"].includes(n.key);
        if (!(count ? /^\d+$/ : /^\d+([.,]\d)?$/).test(raw)) throw new CampInputError(t.nhap(n.label, count ? t.soNguyenKhongAm : t.soDuong));
        const value = Number(raw.replace(",", "."));
        if (!Number.isFinite(value) || (count ? value < 0 : value <= 0)) throw new CampInputError(t.chuaHopLe(n.label));
        prof[n.key] = value;
      }
      const input: AnalysisInput = { profile: prof, observations: draft.observations.map(o => ({ ...o, text: o.text.trim(), evidenceUrl: o.evidenceUrl?.trim() || null, evidenceNote: o.evidenceNote?.trim() || null })), tactics: draft.tactics.map(x => ({ ...x, text: x.text.trim() })) };
      validateAnalysis(input, bout.scheduledRounds);
      const result = preview ? { opponentAnalysis: input, tacticsWithoutSessions: input.tactics.filter(x => !x.sessionIds.length).map(x => x.id) } : await campApi.saveAnalysis(bout.id, input);
      onSaved(result.opponentAnalysis, result.tacticsWithoutSessions);
      const next = makeInput(result.opponentAnalysis); const nextNumbers = profileText(result.opponentAnalysis.profile ?? {});
      setDraft(next); setNumbers(nextNumbers); setSaved(snapshot(next, nextNumbers)); setMessage(t.daLuuPhanTichDoi);
    } catch (e) { setError(campError(e)); } finally { lock.current = false; setPending(false); }
  }
  function copyPrior() {
    if (priorBusy) return; setPriorBusy(true); edited();
    void (preview ? Promise.resolve({ copyableAnalysis: { opponentAnalysis: previewBout.opponentAnalysis } }) : campApi.prior(bout.fighterId, bout.opponentName!)).then(data => {
      if (!data.copyableAnalysis) { setMessage(t.chuaCoPhanTichTran); return; }
      const a = makeInput(data.copyableAnalysis.opponentAnalysis); setDraft(a); setNumbers(profileText(a.profile)); setOpen({ obs: null, tac: null }); setMessage(t.daChepVaoBanDang);
    }).catch(e => setError(campError(e))).finally(() => setPriorBusy(false));
  }

  // ---- Opponent slip -------------------------------------------------------------------------------------------
  const p = draft.profile;
  const summary = [labelOf(STANCE, p.stance) && p.stance ? labelOf(STANCE, p.stance) : t.tuTheChuaRo, p.style ? labelOf(STYLE, p.style) : t.loiDanhChuaRo, numbers.heightCm ? t.cm(numbers.heightCm) : "", numbers.reachCm ? t.tamVoi(numbers.reachCm) : ""].filter(Boolean).join(" · ");
  const num = (key: keyof Numbers, value: string) => { setNumbers(n => ({ ...n, [key]: value })); edited(); };
  const record = <View>
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
      {(["wins", "losses", "draws"] as const).map((key, i) => <View key={key} style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
        {i ? <Text style={[styles.recordDash, { color: c.inkSubtle, fontFamily: fonts.display }]}>–</Text> : null}
        <TextInput accessibilityLabel={numeric[i]!.label} value={numbers[key]} onChangeText={v => num(key, v)} editable={!disabled} inputMode="numeric" keyboardType="number-pad" maxLength={3} placeholder="0" placeholderTextColor={c.inkSubtle} selectionColor={c.ring}
          style={[styles.recordNum, { color: c.ink, fontFamily: fonts.display }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]}/>
      </View>)}
    </View>
    <View style={{ flexDirection: "row", gap: 6 }}>{[t.thang, t.thua, t.hoa].map((l, i) => <View key={l} style={{ flexDirection: "row", gap: 6 }}>{i ? <View style={{ width: 14 }}/> : null}<Text style={[styles.legend, { color: c.inkMuted }]}>{l}</Text></View>)}</View>
  </View>;
  const traits = <View style={{ gap: 14 }}>
    <Choices<OpponentProfile["stance"]> label={t.tuThe} value={p.stance} disabled={disabled} options={STANCE} onChange={stance => profile({ stance })}/>
    <Choices<OpponentProfile["style"]> label={t.loiDanh} value={p.style} disabled={disabled} options={STYLE} onChange={style => profile({ style })}/>
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ flex: 1 }}><Field label={t.chieuCaoCm} inputMode="decimal" maxLength={6} value={numbers.heightCm} editable={!disabled} onChangeText={v => num("heightCm", v)}/></View>
      <View style={{ flex: 1 }}><Field label={t.tamVoiCm} inputMode="decimal" maxLength={6} value={numbers.reachCm} editable={!disabled} onChangeText={v => num("reachCm", v)}/></View>
    </View>
    <Field label={t.nguonHoSoTuyChon} value={p.source ?? ""} editable={!disabled} maxLength={500} onChangeText={source => profile({ source })}/>
    {!wide ? <TextButton label={t.xong} onPress={() => setProfileOpen(false)}/> : null}
  </View>;
  const slip = <Frame pad={18}>
    <View style={wide ? { flexDirection: "row", gap: 32, alignItems: "flex-start" } : { gap: 12 }}>
      <View style={wide ? { flex: 0.9, gap: 12, minWidth: 0 } : { gap: 12 }}>
        <View>
          <Text style={[styles.oppName, { color: c.ink, fontFamily: fonts.display }]}>{bout.opponentName || t.chuaXacDinhDoiThu}</Text>
          <Copy muted small>{`${bout.eventName} · ${dateLabel(bout.boutAt)}`}</Copy>
        </View>
        {record}
      </View>
      {wide ? <View style={{ flex: 1.1, minWidth: 0 }}>{traits}</View>
        : profileOpen ? traits
        : <Pressable accessibilityRole="button" accessibilityLabel={t.suaHoSo} accessibilityHint={summary} onPress={() => setProfileOpen(true)} style={[styles.summary, { borderTopColor: c.line }]}>
            <View style={{ flex: 1 }}><Copy>{summary}</Copy></View><Copy strong color={c.lotus}>{t.sua}</Copy>
          </Pressable>}
    </View>
  </Frame>;

  // ---- Ledgers -------------------------------------------------------------------------------------------------
  const obsForm = (o: Observation) => <View style={{ gap: 16 }}>
    <Choices<Observation["kind"]> label={t.loai} value={o.kind} disabled={disabled} options={KIND} onChange={kind => obs(o.id, { kind })}/>
    <Field label={t.daThayGi} value={o.text} onChangeText={text => obs(o.id, { text })} multiline maxLength={300} editable={!disabled} placeholder={t.viDuQuanSat}/>
    <Choices<Observation["confidence"]> label={t.soLanThay} value={o.confidence} disabled={disabled} options={CONF} onChange={confidence => obs(o.id, { confidence })}/>
    <SectionLabel>{t.bangChung}</SectionLabel>
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ flex: 1.6 }}><Field label={t.ghiChu} value={o.evidenceNote ?? ""} onChangeText={evidenceNote => obs(o.id, { evidenceNote })} maxLength={1000} editable={!disabled} error={hasEvidence(o) ? undefined : t.canGhiChuHoacDuongDan}/></View>
      <View style={{ flex: 1 }}><Field label={t.mocVideo} value={o.evidenceTime ?? ""} onChangeText={evidenceTime => obs(o.id, { evidenceTime })} maxLength={30} editable={!disabled} placeholder="02:14"/></View>
    </View>
    <Field label={t.duongDanVideo} value={o.evidenceUrl ?? ""} onChangeText={evidenceUrl => obs(o.id, { evidenceUrl })} inputMode="url" autoCapitalize="none" maxLength={2000} editable={!disabled} placeholder="https://"/>
    <EditorActions readonly={readonly} disabled={disabled} removeLabel={t.boQuanSat(qsNo(o.id))} onDone={() => setOpen(s => ({ ...s, obs: null }))}
      onRemove={() => { setDraft(d => ({ ...d, observations: d.observations.filter(x => x.id !== o.id), tactics: d.tactics.map(x => ({ ...x, observationIds: x.observationIds.filter(id => id !== o.id) })) })); setOpen(s => ({ ...s, obs: null })); edited(); }}/>
  </View>;
  const tacForm = (x: Tactic, i: number) => <View style={{ gap: 16 }}>
    <Field label={t.chienThuat(i + 1)} value={x.text} onChangeText={text => tactic(x.id, { text })} multiline maxLength={1000} editable={!disabled} placeholder={t.viDuChienThuat}/>
    <Choices<number | null> label={t.apDung} value={x.round} disabled={disabled} onChange={round => tactic(x.id, { round })} options={[{ value: null, label: t.moiHiep }, ...Array.from({ length: bout.scheduledRounds ?? 12 }, (_, n) => ({ value: n + 1, label: t.hiep(n + 1) }))]}/>
    <View style={{ gap: 8 }}>
      <SectionLabel>{t.duaTrenQuanSat}</SectionLabel>
      {!x.observationIds.length ? <Copy small color={c.danger}>{t.chonItNhatMot}</Copy> : null}
      {draft.observations.map(o => <PlanToggle key={o.id} label={`${t.qs(qsNo(o.id))} · ${o.text || t.chuaGhiNoiDung}`} selected={x.observationIds.includes(o.id)} disabled={disabled}
        onPress={() => tactic(x.id, { observationIds: x.observationIds.includes(o.id) ? x.observationIds.filter(id => id !== o.id) : [...x.observationIds, o.id] })}/>)}
    </View>
    <View style={{ gap: 8 }}>
      <SectionLabel>{t.daLuyenOBuoi}</SectionLabel>
      {sessions.map(s => <PlanToggle key={s.id} label={`${s.title} · ${dateLabel(s.scheduledAt)}`} selected={x.sessionIds.includes(s.id)} disabled={disabled}
        onPress={() => tactic(x.id, { sessionIds: x.sessionIds.includes(s.id) ? x.sessionIds.filter(id => id !== s.id) : [...x.sessionIds, s.id] })}/>)}
      {!sessions.length ? <Copy muted small>{t.chuaTaiBuoiTapChien}</Copy> : null}
      {!readonly && moreSessions ? <TextButton label={sessionBusy ? "…" : t.xemBuoiCuHon} muted onPress={() => void loadSessions()} disabled={disabled || sessionBusy}/> : null}
    </View>
    <Field label={t.danBanTapTuyChon} value={x.partnerBrief ?? ""} onChangeText={partnerBrief => tactic(x.id, { partnerBrief })} multiline maxLength={1000} editable={!disabled}/>
    <EditorActions readonly={readonly} disabled={disabled} removeLabel={t.boChienThuat(i + 1)} onDone={() => setOpen(s => ({ ...s, tac: null }))}
      onRemove={() => { setDraft(d => ({ ...d, tactics: d.tactics.filter(y => y.id !== x.id) })); setOpen(s => ({ ...s, tac: null })); edited(); }}/>
  </View>;

  const toggle = (k: Tab, id: string) => setOpen(s => ({ ...s, [k]: s[k] === id && !wide ? null : id }));
  const obsRows = draft.observations.map((o, i) => {
    const active = open.obs === o.id;
    return <View key={o.id}>
      <LedgerRow tag={labelOf(KIND, o.kind) ?? ""} text={o.text || t.chuaGhiNoiDung} empty={!o.text} code={t.qs(i + 1)} active={active} onPress={() => toggle("obs", o.id)}
        meta={<>
          <Copy small muted>{(labelOf(CONF, o.confidence) ?? "").toLowerCase()}</Copy>
          {o.evidenceTime ? <Copy small muted>{o.evidenceTime}</Copy> : null}
          {!hasEvidence(o) ? <Copy small color={c.danger}>{t.chuaCoBangChung}</Copy> : null}
        </>}/>
      {active && !wide ? <View style={styles.inline}>{obsForm(o)}</View> : null}
    </View>;
  });
  const tacRows = draft.tactics.map((x, i) => {
    const active = open.tac === x.id;
    const basis = x.observationIds.map(id => t.qs(qsNo(id))).filter(s => s !== t.qs(0)).join(", ");
    return <View key={x.id}>
      <LedgerRow tag={x.round ? t.hiep(x.round) : t.moiHiep} text={x.text || t.chuaGhiNoiDung} empty={!x.text} code={t.ct(i + 1)} active={active} onPress={() => toggle("tac", x.id)}
        meta={<>
          {basis ? <Copy small muted>{t.duaTren(basis)}</Copy> : <Copy small color={c.danger}>{t.chuaChonQuanSat}</Copy>}
          {x.sessionIds.length ? <Copy small color={c.success}>{t.daLuyenBuoi(x.sessionIds.length)}</Copy> : <Copy small muted>{t.chuaLuyen}</Copy>}
        </>}/>
      {active && !wide ? <View style={styles.inline}>{tacForm(x, i)}</View> : null}
    </View>;
  });
  const isObs = tab === "obs";
  const count = isObs ? draft.observations.length : draft.tactics.length;
  const max = isObs ? 6 : 5;
  const needsObs = !isObs && !draft.observations.length;
  const add = () => {
    const id = newId(isObs ? "o" : "t");
    setDraft(d => isObs ? { ...d, observations: [...d.observations, { id, text: "", kind: "OPENING", confidence: "ONCE", evidenceNote: "" }] } : { ...d, tactics: [...d.tactics, { id, text: "", round: null, observationIds: [], sessionIds: [], partnerBrief: null }] });
    setOpen(s => ({ ...s, [tab]: id })); edited();
  };
  const ledger = <View>
    {isObs ? obsRows : tacRows}
    {!readonly ? <AddRow label={isObs ? t.themQuanSat : t.themChienThuat} note={needsObs ? t.canMotQuanSatTruoc : `${count}/${max}`} disabled={disabled || count >= max || needsObs} onPress={add}/> : null}
  </View>;
  const selectedObs = draft.observations.find(o => o.id === open.obs);
  const selectedTac = draft.tactics.find(x => x.id === open.tac);
  const side = isObs
    ? selectedObs ? <Frame pad={18}><EditorTitle>{t.quanSatN(qsNo(selectedObs.id))}</EditorTitle>{obsForm(selectedObs)}</Frame> : <Copy muted>{t.chonQuanSatDeSua}</Copy>
    : selectedTac ? <Frame pad={18}><EditorTitle>{t.chienThuat(draft.tactics.indexOf(selectedTac) + 1)}</EditorTitle>{tacForm(selectedTac, draft.tactics.indexOf(selectedTac))}</Frame> : <Copy muted>{t.chonChienThuatDeSua}</Copy>;

  return <>
    {readonly ? <Notice title={t.hoSoChiDoc}>{t.khongSuaPhanTichKhi}</Notice> : null}
    {slip}
    {!readonly && bout.opponentName ? <TextButton label={priorBusy ? "…" : t.chepLanTruoc} muted onPress={copyPrior} disabled={pending || priorBusy}/> : null}
    <SheetTabs value={tab} onChange={setTab} tabs={[{ key: "obs", label: t.tabQuanSat, count: draft.observations.length }, { key: "tac", label: t.tabChienThuat, count: draft.tactics.length }]}/>
    {wide ? <View style={{ flexDirection: "row", gap: 32, alignItems: "flex-start" }}>
      <View style={{ flex: 1, minWidth: 0 }}>{ledger}</View>
      <View style={{ flex: 1.1, minWidth: 0, paddingTop: 14 }}>{side}</View>
    </View> : ledger}
    {!readonly ? <CampFooter>
      {error ? <Notice title={t.chuaLuuDuocPhanTich} danger>{error}</Notice> : null}
      {message && !dirty ? <Notice title={message} success/> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ flex: 1 }}><Copy small muted={!dirty}>{dirty ? t.coThayDoiChuaLuu : t.daLuu}</Copy></View>
        <View style={{ flex: 1.4 }}><Action label={t.luuPhanTich} pending={pending} disabled={!dirty || priorBusy} onPress={() => void save()}/></View>
      </View>
    </CampFooter> : null}
  </>;
}

/** One ledger line: a small-caps tag column, the text, a short code, and a line of facts. Selected = surface fill. */
function LedgerRow({ tag, text, empty, code, meta, active, onPress }: { tag: string; text: string; empty: boolean; code: string; meta: ReactNode; active: boolean; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${code}, ${tag}: ${text}`} accessibilityState={{ expanded: active }} onPress={onPress}
    style={[styles.row, { borderBottomColor: c.line, backgroundColor: active ? c.surface : "transparent" }]}>
    <Text style={[styles.tag, { color: active ? c.lotus : c.inkMuted, fontFamily: fonts.display }]}>{tag}</Text>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Copy strong color={empty ? c.inkSubtle : undefined}>{text}</Copy>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 2 }}>{meta}</View>
    </View>
    <Copy small muted>{code}</Copy>
  </Pressable>;
}

/** Two section tabs drawn as condensed uppercase words over one rule; the selected tab gets the red underline. */
function SheetTabs<K extends string>({ value, onChange, tabs }: { value: K; onChange: (k: K) => void; tabs: { key: K; label: string; count: number }[] }) {
  const { colors: c } = useThemePreference();
  return <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: c.line }]}>
    {tabs.map(x => { const on = x.key === value;
      return <Pressable key={x.key} accessibilityRole="tab" accessibilityLabel={`${x.label} ${x.count}`} accessibilityState={{ selected: on }} onPress={() => onChange(x.key)}
        style={[styles.tab, { borderBottomColor: on ? c.lotus : "transparent" }]}>
        <Text style={{ fontFamily: fonts.display, fontSize: 19, letterSpacing: 0.6, textTransform: "uppercase", color: on ? c.ink : c.inkMuted }}>
          {x.label}<Text style={{ ...readableTextStyle(12), color: c.inkSubtle }}>{` ${x.count}`}</Text>
        </Text>
      </Pressable>; })}
  </View>;
}

function AddRow({ label, note, disabled, onPress }: { label: string; note: string; disabled: boolean; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  const ink = disabled ? c.inkSubtle : c.lotus;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={styles.add}>
    <CampIcon name="plus" color={ink} size={18}/><Copy strong color={ink}>{label}</Copy>
    <View style={{ flex: 1, alignItems: "flex-end" }}><Copy small muted>{note}</Copy></View>
  </Pressable>;
}

function TextButton({ label, onPress, muted, disabled }: { label: string; onPress: () => void; muted?: boolean; disabled?: boolean }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
    <Copy strong={!muted} color={disabled ? c.inkSubtle : muted ? c.inkMuted : c.ink}>{label}</Copy>
  </Pressable>;
}

function EditorActions({ readonly, disabled, removeLabel, onRemove, onDone }: { readonly: boolean; disabled: boolean; removeLabel: string; onRemove: () => void; onDone: () => void }) {
  const { colors: c } = useThemePreference();
  return <View style={[styles.actions, { borderTopColor: c.line }]}>
    {!readonly ? <TextButton label={removeLabel} muted disabled={disabled} onPress={onRemove}/> : <View/>}
    <TextButton label={t.xong} onPress={onDone}/>
  </View>;
}

function SectionLabel({ children }: { children: string }) {
  const { colors: c } = useThemePreference();
  return <Text style={{ fontFamily: fonts.display, fontSize: 14, letterSpacing: 1.1, textTransform: "uppercase", color: c.inkMuted }}>{children}</Text>;
}
function EditorTitle({ children }: { children: string }) {
  const { colors: c } = useThemePreference();
  return <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 22, textTransform: "uppercase", color: c.ink, marginBottom: 12 }}>{children}</Text>;
}

const styles = StyleSheet.create({
  oppName: { fontSize: 30, lineHeight: 34, textTransform: "uppercase", letterSpacing: 0.3 },
  recordNum: { fontSize: 46, lineHeight: 52, width: 56, textAlign: "center", padding: 0, borderWidth: 0 },
  recordDash: { fontSize: 30 },
  legend: { fontSize: 12, width: 56, textAlign: "center" },
  summary: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  tabs: { flexDirection: "row", gap: 22, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  tab: { minHeight: 48, justifyContent: "center", borderBottomWidth: 3, marginBottom: -1 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 14, paddingHorizontal: 8, marginHorizontal: -8, borderBottomWidth: StyleSheet.hairlineWidth },
  tag: { width: 74, fontSize: 14, letterSpacing: 1.1, textTransform: "uppercase", paddingTop: 1 },
  inline: { paddingTop: 6, paddingBottom: 18 },
  add: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52 },
  actions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4 },
});
