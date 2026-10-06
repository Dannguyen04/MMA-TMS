import { titleTextStyle, viLineHeight, type LiveTypography } from "@/theme/typography";

/**
 * Screen titles wrap instead of clipping. `clips` stays false because the
 * header does not set a max line count or a fixed height.
 */
export function headerTitleLayout(label: string, live: LiveTypography, contentWidth: number) {
  const title = titleTextStyle(live);
  const fontSize = title.fontSize;
  const lineHeight = Math.max(title.lineHeight, viLineHeight(fontSize));
  const width = Math.max(contentWidth, 1);
  const estimatedTextWidth = Math.max(label.length, 1) * fontSize * 0.55;
  const lines = Math.max(1, Math.ceil(estimatedTextWidth / width));
  return {
    fontSize,
    lineHeight,
    lines,
    blockHeight: lines * lineHeight,
    clips: false as const,
  };
}
