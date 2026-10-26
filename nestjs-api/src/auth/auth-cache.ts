/**
 * Short-lived in-memory cache for the two lookups every authenticated request pays for: who the token belongs
 * to (Supabase `getUser` + `users` row) and what that user may do (permission join). Entries live at most
 * `AUTH_CACHE_TTL_MS`, so a deactivated user, changed role or changed permission is seen within that window
 * even where `invalidateAuthCache()` is not called; the writers that know about the change call it for an
 * immediate effect.
 */
export const AUTH_CACHE_TTL_MS = 15_000;
const AUTH_CACHE_MAX_ENTRIES = 2_000;

const caches = new Set<TtlCache<unknown>>();

export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();

  constructor(private readonly ttlMs: number = AUTH_CACHE_TTL_MS) {
    caches.add(this as TtlCache<unknown>);
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** `notAfter` (epoch ms) caps the lifetime, e.g. at the token's own expiry. */
  set(key: string, value: V, notAfter = Number.POSITIVE_INFINITY): void {
    if (this.entries.size >= AUTH_CACHE_MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, {
      value,
      expiresAt: Math.min(Date.now() + this.ttlMs, notAfter),
    });
  }

  clear(): void {
    this.entries.clear();
  }
}

/** Drops every cached identity and permission set; call after changing a user's state, role or permissions. */
export function invalidateAuthCache(): void {
  for (const cache of caches) cache.clear();
}

/** Epoch ms of a JWT's `exp` claim, or null if unreadable. Only bounds the cache; never trusted for access. */
export function jwtExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
