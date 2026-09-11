"use client";

import { useState, useCallback, useRef } from "react";

export type ToastItem = {
  id: number;
  type: "success" | "error" | "info";
  message: string;
};

let nextId = 0;

export function useToast(defaultDuration = 4000) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastItem["type"], message: string, duration?: number) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, type, message }]);
      timers.current[id] = setTimeout(() => dismiss(id), duration ?? defaultDuration);
      return id;
    },
    [dismiss, defaultDuration]
  );

  const success = useCallback((message: string, duration?: number) => toast("success", message, duration), [toast]);
  const error = useCallback((message: string, duration?: number) => toast("error", message, duration), [toast]);
  const info = useCallback((message: string, duration?: number) => toast("info", message, duration), [toast]);

  return { toasts, toast, success, error, info, dismiss };
}