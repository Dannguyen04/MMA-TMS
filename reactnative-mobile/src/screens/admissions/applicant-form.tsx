import { useState } from "react";
import { useRouter } from "expo-router";

import { submitApplication } from "@/api/admissions";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthDateField } from "@/components/auth/auth-date-field";
import { AuthFormError } from "@/components/auth/auth-form-error";
import { AuthSelectField } from "@/components/auth/auth-select-field";
import { AuthTextField } from "@/components/auth/auth-text-field";
import { WEIGHT_CLASSES, type WeightClass } from "@/constants/weight-classes";
import { vi } from "@/i18n/vi";
import { AdmissionPage } from "@/screens/admissions/page";
import { mapApiMessage } from "@/session/map-api-message";
import { isValidDateOnly } from "@/utils/is-valid-date-only";

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function ApplicantFormScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [weightClass, setWeightClass] = useState<WeightClass | "">("");
  const [nationality, setNationality] = useState("");
  const [phone, setPhone] = useState("");
  const [training, setTraining] = useState("");
  const [competition, setCompetition] = useState("");
  const [motivation, setMotivation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = () => {
    if (submitting) return;
    if (!firstName.trim() || !lastName.trim() || !weightClass || !isValidDateOnly(dateOfBirth)) {
      setError(vi.register.required);
      return;
    }
    setError("");
    setSubmitting(true);
    void submitApplication({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth,
      weightClass,
      nationality: optionalText(nationality),
      contactPhone: optionalText(phone),
      trainingBackground: optionalText(training),
      competitionBackground: optionalText(competition),
      motivation: optionalText(motivation),
    })
      .then((created) => {
        router.replace(`/ho-so/${created.id}` as never);
      })
      .catch((cause: unknown) => setError(mapApiMessage(cause)))
      .finally(() => setSubmitting(false));
  };

  return (
    <AdmissionPage title={vi.admission.submit}>
      <AuthFormError message={error} />
      <AuthTextField label={vi.register.lastName} value={lastName} onChangeText={setLastName} />
      <AuthTextField label={vi.register.firstName} value={firstName} onChangeText={setFirstName} />
      <AuthDateField label={vi.register.dateOfBirth} value={dateOfBirth} onChangeText={setDateOfBirth} />
      <AuthSelectField
        label={vi.register.weightClass}
        value={weightClass}
        placeholder={vi.register.weightClassPlaceholder}
        options={WEIGHT_CLASSES.map((value) => ({ value, label: vi.weightClass[value] }))}
        onChange={setWeightClass}
      />
      <AuthTextField label={vi.admission.nationality} helper={vi.admission.optional} value={nationality} onChangeText={setNationality} />
      <AuthTextField label={vi.admission.phone} helper={vi.admission.optional} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <AuthTextField label={vi.admission.training} helper={vi.admission.optional} value={training} onChangeText={setTraining} multiline />
      <AuthTextField label={vi.admission.competition} helper={vi.admission.optional} value={competition} onChangeText={setCompetition} multiline />
      <AuthTextField label={vi.admission.motivation} helper={vi.admission.optional} value={motivation} onChangeText={setMotivation} multiline />
      <AuthButton title={vi.admission.submit} onPress={onSubmit} loading={submitting} disabled={submitting} />
    </AdmissionPage>
  );
}
