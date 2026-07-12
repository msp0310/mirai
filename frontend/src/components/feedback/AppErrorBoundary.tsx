import { Component, type ErrorInfo, type ReactNode } from "react";

type State = { errorId: string | null };

/** 予期しない描画例外で画面全体が白くなることを防ぎます。 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { errorId: null };

  static getDerivedStateFromError(): State {
    return { errorId: `UI-${Date.now().toString(36).toUpperCase()}` };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", { error, errorId: this.state.errorId, info });
  }

  render() {
    if (!this.state.errorId) {
      return this.props.children;
    }
    return (
      <main className="app-boot-screen">
        <section className="app-boot-panel" role="alert">
          <img alt="Mirai" className="app-boot-wordmark" src="/brand/mirai-wordmark.png" />
          <h1>画面を表示できませんでした</h1>
          <p>
            再読み込みしても直らない場合は、エラーID {this.state.errorId} を管理者へ伝えてください。
          </p>
          <button className="primary-button" onClick={() => window.location.reload()} type="button">
            再読み込み
          </button>
        </section>
      </main>
    );
  }
}
