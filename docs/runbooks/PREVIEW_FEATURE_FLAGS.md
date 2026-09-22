# Reviewer Guide: Dynamic Feature Flag Overrides on Ephemeral Previews

**Specification**: ADR-001 (`docs/decisions/ADR_FEATURE_FLAGGING_FLAGSHIP.md`)  
**Applicability**: Ephemeral PR Previews (`https://pr-<N>-chrishop.jacobmiller22.com`) and Local Development.  
**Production Security**: Reviewer overrides are **strictly ignored** in production (`tier === 'production'`).

---

## 1. Overview

ChrisShop's ephemeral preview environments decouple feature flags across concurrent pull requests using a 4-tier resolution hierarchy:

1. **Reviewer Session Override**: Dynamic parameter or cookie set by the reviewer in the browser.
2. **PR Worker Variable Override**: Static overrides declared in `wrangler.toml [env.preview.vars]`.
3. **Staging Flagship Binding**: Live Cloudflare Flagship configuration on Staging.
4. **Staging Environment Defaults**: Baseline defaults in `ENVIRONMENT_FLAG_DEFAULTS.staging`.

This allows reviewers (such as Chris during Creator Review sessions or QA testing pull requests) to test both "Flag ON" and "Flag OFF" states on the same live ephemeral preview without requiring redeployments.

---

## 2. Dynamic Flag Flipping Methods

### Method 1: URL Query Parameters (Immediate, Per-Request)

Append `?flag:<FLAG_KEY>=<value>` or `?flag_<FLAG_KEY>=<value>` to any preview URL:

#### Examples:
- **Toggle Drop Active**:
  ```text
  https://pr-233-chrishop.jacobmiller22.com/?flag:FLAG_IS_DROP_ACTIVE=true
  https://pr-233-chrishop.jacobmiller22.com/?flag:FLAG_IS_DROP_ACTIVE=false
  ```
- **Toggle Shopify WireMock / Mock Bridge**:
  ```text
  https://pr-233-chrishop.jacobmiller22.com/products?flag:FLAG_ENABLE_WIREMOCK=true
  ```
- **Simulate Emergency Kill-Switch**:
  ```text
  https://pr-233-chrishop.jacobmiller22.com/cart?flag:FLAG_EMERGENCY_KILL_SWITCH=true
  ```
- **Simulate Maintenance Mode**:
  ```text
  https://pr-233-chrishop.jacobmiller22.com/?flag:FLAG_MAINTENANCE_MODE=true
  ```
- **Set Canary Rollout Percentage**:
  ```text
  https://pr-233-chrishop.jacobmiller22.com/?flag:FLAG_PHASE_6_CANARY_PERCENT=75
  ```

> [!TIP]
> Key names are case-insensitive and the `FLAG_` prefix is optional in URL parameters (e.g. `?flag:drop_active=false` will automatically map to `FLAG_IS_DROP_ACTIVE=false`).

---

### Method 2: Browser Cookie Override (Persistent Across Session)

To persist flag overrides across page navigations in your browser, set the `chrishop_flags_override` cookie:

#### Format A: JSON String
```javascript
// In browser developer console
document.cookie = "chrishop_flags_override=" + encodeURIComponent(JSON.stringify({
  FLAG_IS_DROP_ACTIVE: true,
  FLAG_ENABLE_WIREMOCK: false
})) + "; path=/; max-age=3600";
```

#### Format B: Comma-Separated Key:Value
```javascript
document.cookie = "chrishop_flags_override=" + encodeURIComponent("FLAG_IS_DROP_ACTIVE:true,FLAG_ENABLE_WIREMOCK:false") + "; path=/; max-age=3600";
```

#### To Clear Cookie Overrides:
```javascript
document.cookie = "chrishop_flags_override=; path=/; max-age=0";
```

---

## 3. Verifying Active Flag States (Debug Headers)

When `FLAG_VERBOSE_DEBUG_HEADERS=true` (enabled by default on all preview deployments), each response includes diagnostic headers inspectable in browser dev tools (`Network` tab):

```http
X-ChrisShop-Flags-Evaluated: true
X-ChrisShop-Tier: preview
X-ChrisShop-Flag-DropActive: true
X-ChrisShop-Flag-WireMock: true
X-ChrisShop-Flag-Maintenance: false
X-ChrisShop-Flag-KillSwitch: false
X-ChrisShop-Flag-CanaryPercent: 100
X-ChrisShop-Flag-ReviewerOverride: true
```

The header `X-ChrisShop-Flag-ReviewerOverride: true` confirms that your session override was recognized and took top precedence.

---

## 4. Declaring PR-Specific Overrides for Developers

If a PR implements a feature behind a flag, the author declares that flag in `wrangler.toml` under `[env.preview.vars]`:

```toml
[env.preview.vars]
NODE_ENV = "preview"
# Override only the flag under active test in this PR:
FLAG_IS_DROP_ACTIVE = "true"
```

All other flags not declared in `[env.preview.vars]` will seamlessly cascade to the Staging Flagship app and staging defaults.
