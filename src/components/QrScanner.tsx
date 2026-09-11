"use client";

import { useEffect, useRef, useState } from "react";

type FacingMode = "environment" | "user";

export default function QrScanner({
  onResult,
  onError,
}: {
  onResult: (text: string) => void;
  onError?: (error: unknown) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;

  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    let cancelled = false;

    function stopTracks() {
      streamRef.current?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* noop */
        }
      });
      streamRef.current = null;
    }

    async function start() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled || !containerRef.current) return;

        const elementId = `qr-reader-region-${facingMode}`;
        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            stopTracks();
            try {
              scanner.stop();
            } catch {
              /* noop */
            }
            scannerRef.current = null;
            if (!cancelled) onResultRef.current(decodedText);
          },
          () => {}
        );

        if (cancelled) {
          try {
            scanner.stop();
          } catch {
            /* noop */
          }
          scannerRef.current = null;
          return;
        }

        const video = containerRef.current?.querySelector("video");
        if (video?.srcObject instanceof MediaStream) {
          streamRef.current = video.srcObject;
        }
        setCameraError("");
      } catch (error) {
        if (cancelled) return;
        setCameraError(
          error instanceof Error && error.name === "NotAllowedError"
            ? "Izin kamera ditolak. Izinkan akses kamera lalu coba lagi."
            : "Gagal mengakses kamera. Coba mode 'Masukkan Token'."
        );
        onErrorRef.current?.(error);
      }
    }

    start();

    return () => {
      cancelled = true;
      stopTracks();
      try {
        scannerRef.current?.stop();
      } catch {
        /* noop - scanner may not be running */
      }
      scannerRef.current = null;
    };
  }, [facingMode]);

  const handleToggle = () => {
    setCameraError("");
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        id={`qr-reader-region-${facingMode}`}
        className="w-full rounded-xl overflow-hidden bg-black min-h-[220px] flex items-center justify-center text-white/60 text-sm"
      />
      {cameraError && (
        <p className="text-red-500 text-xs text-center">{cameraError}</p>
      )}
      <button
        onClick={handleToggle}
        type="button"
        className="w-full py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors"
      >
        <span className="inline-flex items-center justify-center gap-1.5">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v2m0 0v2m0-2h2m4-2v2m0 0v2m0-2h2M4 20v-2m0 0v-2m0 2h2m4 2v-2m0 0v-2m0 2h2M20 4v2m0 0v2m0-2h-2m-4 2v2m0 0v2m0-2h-2m0 8v2m0 0v-2m0 2h-2"
            />
          </svg>
          Ganti Kamera ({facingMode === "environment" ? "Belakang" : "Depan"})
        </span>
      </button>
    </div>
  );
}