import { type FormEvent, useState } from "react";

type PasswordChangeScreenProps = {
  error: string | null;
  loading: boolean;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

/** 初回ログイン・管理者再設定後にパスワード変更を完了させる画面です。 */
export function PasswordChangeScreen({
  error,
  loading,
  onChangePassword,
}: PasswordChangeScreenProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) {
      return;
    }
    await onChangePassword(currentPassword, newPassword);
  }

  return (
    <main className="login-screen">
      <form className="login-panel" onSubmit={submit}>
        <img alt="Mirai" className="login-wordmark" src="/brand/mirai-wordmark.png" />
        <h1>パスワードを変更</h1>
        <p>初回ログインのため、新しいパスワードを設定してください。</p>
        <label>
          現在のパスワード
          <input
            autoComplete="current-password"
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            type="password"
            value={currentPassword}
          />
        </label>
        <label>
          新しいパスワード
          <input
            autoComplete="new-password"
            minLength={12}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            type="password"
            value={newPassword}
          />
        </label>
        <label>
          新しいパスワード（確認）
          <input
            autoComplete="new-password"
            minLength={12}
            onChange={(e) => setConfirmation(e.target.value)}
            required
            type="password"
            value={confirmation}
          />
        </label>
        {newPassword && confirmation && newPassword !== confirmation ? (
          <p className="login-error">確認用パスワードが一致しません。</p>
        ) : null}
        {error ? <p className="login-error">{error}</p> : null}
        <button
          className="primary-button"
          disabled={loading || newPassword !== confirmation}
          type="submit"
        >
          {loading ? "変更中..." : "パスワードを変更"}
        </button>
      </form>
    </main>
  );
}
