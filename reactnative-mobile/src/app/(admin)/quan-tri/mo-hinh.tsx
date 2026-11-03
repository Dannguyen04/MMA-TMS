import { manager } from "@/i18n/manager";
import { AdminUnavailable } from "@/screens/admin/admin-ui";

/** Chưa có API backend — xem out/06-API-can-bo-sung.md. */
export default function AdminModelsRoute() {
  return <AdminUnavailable title={manager.tools.models} description={manager.missing.models} />;
}
