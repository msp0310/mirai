import { BellIcon } from "@heroicons/react/24/outline";

import type { TopbarNotification } from "./types";

type TopbarNotificationsProps = {
  notifications: TopbarNotification[];
  onToggle: () => void;
  open: boolean;
};

/** 未確認の通知件数と通知一覧を表示します。 */
export function TopbarNotifications({ notifications, onToggle, open }: TopbarNotificationsProps) {
  return (
    <div className="topbar-action-wrap">
      <button
        className={open ? "icon-button has-badge active" : "icon-button has-badge"}
        aria-label="通知"
        onClick={onToggle}
        title="通知"
        type="button"
      >
        <BellIcon />
        {notifications.length > 0 ? <span>{notifications.length}</span> : null}
      </button>
      {open ? (
        <div className="topbar-popover notification-popover">
          <strong>通知</strong>
          {notifications.length > 0 ? (
            <div className="notification-list">
              {notifications.map((notification) => (
                <article className={`notification-item ${notification.tone}`} key={notification.id}>
                  <span />
                  <div>
                    <strong>{notification.title}</strong>
                    <p>{notification.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>確認が必要な通知はありません。</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
