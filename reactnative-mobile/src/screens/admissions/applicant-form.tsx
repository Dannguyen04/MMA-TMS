import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { listOwnApplications, submitApplication } from "@/api/admissions";
import { blockingApplication } from "@/admissions/open-application";
import { isApiError } from "@/api/errors";
import { CountrySelectField } from "@/components/admissions/country-select-field";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthDateField } from "@/components/auth/auth-date-field";
import { useToastMessage } from "@/components/toast/app-toast";
import { AuthSelectField } from "@/components/auth/auth-select-field";
import { AuthTextField } from "@/components/auth/auth-text-field";
import { VisualCard } from "@/components/visuals";
import {
  DEFAULT_COUNTRY,
  DEFAULT_COUNTRY_CODE,
  MAX_PHONE_DIGITS,
  findCountry,
  nationalDigits,
  toInternationalPhone,
} from "@/constants/countries";
import { WEIGHT_CLASSES, type WeightClass } from "@/constants/weight-classes";
import { vi } from "@/i18n/vi";
import { AdmissionPage } from "@/screens/admissions/page";
import { mapApiMessage } from "@/session/map-api-message";
import { radius, spacing, type, useThemePreference } from "@/theme";
import { isValidDateOnly } from "@/utils/is-valid-date-only";

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

const STEP_COUNT = 3;

export function ApplicantFormScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [weightClass, setWeightClass] = useState<WeightClass | "">("");
  const [nationality, setNationality] = useState(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState("");
  const country = findCountry(nationality) ?? DEFAULT_COUNTRY;
  const [training, setTraining] = useState("");
  const [competition, setCompetition] = useState("");
  const [motivation, setMotivation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);
  useToastMessage(blocked ? vi.admission.openBlocksSubmit : error, "error");
  const [openId, setOpenId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const isLastStep = step === STEP_COUNT - 1;

  useEffect(() => {
    let active = true;
    // A failed check leaves the form usable; the API still enforces the rule with a 409.
    void listOwnApplications({ page: 1, limit: 50 })
      .then((page) => {
        const open = blockingApplication(page.items);
        if (!active) return;
        if (open) {
          setOpenId(open.id);
          setBlocked(true);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(mapApiMessage(cause));
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = () => {
    if (submitting || checking || blocked) return;
    if (!firstName.trim() || !lastName.trim() || !weightClass || !isValidDateOnly(dateOfBirth)) {
      setError(vi.register.required);
      setStep(0);
      return;
    }
    setError("");
    setSubmitting(true);
    void submitApplication({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth,
      weightClass,
      nationality: country.code,
      contactPhone: toInternationalPhone(country, phone),
      trainingBackground: optionalText(training),
      competitionBackground: optionalText(competition),
      motivation: optionalText(motivation),
    })
      .then((created) => {
        router.replace(`/ho-so/${created.id}` as never);
      })
      .catch((cause: unknown) => {
        if (isApiError(cause) && cause.code === "FIGHTER_APPLICATION_ALREADY_OPEN") setBlocked(true);
        setError(mapApiMessage(cause));
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <AdmissionPage title={vi.admission.submit}>
        {blocked && openId ? (
          <AuthButton
            title={vi.admission.openExisting}
            onPress={() => router.replace(`/ho-so/${openId}` as never)}
          />
        ) : null}
        <Text style={[type.label, { color: colors.inkMuted }]}>
          {`${vi.admission.step} ${step + 1}/${STEP_COUNT}`}
        </Text>
        <View style={styles.stepRow} accessibilityRole="tablist">
          {vi.admission.stepLabels.map((label, index) => {
            const selected = index === step;
            return (
              <Pressable
                key={label}
                accessibilityRole="tab"
                accessibilityLabel={`${vi.admission.step} ${index + 1}: ${label}`}
                accessibilityState={{ selected }}
                onPress={() => setStep(index)}
                style={[
                  styles.stepItem,
                  {
                    backgroundColor: selected ? colors.cta : colors.surface,
                    borderColor: selected ? colors.cta : colors.line,
                  },
                ]}
              >
                <Text style={[type.caption, { color: selected ? colors.onCta : colors.inkMuted }]}>
                  {`${vi.admission.step} ${index + 1}`}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[type.label, { color: selected ? colors.onCta : colors.ink }]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {step === 0 ? (
          <VisualCard colors={colors}>
            <Text style={[type.label, { color: colors.inkMuted }]}>{vi.register.identity}</Text>
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
          </VisualCard>
        ) : null}
        {step === 1 ? (
          <VisualCard colors={colors}>
            <Text style={[type.label, { color: colors.inkMuted }]}>{vi.register.extraTitle}</Text>
            <CountrySelectField label={vi.admission.nationality} value={country.code} onChange={setNationality} />
            <AuthTextField
              label={vi.admission.phone}
              helper={vi.admission.optional}
              prefix={`+${country.callingCode}`}
              value={phone}
              onChangeText={(text) => setPhone(nationalDigits(text))}
              keyboardType="phone-pad"
              maxLength={MAX_PHONE_DIGITS}
            />
          </VisualCard>
        ) : null}
        {step === 2 ? (
          <VisualCard colors={colors}>
            <Text style={[type.label, { color: colors.inkMuted }]}>{vi.register.extraTitle}</Text>
            <AuthTextField label={vi.admission.training} helper={vi.admission.optional} value={training} onChangeText={setTraining} multiline />
            <AuthTextField label={vi.admission.competition} helper={vi.admission.optional} value={competition} onChangeText={setCompetition} multiline />
            <AuthTextField label={vi.admission.motivation} helper={vi.admission.optional} value={motivation} onChangeText={setMotivation} multiline />
          </VisualCard>
        ) : null}
        {isLastStep ? (
          <AuthButton
            title={vi.admission.submit}
            onPress={onSubmit}
            loading={submitting || checking}
            disabled={submitting || checking || blocked}
          />
        ) : (
          <AuthButton title={vi.admission.stepNext} onPress={() => setStep((current) => current + 1)} />
        )}
        {step > 0 ? (
          <View style={styles.back}>
            <AuthButton
              title={vi.admission.stepBack}
              variant="secondary"
              onPress={() => setStep((current) => current - 1)}
              disabled={submitting}
            />
          </View>
        ) : null}
      </AdmissionPage>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { alignItems: "center" },
  stepRow: { flexDirection: "row", gap: spacing.sm },
  stepItem: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.field,
  },
});
