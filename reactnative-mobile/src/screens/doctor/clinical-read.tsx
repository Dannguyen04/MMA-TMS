import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";

import {
  getFighterMedical,
  isApiError,
  listFighterMedicalExaminations,
  type MedicalDossier,
  type MedicalExamination,
} from "@/api";
import { decisionLabel } from "@/components/medical/medical-format";
import { useToastMessage } from "@/components/toast/app-toast";
import { DoctorCard, DoctorChrome, doctorStyles } from "@/screens/doctor/doctor-chrome";
import { useSelectedFighter } from "@/screens/doctor/selected-fighter";
import { doctor } from "@/i18n/doctor";
import { type, useThemePreference } from "@/theme";

function messageFor(error: unknown): string {
  if (!isApiError(error)) return "Không làm được lúc này. Thử lại sau.";
  if (error.status === 0 || error.code === "NETWORK_ERROR") return "Không kết nối được. Kiểm tra mạng rồi thử lại.";
  if (error.status === 403) return "Bạn chưa được xem hồ sơ võ sĩ này.";
  if (error.status === 404) return "Không tìm thấy võ sĩ.";
  return "Không làm được lúc này. Thử lại sau.";
}

function dossierLines(kind: "injuries" | "recovery" | "clearance" | "records", dossier: MedicalDossier): string[] {
  if (kind === "injuries") {
    return dossier.activeInjuries.map(
      (injury) => `${injury.affectedJoint} · ${injury.injuryType} · ${injury.severity}`,
    );
  }
  if (kind === "recovery") return dossier.activeRecoveryPlans.map((plan) => plan.title);
  if (kind === "clearance") {
    return dossier.activeClearances.map((item) => `${item.clearanceType} · ${item.status}`);
  }
  return [
    `Tập luyện: ${dossier.eligibility.training.eligible ? "Đủ điều kiện" : "Chưa đủ điều kiện"}`,
    `Thi đấu: ${dossier.eligibility.competition.eligible ? "Đủ điều kiện" : "Chưa đủ điều kiện"}`,
    `Yêu cầu khám đang mở: ${dossier.openReviewRequests.length}`,
  ];
}

export function DoctorDossierLines({
  title,
  kind,
}: {
  title: string;
  kind: "injuries" | "recovery" | "clearance" | "records";
}) {
  const { colors } = useThemePreference();
  const { fighter } = useSelectedFighter();
  const [rows, setRows] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!fighter) {
      setRows(null);
      setError("");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void getFighterMedical(fighter.id)
      .then((dossier) => {
        if (!cancelled) setRows(dossierLines(kind, dossier));
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setRows(null);
          setError(messageFor(cause));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fighter, kind]);

  useEffect(() => {
    const stop = load();
    return () => {
      stop?.();
    };
  }, [load]);

  return (
    <DoctorChrome title={title}>
      <ScrollView contentContainerStyle={doctorStyles.list}>
        {!fighter ? <Text style={[type.body, { color: colors.inkMuted }]}>{doctor.pickFighterHint}</Text> : null}
        {loading && !rows ? <Text style={[type.body, { color: colors.inkMuted }]}>{doctor.loading}</Text> : null}
        {error ? (
          <Pressable accessibilityRole="button" onPress={load}>
            <Text style={[type.link, { color: colors.lotus }]}>{doctor.retry}</Text>
          </Pressable>
        ) : null}
        {rows && rows.length === 0 ? (
          <Text style={[type.body, { color: colors.inkMuted }]}>Không có bản ghi đang mở trong hồ sơ này.</Text>
        ) : null}
        {rows?.map((line, index) => (
          <DoctorCard key={`${kind}-${index}`}>
            <Text style={[type.body, { color: colors.ink }]}>{line}</Text>
          </DoctorCard>
        ))}
      </ScrollView>
    </DoctorChrome>
  );
}

export function DoctorExaminationList() {
  const { colors } = useThemePreference();
  const { fighter } = useSelectedFighter();
  const [rows, setRows] = useState<MedicalExamination[] | null>(null);
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!fighter) {
      setRows(null);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void listFighterMedicalExaminations(fighter.id, { page: 1, limit: 20 })
      .then((page) => {
        if (!cancelled) setRows(page.data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setRows(null);
          setError(messageFor(cause));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fighter]);

  useEffect(() => {
    const stop = load();
    return () => {
      stop?.();
    };
  }, [load]);

  return (
    <DoctorChrome title="Khám">
      <ScrollView contentContainerStyle={doctorStyles.list}>
        {!fighter ? <Text style={[type.body, { color: colors.inkMuted }]}>{doctor.pickFighterHint}</Text> : null}
        {loading && !rows ? <Text style={[type.body, { color: colors.inkMuted }]}>{doctor.loading}</Text> : null}
        {error ? (
          <Pressable accessibilityRole="button" onPress={load}>
            <Text style={[type.link, { color: colors.lotus }]}>{doctor.retry}</Text>
          </Pressable>
        ) : null}
        {rows && rows.length === 0 ? (
          <Text style={[type.body, { color: colors.inkMuted }]}>Chưa có kết luận khám nào.</Text>
        ) : null}
        {rows?.map((exam) => (
          <DoctorCard key={exam.id}>
            <Text style={[type.body, { color: colors.ink }]}>
              {exam.scope} · {decisionLabel(exam.decision)}
            </Text>
            <Text style={[type.caption, { color: colors.inkMuted }]}>{exam.reason}</Text>
          </DoctorCard>
        ))}
        <Text style={[type.caption, { color: colors.inkMuted }]}>
          Ghi khám mới (POST /fighters/:id/medical-examinations) thuộc bác sĩ đang phụ trách. Form hạn chế chưa gửi vì quyết định ELIGIBLE_WITH_RESTRICTIONS bắt buộc có restrictions.
        </Text>
      </ScrollView>
    </DoctorChrome>
  );
}
