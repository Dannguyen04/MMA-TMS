import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { oneTapApi } from "@/api/medical/one-tap";
import { SlideSheet } from "@/components/ui/slide-sheet";
import { fighterHealth as t } from "@/i18n/fighter/fighter-health";
import { ot } from "@/i18n/common/one-tap";
import { LitFill } from "@/shared/ui/camp-lit";
import { Action } from "@/shared/ui/camp-ui";
import { reasonValue, useWrite } from "@/screens/one-tap/write";
import { useThemePreference } from "@/theme";
import { readableTextStyle } from "@/theme/typography";

const OTHER_MAX = 100;

/**
 * The one way to ask for an exam (step 10): reason choices, "Khác" opens a 100-character field, one send button.
 * The keyboard never covers the field (SlideSheet rides above it). A 409 means a request is already open: shown as sent.
 */
export function RequestSheet({ fighterId, visible, onClose, onSent }: { fighterId: string; visible: boolean; onClose: () => void; onSent: () => void }) {
  const { colors: c } = useThemePreference();
  const [pick, setPick] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [focused, setFocused] = useState(false);
  const w = useWrite(ot.examForbidden);
  useEffect(() => { if (visible) { setPick(null); setOther(""); w.setForbidden(""); } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const reason = reasonValue(pick, other);

  const send = () => {
    if (!reason) return;
    const done = () => { onClose(); onSent(); };
    void w.run(() => oneTapApi.createMedicalReviewRequest(fighterId, { reason }), done).then(o => { if (o === "conflict") done(); });
  };

  return <SlideSheet visible={visible} onClose={onClose} title={t.sheet.title}>
    <View testID="request-sheet" style={{ gap: 14, paddingBottom: 8 }}>
      <View>{t.sheet.note.map(line => <Text key={line} style={{ ...readableTextStyle(15, true), color: c.ink }}>{line}</Text>)}</View>
      <View accessibilityRole="radiogroup" accessibilityLabel={t.sheet.reasonsLabel} style={{ gap: 6 }}>
        {ot.examReasons.map(r => {
          const on = pick === r;
          return <Pressable key={r} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} aria-checked={on} onPress={() => setPick(r)} disabled={w.sending}
            style={({ pressed }) => ({ minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderWidth: 1.5, borderColor: on ? c.ink : c.controlBorder, backgroundColor: on ? c.ink : "transparent", opacity: pressed ? 0.8 : 1 })}>
            <Text numberOfLines={1} style={{ ...readableTextStyle(15, true), color: on ? c.bg : c.ink }}>{r}</Text>
          </Pressable>;
        })}
      </View>
      {pick === ot.other ? <View style={{ gap: 4 }}>
        <View style={{ minHeight: 50 }}>
          <LitFill kind="secondary"/>
          <View style={{ flex: 1, minHeight: 50, justifyContent: "center", paddingHorizontal: 12, borderLeftWidth: 3, borderLeftColor: focused ? c.lotus : "transparent" }}>
            <TextInput accessibilityLabel={t.sheet.otherLabel} value={other} onChangeText={setOther} maxLength={OTHER_MAX} autoFocus editable={!w.sending}
              placeholder={t.sheet.otherPlaceholder} placeholderTextColor={c.inkSubtle} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              style={{ minHeight: 48, ...readableTextStyle(15), color: c.ink, outlineStyle: "none" } as object}/>
          </View>
        </View>
        <Text style={{ ...readableTextStyle(13), color: c.ink, textAlign: "right" }}>{ot.otherCount(other.length)}</Text>
      </View> : null}
      {w.forbidden ? <Text accessibilityRole="alert" style={{ ...readableTextStyle(14, true), color: c.danger }}>{w.forbidden}</Text> : null}
      <Action label={t.sheet.send} onPress={send} disabled={!reason} pending={w.sending}/>
    </View>
  </SlideSheet>;
}
