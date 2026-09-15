/**
 * ChrisShop Edge SingleFlight Request Coalescing Engine
 *
 * Implements the SingleFlight concurrency pattern for Cloudflare Workers edge isolates.
 * When multiple concurrent requests request the same resource key (e.g., flash drop product,
 * inventory balance, or catalog category) during a cache miss or revalidation window,
 * SingleFlight ensures only a SINGLE upstream fetch or database query is executed.
 * All awaiting concurrent requests share the resulting Promise.
 *
 * Prevents "thundering herd" query saturation against Cloudflare D1 and protects
 * against Shopify Storefront API rate-limit exhaustion during limited-edition drops.
 *
 * Specification: docs/HIGH_LEVEL_DESIGN.md & Story 3.12 (#185)
 */

export interface SingleFlightMetrics {
  totalRequests: number;
  upstreamFetches: number;
  coalescedRequests: number;
  coalesceRatio: number;
  failedFetches: number;
  activeInFlight: number;
}

export interface SingleFlightOptions {
  /**
   * Timeout in milliseconds for upstream fetch execution before aborting awaiting callers.
   * Defaults to 10,000ms (10 seconds).
   */
  timeoutMs?: number;
}

interface InFlightEntry<T> {
  promise: Promise<T>;
  waitersCount: number;
  startedAt: number;
  timeoutId?: ReturnType<typeof setTimeout>;
}

export class SingleFlightGroup {
  private calls = new Map<string, InFlightEntry<any>>();

  // Metrics tracking for edge telemetry and load profiling
  private totalRequests = 0;
  private upstreamFetches = 0;
  private coalescedRequests = 0;
  private failedFetches = 0;

  constructor(private defaultOptions: SingleFlightOptions = {}) {}

  /**
   * Execute an asynchronous action identified by `key`.
   * If an action for the same key is already in flight, the existing Promise is returned
   * and shared among all concurrent callers.
   *
   * @param key Unique identifier for the requested resource (e.g. `product:slug:midnight-beast`)
   * @param fn The async producer function to execute if not already in flight
   * @param options Optional overrides for this execution
   */
  async do<T>(
    key: string,
    fn: () => Promise<T>,
    options?: SingleFlightOptions
  ): Promise<T> {
    const { result } = await this.doWithMeta(key, fn, options);
    return result;
  }

  /**
   * Execute an asynchronous action identified by `key`, returning execution metadata
   * indicating whether the result was shared from an existing in-flight call.
   */
  async doWithMeta<T>(
    key: string,
    fn: () => Promise<T>,
    options?: SingleFlightOptions
  ): Promise<{ result: T; shared: boolean }> {
    this.totalRequests++;

    const existing = this.calls.get(key) as InFlightEntry<T> | undefined;
    if (existing) {
      this.coalescedRequests++;
      existing.waitersCount++;
      const result = await existing.promise;
      return { result, shared: true };
    }

    this.upstreamFetches++;
    const timeoutMs = options?.timeoutMs ?? this.defaultOptions.timeoutMs ?? 10_000;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      if (timeoutMs > 0 && timeoutMs < Infinity) {
        timeoutId = setTimeout(() => {
          this.calls.delete(key);
          reject(new Error(`SingleFlight timeout exceeded (${timeoutMs}ms) for key: "${key}"`));
        }, timeoutMs);
      }
    });

    const executionPromise = (async () => {
      try {
        const value = await fn();
        return value;
      } catch (err) {
        this.failedFetches++;
        throw err;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        this.calls.delete(key);
      }
    })();

    const inFlight: InFlightEntry<T> = {
      promise: Promise.race([executionPromise, timeoutPromise]),
      waitersCount: 1,
      startedAt: Date.now(),
      timeoutId,
    };

    this.calls.set(key, inFlight);

    try {
      const result = await inFlight.promise;
      return { result, shared: false };
    } catch (error) {
      this.calls.delete(key);
      throw error;
    }
  }

  /**
   * Discards an in-flight key entry, forcing the next request for `key` to initiate
   * a fresh upstream fetch.
   */
  forget(key: string): void {
    const existing = this.calls.get(key);
    if (existing?.timeoutId) {
      clearTimeout(existing.timeoutId);
    }
    this.calls.delete(key);
  }

  /**
   * Number of unique in-flight actions currently pending upstream resolution.
   */
  activeCount(): number {
    return this.calls.size;
  }

  /**
   * Current performance metrics and coalescing ratios.
   */
  getMetrics(): SingleFlightMetrics {
    const ratio =
      this.totalRequests > 0
        ? Number((this.coalescedRequests / this.totalRequests).toFixed(4))
        : 0;

    return {
      totalRequests: this.totalRequests,
      upstreamFetches: this.upstreamFetches,
      coalescedRequests: this.coalescedRequests,
      coalesceRatio: ratio,
      failedFetches: this.failedFetches,
      activeInFlight: this.calls.size,
    };
  }

  /**
   * Reset all accumulated metrics counters.
   */
  resetMetrics(): void {
    this.totalRequests = 0;
    this.upstreamFetches = 0;
    this.coalescedRequests = 0;
    this.failedFetches = 0;
  }
}

/**
 * Global singleton SingleFlight group for edge product catalog queries.
 */
export const catalogSingleFlight = new SingleFlightGroup({ timeoutMs: 8_000 });
