import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { VIDEO_CAMERA_ANGLES, VIDEO_TRAINING_TYPES } from "@/api/media";
import { Icon } from "@/components/icon";
import { PressableScale } from "@/components/motion";
import { fighterVideo as t } from "@/i18n/fighter-video";
import { media } from "@/i18n/media";
import { LitFill } from "@/screens/fight-camp/camp-lit";
import { Action, CampShell, Copy, Field, Frame } from "@/screens/fight-camp/camp-ui";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useVideoUpload } from "@/screens/media/video-upload";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { pickedLine, VIDEOS, videoHref } from "./video-v2-model";

/** Pick one in a grid (2 across or 3 across): a bordered cell, or a lit fill with light text when chosen. */
function GridChoices<T extends string>({ label, options, value, onChange, columns, disabled }: {
  label: string; options: readonly { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; columns: 2 | 3; disabled?: boolean;
}) {
  const { colors: c } = useThemePreference();
  return <View style={{ gap: 8 }}>
    <Copy strong>{label}</Copy>
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map(o => { const on = value === o.value;
        return <PressableScale key={o.value} testID={`choice-${o.value}`} scaleTo={0.97} disabled={disabled} accessibilityRole="radio" aria-checked={on} accessibilityLabel={o.label} accessibilityState={{ checked: on, disabled }}
          onPress={() => onChange(o.value)} style={{ flexBasis: columns === 2 ? "48%" : "30%", flexGrow: 1, minWidth: 0, minHeight: 46, justifyContent: "center", paddingHorizontal: 4 }}>
          {on ? <LitFill kind="neutral" cut={false}/> : <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 1, borderColor: c.controlBorder }]}/>}
          <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: on ? c.bg : c.ink, textAlign: "center" }}>{o.label}</Text>
        </PressableScale>; })}
    </View>
  </View>;
}

/** Tải video (redesign step 13): the cut-corner picker, title, description, training type 2×2, camera angle 3 across, "Gửi video" pinned. */
export function FighterUploadV2() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const { fighterId, canFetch } = useFighterId();
  const back = () => { if (router.canGoBack()) router.back(); else router.replace(VIDEOS as never); };
  return <VideoUploadPage testID="fighter-upload-v2" fighterId={canFetch ? fighterId : null} onBack={back} onUploaded={id => router.replace(videoHref(id))}
    top={!canFetch ? <Text style={{ ...readableTextStyle(15.5, true), color: c.danger }}>{t.noFighter}</Text> : null}/>;
}

/**
 * The upload form shared by the fighter (step 13) and the coach (step 19). `top` sits above the picker (the coach's
 * fighter field). Without a fighter, "Gửi video" shows `needFighter` instead of sending.
 */
export function VideoUploadPage({ testID, fighterId, top, needFighter, onBack, onUploaded }: {
  testID: string; fighterId: string | null; top?: ReactNode; needFighter?: string; onBack: () => void; onUploaded: (videoId: string) => void;
}) {
  const { colors: c } = useThemePreference();
  const up = useVideoUpload(fighterId, onUploaded);
  const { form, dispatch } = up;
  const asset = form.asset;
  const [missing, setMissing] = useState(false);
  const send = () => {
    if (!fighterId && needFighter) { setMissing(true); return; }
    setMissing(false);
    void up.onSubmit();
  };
  const error = missing && !fighterId ? needFighter : form.error;

  const pickBody = <View style={{ minHeight: 128, alignItems: "center", justifyContent: "center", gap: 4, padding: 16 }}>
      <Icon name={asset ? "film" : "upload"} size={30} color={asset ? "#FFFFFF" : c.lotus}/>
      <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(18), lineHeight: lh(22), letterSpacing: 0.5, textTransform: "uppercase", color: asset ? "#FFFFFF" : c.ink }}>{asset ? asset.filename : t.pick.empty}</Text>
      <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: asset ? "#FFFFFF" : c.ink }}>{asset ? pickedLine(asset) || t.pick.change : t.pick.types}</Text>
    </View>;
  const picker = <PressableScale testID="video-pick" scaleTo={0.985} accessibilityRole="button" disabled={up.sending}
    accessibilityLabel={asset ? `${t.pick.change}. ${asset.filename}` : `${t.pick.empty}. ${t.pick.types}`}
    onPress={() => { void up.onPick(); }}>
    {asset ? <LitFill kind="primary"/> : null}
    {asset ? pickBody : <Frame pad={0}>{pickBody}</Frame>}
  </PressableScale>;

  return <CampShell title={t.uploadTitle} onBack={onBack}
    footer={<Action label={up.sending ? t.sending : t.send} pending={up.sending} disabled={fighterId || !needFighter ? !up.ready : false} onPress={send}/>}>
    <View testID={testID} style={{ gap: 16 }}>
      {top}
      {picker}
      <Field label={t.fields.title} value={form.title} maxLength={200} placeholder={t.fields.titlePlaceholder} editable={!up.sending}
        onChangeText={value => dispatch({ type: "title", value })}/>
      <Field label={t.fields.description} value={form.description} maxLength={2000} multiline placeholder={t.fields.descriptionPlaceholder} editable={!up.sending}
        onChangeText={value => dispatch({ type: "description", value })}/>
      <GridChoices label={t.fields.training} columns={2} disabled={up.sending} value={form.trainingType}
        options={VIDEO_TRAINING_TYPES.map(v => ({ value: v, label: media.training[v] }))} onChange={value => dispatch({ type: "trainingType", value })}/>
      <GridChoices label={t.fields.angle} columns={3} disabled={up.sending} value={form.cameraAngle}
        options={VIDEO_CAMERA_ANGLES.map(v => ({ value: v, label: t.angle[v] ?? media.angle[v] }))} onChange={value => dispatch({ type: "cameraAngle", value })}/>
      {error ? <Text testID="upload-error" accessibilityRole="alert" style={{ ...readableTextStyle(15, true), color: c.danger }}>{error}</Text> : null}
    </View>
  </CampShell>;
}
