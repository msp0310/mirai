import { ArrowRightIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { type FormEvent, useState } from "react";

type LoginScreenProps = {
  error: string | null;
  loading: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
};

/** メールアドレスとパスワードを受け取り、API認証を開始する画面です。 */
export function LoginScreen({ error, loading, onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    await onLogin(email, password);
  }

  return (
    <main className="login-screen">
      <section className="login-panel" aria-label="ログイン">
        <div className="login-brand">
          <div>
            <img alt="Mirai" className="login-wordmark" src="/brand/mirai-wordmark.png" />
            <h1>ログイン</h1>
          </div>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            メールアドレス
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
              value={email}
            />
          </label>
          <label>
            パスワード
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="パスワード"
              type="password"
              value={password}
            />
          </label>
          {error ? (
            <div className="login-error" role="alert">
              <LockClosedIcon />
              {error}
            </div>
          ) : null}
          <button className="primary-button login-submit" disabled={loading} type="submit">
            {loading ? "確認中" : "ログイン"}
            <ArrowRightIcon />
          </button>
        </form>
      </section>
    </main>
  );
}
