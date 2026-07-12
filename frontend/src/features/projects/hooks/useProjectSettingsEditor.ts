import { useEffect, useState } from "react";

import { isMemberActive } from "../../../lib/members";
import { getProjectLifecycleStatus } from "../../../lib/projects";
import type {
  Member,
  Project,
  ProjectMembership,
  ProjectRole,
  Team,
} from "../../../types/schedule";

export type ProjectSettingsDraft = {
  lifecycleStatus: Project["lifecycleStatus"];
  memberIds: string[];
  memberships: ProjectMembership[];
  milestoneDate: string;
  milestoneTitle: string;
  name: string;
  projectNo: string;
  rangeEnd: string;
  rangeStart: string;
  teamId: string;
  workspace: string;
};

type UseProjectSettingsEditorOptions = {
  members: Member[];
  onSaveProject: (project: Project) => void;
  project: Project;
  team?: Team;
  teams: Team[];
};

/** 案件設定のdraft、所属チーム変更、要員権限、保存時の正規化を管理します。 */
export function useProjectSettingsEditor({
  members,
  onSaveProject,
  project,
  team,
  teams,
}: UseProjectSettingsEditorOptions) {
  const [draft, setDraft] = useState(() => createDraft(project, team));

  useEffect(() => setDraft(createDraft(project, team)), [project, team]);

  const selectedTeam = teams.find((item) => item.id === draft.teamId);
  const assignableMembers = members.filter((member) => selectedTeam?.memberIds.includes(member.id));
  const activeMemberCount = assignableMembers.filter(
    (member) => draft.memberIds.includes(member.id) && isMemberActive(member),
  ).length;
  const invalidRange = draft.rangeStart > draft.rangeEnd;

  function updateDraft(patch: Partial<ProjectSettingsDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return {
    activeMemberCount,
    assignableMembers,
    changeMemberRole: (memberId: string, role: ProjectRole) =>
      updateDraft({
        memberships: [
          ...draft.memberships.filter((item) => item.memberId !== memberId),
          { memberId, role },
        ],
      }),
    changeTeam: (teamId: string) => {
      const nextMemberIds = teams.find((item) => item.id === teamId)?.memberIds ?? [];
      updateDraft({
        memberIds: nextMemberIds,
        memberships: nextMemberIds.map((memberId) => ({ memberId, role: "member" })),
        teamId,
      });
    },
    draft,
    invalidRange,
    milestoneOutside:
      draft.milestoneDate < draft.rangeStart || draft.milestoneDate > draft.rangeEnd,
    save: () => {
      if (invalidRange) {
        return;
      }
      const availableMemberIds = new Set(selectedTeam?.memberIds ?? team?.memberIds);
      onSaveProject({
        ...project,
        lifecycleStatus: draft.lifecycleStatus,
        memberIds: draft.memberIds.filter((memberId) => availableMemberIds.has(memberId)),
        memberships: draft.memberships.filter(
          (item) =>
            draft.memberIds.includes(item.memberId) && availableMemberIds.has(item.memberId),
        ),
        name: draft.name.trim() || project.name,
        nextMilestone: {
          date: draft.milestoneDate,
          title: draft.milestoneTitle.trim() || "次のマイルストーン",
        },
        projectNo: draft.projectNo.trim() || null,
        rangeEnd: draft.rangeEnd,
        rangeStart: draft.rangeStart,
        teamId: draft.teamId || null,
        workspace: draft.workspace.trim() || project.workspace,
      });
    },
    toggleMember: (memberId: string) => {
      const enabled = !draft.memberIds.includes(memberId);
      updateDraft({
        memberIds: enabled
          ? [...draft.memberIds, memberId]
          : draft.memberIds.filter((id) => id !== memberId),
        memberships: enabled
          ? [
              ...draft.memberships.filter((item) => item.memberId !== memberId),
              { memberId, role: "member" },
            ]
          : draft.memberships.filter((item) => item.memberId !== memberId),
      });
    },
    updateDraft,
  };
}

function createDraft(project: Project, team?: Team): ProjectSettingsDraft {
  const memberIds = project.memberIds ?? team?.memberIds ?? [];
  return {
    lifecycleStatus: getProjectLifecycleStatus(project),
    memberIds,
    memberships: project.memberships ?? memberIds.map((memberId) => ({ memberId, role: "member" })),
    milestoneDate: project.nextMilestone.date,
    milestoneTitle: project.nextMilestone.title,
    name: project.name,
    projectNo: project.projectNo ?? "",
    rangeEnd: project.rangeEnd,
    rangeStart: project.rangeStart,
    teamId: project.teamId ?? "",
    workspace: project.workspace,
  };
}
