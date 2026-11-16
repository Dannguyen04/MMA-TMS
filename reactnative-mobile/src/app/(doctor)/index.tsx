import { Redirect, type Href } from "expo-router";

/** "/(doctor)" (đích sau đăng nhập và các liên kết cũ) → tab Hôm nay (redesign 2026-11-11). */
export default function DoctorHomeRoute() {
  return <Redirect href={"/(doctor)/hom-nay" as Href} />;
}
