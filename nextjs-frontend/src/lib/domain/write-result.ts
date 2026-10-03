/** The outcome of a write a form shows: done, or why not, with messages for the fields at fault. */
export type WriteResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };
