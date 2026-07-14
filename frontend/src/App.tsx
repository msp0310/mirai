import { useEffect } from "react";

import { AppWorkbench } from "./app/AppWorkbench";
import { useAppBootstrap } from "./app/useAppBootstrap";
import { ApiRequestError } from "./data/apiClient";
import { LoginScreen } from "./features/auth/components/LoginScreen";
import { PasswordChangeScreen } from "./features/auth/components/PasswordChangeScreen";
import { useAuthSession } from "./features/auth/hooks/useAuthSession";

/** 認証状態とAPI初期化中に表示する共通プレースホルダーです。 */
function AppBootScreen({
  error,
  onRetry,
  title,
}: {
  error?: string;
  onRetry?: () => void;
  title: string;
}) {
  return (
    <div className="app-boot-screen">
      <div className="app-boot-panel">
        <img alt="COMPASS" className="app-boot-wordmark" src="/brand/compass-wordmark.png" />
        <h1>{title}</h1>
        {error ? (
          <p>{error}</p>
        ) : (
          <p>チーム、プロジェクト、ガントの初期データを読み込んでいます。</p>
        )}
        {onRetry ? (
          <button className="primary-button" onClick={onRetry} type="button">
            再読み込み
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** 認証状態とAPI初期化を管理し、ログイン画面とワークベンチを切り替えます。 */
export function App() {
  const auth = useAuthSession();
  const bootState = useAppBootstrap(auth.user);
  const bootError = bootState.status === "failed" ? bootState.error : null;

  useEffect(() => {
    if (bootError instanceof ApiRequestError && bootError.status === 401) {
      auth.expireSession();
    }
  }, [auth.expireSession, bootError]);

  if (auth.checking) {
    return <AppBootScreen title="認証状態を確認中" />;
  }

  if (!auth.user) {
    return (
      <LoginScreen
        error={auth.loginError}
        loading={auth.loginSubmitting}
        onLogin={async (email, password) => {
          await auth.login(email, password).catch(() => undefined);
        }}
      />
    );
  }

  if (auth.user.passwordResetRequired) {
    return (
      <PasswordChangeScreen
        error={auth.passwordChangeError}
        loading={auth.passwordChangeSubmitting}
        onChangePassword={async (currentPassword, newPassword) => {
          await auth.changePassword(currentPassword, newPassword).catch(() => undefined);
        }}
      />
    );
  }

  if (bootState.status === "loading" || bootState.status === "idle") {
    return <AppBootScreen title="ワークスペースを読み込み中" />;
  }

  if (bootState.status === "failed") {
    return (
      <AppBootScreen
        error={
          bootState.error instanceof Error
            ? bootState.error.message
            : "APIから初期データを取得できませんでした。"
        }
        onRetry={() => void bootState.reload()}
        title="APIに接続できません"
      />
    );
  }

  return (
    <AppWorkbench
      key={bootState.loadId}
      currentUser={auth.user}
      initialAppState={bootState.initialAppState}
      onLogout={auth.logout}
      onReloadWorkspace={() => void bootState.reload()}
    />
  );
}
