/**
  * Same logic as nestjs-api/src/shared/gemini/gemini-key-pool.ts (the packages share no code).
  *
  * Rotates Gemini API keys when one runs out of quota or stops being valid.
  *
  * Keys come from GEMINI_API_KEYS (comma separated) or, as a one-key fallback,
  * GEMINI_API_KEY. A request that fails because of its key (HTTP 429 /
  * RESOURCE_EXHAUSTED, 401, 403, or 400 API_KEY_INVALID) is sent again with the
  * next key. The pool remembers the last key that answered, so the next request
  * starts there. Keys are never logged: callers only see their 1-based position.
  */

export type GeminiKeyFailure = "QUOTA" | "INVALID_KEY";

export interface GeminiKeyFailureEvent {
    /** 1-based position of the key in the configured list. */
    keyNumber: number;
    keyCount: number;
    reason: GeminiKeyFailure;
    status: number;
}

export class GeminiKeysExhaustedError extends Error {
    constructor(
        readonly keyCount: number,
        readonly quota: number,
        readonly invalid: number,
        /** The last failing response, for callers that inspect it. */
        readonly response: Response,
    ) {
        super(
            `All ${keyCount} Gemini API key(s) failed (quota: ${quota}, invalid or expired: ${invalid})`,
        );
        this.name = "GeminiKeysExhaustedError";
    }
}

/** Splits, trims, unquotes and de-duplicates keys; GEMINI_API_KEYS wins over GEMINI_API_KEY. */
export function parseGeminiKeys(list?: string, single?: string): string[] {
    const clean = (value: string) =>
        value.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
    const keys = (list ?? "").split(/[,\n]/).map(clean).filter(Boolean);
    const unique = [...new Set(keys)];
    if (unique.length) return unique;
    const one = clean(single ?? "");
    return one ? [one] : [];
}

const INVALID_KEY_REASONS = ["API_KEY_INVALID", "API_KEY_EXPIRED"];

/** Returns why a response failed because of its key, or null when the key is not to blame. */
export async function classifyGeminiKeyFailure(
    response: Response,
): Promise<GeminiKeyFailure | null> {
    if (response.status === 429) return "QUOTA";
    if (![400, 401, 403].includes(response.status)) return null;
    const body = (await response
        .clone()
        .json()
        .catch(() => null)) as {
        error?: {
            status?: string;
            message?: string;
            details?: { reason?: string }[];
        };
    } | null;
    const error = body?.error;
    if (error?.status === "RESOURCE_EXHAUSTED") return "QUOTA";
    if (response.status === 401 || response.status === 403) return "INVALID_KEY";
    const reasons = (error?.details ?? []).map((d) => d.reason ?? "");
    if (reasons.some((r) => INVALID_KEY_REASONS.includes(r)))
        return "INVALID_KEY";
    if (/api key (not valid|expired|invalid)/i.test(error?.message ?? ""))
        return "INVALID_KEY";
    return null;
}

export class GeminiKeyPool {
    private next = 0;

    constructor(private readonly keys: readonly string[]) {}

    get size(): number {
        return this.keys.length;
    }

    /** Position (0-based) of the key the next request starts with. */
    get currentIndex(): number {
        return this.next;
    }

    /**
      * Sends `request` with each key in turn, starting at the last key that
      * worked, until one answers with something that is not a key failure.
      * Network errors and aborts propagate unchanged: they are not the key's fault.
      */
    async run(
        request: (key: string) => Promise<Response>,
        onKeyFailure?: (event: GeminiKeyFailureEvent) => void,
    ): Promise<Response> {
        if (!this.keys.length) throw new Error("No Gemini API key configured");
        const start = this.next;
        let quota = 0;
        let invalid = 0;
        let last: Response | undefined;
        for (let step = 0; step < this.keys.length; step++) {
            const index = (start + step) % this.keys.length;
            const response = await request(this.keys[index]);
            const failure = await classifyGeminiKeyFailure(response);
            if (!failure) {
                this.next = index;
                return response;
            }
            if (failure === "QUOTA") quota++;
            else invalid++;
            last = response;
            onKeyFailure?.({
                keyNumber: index + 1,
                keyCount: this.keys.length,
                reason: failure,
                status: response.status,
            });
        }
        throw new GeminiKeysExhaustedError(this.keys.length, quota, invalid, last!);
    }
}
