import type { Member, Team } from "../../../types/schedule";

type AuditLogTarget = {
  scopeId?: string | null;
  scopeType: string;
  targetId?: string | null;
  targetType?: string | null;
};

export type MasterSettingsSection = "teams" | "members" | "calendar" | "pjmgt" | "audit";

export const weekdays = [
  { label: "日", value: 0 },
  { label: "月", value: 1 },
  { label: "火", value: 2 },
  { label: "水", value: 3 },
  { label: "木", value: 4 },
  { label: "金", value: 5 },
  { label: "土", value: 6 },
] as const;

export const auditActionLabels: Record<string, string> = {
  "attachment.delete": "添付削除",
  "attachment.upload": "添付追加",
  "auth.login": "ログイン",
  "auth.logout": "ログアウト",
  "auth.password.change": "パスワード変更",
  "member.account.save": "アカウント更新",
  "member.password.reset": "パスワード再設定",
  "project.activity.save": "案件運用データ保存",
  "project.schedule.save": "案件計画保存",
  "task.actual.update": "タスク実績更新",
};

export function getActiveTeamMemberCount(team: Team, members: Member[]) {
  const activeMemberIds = new Set(
    members.filter((member) => member.status !== "inactive").map((member) => member.id),
  );
  return team.memberIds.filter((memberId) => activeMemberIds.has(memberId)).length;
}

export function updateTeamMembershipRole(
  team: Team,
  memberId: string,
  role: "manager" | "member",
): Team {
  const memberships =
    team.memberships ?? team.memberIds.map((id) => ({ memberId: id, role: "member" as const }));
  return {
    ...team,
    memberships: [
      ...memberships.filter((membership) => membership.memberId !== memberId),
      { memberId, role },
    ],
  };
}

export function formatAuditDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ja-JP");
}

export function formatAuditTarget(log: AuditLogTarget) {
  const type = log.targetType ?? log.scopeType;
  const id = log.targetId ?? log.scopeId;
  return id ? `${type} / ${id}` : type;
}

export function formatHolidayDate(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function mergeMemberAccountFields(member: Member, accountMember?: Member): Member {
  if (!accountMember) {
    return member;
  }
  return {
    ...member,
    lastLoginAt: accountMember.lastLoginAt ?? null,
    loginCreatedAt: accountMember.loginCreatedAt ?? null,
    loginEmail: accountMember.loginEmail ?? null,
    loginEnabled: accountMember.loginEnabled ?? false,
    passwordChangedAt: accountMember.passwordChangedAt ?? null,
    passwordResetRequired: accountMember.passwordResetRequired ?? false,
    permissionRole: accountMember.permissionRole ?? null,
  };
}

export function upsertMemberAccount(current: Member[], updated: Member) {
  return current.some((member) => member.id === updated.id)
    ? current.map((member) => (member.id === updated.id ? updated : member))
    : [...current, updated];
}
