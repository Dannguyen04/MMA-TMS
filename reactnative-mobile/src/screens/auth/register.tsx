import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Link, useRouter } from "expo-router";

import { getMe, requestAdmissionEmailCode, verifyAdmissionEmail } from "@/api/auth";
import { isApiError } from "@/api/errors";
import { clearSession, persistSession } from "@/api/tokens";
import {
  applyRegisterFieldErrors,
  type RegisterStep,
  validateRegisterStep,
} from "@/auth/register-steps";
import {
  AuthVisionButton,
  AuthVisionField,
  AuthVisionShell,
} from "@/components/auth/auth-vision-shell";
import { authDark, authType } from "@/components/auth/auth-vision-tokens";
import { useToastMessage } from "@/components/toast/app-toast";
import { vi } from "@/i18n/vi";
import { mapApiMessage } from "@/session/map-api-message";
import { homeHrefForGate, useSession } from "@/session/session-context";
import { spacing } from "@/theme";

function registerFailureMessage(cause: unknown, phase: "send" | "verify"): string {
  if (phase === "verify" && isApiError(cause) && cause.code === "INVALID_CREDENTIALS") {
    return vi.register.codeRejected;
  }
  return mapApiMessage(cause);
}

export function RegisterScreen() {
  const router = useRouter();
  const { applyRegisteredSession } = useSession();
  const submitLock = useRef(false);
  const [step, setStep] = useState<RegisterStep>(1);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<"send" | "resend" | "verify" | null>(null);
  useToastMessage(formError, "error");
  useToastMessage(notice, "success");
  const busy = pending !== null;

  const finish = () => {
    submitLock.current = false;
    setPending(null);
  };

  const onSendCode = (mode: "send" | "resend") => {
    if (submitLock.current) return;
    const next = validateRegisterStep(1, { email, token });
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError(applyRegisterFieldErrors(next));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    submitLock.current = true;
    setPending(mode);
    setFormError("");
    setNotice("");
    void requestAdmissionEmailCode(email)
      .then(() => {
        setToken("");
        setErrors({});
        setNotice(vi.register.codeSent);
        setStep(2);
      })
      .catch((cause: unknown) => {
        setFormError(registerFailureMessage(cause, "send"));
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      })
      .finally(finish);
  };

  const onVerify = () => {
    if (submitLock.current) return;
    const next = validateRegisterStep(2, { email, token });
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError(applyRegisterFieldErrors(next));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    submitLock.current = true;
    setPending("verify");
    setFormError("");
    void verifyAdmissionEmail({ email, token })
      .then(async (result) => {
        await persistSession(result.session);
        try {
          const me = await getMe();
          const gate = applyRegisteredSession(me);
          router.replace(homeHrefForGate(gate));
        } catch (cause) {
          await clearSession();
          throw cause;
        }
      })
      .catch((cause: unknown) => {
        setFormError(registerFailureMessage(cause, "verify"));
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      })
      .finally(finish);
  };

  const onChangeEmail = () => {
    if (busy) return;
    setStep(1);
    setFormError("");
    setNotice("");
  };

  const onBack = () => {
    if (step === 2) {
      onChangeEmail();
      return;
    }
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/login");
  };

  return (
    <AuthVisionShell
      stepKey={String(step)}
      contentGap={20}
      title={step === 2 ? vi.register.codeHeading : undefined}
      subtitle={step === 2 ? vi.register.codeLead : undefined}
      accessory={
        step === 2 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={vi.register.changeEmail}
            disabled={busy}
            onPress={onChangeEmail}
            style={styles.changeEmail}
          >
            <MaterialCommunityIcons name="arrow-left" size={16} color={authDark.gold} />
            <Text style={[authType.link, { color: authDark.gold }]}>{vi.register.changeEmail}</Text>
          </Pressable>
        ) : undefined
      }
      onBack={onBack}
      backDisabled={busy}
      footer={
          <Text style={[authType.caption, styles.footerText]}>
            {vi.register.haveAccount}{" "}
            <Link href="/login" style={[authType.link, { color: authDark.gold }]}>
              {vi.register.toLogin}
            </Link>
          </Text>
      }
    >
      {step === 1 ? (
        <>
          <AuthVisionField
            label={vi.register.emailField}
            placeholder={vi.register.emailPlaceholder}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setErrors((current) => ({ ...current, email: "" }));
              setFormError("");
            }}
            error={errors.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="done"
            onSubmitEditing={() => onSendCode("send")}
          />
          <AuthVisionButton
            testID="register-send-code"
            title={vi.register.sendCode}
            onPress={() => onSendCode("send")}
            loading={pending === "send"}
            disabled={!email.trim() || busy}
          />
        </>
      ) : (
        <>
          <AuthVisionField
            label={vi.register.codeLabel}
            placeholder={vi.register.codePlaceholder}
            value={token}
            onChangeText={(value) => {
              setToken(value.replace(/[^\d]/g, ""));
              setErrors((current) => ({ ...current, token: "" }));
              setFormError("");
            }}
            error={errors.token}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            importantForAutofill="yes"
            maxLength={10}
          />
          <AuthVisionButton
            testID="register-verify"
            title={vi.register.verifyCode}
            onPress={onVerify}
            loading={pending === "verify"}
            disabled={!token.trim() || busy}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={vi.register.resendCode}
            disabled={busy}
            onPress={() => onSendCode("resend")}
            style={styles.resend}
          >
            <Text
              style={[
                authType.link,
                { color: busy ? authDark.buttonOffText : authDark.gold, opacity: pending === "resend" ? 0 : 1 },
              ]}
            >
              {vi.register.resendCode}
            </Text>
            {pending === "resend" ? (
              <ActivityIndicator color={authDark.gold} style={styles.resendSpinner} />
            ) : null}
          </Pressable>
          <View style={styles.scope}>
            <Text style={[authType.caption, styles.scopeText]}>{vi.register.scopeNote}</Text>
          </View>
        </>
      )}
    </AuthVisionShell>
  );
}

const styles = StyleSheet.create({
  footerText: {
    color: authDark.muted,
    textAlign: "center",
  },
  changeEmail: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
  },
  resend: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  resendSpinner: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  scope: {
    borderTopWidth: 1,
    borderTopColor: authDark.line,
    paddingTop: 20,
    marginTop: 4,
  },
  scopeText: {
    color: authDark.muted,
    fontSize: 13,
    lineHeight: 20,
  },
});
