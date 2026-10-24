"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({
  siteKey,
  resetKey,
  onToken,
  onExpired,
  onError,
  onScriptError
}: {
  siteKey: string;
  resetKey: number;
  onToken: (token: string) => void;
  onExpired: () => void;
  onError: () => void;
  onScriptError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenCallbackRef = useRef(onToken);
  const expiredCallbackRef = useRef(onExpired);
  const errorCallbackRef = useRef(onError);
  const scriptErrorCallbackRef = useRef(onScriptError);
  const [ready, setReady] = useState(false);

  useEffect(() => { tokenCallbackRef.current = onToken; }, [onToken]);
  useEffect(() => { expiredCallbackRef.current = onExpired; }, [onExpired]);
  useEffect(() => { errorCallbackRef.current = onError; }, [onError]);
  useEffect(() => { scriptErrorCallbackRef.current = onScriptError; }, [onScriptError]);

  useEffect(() => {
    if (!ready || !siteKey || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token: unknown) => { if (typeof token === "string" && token) tokenCallbackRef.current(token); },
      "expired-callback": () => expiredCallbackRef.current(),
      "error-callback": () => errorCallbackRef.current(),
      size: "flexible"
    });
    return () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [ready, siteKey]);

  useEffect(() => {
    if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
  }, [resetKey]);

  if (!siteKey) {
    return <p className="text-sm font-semibold text-red-700" role="alert">A verificacao de seguranca nao esta disponivel agora.</p>;
  }

  return (
    <div className="w-full">
      <Script
        id="visitor-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => {
          if (window.turnstile) setReady(true);
          else scriptErrorCallbackRef.current();
        }}
        onError={() => {
          setReady(false);
          scriptErrorCallbackRef.current();
        }}
      />
      <div ref={containerRef} className="w-full" aria-label="Verificacao de seguranca" />
    </div>
  );
}
