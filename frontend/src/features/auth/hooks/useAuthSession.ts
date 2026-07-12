import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { AuthRequestError, authRepository } from "../../../data/authRepository";
import { clearLocalScheduleDraft } from "../../../data/localScheduleStorage";
import { authQueryKeys, currentUserQueryOptions } from "../api/authQueries";

/** Cookieセッションの取得と認証MutationをTanStack Queryへ集約します。 */
export function useAuthSession() {
  const queryClient = useQueryClient();
  const currentUserQuery = useQuery(currentUserQueryOptions());
  const [signedOutMessage, setSignedOutMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentUserQuery.isFetched && !currentUserQuery.data) {
      clearLocalScheduleDraft();
    }
  }, [currentUserQuery.data, currentUserQuery.isFetched]);

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authRepository.login(email, password),
    onMutate: () => setSignedOutMessage(null),
    onSuccess: (session) => {
      queryClient.removeQueries();
      queryClient.setQueryData(authQueryKeys.currentUser, session.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authRepository.logout().catch(() => undefined),
    onSuccess: () => {
      clearLocalScheduleDraft();
      queryClient.removeQueries();
      queryClient.setQueryData(authQueryKeys.currentUser, null);
      setSignedOutMessage(null);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => authRepository.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      clearLocalScheduleDraft();
      queryClient.removeQueries();
      queryClient.setQueryData(authQueryKeys.currentUser, null);
      setSignedOutMessage("パスワードを変更しました。もう一度ログインしてください。");
    },
  });

  const expireSession = useCallback(
    (message = "セッションが切れました。もう一度ログインしてください。") => {
      authRepository.clearSession();
      clearLocalScheduleDraft();
      queryClient.removeQueries();
      queryClient.setQueryData(authQueryKeys.currentUser, null);
      setSignedOutMessage(message);
    },
    [queryClient],
  );

  return {
    changePassword: (currentPassword: string, newPassword: string) => {
      passwordMutation.reset();
      return passwordMutation.mutateAsync({ currentPassword, newPassword });
    },
    checking: currentUserQuery.isPending,
    expireSession,
    login: (email: string, password: string) => loginMutation.mutateAsync({ email, password }),
    loginError:
      signedOutMessage ??
      formatLoginError(loginMutation.error) ??
      formatCurrentUserError(currentUserQuery.error),
    loginSubmitting: loginMutation.isPending,
    logout: () => logoutMutation.mutateAsync(),
    passwordChangeError: passwordMutation.error
      ? formatUnknownError(passwordMutation.error, "パスワードを変更できませんでした。")
      : null,
    passwordChangeSubmitting: passwordMutation.isPending,
    user: currentUserQuery.data ?? null,
  };
}

function formatLoginError(error: unknown) {
  if (!error) {
    return null;
  }
  if (error instanceof AuthRequestError && error.status === 401) {
    return "メールアドレスまたはパスワードが違います。";
  }
  return formatUnknownError(error, "ログインできませんでした。");
}

function formatCurrentUserError(error: unknown) {
  return error
    ? formatUnknownError(error, "認証状態を確認できませんでした。ログインしてください。")
    : null;
}

function formatUnknownError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
