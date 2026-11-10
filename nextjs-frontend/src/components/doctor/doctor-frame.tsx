import "./doctor.css";

/**
 * Content scope of the doctor pages. The rail and header come from the shared AppShell; this only scopes the
 * doctor's page styles (`.yt-*` in doctor.css), which read the app's global colour and type tokens.
 */
export function DoctorFrame({ children }: { children: React.ReactNode }) {
    return (
        <div lang="vi" className="yt">
            {children}
        </div>
    );
}
