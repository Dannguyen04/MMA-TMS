import { isApiError } from "@/api";
import { fighterBout } from "@/i18n/fighter-bout";

/** Thông báo tiếng Việt cho lỗi khi ghi cân (403 = chưa được phép ghi cân). */
export function weighInErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 403 || error.code === "FORBIDDEN") return fighterBout.weigh.forbidden;
    if (error.status === 0 || error.code === "NETWORK_ERROR") return fighterBout.weigh.network;
  }
  return fighterBout.weigh.failed;
}
