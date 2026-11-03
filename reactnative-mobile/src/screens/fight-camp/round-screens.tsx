import { useState } from "react";
import { Image, View } from "react-native";
import { campApi, type CampDetail } from "@/api/fight-camp";
import { Action, Busy, Choices, Copy, Frame, Notice } from "./camp-ui";
import { kg } from "./camp-rules";
import { useCampResource } from "./use-camp-resource";
import { previewCornerCard } from "./round-advice-preview";
import { readPreviewRounds } from "./preview-round-store";
import { RoundAdvicePanel } from "./round-advice-panel";
import { betweenRound as planCopy } from "@/i18n/between-round";
import { cornerPlanTactics } from "./next-round-plan";
import { campText } from "@/i18n/fight-camp";

function ResourceError({ error, retry }: { error: string; retry: () => void }) { return error ? <><Notice title={campText.roundScreens.khongTaiDuocDuLieu} danger>{error}</Notice><Action label={campText.roundScreens.taiLai} secondary onPress={retry}/></> : null; }

export function CornerScreen({ bout, name, preview, onRounds }: { bout: CampDetail; name: string; preview: boolean; onRounds: () => void }) {
  const state = useCampResource(`corner:${bout.id}:${preview}`, async () => {
    const [card, rounds] = await Promise.all([
      preview ? Promise.resolve(previewCornerCard(bout.opponentAnalysis, readPreviewRounds(bout).rounds, bout.acuteLoss)) : campApi.corner(bout.id),
      preview ? Promise.resolve(readPreviewRounds(bout)) : campApi.rounds(bout.id),
    ]);
    return { ...card, tactics: cornerPlanTactics(card, rounds) };
  });
  const [round, setRound] = useState<number | null>(null);
  const c = state.data;
  return <>
    {state.loading && !c ? <Busy/> : null}<ResourceError error={state.error} retry={() => void state.reload()}/>
    {c ? <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1, gap: 9 }}><Copy large strong>{name}</Copy><Copy muted>{campText.roundScreens.doiThu}{bout.opponentName || campText.roundScreens.chuaXacDinh}</Copy><Copy>{kg(bout.catchweightKg ?? bout.weightLimitKg)} {campText.roundScreens.kg}{bout.scheduledRounds ?? "—"} {campText.roundScreens.hiep}</Copy></View>
        <Image source={require("../../../assets/fight-camp/corner-stool.webp")} accessibilityLabel={campText.roundScreens.gocDaiVoiGheVa} resizeMode="contain" style={{ width: 108, height: 126 }}/>
      </View>
      {c.acuteLossFlag ? <Notice title={campText.roundScreens.giamCanCapTocVuot} danger>{campText.roundScreens.hlvCanLuuYCanh}</Notice> : null}
      <Choices<number | null> label={campText.roundScreens.chienThuatTheoHiep} value={round} onChange={setRound} options={[{ value: null, label: campText.roundScreens.tatCa }, ...Array.from({ length: bout.scheduledRounds ?? 0 }, (_, i) => ({ value: i + 1, label: campText.roundScreens.hiep2(i + 1) }))]}/>
      {c.tactics.filter(t => round == null || t.round == null || t.round === round).map((t, i) => <Frame key={t.id}>
        <Copy muted>{t.round == null ? campText.roundScreens.moiHiep : campText.roundScreens.hiep3(t.round)} · {t.basis === "REPEATED" ? campText.roundScreens.quanSatLapLai : campText.roundScreens.quanSatMotLan}</Copy>
        <Copy large strong>{t.text}</Copy>
        {t.focus ? <Copy strong>{planCopy.focus}</Copy> : null}
        {t.addedRound != null ? <Copy muted>{planCopy.addedAt(t.addedRound)}</Copy> : null}
        {!t.trained ? <Copy strong>{campText.roundScreens.chuaLuyen}</Copy> : <Copy muted>{campText.roundScreens.daGanBuoiTap}</Copy>}
        {t.partnerBrief ? <Copy muted>{campText.roundScreens.doiLuyen}{t.partnerBrief}</Copy> : null}
      </Frame>)}
      {!c.tactics.some(t => round == null || t.round == null || t.round === round) ? <Notice title={campText.roundScreens.chuaCoChienThuatCho}/> : null}
      <Action label={campText.roundScreens.ghiChuVaGhiHiep} onPress={onRounds}/>
    </> : null}
  </>;
}

export { RoundScreen, type RoundDraftState } from './round-entry-screen';
export { ReportScreen } from './report-screen';

export function AdviceScreen({ bout, preview }: { bout: CampDetail; preview: boolean }) {
  const state = useCampResource(`advice:${bout.id}:${preview}`, () => preview ? Promise.resolve(readPreviewRounds(bout)) : campApi.rounds(bout.id));
  return <>
    {state.loading ? <Busy/> : null}<ResourceError error={state.error} retry={() => void state.reload()}/>
    {state.data && !state.error ? <RoundAdvicePanel data={state.data} refreshing={state.loading} heading={false}/> : null}
  </>;
}
