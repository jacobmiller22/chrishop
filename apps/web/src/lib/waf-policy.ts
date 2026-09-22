/**
 * ChrisShop Cloudflare Web Application Firewall (WAF) & Rate Limiting Policy Engine
 *
 * Story 5.7 (#165): Architectural Spike & Integration Assessment:
 * WAF Rulesets, Rate Limiting & Checkout False-Positive Mitigation.
 *
 * Directly informs and unblocks Story 5.5 (#56): Cloudflare Integration — WAF, CDN & DDoS Protection.
 * Conforms to docs/HIGH_LEVEL_DESIGN.md Section 7 & 10.
 */

export type WafAction =
  | 'allow'
  | 'skip'
  | 'managed_challenge'
  | 'interactive_challenge'
  | 'block'
  | 'rate_limit';

export type RouteCategory =
  | 'storefront_public'
  | 'cart_checkout'
  | 'webhooks_external'
  | 'observability_health'
  | 'admin_cms'
  | 'static_assets';

export interface RouteInventoryEntry {
  pathPattern: string;
  category: RouteCategory;
  methods: string[];
  description: string;
  riskProfile: 'critical' | 'high' | 'medium' | 'low';
  wafRuleAction: WafAction;
  rateLimitPerMinute?: number;
  burstLimitPer10Sec?: number;
  exemptionReason?: string;
}

export interface BotMitigationComparison {
  mechanism: 'turnstile' | 'managed_challenge' | 'interactive_captcha';
  name: string;
  latencyOverheadMs: number;
  userFrictionLevel: 'zero' | 'low' | 'high' | 'severe';
  falsePositiveRisk: 'extremely_low' | 'low' | 'medium' | 'high';
  dropDaySuitability: 'recommended' | 'secondary_defense' | 'strictly_prohibited';
  implementationLayer: 'application_form' | 'edge_network' | 'edge_interstitial';
  description: string;
}

export interface WafSimulationRequest {
  path: string;
  method: string;
  ip: string;
  threatScore?: number;
  isBot?: boolean;
  hasValidHmac?: boolean;
  requestsInLastMinute?: number;
  requestsInLast10Sec?: number;
  turnstilePassed?: boolean;
}

export interface WafSimulationDecision {
  action: WafAction;
  ruleName: string;
  isFalsePositiveRiskMitigated: boolean;
  rateLimited: boolean;
  explanation: string;
}

/**
 * 1. Exposed Public Edge Route Inventory across Next.js & Payload CMS
 */
export const WAF_ROUTE_INVENTORY: RouteInventoryEntry[] = [
  {
    pathPattern: '/',
    category: 'storefront_public',
    methods: ['GET', 'HEAD'],
    description: 'Storefront Homepage and Hero Drop announcement',
    riskProfile: 'medium',
    wafRuleAction: 'allow',
    rateLimitPerMinute: 300,
  },
  {
    pathPattern: '/products/*',
    category: 'storefront_public',
    methods: ['GET', 'HEAD'],
    description: 'Product detail pages and gallery',
    riskProfile: 'medium',
    wafRuleAction: 'allow',
    rateLimitPerMinute: 300,
  },
  {
    pathPattern: '/collections/*',
    category: 'storefront_public',
    methods: ['GET', 'HEAD'],
    description: 'Collection and category listings',
    riskProfile: 'medium',
    wafRuleAction: 'allow',
    rateLimitPerMinute: 300,
  },
  {
    pathPattern: '/cart',
    category: 'cart_checkout',
    methods: ['GET', 'HEAD'],
    description: 'Interactive Shopping Cart UI',
    riskProfile: 'medium',
    wafRuleAction: 'allow',
    rateLimitPerMinute: 120,
  },
  {
    pathPattern: '/api/cart/*',
    category: 'cart_checkout',
    methods: ['POST', 'PUT', 'DELETE', 'GET'],
    description: 'Cart mutations, line item additions, and reservations',
    riskProfile: 'critical',
    wafRuleAction: 'rate_limit',
    rateLimitPerMinute: 30,
    burstLimitPer10Sec: 10,
  },
  {
    pathPattern: '/api/checkout/*',
    category: 'cart_checkout',
    methods: ['POST', 'GET'],
    description: 'Shopify checkout session handshake and redirect dispatch',
    riskProfile: 'critical',
    wafRuleAction: 'rate_limit',
    rateLimitPerMinute: 30,
    burstLimitPer10Sec: 10,
  },
  {
    pathPattern: '/api/orders/webhook',
    category: 'webhooks_external',
    methods: ['POST'],
    description: 'Shopify order placement, update, and fulfillment webhooks',
    riskProfile: 'high',
    wafRuleAction: 'skip',
    exemptionReason:
      'Exempt from OWASP/Managed inspection to prevent false-positive drops. Verified via raw HMAC-SHA256 signature.',
  },
  {
    pathPattern: '/api/webhooks/*',
    category: 'webhooks_external',
    methods: ['POST'],
    description: 'Generic third-party webhooks (e.g. Resend, Shippo)',
    riskProfile: 'high',
    wafRuleAction: 'skip',
    exemptionReason: 'Exempt from WAF managed rules. Protected by provider signatures.',
  },
  {
    pathPattern: '/api/health',
    category: 'observability_health',
    methods: ['GET'],
    description: 'Cloudflare Workers edge dependency probe & Better Stack monitor',
    riskProfile: 'low',
    wafRuleAction: 'allow',
    rateLimitPerMinute: 120,
    exemptionReason: 'Synthetic uptime probe from Better Stack across US/EU/AS locations.',
  },
  {
    pathPattern: '/admin/*',
    category: 'admin_cms',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    description: 'Payload CMS Admin Dashboard and Editorial API',
    riskProfile: 'critical',
    wafRuleAction: 'allow', // Cloudflare Access Zero Trust intercepts before WAF origin
    rateLimitPerMinute: 200,
    exemptionReason: 'Protected by Cloudflare Access Zero Trust Identity Gate + TOTP 2FA.',
  },
  {
    pathPattern: '/_next/static/*',
    category: 'static_assets',
    methods: ['GET', 'HEAD'],
    description: 'Next.js precompiled static chunks, CSS, and JS',
    riskProfile: 'low',
    wafRuleAction: 'allow',
    rateLimitPerMinute: 1000,
  },
  {
    pathPattern: '/media/*',
    category: 'static_assets',
    methods: ['GET', 'HEAD'],
    description: 'Immutable Cloudflare R2 images and drop assets',
    riskProfile: 'low',
    wafRuleAction: 'allow',
    rateLimitPerMinute: 1000,
  },
];

/**
 * 2. Cloudflare Ruleset Wire Expressions
 */
export const WAF_EXPRESSIONS = {
  // Shopify Webhook WAF Bypass Rule (Action: skip)
  SHOPIFY_WEBHOOK_BYPASS:
    '(http.request.uri.path eq "/api/orders/webhook" or starts_with(http.request.uri.path, "/api/webhooks/")) and http.request.method eq "POST"',

  // Health Probe Whitelist Expression
  HEALTH_CHECK_WHITELIST: 'http.request.uri.path eq "/api/health" and http.request.method eq "GET"',

  // Cart and Checkout Mutation Rate Limiting
  CART_CHECKOUT_RATE_LIMIT:
    '(starts_with(http.request.uri.path, "/api/cart") or starts_with(http.request.uri.path, "/api/checkout")) and (http.request.method in {"POST" "PUT" "DELETE"})',

  // High Threat Score Managed Challenge
  ELEVATED_THREAT_SCORE_CHALLENGE:
    'cf.threat_score gt 30 and not (http.request.uri.path eq "/api/orders/webhook" or http.request.uri.path eq "/api/health")',

  // Automated Bot Traffic Challenge (when Bot Management / Super Bot Fight Mode active)
  AUTOMATED_BOT_CHALLENGE:
    'cf.bot_management.score lt 20 and not (http.request.uri.path eq "/api/orders/webhook" or http.request.uri.path eq "/api/health")',

  // Zero Trust Protected Admin Routes
  ADMIN_ACCESS_GATE: 'starts_with(http.request.uri.path, "/admin")',
};

/**
 * 3. Bot Defense Comparison & Benchmark Matrix
 */
export const BOT_MITIGATION_MATRIX: BotMitigationComparison[] = [
  {
    mechanism: 'turnstile',
    name: 'Cloudflare Turnstile (Embedded Interactive/Non-Interactive)',
    latencyOverheadMs: 15,
    userFrictionLevel: 'zero',
    falsePositiveRisk: 'extremely_low',
    dropDaySuitability: 'recommended',
    implementationLayer: 'application_form',
    description:
      'Invisible, privacy-focused CAPTCHA alternative embedded into checkout forms. Validated server-side on handshake.',
  },
  {
    mechanism: 'managed_challenge',
    name: 'Cloudflare Edge Managed Challenge',
    latencyOverheadMs: 120,
    userFrictionLevel: 'low',
    falsePositiveRisk: 'low',
    dropDaySuitability: 'secondary_defense',
    implementationLayer: 'edge_network',
    description:
      'Cloudflare dynamically chooses between invisible telemetry probes and lightweight JS puzzles based on visitor risk score.',
  },
  {
    mechanism: 'interactive_captcha',
    name: 'Legacy Interactive CAPTCHA (Distorted Text / Image Select)',
    latencyOverheadMs: 4500,
    userFrictionLevel: 'severe',
    falsePositiveRisk: 'high',
    dropDaySuitability: 'strictly_prohibited',
    implementationLayer: 'edge_interstitial',
    description:
      'Causes 15-30% cart abandonment on mobile screens during fast-paced drops. Strictly prohibited in ChrisShop architecture.',
  },
];

/**
 * 4. Simulated WAF Decision Engine
 * Evaluates simulated incoming requests against the full ChrisShop WAF policy hierarchy.
 */
export function evaluateWafPolicy(request: WafSimulationRequest): WafSimulationDecision {
  const {
    path,
    method,
    threatScore = 0,
    isBot = false,
    hasValidHmac = false,
    requestsInLastMinute = 1,
    requestsInLast10Sec = 1,
    turnstilePassed = true,
  } = request;

  // Layer 1: Shopify Webhook Bypass Gate (Absolute Priority to Prevent False Positives)
  if (
    (path === '/api/orders/webhook' || path.startsWith('/api/webhooks/')) &&
    method === 'POST'
  ) {
    if (hasValidHmac) {
      return {
        action: 'skip',
        ruleName: 'SHOPIFY_WEBHOOK_BYPASS',
        isFalsePositiveRiskMitigated: true,
        rateLimited: false,
        explanation:
          'Bypasses Cloudflare Managed Rulesets and Rate Limiting. Signature verified at application edge via HMAC-SHA256.',
      };
    }
    // Webhook with invalid/missing HMAC is dropped at application layer, not WAF IP block
    return {
      action: 'block',
      ruleName: 'WEBHOOK_HMAC_AUTHENTICATION_FAILURE',
      isFalsePositiveRiskMitigated: true,
      rateLimited: false,
      explanation: 'Rejected at edge worker: Invalid or missing X-Shopify-HMAC-SHA256 signature.',
    };
  }

  // Layer 2: Edge Health Check Exemption
  if (path === '/api/health' && method === 'GET') {
    return {
      action: 'allow',
      ruleName: 'HEALTH_CHECK_WHITELIST',
      isFalsePositiveRiskMitigated: true,
      rateLimited: false,
      explanation: 'Allowed for Better Stack external synthetic uptime probes.',
    };
  }

  // Layer 3: Edge Rate Limiting on Cart & Checkout Handshake
  const isCartOrCheckout =
    path.startsWith('/api/cart') || path.startsWith('/api/checkout') || path === '/checkout';

  if (isCartOrCheckout && ['POST', 'PUT', 'DELETE'].includes(method)) {
    if (requestsInLast10Sec > 10 || requestsInLastMinute > 30) {
      return {
        action: 'rate_limit',
        ruleName: 'CART_CHECKOUT_RATE_LIMIT',
        isFalsePositiveRiskMitigated: true,
        rateLimited: true,
        explanation: `Rate limit triggered: ${requestsInLastMinute} req/min exceeds 30 req/min (or ${requestsInLast10Sec} req/10s burst limit).`,
      };
    }

    // Check Turnstile token on checkout handshake
    if (path.includes('/checkout') && !turnstilePassed) {
      return {
        action: 'managed_challenge',
        ruleName: 'CHECKOUT_TURNSTILE_CHALLENGE',
        isFalsePositiveRiskMitigated: true,
        rateLimited: false,
        explanation: 'Missing or invalid Turnstile token on checkout handshake. Managed challenge issued.',
      };
    }
  }

  // Layer 4: Threat Score & Bot Management
  if (threatScore > 30 || isBot) {
    return {
      action: 'managed_challenge',
      ruleName: 'ELEVATED_THREAT_SCORE_CHALLENGE',
      isFalsePositiveRiskMitigated: true,
      rateLimited: false,
      explanation: `Cloudflare Threat Score ${threatScore} exceeds safe threshold of 30. Managed challenge issued.`,
    };
  }

  // Layer 5: Standard Storefront Browsing Rate Limit (Prevent DoS)
  if (requestsInLastMinute > 300) {
    return {
      action: 'rate_limit',
      ruleName: 'STOREFRONT_BROWSING_DOS_LIMIT',
      isFalsePositiveRiskMitigated: true,
      rateLimited: true,
      explanation: 'Exceeded high-water storefront browsing limit (300 req/min).',
    };
  }

  // Default: Allow
  return {
    action: 'allow',
    ruleName: 'DEFAULT_ALLOW',
    isFalsePositiveRiskMitigated: true,
    rateLimited: false,
    explanation: 'Request complies with all edge security and rate limiting policies.',
  };
}
