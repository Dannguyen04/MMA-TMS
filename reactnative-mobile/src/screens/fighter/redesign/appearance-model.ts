export type DisplayMode = "light" | "dark";
export type ThemeId = "default" | "paper" | "mint";
export type AccentId = "red" | "green" | "blue" | "purple";
export type TypeSize = "small" | "medium" | "large";
export type ReadingSupport = "standard" | "highContrast";
export type AppearanceGroup = "theme" | "reading";

export type AppearanceDraft = {
  mode: DisplayMode;
  theme: ThemeId;
  accent: AccentId;
  typeSize: TypeSize;
  reading: ReadingSupport;
};

/**
 * Defaults for the fighter appearance editor.
 * Decision: Sáng, chủ đề Mặc định, nhấn Đỏ võ đài, Inter cỡ Vừa, tương phản tiêu chuẩn.
 * Áp dụng writes this shape to on-device storage. The draft stays local until that save.
 */
export const DEFAULT_APPEARANCE_DRAFT: AppearanceDraft = {
  mode: "light",
  theme: "default",
  accent: "red",
  typeSize: "medium",
  reading: "standard",
};

export const ACCENT_SWATCHES: readonly { id: AccentId; label: string; hex: string }[] = [
  { id: "red", label: "Đỏ võ đài", hex: "#C23A22" },
  { id: "green", label: "Xanh lục", hex: "#408369" },
  { id: "blue", label: "Xanh lam", hex: "#4878AB" },
  { id: "purple", label: "Tím", hex: "#8268AD" },
];

export const TYPE_SCALE: Record<TypeSize, number> = {
  small: 0.9,
  medium: 1,
  large: 1.16,
};

const MODE_LABEL: Record<DisplayMode, string> = { light: "Sáng", dark: "Tối" };
const THEME_LABEL: Record<ThemeId, string> = {
  default: "Mặc định",
  paper: "Giấy",
  mint: "Bạc hà",
};
const SIZE_LABEL: Record<TypeSize, string> = { small: "Nhỏ", medium: "Vừa", large: "Lớn" };

export function accentById(id: AccentId) {
  return ACCENT_SWATCHES.find((item) => item.id === id) ?? ACCENT_SWATCHES[0];
}

export function appearanceSummary(draft: AppearanceDraft): string {
  return `${THEME_LABEL[draft.theme]} · ${MODE_LABEL[draft.mode]} · Inter ${SIZE_LABEL[draft.typeSize].toLowerCase()}`;
}

export function settingsAppearanceSummary(draft: AppearanceDraft): string {
  return appearanceSummary(draft);
}

export function resetAppearanceGroup(draft: AppearanceDraft, group: AppearanceGroup): AppearanceDraft {
  if (group === "theme") return { ...draft, theme: DEFAULT_APPEARANCE_DRAFT.theme };
  return { ...draft, reading: DEFAULT_APPEARANCE_DRAFT.reading };
}

export function draftsEqual(a: AppearanceDraft, b: AppearanceDraft): boolean {
  return (
    a.mode === b.mode &&
    a.theme === b.theme &&
    a.accent === b.accent &&
    a.typeSize === b.typeSize &&
    a.reading === b.reading
  );
}

export type PreviewPalette = {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
};

export function previewPalette(draft: AppearanceDraft): PreviewPalette {
  const accent = accentById(draft.accent).hex;
  const high = draft.reading === "highContrast";
  if (draft.theme === "paper" && draft.mode === "light") {
    return {
      bg: "#F4ECD8",
      surface: "#FBF6EA",
      surface2: "#E7DCC4",
      ink: high ? "#000000" : "#3B2F20",
      muted: high ? "#1A140C" : "#6B5A45",
      line: high ? "#000000" : "#D9C9AE",
      accent,
      accentSoft: "#F3E6D4",
      onAccent: "#FFFFFF",
    };
  }
  if (draft.theme === "mint" && draft.mode === "light") {
    return {
      bg: "#E3EFE3",
      surface: "#F2F8F2",
      surface2: "#D5E6D8",
      ink: high ? "#000000" : "#13241A",
      muted: high ? "#102016" : "#3E5C4A",
      line: high ? "#000000" : "#C5D9CB",
      accent,
      accentSoft: "#DCEBDF",
      onAccent: "#FFFFFF",
    };
  }
  if (draft.mode === "dark") {
    return {
      bg: high ? "#000000" : "#0A0A0C",
      surface: high ? "#000000" : "#16161A",
      surface2: high ? "#1A1A1A" : "#1E1E24",
      ink: high ? "#FFFFFF" : "#F4F4F5",
      muted: high ? "#F2F2F2" : "#A1A1AA",
      line: high ? "#FFFFFF" : "#303038",
      accent,
      accentSoft: "#3B2726",
      onAccent: "#FFFFFF",
    };
  }
  return {
    bg: high ? "#FFFFFF" : "#F6F6F8",
    surface: "#FFFFFF",
    surface2: high ? "#F2F2F2" : "#ECECEF",
    ink: high ? "#000000" : "#18181B",
    muted: high ? "#1A1A1A" : "#616169",
    line: high ? "#000000" : "#E4E6E9",
    accent,
    accentSoft: "#F9EBE9",
    onAccent: "#FFFFFF",
  };
}

/** Illustration only. Never written to the signed-in profile or session APIs. */
export const PREVIEW_FIXTURE = {
  academy: "LOTUS COMBAT ACADEMY",
  title: "LỊCH TẬP HÔM NAY",
  initials: "NĐ",
  name: "Nguyễn Văn Đức",
  meta: "Hạng 70 kg · Sẵn sàng thi đấu",
  sessionKind: "BUỔI TẬP MẪU",
  time: "18:00–19:30",
  sessionTitle: "Kỹ thuật & thể lực",
  place: "Phòng tập · Lotus Combat Academy",
  weekLabel: "Buổi tập tuần này",
  weekValue: "4/5",
  weekDone: 4,
  weekTotal: 5,
  disclaimer: "Dữ liệu minh họa, không phải tiến độ của bạn.",
  reminderTitle: "Nhắc nhở",
  reminder: "Kiểm tra lịch tập và chuẩn bị dụng cụ trước buổi tập.",
  sync: "Cập nhật mới nhất: lịch tập đã được đồng bộ.",
} as const;
