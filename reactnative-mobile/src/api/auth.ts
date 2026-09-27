import { apiFetch } from "./client";
import type {
  AuthResponse,
  ForgotPasswordBody,
  ForgotPasswordResponse,
  LoginBody,
  LogoutResponse,
  PublicUser,
  RefreshBody,
  RegisterBody,
  RegisterResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
} from "./types";

export function login(body: LoginBody) {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    skipAuth: true,
    skipRefresh: true,
    body: JSON.stringify({
      email: body.email.trim().toLowerCase(),
      password: body.password,
    }),
  });
}

export function register(body: RegisterBody) {
  return apiFetch<RegisterResponse>("/auth/register", {
    method: "POST",
    skipAuth: true,
    skipRefresh: true,
    body: JSON.stringify(body),
  });
}

export function logout() {
  return apiFetch<LogoutResponse>("/auth/logout", {
    method: "POST",
    skipRefresh: true,
  });
}

export function getMe() {
  return apiFetch<PublicUser>("/users/me");
}

export function getUser(userId: string) {
  return apiFetch<PublicUser>(`/users/${userId}`);
}

export function forgotPassword(body: ForgotPasswordBody) {
  return apiFetch<ForgotPasswordResponse>("/auth/forgot-password", {
    method: "POST",
    skipAuth: true,
    skipRefresh: true,
    body: JSON.stringify({
      email: body.email.trim().toLowerCase(),
    }),
  });
}

export function resetPassword(body: ResetPasswordBody) {
  return apiFetch<ResetPasswordResponse>("/auth/reset-password", {
    method: "POST",
    skipAuth: true,
    skipRefresh: true,
    body: JSON.stringify({
      tokenHash: body.tokenHash,
      newPassword: body.newPassword,
    }),
  });
}

export function refresh(body: RefreshBody) {
  return apiFetch<AuthResponse>("/auth/refresh", {
    method: "POST",
    skipAuth: true,
    skipRefresh: true,
    body: JSON.stringify({ refreshToken: body.refreshToken }),
  });
}
