import { useCallback, useRef, useState } from "react";

import type { ToastMessage, ToastTone } from "../components/ui/ToastViewport";

export type ToastInput = {
  detail?: string;
  durationMs?: number;
  title: string;
  tone?: ToastTone;
};

/**
 * 一時通知の追加、手動解除、自動解除を一つのライフサイクルにまとめます。
 * 画面コンポーネント側がタイマーやID採番を意識しないためのフックです。
 */
export function useToastQueue() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextIdRef = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    ({ detail, durationMs = 4200, title, tone = "success" }: ToastInput) => {
      const id = nextIdRef.current + 1;
      nextIdRef.current = id;
      setToasts((current) => [...current, { detail, durationMs, id, title, tone }].slice(-3));
    },
    [],
  );

  return { addToast, dismissToast, toasts };
}
