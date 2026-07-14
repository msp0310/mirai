import { useForm } from "@tanstack/react-form";

import { FormFieldError } from "../../../components/forms/FormFieldError";
import { passwordChangeFormSchema } from "../model/authFormSchemas";

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
  const form = useForm({
    defaultValues: { confirmation: "", currentPassword: "", newPassword: "" },
    onSubmit: async ({ value }) => {
      const input = passwordChangeFormSchema.parse(value);
      await onChangePassword(input.currentPassword, input.newPassword);
    },
    validators: {
      onChange: passwordChangeFormSchema,
      onSubmit: passwordChangeFormSchema,
    },
  });

  return (
    <main className="login-screen">
      <form
        className="login-panel"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <img alt="COMPASS" className="login-wordmark" src="/brand/compass-wordmark.png" />
        <h1>パスワードを変更</h1>
        <p>初回ログインのため、新しいパスワードを設定してください。</p>
        <form.Field name="currentPassword">
          {(field) => (
            <label>
              現在のパスワード
              <input
                aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                autoComplete="current-password"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                required
                type="password"
                value={field.state.value}
              />
              <FormFieldError errors={field.state.meta.errors} show={field.state.meta.isTouched} />
            </label>
          )}
        </form.Field>
        <form.Field name="newPassword">
          {(field) => (
            <label>
              新しいパスワード
              <input
                aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                autoComplete="new-password"
                minLength={12}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                required
                type="password"
                value={field.state.value}
              />
              <FormFieldError errors={field.state.meta.errors} show={field.state.meta.isTouched} />
            </label>
          )}
        </form.Field>
        <form.Field name="confirmation">
          {(field) => (
            <label>
              新しいパスワード（確認）
              <input
                aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                autoComplete="new-password"
                minLength={12}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                required
                type="password"
                value={field.state.value}
              />
              <FormFieldError errors={field.state.meta.errors} show={field.state.meta.isTouched} />
            </label>
          )}
        </form.Field>
        {error ? <p className="login-error">{error}</p> : null}
        <form.Subscribe selector={(state) => [state.canSubmit, state.values] as const}>
          {([canSubmit, values]) => (
            <button
              className="primary-button"
              disabled={
                loading ||
                !canSubmit ||
                !values.currentPassword ||
                values.newPassword.length < 12 ||
                values.confirmation.length < 12
              }
              type="submit"
            >
              {loading ? "変更中..." : "パスワードを変更"}
            </button>
          )}
        </form.Subscribe>
      </form>
    </main>
  );
}
