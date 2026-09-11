"use client";

import { useEffect, useRef } from "react";

export default function QrScanner({
  onResult,
  onError,
}: {
  onResult: (text: string) => void;
  onError?: (error: unknown) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled || !containerRef.current) return;

        const scanner = new Html5Qrcode("qr-reader-region");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            scanner.stop().catch(() => {});
            onResult(decodedText);
          },
          () => {}
        );
      } catch (error) {
        if (!cancelled) onError?.(error);
      }
    }

    start();

    return () => {
      cancelled = true;
      scannerRef.current?.stop().catch(() => {});
    };
  }, [onResult, onError]);

  return (
    <div
      ref={containerRef}
      id="qr-reader-region"
      className="w-full rounded-xl overflow-hidden bg-black min-h-[220px] flex items-center justify-center text-white/60 text-sm"
    />
  );
}