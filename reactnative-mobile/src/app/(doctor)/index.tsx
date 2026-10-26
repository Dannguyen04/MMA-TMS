import { Redirect, type Href } from "expo-router";

/** "/(doctor)" (đích sau đăng nhập và các liên kết cũ) → tab Võ sĩ. */
export default function DoctorHomeRoute() {
  return <Redirect href={"/(doctor)/vo-si" as Href} />;
}
