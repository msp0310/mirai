import { ArrowRightIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { useForm } from "@tanstack/react-form";

import { FormFieldError } from "../../../components/forms/FormFieldError";
import { loginFormSchema } from "../model/authFormSchemas";

type LoginScreenProps = {
  error: string | null;
  loading: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
};

/** メールアドレスとパスワードを受け取り、API認証を開始する画面です。 */
export function LoginScreen({ error, loading, onLogin }: LoginScreenProps) {
  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      if (!loading) {
        const input = loginFormSchema.parse(value);
        await onLogin(input.email, input.password);
      }
    },
    validators: {
      onChange: loginFormSchema,
      onSubmit: loginFormSchema,
    },
  });

  return (
    <main className="login-screen">
      <section className="login-panel" aria-label="ログイン">
        <div className="login-brand">
          <div>
            <img alt="COMPASS" className="login-wordmark" src="/brand/compass-wordmark.png" />
            <h1>ログイン</h1>
          </div>
        </div>
        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field name="email">
            {(field) => (
              <label>
                メールアドレス
                <input
                  aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  autoComplete="email"
                  inputMode="email"
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="name@example.com"
                  type="email"
                  value={field.state.value}
                />
                <FormFieldError
                  errors={field.state.meta.errors}
                  show={field.state.meta.isTouched}
                />
              </label>
            )}
          </form.Field>
          <form.Field name="password">
            {(field) => (
              <label>
                パスワード
                <input
                  aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  autoComplete="current-password"
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="パスワード"
                  type="password"
                  value={field.state.value}
                />
                <FormFieldError
                  errors={field.state.meta.errors}
                  show={field.state.meta.isTouched}
                />
              </label>
            )}
          </form.Field>
          {error ? (
            <div className="login-error" role="alert">
              <LockClosedIcon />
              {error}
            </div>
          ) : null}
          <form.Subscribe selector={(state) => [state.canSubmit, state.values] as const}>
            {([canSubmit, values]) => (
              <button
                className="primary-button login-submit"
                disabled={loading || !canSubmit || !values.email.trim() || !values.password}
                type="submit"
              >
                {loading ? "確認中" : "ログイン"}
                <ArrowRightIcon />
              </button>
            )}
          </form.Subscribe>
        </form>
      </section>
    </main>
  );
}
