import { createHash } from 'node:crypto';

/** Canonical JSON for semantic idempotency, not a signature/auth mechanism. */
export function resultDigest(value: unknown): string {
  function canonical(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, canonical(v)]));
    }
    if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('Non-finite result value');
    return item;
  }
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
