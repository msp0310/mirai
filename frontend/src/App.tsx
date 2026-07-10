import { useEffect, useState } from "react";
import { LoginScreen } from "./features/auth/components/LoginScreen";
import { AppWorkbench } from "./app/AppWorkbench";
import { authRepository, AuthRequestError } from "./data/authRepository";
import { apiScheduleRepository, ApiRequestError } from "./data/apiScheduleRepository";
import { loadLocalScheduleDraft } from "./data/localScheduleStorage";
import { createInitialAppState, getProjectIdFromHash } from "./app/appState";
import type { AppBootState, AuthState } from "./app/appTypes";
import {
  createInitialScheduleWorkspace,
  selectInitialProject,
} from "./app/projectLoading";

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
        <img alt="Mirai" className="app-boot-wordmark" src="/brand/mirai-wordmark.png" />
        <h1>{title}</h1>
        {error ? <p>{error}</p> : <p>チーム、プロジェクト、ガントの初期データを読み込んでいます。</p>}
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
  const [authState, setAuthState] = useState<AuthState>({ status: "checking" });
  const [bootState, setBootState] = useState<AppBootState>({ status: "loading" });
  const [reloadRequestId, setReloadRequestId] = useState(0);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authRepository
      .getCurrentUser()
      .then((user) => {
        if (cancelled) return;
        setAuthState(user ? { status: "signedIn", user } : { error: null, status: "signedOut" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAuthState({
          error:
            error instanceof Error
              ? error.message
              : "認証状態を確認できませんでした。ログインしてください。",
          status: "signedOut",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authState.status !== "signedIn") return;

    let cancelled = false;
    setBootState({ status: "loading" });
    async function loadInitialWorkspace() {
      const summary = await apiScheduleRepository.getWorkspaceSummary();
      const draft = loadLocalScheduleDraft();
      const initialProject = selectInitialProject(summary, {
        draftProjectId: draft?.activeProjectId,
        hashProjectId: getProjectIdFromHash(),
      });
      if (!initialProject) {
        throw new Error("APIからプロジェクトが取得できませんでした。");
      }
      const schedule = await apiScheduleRepository.getProjectSchedule(initialProject.id);
      return createInitialScheduleWorkspace(summary, schedule);
    }

    loadInitialWorkspace()
      .then((workspace) => {
        if (cancelled) return;
        setBootState({
          initialAppState: createInitialAppState(workspace),
          loadId: Date.now(),
          status: "ready",
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiRequestError && error.status === 401) {
          authRepository.clearSession();
          setAuthState({
            error: "セッションが切れました。もう一度ログインしてください。",
            status: "signedOut",
          });
          return;
        }
        setBootState({
          error:
            error instanceof Error ? error.message : "APIから初期データを取得できませんでした。",
          status: "failed",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [authState.status, reloadRequestId]);

  async function login(email: string, password: string) {
    setLoginSubmitting(true);
    try {
      const session = await authRepository.login(email, password);
      setAuthState({ status: "signedIn", user: session.user });
    } catch (error) {
      setAuthState({
        error:
          error instanceof AuthRequestError && error.status === 401
            ? "メールアドレスまたはパスワードが違います。"
            : error instanceof Error
              ? error.message
              : "ログインできませんでした。",
        status: "signedOut",
      });
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function logout() {
    await authRepository.logout().catch(() => undefined);
    setAuthState({ error: null, status: "signedOut" });
    setBootState({ status: "loading" });
  }

  if (authState.status === "checking") {
    return <AppBootScreen title="認証状態を確認中" />;
  }

  if (authState.status === "signedOut") {
    return <LoginScreen error={authState.error} loading={loginSubmitting} onLogin={login} />;
  }

  if (bootState.status === "loading") {
    return <AppBootScreen title="ワークスペースを読み込み中" />;
  }

  if (bootState.status === "failed") {
    return (
      <AppBootScreen
        error={bootState.error}
        onRetry={() => setReloadRequestId((value) => value + 1)}
        title="APIに接続できません"
      />
    );
  }

  return (
    <AppWorkbench
      key={bootState.loadId}
      currentUser={authState.user}
      initialAppState={bootState.initialAppState}
      onLogout={logout}
      onReloadWorkspace={() => setReloadRequestId((value) => value + 1)}
    />
  );
}
