import { CircleCheck, ContactRound, FileHeart, FilePlus, FileText, FlaskConical, Paperclip, Phone, ScanLine, Send, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { EmptyState } from "@/components/ui/states";
import type { MedicalDocument, MedicalRecord } from "@/lib/domain/types";
import { formatDate, formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MedicalRecordEditor } from "./medical-record-editor";

const DOCUMENT_KINDS: Record<MedicalDocument["kind"], { label: string; icon: LucideIcon }> = {
    imaging: { label: "Imaging", icon: ScanLine },
    lab: { label: "Lab result", icon: FlaskConical },
    report: { label: "Report", icon: FileText },
    referral: { label: "Referral", icon: Send },
};

export interface MedicalRecordPanelProps {
    fighterId: string;
    fighterName: string;
    record: MedicalRecord | null;
    primaryDoctorName: string | null;
    /** Server time (ISO). */
    now: string;
}

/** The fighter's medical record: allergies first, then history, contact and documents. Doctors only. */
export function MedicalRecordPanel({ fighterId, fighterName, record, primaryDoctorName, now }: MedicalRecordPanelProps) {
    if (!record) {
        return (
            <EmptyState
                icon={<FilePlus />}
                title="No medical record opened yet"
                description={`Open ${fighterName}'s record to capture blood type, allergies, medications and an emergency contact before their baseline examination.`}
                action={<MedicalRecordEditor fighterId={fighterId} fighterName={fighterName} record={null} />}
            />
        );
    }

    const documents = [...record.documents].sort((a, b) => b.date.localeCompare(a.date));

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] text-fg-muted">
                    {primaryDoctorName ? `Primary doctor ${primaryDoctorName} · ` : ""}Last updated{" "}
                    <time dateTime={record.updatedAt} title={formatDateTime(record.updatedAt)}>
                        {formatRelative(record.updatedAt, now)}
                    </time>{" "}
                    · Visible to assigned sports doctors only
                </p>
                <MedicalRecordEditor
                    fighterId={fighterId}
                    fighterName={fighterName}
                    record={{
                        bloodType: record.bloodType,
                        allergies: record.allergies,
                        chronicConditions: record.chronicConditions,
                        medications: record.medications,
                        surgicalHistory: record.surgicalHistory,
                        emergencyContact: record.emergencyContact,
                        notes: record.notes,
                    }}
                />
            </div>

            <AllergyBanner allergies={record.allergies} />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <Card className="min-w-0 lg:col-span-2">
                    <CardHeader title="Clinical history" icon={<FileHeart />} />
                    <CardContent>
                        <DescriptionList
                            items={[
                                { label: "Blood type", value: record.bloodType },
                                { label: "Last physical", value: <time dateTime={record.lastPhysicalAt}>{formatDate(record.lastPhysicalAt)}</time> },
                                { label: "Chronic conditions", value: <PlainList items={record.chronicConditions} />, wide: true },
                                { label: "Current medications", value: <PlainList items={record.medications} />, wide: true },
                                {
                                    label: "Surgical history",
                                    value: <PlainList items={record.surgicalHistory.map((entry) => `${entry.year} — ${entry.procedure}`)} />,
                                    wide: true,
                                },
                                {
                                    label: "Clinical notes",
                                    value: record.notes ? (
                                        <span className="font-normal text-pretty whitespace-pre-line">{record.notes}</span>
                                    ) : (
                                        <span className="font-normal text-fg-muted">No notes</span>
                                    ),
                                    wide: true,
                                },
                            ]}
                        />
                    </CardContent>
                </Card>

                <div className="flex min-w-0 flex-col gap-6">
                    <Card>
                        <CardHeader title="Emergency contact" icon={<ContactRound />} />
                        <CardContent>
                            {record.emergencyContact.name || record.emergencyContact.phone ? (
                                <div className="flex flex-col gap-1 text-sm">
                                    <p className="font-medium text-fg">{record.emergencyContact.name || "Name not recorded"}</p>
                                    {record.emergencyContact.relation && <p className="text-fg-muted">{record.emergencyContact.relation}</p>}
                                    {record.emergencyContact.phone && (
                                        <a
                                            href={`tel:${record.emergencyContact.phone.replace(/[^\d+]/g, "")}`}
                                            className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-sm font-medium text-primary-soft-fg hover:underline"
                                        >
                                            <Phone aria-hidden className="size-3.5" />
                                            {record.emergencyContact.phone}
                                        </a>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-fg-muted">No emergency contact recorded. Add one with Edit record.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader title="Documents" description={pluralize(documents.length, "document")} icon={<Paperclip />} />
                        {documents.length === 0 ? (
                            <CardContent>
                                <p className="text-sm text-fg-muted">No imaging, lab results, reports or referrals on file.</p>
                            </CardContent>
                        ) : (
                            <ul className="flex flex-col divide-y divide-border border-t border-border">
                                {documents.map((document) => {
                                    const kind = DOCUMENT_KINDS[document.kind];
                                    const Icon = kind.icon;
                                    return (
                                        <li key={document.id} className="flex gap-3 px-5 py-3">
                                            <span
                                                aria-hidden
                                                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted"
                                            >
                                                <Icon className="size-4" />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-pretty text-fg">{document.title}</p>
                                                <p className="text-xs text-fg-muted">
                                                    {kind.label} · <time dateTime={document.date}>{formatDate(document.date)}</time> · {document.authorName}
                                                </p>
                                                <p className="mt-1 text-[13px] text-pretty text-fg-muted">{document.summary}</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}

/** Allergies are the first thing a clinician needs — highlighted whenever any are recorded. */
export function AllergyBanner({ allergies, className }: { allergies: string[]; className?: string }) {
    if (allergies.length === 0) {
        return (
            <p className={cn("flex items-center gap-2 rounded-lg bg-surface-muted px-4 py-2.5 text-sm text-fg-muted", className)}>
                <CircleCheck aria-hidden className="size-4 shrink-0 text-success-fg" />
                No known allergies recorded.
            </p>
        );
    }
    return (
        <div role="note" aria-label="Allergies" className={cn("flex items-start gap-3 rounded-lg px-4 py-3 ring-1 ring-inset", "bg-danger-soft ring-danger-border", className)}>
            <TriangleAlert aria-hidden className="mt-0.5 size-[18px] shrink-0 text-danger-fg" />
            <div className="min-w-0">
                <p className="text-sm font-semibold text-danger-fg">
                    {allergies.length === 1 ? "Allergy" : `${allergies.length} allergies`} — check before prescribing or administering medication
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                    {allergies.map((allergy) => (
                        <li key={allergy}>
                            <Badge tone="danger" variant="solid">
                                {allergy}
                            </Badge>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

function PlainList({ items, empty = "None recorded" }: { items: string[]; empty?: ReactNode }) {
    if (items.length === 0) return <span className="font-normal text-fg-muted">{empty}</span>;
    return (
        <ul className="flex flex-col gap-1">
            {items.map((item) => (
                <li key={item} className="flex gap-2 font-normal">
                    <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-fg-subtle" />
                    <span className="text-pretty">{item}</span>
                </li>
            ))}
        </ul>
    );
}
