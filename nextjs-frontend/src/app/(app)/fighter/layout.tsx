import { requireRole } from "@/lib/auth/session";

export default async function FighterLayout({ children }: { children: React.ReactNode }) {
    await requireRole("fighter");
    return children;
}
