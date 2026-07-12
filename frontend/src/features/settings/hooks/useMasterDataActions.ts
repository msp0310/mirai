import { type Dispatch, type SetStateAction, useCallback } from "react";

import { apiScheduleRepository } from "../../../data/apiScheduleRepository";
import type { ProjectSummary, ScheduleWorkspace } from "../../../data/scheduleRepository";
import type { ToastInput } from "../../../hooks/useToastQueue";
import type { ActivityInput } from "../../../types/activity";
import type { CalendarDefinition, Member, Team } from "../../../types/schedule";

type UseMasterDataActionsOptions = {
  activeTeam?: Team | null;
  onActivity: (input: ActivityInput) => void;
  onToast: (input: ToastInput) => void;
  projectSummaries: ProjectSummary[];
  scheduleMembers: Member[];
  setWorkspace: Dispatch<SetStateAction<ScheduleWorkspace>>;
  workspace: ScheduleWorkspace;
};

/**
 * 管理設定のAPI保存とワークスペース反映をまとめます。
 * 案件画面は管理データの永続化手順を意識せず、操作だけを呼び出します。
 */
export function useMasterDataActions({
  activeTeam,
  onActivity,
  onToast,
  projectSummaries,
  scheduleMembers,
  setWorkspace,
  workspace,
}: UseMasterDataActionsOptions) {
  const updateTeam = useCallback(
    async (sourceTeam: Team) => {
      let team: Team = {
        ...sourceTeam,
        memberships: sourceTeam.memberIds.map(
          (memberId) =>
            sourceTeam.memberships?.find((item) => item.memberId === memberId) ?? {
              memberId,
              role: "member",
            },
        ),
      };
      try {
        team = await apiScheduleRepository.saveTeam(team);
      } catch (error) {
        onToast({
          detail: error instanceof Error ? error.message : "保存できませんでした。",
          title: "チーム設定の保存に失敗しました",
          tone: "warning",
        });
        return;
      }
      setWorkspace((current) => ({
        ...current,
        teams: current.teams.map((item) => (item.id === team.id ? team : item)),
      }));
      onToast({ detail: team.name, title: "チーム設定を保存しました" });
      onActivity({
        category: "team",
        detail: `${team.memberIds.length}名のメンバー構成`,
        title: "チーム設定を更新しました",
        tone: "success",
      });
    },
    [onActivity, onToast, setWorkspace],
  );

  const createTeam = useCallback(
    async (sourceTeam: Team) => {
      let team = sourceTeam;
      try {
        team = await apiScheduleRepository.saveTeam(team);
      } catch (error) {
        onToast({
          detail: error instanceof Error ? error.message : "追加できませんでした。",
          title: "チームの追加に失敗しました",
          tone: "warning",
        });
        return;
      }
      setWorkspace((current) => ({ ...current, teams: [...current.teams, team] }));
      onToast({ detail: team.name, title: "チームを追加しました" });
      onActivity({
        category: "team",
        detail: team.description || `${team.memberIds.length}名`,
        title: `チームを追加: ${team.name}`,
        tone: "success",
      });
    },
    [onActivity, onToast, setWorkspace],
  );

  const updateMember = useCallback(
    async (sourceMember: Member) => {
      let member = sourceMember;
      try {
        member = await apiScheduleRepository.saveMember(member);
      } catch (error) {
        onToast({
          detail: error instanceof Error ? error.message : "保存できませんでした。",
          title: "メンバーの保存に失敗しました",
          tone: "warning",
        });
        return;
      }
      setWorkspace((current) => ({
        ...current,
        schedules: current.schedules.map((snapshot) => ({
          ...snapshot,
          members: snapshot.members.map((item) => (item.id === member.id ? member : item)),
        })),
      }));
      onActivity({
        category: "team",
        detail: `${member.role} / ${member.capacityHours}h / 休暇${member.availabilityOverrides?.length ?? 0}日`,
        title: `メンバーを更新: ${member.name}`,
        tone: "info",
      });
    },
    [onActivity, onToast, setWorkspace],
  );

  const updateMemberLifecycle = useCallback(
    (memberId: string, status: "active" | "inactive") => {
      const inactiveAt = status === "inactive" ? new Date().toISOString() : undefined;
      const member = scheduleMembers.find((item) => item.id === memberId);
      setWorkspace((current) => ({
        ...current,
        schedules: current.schedules.map((snapshot) => ({
          ...snapshot,
          members: snapshot.members.map((item) =>
            item.id === memberId ? { ...item, inactiveAt, status } : item,
          ),
        })),
      }));
      onToast({
        detail: member?.name ?? memberId,
        title: status === "inactive" ? "メンバーを休止しました" : "メンバーを復帰しました",
        tone: status === "inactive" ? "warning" : "success",
      });
      onActivity({
        category: "team",
        detail:
          status === "inactive"
            ? "新しい担当候補から外しました。既存の担当履歴は残ります。"
            : "新しい担当候補に戻しました。",
        title: `${status === "inactive" ? "メンバーを休止" : "メンバーを復帰"}: ${member?.name ?? memberId}`,
        tone: status === "inactive" ? "warning" : "success",
      });
    },
    [onActivity, onToast, scheduleMembers, setWorkspace],
  );

  const createMember = useCallback(
    async (sourceMember: Member, teamId: string | null) => {
      let member = sourceMember;
      try {
        member = await apiScheduleRepository.saveMember(member);
      } catch (error) {
        onToast({
          detail: error instanceof Error ? error.message : "追加できませんでした。",
          title: "メンバーの追加に失敗しました",
          tone: "warning",
        });
        return;
      }
      setWorkspace((current) => ({
        ...current,
        schedules: current.schedules.map((snapshot) => ({
          ...snapshot,
          members: snapshot.members.some((item) => item.id === member.id)
            ? snapshot.members
            : [...snapshot.members, member],
        })),
        teams:
          teamId == null
            ? current.teams
            : current.teams.map((team) =>
                team.id === teamId
                  ? {
                      ...team,
                      memberIds: team.memberIds.includes(member.id)
                        ? team.memberIds
                        : [...team.memberIds, member.id],
                    }
                  : team,
              ),
      }));
      onToast({ detail: member.name, title: "メンバーを追加しました" });
      onActivity({
        category: "team",
        detail: `${member.role} / ${member.capacityHours}h / 休暇${member.availabilityOverrides?.length ?? 0}日`,
        title: `メンバーを追加: ${member.name}`,
        tone: "success",
      });
      if (teamId) {
        const targetTeam = workspace.teams.find((item) => item.id === teamId);
        if (targetTeam) {
          await updateTeam({
            ...targetTeam,
            memberIds: [...new Set([...targetTeam.memberIds, member.id])],
          });
        }
      }
    },
    [onActivity, onToast, setWorkspace, updateTeam, workspace.teams],
  );

  const toggleTeamMember = useCallback(
    async (teamId: string, memberId: string, enabled: boolean) => {
      const target = workspace.teams.find((team) => team.id === teamId);
      if (!target) {
        return;
      }
      const savedTeam = {
        ...target,
        memberIds: enabled
          ? [...new Set([...target.memberIds, memberId])]
          : target.memberIds.filter((id) => id !== memberId),
      };
      try {
        await apiScheduleRepository.saveTeam(savedTeam);
      } catch (error) {
        onToast({
          detail: error instanceof Error ? error.message : "保存できませんでした。",
          title: "チーム所属の更新に失敗しました",
          tone: "warning",
        });
        return;
      }
      setWorkspace((current) => ({
        ...current,
        teams: current.teams.map((team) => {
          if (team.id !== teamId) {
            return team;
          }
          return {
            ...team,
            memberIds: enabled
              ? [...new Set([...team.memberIds, memberId])]
              : team.memberIds.filter((id) => id !== memberId),
          };
        }),
      }));
      const member = scheduleMembers.find((item) => item.id === memberId);
      onActivity({
        category: "team",
        detail: `${member?.name ?? memberId} を${enabled ? "チームに追加" : "チームから外し"}ました。`,
        title: "チーム所属を更新しました",
        tone: "info",
      });
    },
    [onActivity, onToast, scheduleMembers, setWorkspace, workspace.teams],
  );

  const updateTeamCalendarMaster = useCallback(
    async (sourceCalendar: CalendarDefinition) => {
      if (!activeTeam) {
        onToast({ title: "未所属案件にはチーム標準カレンダーがありません", tone: "warning" });
        return;
      }
      const teamId = activeTeam.id;
      let calendar = sourceCalendar;
      try {
        calendar = await apiScheduleRepository.saveTeamCalendar(teamId, calendar);
      } catch (error) {
        onToast({
          detail: error instanceof Error ? error.message : "保存できませんでした。",
          title: "標準カレンダーの保存に失敗しました",
          tone: "warning",
        });
        return;
      }
      const targetProjectCount = projectSummaries.filter(
        (summary) => summary.project.teamId === teamId,
      ).length;
      setWorkspace((current) => ({
        ...current,
        schedules: current.schedules.map((snapshot) =>
          snapshot.project.teamId === teamId
            ? {
                ...snapshot,
                calendar,
                project: { ...snapshot.project, version: (snapshot.project.version ?? 0) + 1 },
              }
            : snapshot,
        ),
        projectSummaries: (current.projectSummaries ?? []).map((summary) =>
          summary.project.teamId === teamId
            ? {
                ...summary,
                project: { ...summary.project, version: (summary.project.version ?? 0) + 1 },
              }
            : summary,
        ),
      }));
      onToast({
        detail: `${activeTeam.name} / ${targetProjectCount}件`,
        title: "チーム標準カレンダーを保存しました",
      });
      onActivity({
        category: "calendar",
        detail: `${activeTeam.name} / 稼働曜日 ${calendar.workWeek.length}件 / 休日 ${calendar.holidays.length}件`,
        title: "チーム標準カレンダーを更新しました",
        tone: "info",
      });
    },
    [activeTeam, onActivity, onToast, projectSummaries, setWorkspace],
  );

  return {
    createMember,
    createTeam,
    toggleTeamMember,
    updateMember,
    updateMemberLifecycle,
    updateTeam,
    updateTeamCalendarMaster,
  };
}
