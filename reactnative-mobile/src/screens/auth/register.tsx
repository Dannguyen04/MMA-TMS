import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
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
  AuthCodeField,
  AuthVisionButton,
  AuthVisionField,
  AuthVisionShell,
} from "@/components/auth/auth-vision-shell";
import { authType, useAuthColors } from "@/components/auth/auth-vision-tokens";
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

/** Client-side wait before another code can be requested. */
export const RESEND_COOLDOWN_SECONDS = 60;
const CODE_MIN = 6;

function useCountdown(): [number, () => void] {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= now) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until, now]);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  const start = () => {
    const t = Date.now();
    setNow(t);
    setUntil(t + RESEND_COOLDOWN_SECONDS * 1000);
  };
  return [left, start];
}

export function RegisterScreen() {
  const c = useAuthColors();
  const [cooldown, startCooldown] = useCountdown();
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
        startCooldown();
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

  const resendBlocked = busy || cooldown > 0;

  return (
    <AuthVisionShell
      stepKey={String(step)}
      contentGap={16}
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
            <Text style={[authType.body, { color: c.ink, flexShrink: 1 }]} numberOfLines={1}>
              {email.trim()}
            </Text>
            <Text style={[authType.link, { color: c.accent }]}>{vi.register.changeEmail}</Text>
          </Pressable>
        ) : undefined
      }
      onBack={onBack}
      backDisabled={busy}
      action={
        step === 1 ? (
          <AuthVisionButton
            testID="register-send-code"
            title={vi.register.sendCode}
            onPress={() => onSendCode("send")}
            loading={pending === "send"}
            disabled={!email.trim() || busy}
          />
        ) : (
          <AuthVisionButton
            testID="register-verify"
            title={vi.register.verifyCode}
            onPress={onVerify}
            loading={pending === "verify"}
            disabled={token.length < CODE_MIN || busy}
          />
        )
      }
      below={
        step === 1 ? (
          <Text style={[authType.caption, styles.footerText, { color: c.ink }]}>
            {vi.register.haveAccount}{" "}
            <Link href="/login" style={[authType.link, { color: c.accent }]}>
              {vi.register.toLogin}
            </Link>
          </Text>
        ) : undefined
      }
      link={
        step === 1 ? undefined : (
            <Pressable
              testID="register-resend"
              accessibilityRole="button"
              accessibilityLabel={cooldown > 0 ? vi.register.resendIn(cooldown) : vi.register.resendCode}
              accessibilityState={{ disabled: resendBlocked }}
              disabled={resendBlocked}
              onPress={() => onSendCode("resend")}
              style={styles.resend}
            >
              <Text
                style={[
                  authType.link,
                  { color: resendBlocked ? c.buttonOffText : c.accent, opacity: pending === "resend" ? 0 : 1 },
                ]}
              >
                {cooldown > 0 ? vi.register.resendIn(cooldown) : vi.register.resendCode}
              </Text>
              {pending === "resend" ? (
                <ActivityIndicator color={c.accent} style={styles.resendSpinner} />
              ) : null}
            </Pressable>
        )
      }
    >
      {step === 1 ? (
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
      ) : (
        <AuthCodeField
          testID="register-code"
          label={vi.register.codeLabel}
          value={token}
          onChangeText={(value) => {
            setToken(value);
            setErrors((current) => ({ ...current, token: "" }));
            setFormError("");
          }}
          error={errors.token}
          editable={!busy}
          onSubmitEditing={onVerify}
        />
      )}
    </AuthVisionShell>
  );
}

const styles = StyleSheet.create({
  footerText: {
    textAlign: "center",
  },
  changeEmail: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
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
});
