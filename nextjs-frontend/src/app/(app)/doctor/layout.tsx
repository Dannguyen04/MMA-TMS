import { DoctorFrame } from "@/components/doctor/doctor-frame";
import { requireRole } from "@/lib/auth/session";

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
    await requireRole("doctor");
    return <DoctorFrame>{children}</DoctorFrame>;
}
