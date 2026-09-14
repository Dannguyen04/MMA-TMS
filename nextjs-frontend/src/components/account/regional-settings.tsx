import { Clock } from "lucide-react";

import { Field, Input, Select } from "@/components/ui/form";
import { APP_TIMEZONE, formatDate, formatDateTime, formatTime, formatWeekdayDate } from "@/lib/format";

function utcOffsetLabel(now: string): string {
    return (
        new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, timeZoneName: "shortOffset" })
            .formatToParts(new Date(now))
            .find((part) => part.type === "timeZoneName")?.value ?? "UTC"
    );
}

/** Language (English only for now), the academy time zone and how dates are written. */
export function RegionalSettings({ now }: { now: string }) {
    const languageHint = "Vietnamese (Tiếng Việt) is coming soon.";
    const timezoneHint = "Set by the academy so session times read the same for everyone, wherever they sign in from.";
    const examples = [
        { label: "Date", value: formatDate(now) },
        { label: "Short date", value: formatWeekdayDate(now) },
        { label: "Time", value: `${formatTime(now)} (24-hour)` },
        { label: "Date and time", value: formatDateTime(now) },
    ];

    return (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Language" htmlFor="settings-language" hint={languageHint}>
                <Select id="settings-language" name="language" defaultValue="en">
                    <option value="en">English</option>
                    <option value="vi" disabled>
                        Tiếng Việt — coming soon
                    </option>
                </Select>
            </Field>
            <Field label="Time zone" htmlFor="settings-timezone" hint={timezoneHint}>
                <Input
                    id="settings-timezone"
                    readOnly
                    value={`${APP_TIMEZONE} (academy time)`}
                    className="bg-surface-muted text-fg-muted"
                />
            </Field>
            <div className="md:col-span-2">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-fg">
                    Date and time format
                    <span className="inline-flex items-center gap-1 text-[13px] font-normal text-fg-muted">
                        <Clock aria-hidden className="size-3.5" />
                        It&apos;s {formatTime(now)} at the academy ({utcOffsetLabel(now)})
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
                <p className="mt-2 text-[13px] text-fg-subtle">Day before month, 24-hour clock — the format used across the academy.</p>
            </div>
        </div>
    );
}
