import { roleMayReadMeasurements } from "@/api/role-contracts";

export type BodySection = "health" | "exam";

export type BodyChromeState = {
  section: BodySection;
  filter: string;
  reason: string;
};

export function initialBodyChrome(): BodyChromeState {
  return { section: "health", filter: "", reason: "" };
}

export function selectBodySection(state: BodyChromeState, section: BodySection): BodyChromeState {
  return { ...state, section };
}

export function withExamFilter(state: BodyChromeState, filter: string): BodyChromeState {
  return { ...state, filter };
}

export function withExamReason(state: BodyChromeState, reason: string): BodyChromeState {
  return { ...state, reason };
}

/** A theme update must not rewrite section, filter, or the exam reason. */
export function keepBodyChrome(state: BodyChromeState): BodyChromeState {
  return state;
}

export function measurementAvailability(role: string | null | undefined): {
  mayRead: boolean;
  message: string;
} {
  if (roleMayReadMeasurements(role)) {
    return { mayRead: true, message: "" };
  }
  return {
    mayRead: false,
    message:
      "Số đo không hiện trên tài khoản này. Huấn luyện viên và quản trị xem được lịch sử số đo.",
  };
}
