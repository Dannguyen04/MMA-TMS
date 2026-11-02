import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { oneTapApi } from "@/api/one-tap";
import { ot } from "@/i18n/one-tap";
import { StatusChip } from "@/screens/coach/readonly/ro-ui";

import { ConfirmSheet, SheetButton } from "./sheets";
import { useWrite } from "./write";

/**
 * Võ sĩ: "Yêu cầu khám lại" ở tab Sức khỏe. Ẩn nút khi đã có yêu cầu đang mở: cùng nguồn bác sĩ dùng cho thẻ
 * "Yêu cầu khám lại · N đang mở" = GET /fighters/:id/medical → openReviewRequests (FIGHTER có fighter.medical:read, chỉ chính mình),
 * chỉ hiện chip "Đã gửi yêu cầu". Gửi đúng nhãn chip lý do (hoặc chữ "Khác" ≤100 ký tự).
 */
export function MedicalReviewAction({ fighterId, openCount, onSent }: { fighterId: string; openCount: number; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const w = useWrite(ot.examForbidden);
  if (sent || openCount > 0) {
    return (
      <View testID="exam-sent" style={styles.wrap}>
        <StatusChip spec={{ label: ot.examSent, tone: "info", icon: "schedule" }} />
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <SheetButton
        testID="exam-request-btn"
        label={ot.exam}
        kind="outline"
        onPress={() => {
          w.setForbidden("");
          setOpen(true);
        }}
      />
      <ConfirmSheet
        visible={open}
        title={ot.examTitle}
        body={ot.examBody}
        confirmLabel={ot.examSend}
        reasons={ot.examReasons}
        sending={w.sending}
        forbidden={w.forbidden}
        onCancel={() => setOpen(false)}
        onConfirm={(reason) => {
          const done = () => {
            setOpen(false);
            setSent(true);
            onSent();
          };
          // 409: đã có yêu cầu đang mở → coi như đã gửi, hiện chip, không báo lỗi.
          void w.run(() => oneTapApi.createMedicalReviewRequest(fighterId, { reason }), done).then((o) => (o === "conflict" ? done() : o === "offline" ? setOpen(false) : undefined));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignSelf: "stretch", gap: 8 } });
