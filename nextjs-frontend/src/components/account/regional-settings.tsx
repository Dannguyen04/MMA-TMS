"use client";

import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Field, Input, Select } from "@/components/ui/form";
import { setLocalePreference } from "@/lib/actions/locale";
import { APP_TIMEZONE, formatDate, formatDateTime, formatTime, formatWeekdayDate } from "@/lib/format";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";

function utcOffsetLabel(now: string, locale: Locale): string {
    return (
        new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: APP_TIMEZONE, timeZoneName: "shortOffset" })
            .formatToParts(new Date(now))
            .find((part) => part.type === "timeZoneName")?.value ?? "UTC"
    );
}

/** Language, the academy time zone and how dates are written. */
export function RegionalSettings({ now, locale: initialLocale }: { now: string; locale?: Locale }) {
    const activeLocale = useLocale();
    const locale = initialLocale ?? activeLocale;
    const t = useT();
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    const onLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const next = event.target.value as Locale;
        const data = new FormData();
        data.set("locale", next);
        startTransition(async () => {
            await setLocalePreference(data);
            router.refresh();
        });
    };

    const examples = [
        { label: t("account.regional.exampleDate"), value: formatDate(now, locale) },
        { label: t("account.regional.exampleShortDate"), value: formatWeekdayDate(now, locale) },
        { label: t("account.regional.exampleTime"), value: t("account.regional.exampleTimeSuffix", { time: formatTime(now, locale) }) },
        { label: t("account.regional.exampleDateTime"), value: formatDateTime(now, locale) },
    ];

    return (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label={t("account.regional.language")} htmlFor="settings-language" hint={t("account.regional.languageHint")}>
                <Select id="settings-language" name="language" value={locale} disabled={pending} onChange={onLanguageChange}>
                    <option value="en">English</option>
                    <option value="vi">Tiếng Việt</option>
                </Select>
            </Field>
            <Field label={t("account.regional.timezone")} htmlFor="settings-timezone" hint={t("account.regional.timezoneHint")}>
                <Input
                    id="settings-timezone"
                    readOnly
                    value={`${APP_TIMEZONE} (${locale === "vi" ? "giờ học viện" : "academy time"})`}
                    className="bg-surface-muted text-fg-muted"
                />
            </Field>
            <div className="md:col-span-2">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-fg">
                    {t("account.regional.formatTitle")}
                    <span className="inline-flex items-center gap-1 text-[13px] font-normal text-fg-muted">
                        <Clock aria-hidden className="size-3.5" />
                        {t("account.regional.currentAcademyTime", { time: formatTime(now, locale), offset: utcOffsetLabel(now, locale) })}
                    </span>
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {examples.map((example) => (
                        <div key={example.label} className="min-w-0 rounded-lg bg-surface-muted px-3 py-2.5">
                            <dt className="text-xs text-fg-muted">{example.label}</dt>
                            <dd className="mt-0.5 text-sm font-medium break-words text-fg">{example.value}</dd>
                        </div>
                    ))}
                </dl>
                <p className="mt-2 text-[13px] text-fg-subtle">{t("account.regional.formatExplanation")}</p>
            </div>
        </div>
    );
}
