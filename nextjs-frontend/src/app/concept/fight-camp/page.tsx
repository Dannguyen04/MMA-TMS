import type { Metadata } from "next";
import FightCampPrototype from "./prototype";
import DeepPrototype from "./deep-prototype";

export const metadata: Metadata = {
    title: "Fight camp · Bản thử nghiệm nghiệp vụ",
    robots: { index: false, follow: false },
};

export default async function FightCampConceptPage({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
    const { version } = await searchParams;
    return version === "1" ? <FightCampPrototype /> : <DeepPrototype />;
}
