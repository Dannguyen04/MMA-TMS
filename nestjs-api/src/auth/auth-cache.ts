/**
 * Short-lived in-memory cache for the two lookups every authenticated request pays for: who the token belongs
 * to (Supabase `getUser` + `users` row) and what that user may do (permission join). Identity entries live at
 * most `IDENTITY_CACHE_TTL_MS` (and never past the token's `exp`), permission entries at most
 * `AUTH_CACHE_TTL_MS`, so a deactivated user, changed role or changed permission is seen within that window
 * even where `invalidateAuthCache()` is not called; the writers that know about the change call it for an
 * immediate effect.
 *
 * `getOrLoad` also shares one lookup between concurrent callers with the same key, so a page that fires 40
 * requests on a cold cache makes one Supabase call per token instead of 40 (T-065).
 */
export const AUTH_CACHE_TTL_MS = 15_000;
export const IDENTITY_CACHE_TTL_MS = 60_000;
const AUTH_CACHE_MAX_ENTRIES = 2_000;

const caches = new Set<TtlCache<unknown>>();

export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();
  private readonly inFlight = new Map<string, Promise<V>>();
  /** Bumped by `clear()`, so a lookup that started before an invalidation does not refill the cache. */
  private generation = 0;

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

  /**
   * Returns the cached value, or joins the lookup already running for `key`, or starts `load`. A failed
   * lookup is dropped from the in-flight map and never cached, so the next caller tries again.
   */
  getOrLoad(
    key: string,
    load: () => Promise<V>,
    notAfter?: number,
  ): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const generation = this.generation;
    let started: Promise<V>;
    try {
      started = load();
    } catch (error) {
      return Promise.reject(error);
    }
    const promise = started
      .then((value) => {
        if (this.generation === generation) this.set(key, value, notAfter);
        return value;
      })
      .finally(() => {
        if (this.inFlight.get(key) === promise) this.inFlight.delete(key);
      });
    this.inFlight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
    this.generation += 1;
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
