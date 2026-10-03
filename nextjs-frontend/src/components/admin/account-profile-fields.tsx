"use client";

import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import type { ActionForm } from "@/components/ui/use-action-form";
import { ACCOUNT_LIMITS, type AccountProfile, type CoachProfileFields, type DoctorProfileFields, type FighterProfileFields } from "@/lib/domain/account-contract";
import { STANCE_LABELS, WEIGHT_CLASS_LABELS, WEIGHT_CLASS_ORDER } from "@/lib/domain/labels";

export type StaffAccount = Exclude<AccountProfile, { role: "admin" }>;

export interface AccountProfileFieldsProps {
    form: ActionForm<undefined>;
    role: StaffAccount["role"];
    /** The saved profile when editing; the fields start empty when creating. */
    initial?: StaffAccount | null;
    /** Today's academy date (YYYY-MM-DD), the latest date of birth the picker offers. */
    today: string;
}

type FormProp = { form: ActionForm<undefined> };

/** A fighter's, coach's or doctor's profile fields, named `profile.<field>` as the account actions read them. */
export function AccountProfileFields({ form, role, initial, today }: AccountProfileFieldsProps) {
    const saved = initial?.role === role ? initial : null;
    return (
        <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextField form={form} name="firstName" label="First name" required max={ACCOUNT_LIMITS.name} defaultValue={saved?.profile.firstName} />
                <TextField form={form} name="lastName" label="Last name" required max={ACCOUNT_LIMITS.name} defaultValue={saved?.profile.lastName} />
            </div>
            {role === "fighter" && <FighterFields form={form} saved={saved?.role === "fighter" ? saved.profile : null} today={today} />}
            {role === "coach" && <CoachFields form={form} saved={saved?.role === "coach" ? saved.profile : null} />}
            {role === "doctor" && <DoctorFields form={form} saved={saved?.role === "doctor" ? saved.profile : null} />}
        </>
    );
}

function FighterFields({ form, saved, today }: FormProp & { saved: FighterProfileFields | null; today: string }) {
    const dateOfBirth = form.control("profile.dateOfBirth", { required: true });
    const weightClass = form.control("profile.weightClass", { required: true });
    const stance = form.control("profile.dominantStance");
    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Date of birth" htmlFor={dateOfBirth.id} required error={form.error("profile.dateOfBirth")}>
                <Input {...dateOfBirth} type="date" max={today} defaultValue={saved?.dateOfBirth ?? ""} />
            </Field>
            <Field label="Weight class" htmlFor={weightClass.id} required error={form.error("profile.weightClass")}>
                <Select {...weightClass} defaultValue={saved?.weightClass ?? ""}>
                    <option value="" disabled>
                        Choose a weight class
                    </option>
                    {WEIGHT_CLASS_ORDER.map((value) => (
                        <option key={value} value={value}>
                            {WEIGHT_CLASS_LABELS[value]}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field label="Stance" htmlFor={stance.id} optional error={form.error("profile.dominantStance")}>
                <Select {...stance} defaultValue={saved?.dominantStance ?? ""}>
                    <option value="">Not recorded</option>
                    {Object.entries(STANCE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </Select>
            </Field>
            <TextField form={form} name="nationality" label="Nationality" max={ACCOUNT_LIMITS.nationality} defaultValue={saved?.nationality} placeholder="e.g. Vietnamese" />
        </div>
    );
}

function CoachFields({ form, saved }: FormProp & { saved: CoachProfileFields | null }) {
    return (
        <>
            <TextField form={form} name="specialization" label="Specialisation" max={ACCOUNT_LIMITS.specialization} defaultValue={saved?.specialization} placeholder="e.g. Striking" />
            <Checkbox
                id={form.control("profile.isHeadCoach").id}
                name="profile.isHeadCoach"
                label="Head coach"
                description="Leads the coaching staff."
                defaultChecked={saved?.isHeadCoach ?? false}
            />
        </>
    );
}

function DoctorFields({ form, saved }: FormProp & { saved: DoctorProfileFields | null }) {
    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField form={form} name="licenseNumber" label="License number" required max={ACCOUNT_LIMITS.licenseNumber} defaultValue={saved?.licenseNumber} />
            <TextField
                form={form}
                name="specialization"
                label="Specialisation"
                max={ACCOUNT_LIMITS.specialization}
                defaultValue={saved?.specialization}
                placeholder="e.g. Sports medicine"
            />
        </div>
    );
}

function TextField({
    form,
    name,
    label,
    required = false,
    max,
    defaultValue,
    placeholder,
}: FormProp & { name: string; label: string; required?: boolean; max: number; defaultValue?: string | null; placeholder?: string }) {
    const control = form.control(`profile.${name}`, { required });
    return (
        <Field label={label} htmlFor={control.id} required={required} optional={!required} error={form.error(`profile.${name}`)}>
            <Input {...control} defaultValue={defaultValue ?? ""} maxLength={max} autoComplete="off" placeholder={placeholder} />
        </Field>
    );
}
