import { useRef, useState } from "react";
import { Text, TextInput } from "react-native";
import * as Haptics from "expo-haptics";
import { Link, useLocalSearchParams, useRouter } from "expo-router";

import { resetPassword } from "@/api/auth";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/auth/register-steps";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthFormError } from "@/components/auth/auth-form-error";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthTextField } from "@/components/auth/auth-text-field";
import { vi } from "@/i18n/vi";
import { mapApiMessage } from "@/session/map-api-message";
import { type, useThemePreference } from "@/theme";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export function ResetPasswordScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const params = useLocalSearchParams<{
    token_hash?: string | string[];
    type?: string | string[];
  }>();
  const tokenHash = firstParam(params.token_hash);
  const recoveryType = firstParam(params.type);
  const linkReady = tokenHash.length >= 16 && recoveryType === "recovery";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [notice, setNotice] = useState(linkReady ? "" : vi.resetPassword.missingLink);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  const onSubmit = () => {
    if (submitting || done || !linkReady) return;

    let nextPasswordError = "";
    let nextConfirmError = "";
    if (!password) nextPasswordError = vi.field.required;
    else if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      nextPasswordError = vi.register.passwordHint;
    }
    if (!confirm) nextConfirmError = vi.field.required;
    else if (password && confirm !== password) nextConfirmError = vi.register.mismatch;

    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    if (nextPasswordError || nextConfirmError) {
      setNotice("");
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    setNotice("");
    setSubmitting(true);
    void resetPassword({ tokenHash, newPassword: password })
      .then((result) => {
        setDone(true);
        setNotice(
          result.admissionActivationReady
            ? `${vi.resetPassword.success} ${vi.resetPassword.activationReady}`
            : vi.resetPassword.success,
        );
      })
      .catch((error: unknown) => {
        setNotice(mapApiMessage(error));
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <AuthShell
      title={vi.resetPassword.title}
      subtitle={vi.resetPassword.subtitle}
      onBack={() => router.replace("/login")}
      backDisabled={submitting}
      backLabel={vi.resetPassword.back}
      footer={
        <Text style={[type.caption, { color: colors.inkMuted, textAlign: "center" }]}>
          <Link href="/login" style={[type.link, { color: colors.lotus }]}>
            {vi.resetPassword.toLogin}
          </Link>
        </Text>
      }
      cta={
        done ? (
          <AuthButton
            testID="reset-to-login"
            title={vi.resetPassword.toLogin}
            onPress={() => router.replace("/login")}
          />
        ) : (
          <AuthButton
            testID="reset-submit"
            title={vi.resetPassword.submit}
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting || !linkReady}
          />
        )
      }
      banner={<AuthFormError message={notice} tone={done ? "success" : "danger"} />}
    >
      <AuthTextField
        label={vi.register.password}
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setPasswordError("");
          setNotice(linkReady ? "" : vi.resetPassword.missingLink);
        }}
        error={passwordError}
        helper={vi.register.passwordHint}
        editable={linkReady && !submitting && !done}
        secureToggle
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <AuthTextField
        ref={confirmRef}
        label={vi.register.confirm}
        value={confirm}
        onChangeText={(value) => {
          setConfirm(value);
          setConfirmError("");
          setNotice(linkReady ? "" : vi.resetPassword.missingLink);
        }}
        error={confirmError}
        editable={linkReady && !submitting && !done}
        secureToggle
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
    </AuthShell>
  );
}
