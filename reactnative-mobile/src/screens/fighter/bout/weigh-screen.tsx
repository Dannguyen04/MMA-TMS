import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { campApi } from "@/features/fight-camp/api";
import { roleMayReadMeasurements } from "@/api/role-contracts";
import { createFighterMeasurement, listFighterMeasurements, supersedeFighterMeasurement } from "@/api/fighters";
import { Icon } from "@/components/icon";
import { fighterTran as t } from "@/i18n/fighter-tran";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { previewBout } from "@/features/fight-camp/state/camp-preview";
import { campError, isToday, kg, readKg } from "@/features/fight-camp/logic/camp-rules";
import { Action, CampShell } from "@/shared/ui/camp-ui";
import { RetryRow } from "@/screens/fighter/redesign/tab-page";
import { useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { activeBout, backToTran, limitOf } from "./bout-model";

type Today = { id: string | null; kg: number } | null;
/** Demo-only memory of today's self-report, so the preview keeps one entry per day. */
let demoToday: { id: string; kg: number; on: string } | null = null;

/** The id of today's self-report saved on this phone, so a second save replaces it (fighters cannot list measurements). */
const memoKey = (profileId: string) => `mma.weigh.today.${profileId}`;
async function rememberToday(profileId: string, id: string, kgValue: number) {
  try { await AsyncStorage.setItem(memoKey(profileId), JSON.stringify({ id, kg: kgValue, on: new Date().toISOString() })); } catch { /* memory only */ }
}
async function recallToday(profileId: string): Promise<{ id: string; kg: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(memoKey(profileId));
    const v = raw ? JSON.parse(raw) as { id?: unknown; kg?: unknown; on?: unknown } : null;
    return v && typeof v.id === "string" && typeof v.kg === "number" && typeof v.on === "string" && isToday(v.on) ? { id: v.id, kg: v.kg } : null;
  } catch { return null; }
}

/**
 * Today's entry: listed from the server when the role may read measurements (coach, admin), otherwise from this
 * phone's memory, or from the bout's weight track (kg only; a save then adds today's entry).
 */
async function loadWeigh(profileId: string | undefined, demo: boolean, canRead: boolean): Promise<{ limit: number | null; today: Today }> {
  if (demo) return { limit: limitOf(previewBout), today: demoToday && isToday(demoToday.on) ? demoToday : null };
  if (!profileId) return { limit: null, today: null };
  const bout = await activeBout(profileId);
  const limit = bout ? limitOf(bout) : null;
  if (canRead) {
    const latest = (await listFighterMeasurements(profileId, { limit: 1 })).data[0];
    return { limit, today: latest && isToday(latest.measuredAt) ? { id: latest.id, kg: latest.weightKg } : null };
  }
  const memo = await recallToday(profileId);
  if (memo) return { limit, today: memo };
  const track = bout ? await campApi.weightTrack(bout.id).catch(() => null) : null;
  return { limit, today: track && track.latestKg != null && isToday(track.latestOn) ? { id: null, kg: track.latestKg } : null };
}

/**
 * Ghi cân hôm nay (redesign step 12): one big kg field, the limit, one save pinned at the bottom.
 * One self-report per academy day: when today already has one, saving supersedes it.
 */
export function FighterWeighV2() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const { user, isDemo } = useSession();
  const profileId = (user?.profile as { id?: string } | null | undefined)?.id;
  const canRead = roleMayReadMeasurements(user?.role);
  const [src, reload] = useSource(() => loadWeigh(profileId, !!isDemo, canRead), `${profileId}-${isDemo}-${canRead}`);
  const [today, setToday] = useState<Today>(null);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<"" | "created" | "updated">("");
  const lock = useRef(false);
  const input = useRef<TextInput>(null);
  const typed = useRef(false);

  useEffect(() => {
    if (src.state !== "ok") return;
    setToday(src.data.today);
    // Prefill once; never overwrite what the fighter has typed.
    if (src.data.today && !typed.current) setText(kg(src.data.today.kg));
  }, [src]);
  const ready = src.state === "ok";
  const editing = !!today;

  const save = useCallback(() => {
    if (lock.current || !ready) return;
    lock.current = true; setPending(true); setError("");
    void (async () => {
      const weightKg = readKg(text);
      if (isDemo) { demoToday = { id: today?.id ?? "demo-today", kg: weightKg, on: new Date().toISOString() }; setToday(demoToday); }
      else {
        if (!profileId) throw new Error(t.weigh.failed);
        const body = { weightKg, measurementContext: "SELF_REPORTED" as const };
        const m = today?.id ? await supersedeFighterMeasurement(profileId, today.id, body) : await createFighterMeasurement(profileId, body);
        setToday({ id: m.id, kg: m.weightKg });
        if (!canRead) await rememberToday(profileId, m.id, m.weightKg);
      }
      setSaved(today ? "updated" : "created");
    })().catch(e => setError(campError(e))).finally(() => { lock.current = false; setPending(false); });
  }, [canRead, isDemo, profileId, ready, text, today]);

  const footer = saved
    ? <Action label={t.weigh.back} secondary onPress={() => backToTran(router)}/>
    : <Action label={editing ? t.weigh.saveEdit : t.weigh.save} pending={pending} disabled={!ready} onPress={save}/>;

  const limit = src.state === "ok" ? src.data.limit : null;
  return <CampShell title={editing && !saved ? t.edit : t.log} onBack={() => backToTran(router)} preview={!!isDemo} footer={footer}>
    {src.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {src.state === "error" ? <RetryRow message={t.weigh.checkFailed} retry={t.retry} onRetry={reload}/> : null}
    {ready ? <View testID="weigh-v2" style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 6, paddingTop: 18, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: c.controlBorder }}>
        <TextInput ref={input} testID="weigh-input" accessibilityLabel={t.weigh.input} value={text} editable={!pending}
          onChangeText={v => { typed.current = true; setText(v); setSaved(""); setError(""); }} inputMode="decimal" keyboardType="decimal-pad" maxLength={5}
          placeholder="0,0" placeholderTextColor={c.inkSubtle} selectionColor={c.lotus} autoFocus={!editing}
          style={{ width: 190, textAlign: "right", color: c.ink, fontFamily: fonts.displayExtraBold, fontSize: fz(72), lineHeight: lh(84), padding: 0, ...(Platform.OS === "web" ? { outlineStyle: "none", borderWidth: 0 } as object : {}) }}/>
        <Text style={{ fontFamily: fonts.display, fontSize: fz(26), lineHeight: lh(30), color: c.ink }}>{t.kg}</Text>
      </View>
      <View>
        {limit != null ? <Text style={{ ...readableTextStyle(15.5), color: c.ink }}>{t.weigh.limit(kg(limit))}</Text> : null}
        {today && !saved ? <>
          <Text style={{ ...readableTextStyle(15.5), color: c.ink }}>{t.weigh.already(kg(today.kg))}</Text>
          <Text style={{ ...readableTextStyle(15.5), color: c.ink }}>{t.weigh.replace}</Text>
        </> : !saved ? <Text style={{ ...readableTextStyle(15.5), color: c.ink }}>{t.weigh.self}</Text> : null}
      </View>
      {error ? <Text testID="weigh-error" accessibilityRole="alert" style={{ ...readableTextStyle(15, true), color: c.danger }}>{error}</Text> : null}
      {saved ? <View testID="weigh-saved" accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon name="check" size={22} color={c.success}/>
        <Text style={{ ...readableTextStyle(15.5, true), color: c.success }}>{saved === "updated" ? t.weigh.savedEdit : t.weigh.saved}</Text>
      </View> : null}
    </View> : null}
  </CampShell>;
}
