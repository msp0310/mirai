import { requestJson } from "./apiClient";

export type AuditLog = {
  action: string;
  createdAt: string;
  detailJson?: string | null;
  id: string;
  ipAddress?: string | null;
  scopeId?: string | null;
  scopeType: string;
  targetId?: string | null;
  targetType?: string | null;
  userId: string;
  userName: string;
};

export type PjmgtSyncSummary = {
  assignmentsImported: number;
  errors: string[];
  membersCreated: number;
  membersUpdated: number;
  projectsArchived: number;
  projectsCreated: number;
  projectsSkipped: number;
  projectsUpdated: number;
  teamsCreated: number;
  teamsUpdated: number;
  warnings: string[];
};

export type PjmgtIntegrationSettings = {
  apiKeyConfigured: boolean;
  baseUrl: string;
  excludePastProjects: boolean;
  lastConnectionCheckedAt?: string | null;
  lastConnectionMessage?: string | null;
  lastConnectionSucceeded?: boolean | null;
  lastSyncedAt?: string | null;
  lastSyncSummary?: PjmgtSyncSummary | null;
};

export type PjmgtConnectionTestResult = {
  checkedAt: string;
  message: string;
  succeeded: boolean;
};

export type PjmgtSyncResult = {
  summary: PjmgtSyncSummary;
  syncedAt: string;
};

/** システム管理者向けの直近監査ログを取得します。 */
export function listAuditLogs(limit = 200) {
  return requestJson<AuditLog[]>(`/admin/audit-logs?limit=${Math.min(Math.max(limit, 1), 500)}`);
}

export function getPjmgtIntegrationSettings() {
  return requestJson<PjmgtIntegrationSettings>("/admin/integrations/pjmgt/settings");
}

export function savePjmgtIntegrationSettings(baseUrl: string, excludePastProjects: boolean) {
  return requestJson<PjmgtIntegrationSettings>("/admin/integrations/pjmgt/settings", {
    body: JSON.stringify({ baseUrl, excludePastProjects }),
    method: "PUT",
  });
}

export function testPjmgtConnection() {
  return requestJson<PjmgtConnectionTestResult>(
    "/admin/integrations/pjmgt/test",
    { method: "POST" },
    { timeoutMs: 35_000 },
  );
}

export function previewPjmgtSync() {
  return requestJson<PjmgtSyncSummary>(
    "/admin/integrations/pjmgt/preview",
    { method: "POST" },
    { timeoutMs: 60_000 },
  );
}

export function synchronizePjmgt() {
  return requestJson<PjmgtSyncResult>(
    "/admin/integrations/pjmgt/sync",
    { method: "POST" },
    { timeoutMs: 120_000 },
  );
}
