import "./doctor.css";

import type { ThemePreference } from "@/lib/auth/constants";
import type { User } from "@/lib/domain/types";
import { doctorShellCounts } from "@/lib/services/doctor-board";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";
import type { NotificationBellData } from "@/lib/services/notifications";
import { routes } from "@/lib/routes";
import { publicSans, shoulders } from "./fonts";
import { initials } from "./labels";
import { DoctorShell } from "./shell";

/** Khung riêng của vai trò Bác sĩ: thanh bên dọc, chữ tiếng Việt. Các vai trò khác vẫn dùng AppShell. */
export async function DoctorFrame({ user, theme, notifications, children }: { user: User; theme: ThemePreference; notifications: NotificationBellData | null; children: React.ReactNode }) {
    const counts = await doctorShellCounts(user);
    const name = `BS. ${user.name.replace(/^(BS|Dr)\.?\s+/i, "")}`;
    return (
        <div lang="vi" className={`yt ${shoulders.variable} ${publicSans.variable}`}>
            <DoctorShell
                doctor={{ name, role: "Bác sĩ y học thể thao", initials: initials(user.name) }}
                theme={theme}
                counts={counts}
                showRecords={medicalFeatureAvailable("medicalRecord")}
                bell={notifications ? { unread: notifications.unread, href: notifications.allHref ?? routes.notifications } : null}
            >
                {children}
            </DoctorShell>
        </div>
    );
}
