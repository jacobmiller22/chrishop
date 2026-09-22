'use client';

import { useReportWebVitals } from 'next/web-vitals';

/**
 * WebVitalsReporter
 *
 * Real User Monitoring (RUM) client component that captures Core Web Vitals
 * (LCP, INP, CLS, FCP, TTFB) using Next.js `useReportWebVitals` and dispatches
 * non-blocking telemetry beacons to `/api/telemetry/vitals`.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    try {
      const nav = typeof navigator !== 'undefined' ? (navigator as any) : undefined;
      const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;

      const deviceContext = {
        connectionType: conn?.effectiveType || conn?.type,
        downlink: typeof conn?.downlink === 'number' ? conn.downlink : undefined,
        rtt: typeof conn?.rtt === 'number' ? conn.rtt : undefined,
        deviceMemory: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : undefined,
        hardwareConcurrency:
          typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : undefined,
        viewport:
          typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined,
      };

      const payload = {
        id: metric.id,
        name: metric.name,
        value: metric.value,
        delta: metric.delta,
        rating: metric.rating,
        navigationType: metric.navigationType,
        path: typeof window !== 'undefined' ? window.location.pathname : '/',
        timestamp: Date.now(),
        device: deviceContext,
      };

      const endpoint = '/api/telemetry/vitals';
      const payloadString = JSON.stringify(payload);

      // 1. Prefer non-blocking navigator.sendBeacon for zero impact on thread and unload resilience
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payloadString], { type: 'application/json' });
        if (navigator.sendBeacon(endpoint, blob)) {
          return;
        }
      }

      // 2. Fallback to fetch with keepalive: true
      if (typeof fetch === 'function') {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadString,
          keepalive: true,
        }).catch(() => {
          // Non-blocking telemetry drop
        });
      }
    } catch {
      // Non-fatal telemetry dispatch error
    }
  });

  return null;
}
