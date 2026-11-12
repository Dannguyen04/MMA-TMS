/**
 * In-memory LRU cache of finished analysis results (T-068). A DONE job is terminal, so its result file never
 * changes; reading it from Storage on every view only adds latency. Bounded by entry count, total size and age.
 * The cache never decides access: `JobsService.getResult` authorizes the caller before it looks here.
 */
export const JOB_RESULT_CACHE_MAX_ENTRIES = 50;
export const JOB_RESULT_CACHE_MAX_BYTES = 50 * 1024 * 1024;
export const JOB_RESULT_CACHE_TTL_MS = 10 * 60 * 1000;

interface Entry {
  /** The job's `result_url` when cached; a different URL is a different result. */
  resultUrl: string;
  value: unknown;
  bytes: number;
  expiresAt: number;
}

export class JobResultCache {
  // Map keeps insertion order: the first key is the least recently used.
  private readonly entries = new Map<string, Entry>();
  private totalBytes = 0;

  constructor(
    private readonly maxEntries = JOB_RESULT_CACHE_MAX_ENTRIES,
    private readonly maxBytes = JOB_RESULT_CACHE_MAX_BYTES,
    private readonly ttlMs = JOB_RESULT_CACHE_TTL_MS,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  get bytes(): number {
    return this.totalBytes;
  }

  get(jobId: string, resultUrl: string): unknown {
    const entry = this.entries.get(jobId);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now() || entry.resultUrl !== resultUrl) {
      this.delete(jobId);
      return undefined;
    }
    // Refresh recency.
    this.entries.delete(jobId);
    this.entries.set(jobId, entry);
    return entry.value;
  }

  set(jobId: string, resultUrl: string, value: unknown, bytes: number): void {
    this.delete(jobId);
    if (bytes > this.maxBytes) return;
    this.entries.set(jobId, {
      resultUrl,
      value,
      bytes,
      expiresAt: Date.now() + this.ttlMs,
    });
    this.totalBytes += bytes;
    while (
      this.entries.size > this.maxEntries ||
      this.totalBytes > this.maxBytes
    ) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.delete(oldest);
    }
  }

  delete(jobId: string): void {
    const entry = this.entries.get(jobId);
    if (!entry) return;
    this.entries.delete(jobId);
    this.totalBytes -= entry.bytes;
  }

  clear(): void {
    this.entries.clear();
    this.totalBytes = 0;
  }
}
