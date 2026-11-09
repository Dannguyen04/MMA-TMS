import "./doctor.css";

import type { ThemePreference } from "@/lib/auth/constants";
import type { User } from "@/lib/domain/types";
import { doctorShellCounts } from "@/lib/services/doctor-board";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import type { NotificationBellData } from "@/lib/services/notifications";
import { initials } from "@/lib/utils";
import { DoctorShell } from "./shell";

/** Khung bác sĩ: thanh bên dọc hai nhóm. Font trang vẫn là font của app. */
export async function DoctorFrame({ user, theme, notifications, children }: { user: User; theme: ThemePreference; notifications: NotificationBellData | null; children: React.ReactNode }) {
    const counts = await doctorShellCounts(user);
    const { t } = await getTranslator();
    const name = `BS. ${user.name.replace(/^(BS|Dr)\.?\s+/i, "")}`;
    return (
        <div lang="vi" className="yt">
            <DoctorShell
                doctor={{ name, role: t("doctor.nav.role"), initials: initials(user.name) }}
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
