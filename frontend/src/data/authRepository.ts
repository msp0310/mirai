import type { Member } from "../types/schedule";
import { ApiRequestError, requestJson } from "./apiClient";

export { ApiRequestError as AuthRequestError } from "./apiClient";

export type AuthUser = {
  email: string;
  id: string;
  name: string;
  role: string;
};

export type AuthSession = {
  expiresAt: string;
  token: string;
  user: AuthUser;
};

export type SaveMemberAccountInput = {
  email: string;
  loginEnabled: boolean;
  password?: string | null;
  permissionRole: string;
};

export type MemberAccountMutationResponse = {
  member: Member;
  temporaryPassword: string | null;
};

export type ResetMemberPasswordInput = {
  password?: string | null;
  passwordResetRequired: boolean;
};

const authSessionKey = "si-schedule-manager-auth-session-v1";

function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(authSessionKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!isAuthSession(parsed)) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      clearStoredSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredSession(session: AuthSession) {
  window.localStorage.setItem(authSessionKey, JSON.stringify(session));
}

function clearStoredSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(authSessionKey);
}

function getAuthenticatedHeaders() {
  const session = readStoredSession();
  if (!session) {
    throw new ApiRequestError("ログインが必要です。", 401);
  }
  return {
    Authorization: `Bearer ${session.token}`,
  };
}

function isAuthSession(value: Partial<AuthSession>): value is AuthSession {
  return (
    typeof value.token === "string" && typeof value.expiresAt === "string" && isAuthUser(value.user)
  );
}

function isAuthUser(value: unknown): value is AuthUser {
  if (value == null || typeof value !== "object") return false;
  const maybe = value as Partial<AuthUser>;
  return (
    typeof maybe.id === "string" &&
    typeof maybe.email === "string" &&
    typeof maybe.name === "string" &&
    typeof maybe.role === "string"
  );
}

export const authRepository = {
  clearSession() {
    clearStoredSession();
  },

  getAccessToken() {
    return readStoredSession()?.token ?? null;
  },

  async getCurrentUser() {
    const session = readStoredSession();
    if (!session) return null;

    try {
      const user = await requestJson<AuthUser>("/auth/me", {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });
      saveStoredSession({ ...session, user });
      return user;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        clearStoredSession();
        return null;
      }
      throw error;
    }
  },

  async login(email: string, password: string) {
    const session = await requestJson<AuthSession>("/auth/login", {
      body: JSON.stringify({ email, password }),
      method: "POST",
    });
    saveStoredSession(session);
    return session;
  },

  async logout() {
    const session = readStoredSession();
    clearStoredSession();
    if (!session) return;

    await requestJson<void>("/auth/logout", {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
      method: "POST",
    });
  },

  async listMembersWithAccounts() {
    return requestJson<Member[]>("/auth/members", {
      headers: getAuthenticatedHeaders(),
    });
  },

  async saveMemberAccount(memberId: string, input: SaveMemberAccountInput) {
    return requestJson<MemberAccountMutationResponse>(
      `/auth/members/${encodeURIComponent(memberId)}/account`,
      {
        body: JSON.stringify(input),
        headers: getAuthenticatedHeaders(),
        method: "PUT",
      },
    );
  },

  async resetMemberPassword(memberId: string, input: ResetMemberPasswordInput) {
    return requestJson<MemberAccountMutationResponse>(
      `/auth/members/${encodeURIComponent(memberId)}/reset-password`,
      {
        body: JSON.stringify(input),
        headers: getAuthenticatedHeaders(),
        method: "POST",
      },
    );
  },
};
