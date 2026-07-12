import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect } from "react";

import * as styles from "./ToastViewport.css";

export type ToastTone = "success" | "info" | "warning";

export type ToastMessage = {
  detail?: string;
  durationMs: number;
  id: number;
  title: string;
  tone: ToastTone;
};

type ToastViewportProps = {
  onDismiss: (id: number) => void;
  toasts: ToastMessage[];
};

const toneIcon = {
  info: InformationCircleIcon,
  success: CheckCircleIcon,
  warning: ExclamationTriangleIcon,
};

/** 画面右下に通知メッセージを表示し、個別に閉じられるようにする領域です。 */
export function ToastViewport({ onDismiss, toasts }: ToastViewportProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <section aria-label="操作結果" aria-live="polite" className={styles.viewport}>
      {toasts.map((toast) => (
        <ToastCard key={toast.id} onDismiss={onDismiss} toast={toast} />
      ))}
    </section>
  );
}

function ToastCard({ onDismiss, toast }: { onDismiss: (id: number) => void; toast: ToastMessage }) {
  const Icon = toneIcon[toast.tone];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [onDismiss, toast.durationMs, toast.id]);

  return (
    <article className={styles.message}>
      <Icon className={`${styles.icon} ${styles.iconByTone[toast.tone]}`} />
      <div className={styles.content}>
        <strong className={styles.title}>{toast.title}</strong>
        {toast.detail ? <p className={styles.detail}>{toast.detail}</p> : null}
      </div>
      <button
        aria-label="通知を閉じる"
        className={styles.dismiss}
        onClick={() => onDismiss(toast.id)}
        type="button"
      >
        <XMarkIcon className={styles.dismissIcon} />
      </button>
    </article>
  );
}
