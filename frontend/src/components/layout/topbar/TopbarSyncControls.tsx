import { ArrowPathIcon, CloudArrowUpIcon } from "@heroicons/react/24/outline";

import { formatSavedAt } from "./topbarPresentation";
import type { TopbarSyncQueueItem, TopbarSyncStatus } from "./types";

type TopbarSyncControlsProps = {
  hasUnsavedChanges: boolean;
  onClose: () => void;
  onResetDraft: () => void;
  onRetryApiSync: () => void;
  onSaveDraft: () => void;
  onToggle: () => void;
  open: boolean;
  queueItems: TopbarSyncQueueItem[];
  status: TopbarSyncStatus;
};

/** 保存状態、API送信キュー、手動保存・再送を一つの同期操作群として表示します。 */
export function TopbarSyncControls({
  hasUnsavedChanges,
  onClose,
  onResetDraft,
  onRetryApiSync,
  onSaveDraft,
  onToggle,
  open,
  queueItems,
  status,
}: TopbarSyncControlsProps) {
  return (
    <>
      <div className="topbar-action-wrap">
        <button
          className={`save-state ${status.status}${open ? " active" : ""}`}
          onClick={onToggle}
          title={status.detail}
          type="button"
        >
          <span />
          <div>
            <strong>{status.title}</strong>
            <small>
              {status.lastSyncedAt ? formatSavedAt(status.lastSyncedAt) : status.modeLabel}
            </small>
          </div>
        </button>
        {open ? (
          <div className="topbar-popover sync-popover">
            <strong>同期状態</strong>
            <div className={`sync-status-card ${status.status}`}>
              <span />
              <div>
                <strong>{status.title}</strong>
                <p>{status.detail}</p>
              </div>
            </div>
            <dl className="sync-meta">
              <div>
                <dt>保存範囲</dt>
                <dd>{status.scopeLabel}</dd>
              </div>
              <div>
                <dt>保存先</dt>
                <dd>{status.providerLabel}</dd>
              </div>
              <div>
                <dt>接続</dt>
                <dd>{status.endpointLabel}</dd>
              </div>
              <div>
                <dt>未同期</dt>
                <dd>{status.pendingChangeCount}件</dd>
              </div>
            </dl>
            <section className="sync-queue" aria-label="API送信キュー">
              <div className="sync-queue-heading">
                <strong>API送信キュー</strong>
                <span>{queueItems.length}件</span>
              </div>
              {queueItems.length > 0 ? (
                <div className="sync-queue-list">
                  {queueItems.map((item) => (
                    <article className={`sync-queue-item ${item.status}`} key={item.id}>
                      <span />
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                        {item.updatedAt ? <small>{formatSavedAt(item.updatedAt)}</small> : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="sync-queue-empty">API送信待ちはありません。</p>
              )}
            </section>
            <button
              className="primary-button full"
              onClick={() => {
                onClose();
                onSaveDraft();
              }}
              type="button"
            >
              <CloudArrowUpIcon />
              今すぐ保存
            </button>
            {status.status === "error" || status.status === "saving" ? (
              <button
                className="subtle-action full"
                disabled={status.status === "saving"}
                onClick={onRetryApiSync}
                type="button"
              >
                <ArrowPathIcon />
                API再送
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <button
        className={
          hasUnsavedChanges ? "toolbar-button save-button dirty" : "toolbar-button save-button"
        }
        onClick={onSaveDraft}
        title={`${status.scopeLabel}を保存 (Ctrl/Cmd+S)`}
        type="button"
      >
        <CloudArrowUpIcon />
        保存
      </button>
      <button
        aria-label="表示設定を初期化"
        className="icon-button"
        onClick={onResetDraft}
        title="表示設定を初期化してAPIから再読み込み"
        type="button"
      >
        <ArrowPathIcon />
      </button>
    </>
  );
}
