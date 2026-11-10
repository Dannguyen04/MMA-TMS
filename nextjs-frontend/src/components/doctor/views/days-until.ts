import { plural, type Translator } from "@/lib/i18n/translate";

/** Whole-day distance in words ("today", "in 3 days", "2 days ago"), as `describeDaysUntil` words it in Vietnamese. */
export function daysUntil(t: Translator, days: number): string {
    if (days === 0) return t("doctorViews.days.today");
    if (days === 1) return t("doctorViews.days.tomorrow");
    if (days === -1) return t("doctorViews.days.yesterday");
    return days > 0 ? plural(t, "doctorViews.days.in", days) : plural(t, "doctorViews.days.ago", -days);
}
