/// <reference types="jest" />
import { videoTitle, guidanceLine, guidanceText, notificationTemplates, notificationTypeTitle, viNotification } from "./server-text";

// Exact backend English (nestjs-api *_NOTIFICATION_TEXT), copied verbatim for the test.
const EN: [string, string, string][] = [
  ["ADMISSION_APPLICATION_SUBMITTED", "New fighter application", "A Guest submitted a fighter application. Assign a Coach to evaluate it."],
  ["ADMISSION_ASSESSMENT_ASSIGNED", "Application assigned to you", "You were assigned to evaluate a fighter application. Record the PASS or FAIL assessment when you are done."],
  ["ADMISSION_ASSESSMENT_UNASSIGNED", "Application evaluation reassigned", "A fighter application you were evaluating was reassigned to another Coach. No further action is needed from you."],
  ["ADMISSION_DECISION_REQUIRED", "Application awaiting decision", "A Coach recorded a PASS assessment. Approve or reject the application."],
  ["ADMISSION_ASSESSMENT_RESULT", "Assessment passed", "Your application passed the assessment and is waiting for an Admin decision. Passing does not activate your Fighter account yet."],
  ["ADMISSION_ASSESSMENT_RESULT", "Assessment not passed", "Your application did not pass the assessment and this attempt is closed. You may submit a new application."],
  ["ADMISSION_DECISION_RECORDED", "Application approved", 'Your application was approved. Set your password from the email we sent to activate your Fighter account (if it does not arrive, request another one with "Forgot password" on the sign-in page), then complete activation.'],
  ["ADMISSION_DECISION_RECORDED", "Application not approved", "Your application was not approved. This attempt is closed."],
  ["ADMISSION_ACTIVATION_COMPLETED", "New Fighter activated", "A new Fighter completed activation. Assign a training Coach; the admission evaluator is not assigned automatically."],
  ["COACH_ASSIGNMENT_STARTED", "New Fighter assigned", "You were assigned as training Coach for a Fighter. The Fighter appears in your roster from the assignment start."],
  ["COACH_ASSIGNMENT_STARTED", "Training Coach assigned", "A training Coach was assigned to you."],
  ["COACH_ASSIGNMENT_ENDED", "Fighter assignment ended", "One of your training Fighter assignments was ended."],
  ["COACH_ASSIGNMENT_ENDED", "Training Coach assignment ended", "One of your training Coach assignments was ended."],
  ["TRAINING_PLAN_ACTIVATED", "Training plan active", "A training plan assigned to you is now active."],
  ["TRAINING_SESSION_SCHEDULED", "Training session scheduled", "A new training session was scheduled."],
  ["TRAINING_SESSION_RESCHEDULED", "Training session changed", "The time or location of a training session changed."],
  ["TRAINING_SESSION_CANCELLED", "Training session cancelled", "A training session was cancelled."],
  ["FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED", "Assign a Doctor", "A new Fighter needs an assigned Doctor for the baseline examination before training."],
];
const ascii = /^[\x20-\x7e]*$/;

describe("Phase 5 C: notification texts", () => {
  it.each(EN)("%s / %s: Vietnamese title and body, no English left", (type, title, message) => {
    const vi = viNotification({ type, title, message });
    const t = notificationTemplates[type].find((x) => x.title === title)!;
    expect(vi.title).toBe(t.titleVi);
    expect(vi.message).toBe(t.bodyVi(message.match(t.body)!));
    expect(vi.message).not.toBe("");
    expect(ascii.test(vi.message)).toBe(false);
    expect(vi.message).not.toContain(message);
  });
  it("covers every published template exactly once", () => {
    expect(Object.values(notificationTemplates).flat()).toHaveLength(EN.length);
  });
  it("a body that matches no template is hidden; the title still comes from the type", () => {
    expect(viNotification({ type: "TRAINING_SESSION_CANCELLED", title: "Training session cancelled", message: "Cancelled because of rain." }))
      .toEqual({ title: "Buổi tập đã huỷ", message: "" });
    expect(viNotification({ type: "TRAINING_SESSION_CANCELLED", title: "Something new", message: "A training session was cancelled." }))
      .toEqual({ title: "Buổi tập đã huỷ", message: "Một buổi tập đã bị huỷ." });
  });
  it("types without a producer yet (bout, suspension) and legacy types get a title and no English body", () => {
    for (const type of ["BOUT_CREATED", "BOUT_WEIGHT_AT_RISK", "BOUT_REQUIREMENT_REJECTED", "BOUT_REQUIREMENT_DUE", "BOUT_WEIGHT_MISSING", "SUSPENSION_CREATED", "SUSPENSION_AWAITING_CLEARANCE", "SYSTEM", "VIDEO_PROCESSED"]) {
      const vi = viNotification({ type, title: "Whatever", message: "Some English text." });
      expect(vi.title).toBe(notificationTypeTitle[type]);
      expect(vi.message).toBe("");
    }
    expect(Object.keys(notificationTypeTitle)).toHaveLength(28);
  });
  it("an unknown type falls back to a generic Vietnamese title", () => {
    expect(viNotification({ type: "NEW_THING", title: "New thing", message: "Hello" })).toEqual({ title: "Thông báo mới", message: "" });
  });
  it("the api layer localizes listed rows", async () => {
    jest.resetModules();
    jest.doMock("@/api/client", () => ({ apiFetch: jest.fn().mockResolvedValue({ data: [{ id: "1", type: "TRAINING_PLAN_ACTIVATED", title: "Training plan active", message: "A training plan assigned to you is now active.", payload: {}, isRead: false, readAt: null, createdAt: "2026-11-01T00:00:00Z" }], total: 1, hasNextPage: false }) }));
    const { listNotifications } = require("@/api/notifications");
    const page = await listNotifications();
    expect(page.data[0]).toMatchObject({ id: "1", title: "Giáo án đã áp dụng", message: "Giáo án giao cho bạn đã bắt đầu áp dụng." });
  });
});

describe("Phase 5 C: recording guidance", () => {
  it("maps all 15 worker codes", () => {
    expect(Object.keys(guidanceText)).toHaveLength(15);
    expect(guidanceLine("LOW_FPS")).toBe("Dùng video quay ít nhất 20 khung hình/giây.");
  });
  it("an unknown code is hidden, never the English", () => {
    expect(guidanceLine("NEW_CODE")).toBeNull();
  });
});

describe("Phase 5 C (3a): re-analysed video titles", () => {
  it("maps the server suffix, keeps the user's title as sent", () => {
    expect(videoTitle("Buổi pad 31/10 (Reanalysis)")).toBe("Buổi pad 31/10 (Phân tích lại)");
    expect(videoTitle("Sparring (Reanalysis) (Reanalysis)")).toBe("Sparring (Phân tích lại) (Phân tích lại)");
  });
  it("leaves other titles alone", () => {
    expect(videoTitle("Reanalysis of my jab")).toBe("Reanalysis of my jab");
    expect(videoTitle("Clip (Reanalysis) cũ")).toBe("Clip (Reanalysis) cũ");
    expect(videoTitle("")).toBe("");
    expect(videoTitle(null)).toBeNull();
    expect(videoTitle(undefined)).toBeUndefined();
  });
});

describe("Phase 5 I: examination areas stored in English", () => {
  it("shows the three baseline areas in Vietnamese and leaves other areas as written", () => {
    const { assessmentAreaLabel } = jest.requireActual("./server-text") as typeof import("./server-text");
    expect(assessmentAreaLabel("Cardiovascular")).toBe("Tim mạch");
    expect(assessmentAreaLabel("Neurological")).toBe("Thần kinh");
    expect(assessmentAreaLabel("Musculoskeletal")).toBe("Cơ xương khớp");
    expect(assessmentAreaLabel("Da liễu")).toBe("Da liễu");
  });
});
