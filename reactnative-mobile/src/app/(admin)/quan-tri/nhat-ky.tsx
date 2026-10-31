import { manager } from "@/i18n/manager";
import { AdminUnavailable } from "@/screens/admin/admin-ui";

/** Chưa có API backend — xem out/06-API-can-bo-sung.md. */
export default function AdminAuditRoute() {
  return <AdminUnavailable title={manager.tools.audit} description={manager.missing.audit} />;
}
