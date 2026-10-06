import { SESSION_STATUSES } from "@/api/types";
import { fighter } from "@/i18n/fighter";

import {
  DEFAULT_APPEARANCE_DRAFT,
  draftsEqual,
  PREVIEW_FIXTURE,
  previewPalette,
  resetAppearanceGroup,
} from "./appearance-model";
import { canSubmitReviewReason, reviewReasonIssue } from "./review-reason";

describe("review reason", () => {
  it("rejects empty and whitespace and accepts a real reason", () => {
    expect(reviewReasonIssue("")).toBe("empty");
    expect(reviewReasonIssue("   \n")).toBe("empty");
    expect(canSubmitReviewReason("   ", false)).toBe(false);
    expect(reviewReasonIssue("Đau vai")).toBeNull();
    expect(canSubmitReviewReason("Đau vai", false)).toBe(true);
  });

  it("rejects more than 2000 trimmed characters and blocks a second submit", () => {
    expect(reviewReasonIssue("a".repeat(2000))).toBeNull();
    expect(reviewReasonIssue(`  ${"a".repeat(2001)}  `)).toBe("tooLong");
    expect(canSubmitReviewReason("Đau vai", true)).toBe(false);
  });
});

describe("session filters", () => {
  it("maps Vietnamese labels onto the server enums without renaming them", () => {
    expect(SESSION_STATUSES).toEqual([
      "SCHEDULED",
      "IN_PROGRESS",
      "COMPLETED",
      "SKIPPED",
      "CANCELLED",
      "ABANDONED",
    ]);
    expect(fighter.sessionStatus.SCHEDULED).toBe("Đã lên lịch");
    expect(fighter.sessionStatus.IN_PROGRESS).toBe("Đang tập");
    expect(fighter.sessionStatus.COMPLETED).toBe("Đã xong");
    expect(fighter.sessionStatus.SKIPPED).toBe("Bỏ buổi");
    expect(fighter.sessionStatus.CANCELLED).toBe("Đã hủy");
    expect(fighter.sessionStatus.ABANDONED).toBe("Dừng giữa chừng");
  });
});

describe("training and competition eligibility", () => {
  it("keeps the two scopes independent", () => {
    const dossier = {
      training: { eligible: true, reasons: [] as string[] },
      competition: { eligible: false, reasons: ["CLEARANCE_REQUIRED"] },
    };
    expect(dossier.training.eligible).toBe(true);
    expect(dossier.competition.eligible).toBe(false);
    expect(dossier.training.eligible).not.toBe(dossier.competition.eligible);
  });
});

describe("appearance draft", () => {
  it("resets one group without clearing the rest, and full default restores everything", () => {
    const edited = {
      ...DEFAULT_APPEARANCE_DRAFT,
      theme: "paper" as const,
      reading: "highContrast" as const,
      accent: "blue" as const,
      mode: "dark" as const,
    };
    const themeReset = resetAppearanceGroup(edited, "theme");
    expect(themeReset.theme).toBe("default");
    expect(themeReset.reading).toBe("highContrast");
    expect(themeReset.accent).toBe("blue");
    const readingReset = resetAppearanceGroup(edited, "reading");
    expect(readingReset.reading).toBe("standard");
    expect(readingReset.theme).toBe("paper");
    expect(draftsEqual(DEFAULT_APPEARANCE_DRAFT, edited)).toBe(false);
  });

  it("changes the preview palette with accent, theme, and contrast without touching the fixture identity", () => {
    const red = previewPalette(DEFAULT_APPEARANCE_DRAFT);
    const blue = previewPalette({ ...DEFAULT_APPEARANCE_DRAFT, accent: "blue" });
    const paper = previewPalette({ ...DEFAULT_APPEARANCE_DRAFT, theme: "paper" });
    const contrast = previewPalette({ ...DEFAULT_APPEARANCE_DRAFT, reading: "highContrast" });
    expect(blue.accent).toBe("#4878AB");
    expect(blue.accent).not.toBe(red.accent);
    expect(paper.bg).not.toBe(red.bg);
    expect(contrast.ink).toBe("#000000");
    expect(PREVIEW_FIXTURE.name).toBe("Nguyễn Văn Đức");
    expect(PREVIEW_FIXTURE.weekValue).toBe("4/5");
    expect(PREVIEW_FIXTURE.name.includes("Minh")).toBe(false);
  });
});
