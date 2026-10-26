import { Redirect, type Href } from "expo-router";

/** Giữ đường dẫn cũ: danh sách người dùng nay là tab "Người dùng" (chỉ đọc). */
export default function AdminUsersLegacyRoute() {
  return <Redirect href={"/(admin)/nguoi-dung" as Href} />;
}
