"use client";

import { useEffect, useRef } from "react";

const CHANNEL = "kehadiran-acara-auth";

export function notifyAuthLogout() {
  try {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage({ type: "LOGOUT", at: Date.now() });
    bc.close();
  } catch {
    /* noop */
  }
}

export function useOnAuthLogout(handler: () => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel === "undefined") return;
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = (event) => {
        if (event.data?.type === "LOGOUT") handlerRef.current();
      };
    } catch {
      /* noop */
    }
    return () => {
      try {
        bc?.close();
      } catch {
        /* noop */
      }
    };
  }, []);
}