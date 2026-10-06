/** Mirrors nestjs OPEN_APPLICATION_STATUSES. FAILED, REJECTED and ACTIVATED do not block a new file. */
export const OPEN_APPLICATION_STATUSES = ["SUBMITTED", "PASSED", "APPROVED"] as const;

export function blockingApplication<T extends { id: string; status: string }>(
  items: readonly T[],
): T | null {
  return (
    items.find((item) =>
      (OPEN_APPLICATION_STATUSES as readonly string[]).includes(item.status),
    ) ?? null
  );
}
