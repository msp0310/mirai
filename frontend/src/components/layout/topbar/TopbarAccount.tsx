import { ArrowRightOnRectangleIcon, UserCircleIcon } from "@heroicons/react/24/outline";

import type { TopbarAuthUser } from "./types";

type TopbarAccountProps = {
  currentUser: TopbarAuthUser;
  onClose: () => void;
  onLogout: () => Promise<void>;
  onToggle: () => void;
  open: boolean;
};

/** ログイン中ユーザーの要約とログアウト操作を表示します。 */
export function TopbarAccount({
  currentUser,
  onClose,
  onLogout,
  onToggle,
  open,
}: TopbarAccountProps) {
  return (
    <div className="topbar-action-wrap">
      <button
        aria-label="アカウント"
        className={open ? "account-button active" : "account-button"}
        onClick={onToggle}
        title={`${currentUser.name}としてログイン中`}
        type="button"
      >
        <UserCircleIcon />
        <span>{currentUser.name}</span>
      </button>
      {open ? (
        <div className="topbar-popover account-popover">
          <strong>アカウント</strong>
          <div className="account-summary">
            <UserCircleIcon />
            <div>
              <strong>{currentUser.name}</strong>
              <span>{currentUser.email}</span>
              <small>{currentUser.role}</small>
            </div>
          </div>
          <button
            className="subtle-action full"
            onClick={() => {
              onClose();
              void onLogout();
            }}
            type="button"
          >
            <ArrowRightOnRectangleIcon />
            ログアウト
          </button>
        </div>
      ) : null}
    </div>
  );
}
