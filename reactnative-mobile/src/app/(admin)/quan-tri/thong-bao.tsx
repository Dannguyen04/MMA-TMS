import { Redirect, type Href } from "expo-router";

/** Giữ đường dẫn cũ: thông báo Admin nay là tab "Thông báo". */
export default function AdminNotificationsLegacyRoute() {
  return <Redirect href={"/(admin)/thong-bao" as Href} />;
}
