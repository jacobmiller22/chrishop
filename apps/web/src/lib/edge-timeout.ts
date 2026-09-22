/**
 * ChrisShop Edge Timeout Interception & Customer-Facing 504 Fallback
 *
 * Story 4.24: Graceful Edge Timeout Interception & Branded Customer-Facing 504 Fallback
 *
 * Preempts Cloudflare Worker runtime watchdogs (30s wall-clock / 50ms CPU limit)
 * by intercepting hanging or degraded upstream requests before Cloudflare terminates
 * the isolate. Delivers branded 504 HTML to human shoppers and structured JSON to API clients.
 */

export const DEFAULT_EDGE_TIMEOUT_MS = 25000;
export const FAST_FAIL_EDGE_TIMEOUT_MS = 15000;

export interface EdgeTimeoutEvent {
  event: 'EDGE_TIMEOUT';
  path: string;
  method: string;
  rayId: string;
  elapsedMs: number;
  thresholdMs: number;
  clientIp: string;
  timestamp: string;
}

export interface EdgeTimeoutJsonResponse {
  error: string;
  code: 'ERR_EDGE_TIMEOUT';
  message: string;
  rayId: string;
  timestamp: string;
}

export interface EdgeTimeoutOptions {
  timeoutMs?: number;
  rayId?: string;
  clientIp?: string;
  supportUrl?: string;
  statusUrl?: string;
}

/**
 * Determines whether a request targets an API endpoint or expects a JSON payload.
 */
export function isApiOrJsonRequest(request: Request, url: URL): boolean {
  if (url.pathname.startsWith('/api/')) {
    return true;
  }
  const acceptHeader = request.headers.get('accept') || '';
  if (acceptHeader.includes('application/json')) {
    return true;
  }
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return true;
  }
  return false;
}

/**
 * Generates a standardized, RFC-compliant JSON 504 Gateway Timeout response.
 */
export function generateTimeoutJsonResponse(rayId: string, timestamp?: string): Response {
  const ts = timestamp || new Date().toISOString();
  const payload: EdgeTimeoutJsonResponse = {
    error: 'Gateway Timeout',
    code: 'ERR_EDGE_TIMEOUT',
    message: 'The request took longer than expected to complete. Please retry.',
    rayId,
    timestamp: ts,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 504,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'x-chrishop-edge-timeout': 'true',
      'cf-ray': rayId,
      'retry-after': '5',
    },
  });
}

/**
 * Generates an embedded, self-contained, branded ChrisShop 504 HTML page.
 * Pure inline CSS & SVG — zero external CDN dependencies.
 */
export function generateBranded504Html(options: {
  rayId: string;
  supportUrl?: string;
  statusUrl?: string;
}): string {
  const {
    rayId,
    supportUrl = 'mailto:support@chrishop.com',
    statusUrl = 'https://status.chrishop.com',
  } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>504 Gateway Timeout | ChrisShop BankBeaters</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    :root {
      --bg: #020617;
      --surface: #0f172a;
      --border: #1e293b;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --brand-accent: #10b981;
      --brand-glow: rgba(16, 185, 129, 0.15);
      --warning: #f59e0b;
    }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      line-height: 1.5;
    }
    .card {
      background-color: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
      max-width: 32rem;
      width: 100%;
      padding: 2.25rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    .icon-container {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 4.5rem;
      height: 4.5rem;
      border-radius: 50%;
      background: var(--brand-glow);
      border: 1px solid rgba(16, 185, 129, 0.3);
      margin-bottom: 1.5rem;
      color: var(--brand-accent);
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      border-radius: 9999px;
      background: rgba(245, 158, 11, 0.15);
      color: var(--warning);
      border: 1px solid rgba(245, 158, 11, 0.3);
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.625rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      margin-bottom: 0.75rem;
      color: var(--text-main);
    }
    p {
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-bottom: 1.75rem;
      line-height: 1.6;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.75rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      border-radius: 0.5rem;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    .btn-primary {
      background: var(--brand-accent);
      color: #020617;
      border: none;
    }
    .btn-primary:hover {
      background: #059669;
      transform: translateY(-1px);
    }
    .btn-primary:active {
      transform: translateY(0);
    }
    .btn-secondary {
      background: transparent;
      color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover {
      color: var(--text-main);
      border-color: #475569;
    }
    .footer-meta {
      border-top: 1px solid var(--border);
      padding-top: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .ray-box {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: rgba(2, 6, 23, 0.6);
      padding: 0.35rem 0.75rem;
      border-radius: 0.375rem;
      border: 1px solid var(--border);
      font-family: monospace;
      font-size: 0.8rem;
    }
    .copy-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.1rem;
      display: inline-flex;
      align-items: center;
    }
    .copy-btn:hover {
      color: var(--text-main);
    }
    .links-row {
      display: flex;
      justify-content: center;
      gap: 1.25rem;
    }
    .links-row a {
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.2s;
    }
    .links-row a:hover {
      color: var(--brand-accent);
    }
    @media (min-width: 480px) {
      .actions {
        flex-direction: row;
        justify-content: center;
      }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-container">
      <!-- Mountain Peak Craft Icon -->
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
        <path d="M4.14 15.08 9 11l4 4"/>
      </svg>
    </div>

    <div class="badge">504 · Gateway Timeout</div>
    <h1>High Demand on the Mountain</h1>
    <p>
      Our workshop is experiencing high drop traffic or an upstream service took longer than expected to respond.
      Your request was safely intercepted before edge termination. Please retry in a few moments.
    </p>

    <div class="actions">
      <button id="retry-btn" class="btn btn-primary" onclick="retryWithJitter()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
          <path d="M16 21h5v-5"/>
        </svg>
        <span id="retry-label">Retry Request</span>
      </button>

      <a href="${statusUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
        Check System Status
      </a>
    </div>

    <div class="footer-meta">
      <div>
        Cloudflare Ray ID:
        <span class="ray-box">
          <span id="ray-id-val">${rayId}</span>
          <button class="copy-btn" onclick="copyRayId()" title="Copy Ray ID" aria-label="Copy Ray ID">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </span>
      </div>

      <div class="links-row">
        <a href="${statusUrl}" target="_blank" rel="noopener noreferrer">System Status</a>
        <span>·</span>
        <a href="${supportUrl}">Contact Support</a>
        <span>·</span>
        <a href="/">Storefront Home</a>
      </div>
    </div>
  </div>

  <script>
    function copyRayId() {
      const rayEl = document.getElementById('ray-id-val');
      if (rayEl && navigator.clipboard) {
        navigator.clipboard.writeText(rayEl.innerText).then(() => {
          alert('Ray ID copied to clipboard: ' + rayEl.innerText);
        });
      }
    }

    let retryCount = 0;
    function retryWithJitter() {
      const btn = document.getElementById('retry-btn');
      const label = document.getElementById('retry-label');
      if (!btn || !label) return;

      retryCount++;
      // Exponential backoff with random jitter: (2^retryCount * 250ms) + random(0, 500ms)
      const baseDelay = Math.min(1000 * Math.pow(1.5, retryCount - 1), 5000);
      const jitter = Math.floor(Math.random() * 500);
      const totalDelay = Math.floor(baseDelay + jitter);

      btn.disabled = true;
      btn.style.opacity = '0.7';
      label.innerText = 'Retrying in ' + (totalDelay / 1000).toFixed(1) + 's...';

      setTimeout(() => {
        window.location.reload();
      }, totalDelay);
    }
  </script>
</body>
</html>`;
}

/**
 * Generates an HTTP 504 Response containing the self-contained, branded ChrisShop Error Page.
 */
export function generateTimeoutHtmlResponse(
  rayId: string,
  options?: { supportUrl?: string; statusUrl?: string }
): Response {
  const html = generateBranded504Html({
    rayId,
    supportUrl: options?.supportUrl,
    statusUrl: options?.statusUrl,
  });

  return new Response(html, {
    status: 504,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'x-chrishop-edge-timeout': 'true',
      'cf-ray': rayId,
      'retry-after': '5',
    },
  });
}

/**
 * Preemptively wraps an asynchronous Cloudflare Worker or OpenNext handler with a watchdog timeout.
 * If the execution exceeds the timeout threshold, downstream I/O is aborted via AbortSignal,
 * a structured JSON telemetry event is emitted, and a branded 504 is returned before Cloudflare
 * terminates the worker isolate.
 */
export async function executeWithEdgeTimeout(
  request: Request,
  env: Record<string, any>,
  _executionCtx: any,
  runFn: (signal: AbortSignal) => Promise<Response>,
  options?: Partial<EdgeTimeoutOptions>
): Promise<Response> {
  const timeoutMs =
    options?.timeoutMs ?? (Number(env?.EDGE_TIMEOUT_MS) || DEFAULT_EDGE_TIMEOUT_MS);

  const rayId =
    options?.rayId ||
    request.headers.get('cf-ray') ||
    `sim-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const clientIp =
    options?.clientIp ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    '127.0.0.1';

  const abortController = new AbortController();

  // Propagate incoming request abortion to child controller
  if (request.signal) {
    if (request.signal.aborted) {
      abortController.abort(request.signal.reason);
    } else {
      request.signal.addEventListener(
        'abort',
        () => {
          abortController.abort(request.signal.reason);
        },
        { once: true }
      );
    }
  }

  let timer: any = null;

  const timeoutPromise = new Promise<{ timedOut: true }>((resolve) => {
    timer = setTimeout(() => {
      abortController.abort(
        new Error(`Edge execution exceeded timeout threshold of ${timeoutMs}ms`)
      );
      resolve({ timedOut: true });
    }, timeoutMs);
  });

  const executionPromise = (async () => {
    try {
      const response = await runFn(abortController.signal);
      return { timedOut: false as const, response, error: null };
    } catch (error) {
      return { timedOut: false as const, response: null, error };
    }
  })();

  const raceResult = await Promise.race([executionPromise, timeoutPromise]);
  if (timer) {
    clearTimeout(timer);
  }

  if (raceResult.timedOut) {
    const url = new URL(request.url);

    // Structured observability telemetry log
    const telemetryEvent: EdgeTimeoutEvent = {
      event: 'EDGE_TIMEOUT',
      path: url.pathname,
      method: request.method,
      rayId,
      elapsedMs: timeoutMs,
      thresholdMs: timeoutMs,
      clientIp,
      timestamp: new Date().toISOString(),
    };
    console.error(JSON.stringify(telemetryEvent));

    if (isApiOrJsonRequest(request, url)) {
      return generateTimeoutJsonResponse(rayId);
    } else {
      return generateTimeoutHtmlResponse(rayId, {
        supportUrl: options?.supportUrl,
        statusUrl: options?.statusUrl,
      });
    }
  }

  if (raceResult.error) {
    throw raceResult.error;
  }

  return raceResult.response!;
}
