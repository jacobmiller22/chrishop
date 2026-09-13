# Root Cause Analysis (RCA): Payload CMS Admin Panel Blank Screen on Cloudflare Edge

- **Date**: 2026-09-13
- **Incident / Ticket**: [Issue #232](https://github.com/jacobmiller22/chrishop/issues/232) / [PR #235](https://github.com/jacobmiller22/chrishop/pull/235)
- **Target Route**: `https://pr-235-chrishop.jacobmiller22.com/admin`
- **Impacted Systems**: Cloudflare Workers Edge Router (`.open-next/worker.js`), Dedicated Admin Function (`server-functions/admin`), Payload CMS v3 App Router

---

## 1. Executive Summary

Navigating to `https://pr-235-chrishop.jacobmiller22.com/admin` displays a completely blank white screen in web browsers (`document.body.innerText === ""`). 

Through automated headless Chrome DevTools Protocol (CDP) diagnostics and HTTP stream inspection, the failure was traced to **three interrelated issues**:
1. **Next.js App Router Streaming Redirect Flushes as `HTTP 200 OK`**: Server Component `redirect('/admin/login')` is emitted after HTML `<head>` streaming has started. The HTTP response commits as `200 OK` with an RSC error digest (`NEXT_REDIRECT;replace;/admin/login;307;`) appended to the body, which browsers do not follow on initial page navigation.
2. **Cascade Redirect on Unseeded D1 Database**: Visiting `/admin/login` triggers a second redirect to `/admin/create-first-user` because the ephemeral D1 database has 0 registered users. This second redirect also flushes as `HTTP 200 OK`.
3. **OpenNext Function Splitting Slot Disconnection**: On `/admin/create-first-user`, OpenNext's function-splitting bundler serializes `app/(payload)/layout.tsx`'s `{children}` slot as `null` (`"children": ["$L17", "$L18"]` where `$L18 = null`), leaving the `CreateFirstUserClient` component unmounted in the DOM.

---

## 2. Empirical Diagnostics & Evidence

### 2.1 Headless Chrome CDP Live Evaluation
Running Chrome CDP against `https://pr-235-chrishop.jacobmiller22.com/admin`:

```json
{
  "url": "https://pr-235-chrishop.jacobmiller22.com/admin",
  "title": "Dashboard - Payload",
  "innerText": "",
  "elements": [
    { "tag": "HTML", "computedDisplay": "block" },
    { "tag": "BODY", "computedDisplay": "block" },
    { "tag": "DIV", "id": "_R_6ivb_", "computedDisplay": "none" },
    { "tag": "DIV", "id": "DndLiveRegion-0", "rect": { "width": 1, "height": 1 } },
    { "tag": "DIV", "class": "payload__modal-container", "computedVisibility": "hidden" },
    { "tag": "SECTION", "aria-label": "Notifications alt+T", "computedDisplay": "block" },
    { "tag": "DIV", "id": "portal", "computedDisplay": "block" },
    { "tag": "NEXT-ROUTE-ANNOUNCER", "computedDisplay": "block" }
  ]
}
```
**Observation**: React successfully hydrates the shell and sets `document.title` to `"Dashboard - Payload"`, but no interactive UI, form controls, or text nodes are rendered.

### 2.2 HTTP Response Status & Header Mismatch
```http
GET /admin HTTP/2
Host: pr-235-chrishop.jacobmiller22.com

HTTP/2 200 OK
content-type: text/html; charset=utf-8
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
x-powered-by: Next.js, Payload
```

**Body Tail**:
```javascript
self.__next_f.push([1,"6:E{\"digest\":\"NEXT_REDIRECT;replace;/admin/login;307;\"}\n"])
```
**Observation**: The server returned `HTTP 200 OK` rather than `HTTP 307 Temporary Redirect`. The browser treats this as a successful page delivery and will not follow the redirect.

### 2.3 RSC Flight Stream Analysis (`/admin/create-first-user`)
Examining the serialized React flight tree emitted by `server-functions/admin`:

```javascript
/* Line 4: RootLayout serialization */
4: ["$", "html", null, {
  "data-theme": "$12",
  "dir": "LTR",
  "children": [
    ["$", "head", null, { ... }],
    ["$", "body", null, {
      "children": [
        ["$", "$L13", null, {
          /* RootProvider client component */
          "config": { ... },
          "children": ["$L17", "$L18"]
        }],
        "$L19"
      ]
    }]
  ]
}]

/* Line 17 & 18 */
17: ["$", "$L1a", null, {}]  // ProgressBar client component
18: null                      // {children} passed to RootLayout is NULL
```

**Observation**: Next.js App Router passed `null` as the `{children}` prop to `RootLayoutContent`, while the actual page content (`$L6` / `$L1e` `CreateFirstUserClient`) was placed in an unlinked router leaf node.

---

## 3. Root Cause Breakdown

```mermaid
flowchart TD
    Req[Client Browser: GET /admin] --> Router[Cloudflare Worker Router: .open-next/worker.js]
    Router --> AdminWorker[server-functions/admin]
    AdminWorker --> NextSSR[Next.js 15 App Router SSR]
    
    NextSSR --> HeadFlush[Flushes HTML head: HTTP 200 OK committed]
    HeadFlush --> PayloadCheck{User Authenticated?}
    
    PayloadCheck -->|No| ThrowRedirect[redirect('/admin/login') called]
    ThrowRedirect --> DigestEmit[Pushes NEXT_REDIRECT error digest to body]
    DigestEmit --> BrowserRecv[Browser receives HTTP 200 OK with empty shell]
    BrowserRecv --> BlankScreen[Result: Blank White Screen]
```

### Root Cause 1: Streaming SSR vs Server Component Redirect
In Next.js 15 App Router streaming mode:
- Next.js begins streaming the HTML document (`<!DOCTYPE html><html><head>...`) as soon as the root layout resolves.
- Once bytes are flushed over HTTP, status codes and headers are immutable.
- When Payload's `RootPage` component executes, it discovers that the request lacks authentication cookies and throws `redirect('/admin/login')`.
- Because headers are already closed, Next.js converts the redirect into a streaming error digest: `NEXT_REDIRECT;replace;/admin/login;307;`.
- In a Single-Page Application (SPA) client-side transition (e.g. `next/link`), the client router catches this digest and navigates. But during Multi-Page Application (MPA) hard loads or browser address bar entries, the browser renders the empty HTML shell and halts.

### Root Cause 2: Unseeded Database Cascade
- If a user manually browses to `/admin/login`, Payload queries `DB` (D1 SQLite).
- In ephemeral preview environments, `chrishop-preview-db` contains zero users.
- Payload's `LoginPage` component detects `count === 0` and immediately calls `redirect('/admin/create-first-user')`.
- This triggers the exact same streaming `HTTP 200` + `NEXT_REDIRECT` digest cycle, resulting in a blank page on `/admin/login` as well.

### Root Cause 3: OpenNext Function Splitting Route Group Slot Disconnection
- In `apps/web/open-next.config.ts`, `functions.admin.routes` only declares:
  ```ts
  routes: [
    'app/(payload)/admin/[[...segments]]/page',
    'app/(payload)/api/[...slug]/route',
    'app/(payload)/api/graphql/route',
  ]
  ```
- Because the route group layout `app/(payload)/layout.tsx` is located outside `app/(payload)/admin`, Next.js's standalone tracer under OpenNext does not properly correlate the parallel router slot (`parallelRouterKey: "children"`) with the leaf page component during SSR bundling.
- Consequently, `RootProvider` receives `children = null`, leaving the DOM body empty even when rendering views that do not throw redirects.

---

## 4. Remediation Plan

### Phase 1: Edge Router Redirect Interception
In `.open-next/worker.js` (generated via [`scripts/build-worker.ts`](file:///Users/jacobmiller22/projects/chrishop/scripts/build-worker.ts)):
1. Inspect the response returned by `server-functions/admin`.
2. If the response body starts with or contains `NEXT_REDIRECT;replace;<target>;307;` and status is 200, or if Next.js emits `x-nextjs-redirect`:
   - Intercept the response stream.
   - Return a synthetic `Response(null, { status: 307, headers: { Location: target } })`.
   - This guarantees that browsers natively follow the redirect to `/admin/login` or `/admin/create-first-user`.

### Phase 2: OpenNext Route Group & Layout Wiring
In [`apps/web/open-next.config.ts`](file:///Users/jacobmiller22/projects/chrishop/apps/web/open-next.config.ts):
1. Explicitly declare `app/(payload)/layout` in `functions.admin.routes` or evaluate unifying the route group hierarchy.
2. Verify that `RootLayoutContent` in `(payload)/layout.tsx` receives the rendered leaf page in both SSR and CSR.

### Phase 3: Ephemeral D1 Database Seeding
In `.github/workflows/preview-deploy.yml`:
1. Add an automated seed step after D1 migrations:
   ```bash
   wrangler d1 execute chrishop-preview-db --env preview --command "INSERT OR IGNORE INTO users (email, ...) VALUES (...);"
   ```
2. This eliminates the unseeded cascade redirect so `/admin/login` renders the authentic login interface on fresh preview deployments.

---

## 5. Verification Strategy

1. **Automated Headless Chrome CDP Verification**:
   - Add a test script in `tests/e2e/admin-edge-render.test.ts` that runs Chrome CDP against the preview URL.
   - Assert:
     - `response.status === 307` on `/admin` redirect.
     - Final URL resolves to `/admin/login`.
     - `document.querySelector('form') !== null`.
     - `document.body.innerText.length > 50`.
2. **Local Workerd / Miniflare Parity**:
   - Run `pnpm run dev:wrangler` locally and curl `/admin` to verify status code 307 and location headers.
