'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface TurnstileWidgetProps {
  siteKey?: string;
  onVerify: (token: string) => void;
  onError?: (error?: any) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  action?: string;
  cdata?: string;
  className?: string;
  testMode?: boolean;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: (error: any) => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
          action?: string;
          cdata?: string;
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string | undefined;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const DEFAULT_TEST_SITE_KEY = '1x00000000000000000000AA';

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  siteKey,
  onVerify,
  onError,
  onExpire,
  theme = 'dark',
  size = 'normal',
  action = 'checkout',
  cdata,
  className = '',
  testMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const resolvedSiteKey =
    siteKey ||
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY) ||
    DEFAULT_TEST_SITE_KEY;

  useEffect(() => {
    if (testMode || typeof window === 'undefined') {
      return;
    }

    let isSubscribed = true;

    const renderWidget = () => {
      if (!isSubscribed || !containerRef.current || !window.turnstile) {
        return;
      }

      // If already rendered, avoid re-rendering duplicate widgets
      if (widgetIdRef.current) {
        return;
      }

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: resolvedSiteKey,
          callback: (token: string) => {
            if (isSubscribed) {
              onVerify(token);
            }
          },
          'error-callback': (err: any) => {
            if (isSubscribed && onError) {
              onError(err);
            }
          },
          'expired-callback': () => {
            if (isSubscribed && onExpire) {
              onExpire();
            }
          },
          theme,
          size,
          action,
          cdata,
        });
        widgetIdRef.current = id;
        setIsLoaded(true);
      } catch (err) {
        if (onError) {
          onError(err);
        }
      }
    };

    // Load Cloudflare Turnstile script if not already present
    const SCRIPT_ID = 'cf-turnstile-script';
    if (!document.getElementById(SCRIPT_ID)) {
      window.onloadTurnstileCallback = () => {
        renderWidget();
      };

      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit';
      script.async = true;
      script.defer = true;
      script.onerror = (err) => {
        if (onError) onError(err);
      };
      document.head.appendChild(script);
    } else if (window.turnstile) {
      renderWidget();
    } else {
      // Script is loading; poll or wait for onload callback
      const prevCallback = window.onloadTurnstileCallback;
      window.onloadTurnstileCallback = () => {
        if (prevCallback) prevCallback();
        renderWidget();
      };
    }

    return () => {
      isSubscribed = false;
      if (widgetIdRef.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore cleanup errors
        }
        widgetIdRef.current = null;
      }
    };
  }, [resolvedSiteKey, onVerify, onError, onExpire, theme, size, action, cdata, testMode]);

  return (
    <div
      ref={containerRef}
      data-testid="turnstile-widget"
      data-sitekey={resolvedSiteKey}
      data-action={action}
      className={`min-h-[65px] flex items-center justify-center my-2 ${className}`}
    >
      {!isLoaded && !testMode && (
        <div className="w-full h-[65px] bg-stone-900/40 border border-stone-800/60 rounded flex items-center justify-center text-xs text-stone-500 font-mono animate-pulse">
          <span>Verifying security challenge...</span>
        </div>
      )}
      {testMode && (
        <div className="flex items-center gap-2 p-2 bg-stone-900 border border-stone-800 rounded text-xs text-stone-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Turnstile Security Verification (Simulated)</span>
          <button
            type="button"
            data-testid="simulate-turnstile-pass"
            onClick={() => onVerify(DEFAULT_TEST_SITE_KEY)}
            className="ml-auto px-2 py-0.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-[10px]"
          >
            Pass Challenge
          </button>
        </div>
      )}
    </div>
  );
};
