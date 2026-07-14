import { useEffect, useMemo, useState } from "react";

import type { CalendarDefinition, Member, Team } from "../../../types/schedule";
import type { MasterSettingsSection } from "../model/masterSettings";
import { AuditLogSection } from "./settings/AuditLogSection";
import { CalendarSettingsSection } from "./settings/CalendarSettingsSection";
import { MasterSettingsNavigation } from "./settings/MasterSettingsNavigation";
import { MemberSettingsSection } from "./settings/MemberSettingsSection";
import { PjmgtIntegrationSection } from "./settings/PjmgtIntegrationSection";
import { TeamSettingsSection } from "./settings/TeamSettingsSection";

type MasterSettingsPageProps = {
  activeTeamProjectCount: number;
  baseDate: string;
  calendar: CalendarDefinition;
  canManageMembers: boolean;
  memberAssignmentCounts: Record<string, number>;
  members: Member[];
  onCreateMember: (member: Member, teamId: string | null) => void;
  onCreateTeam: (team: Team) => void;
  onSaveCalendar: (calendar: CalendarDefinition) => void;
  onSaveMember: (member: Member) => void;
  onSaveTeam: (team: Team) => void;
  onSyncComplete: () => void;
  onToggleTeamMember: (teamId: string, memberId: string, enabled: boolean) => void;
  onUpdateMemberLifecycle: (memberId: string, status: "active" | "inactive") => void;
  team: Team;
  teams: Team[];
};

/** 管理設定のカテゴリ選択と各設定featureの構成だけを担うページです。 */
export function MasterSettingsPage({
  activeTeamProjectCount,
  baseDate,
  calendar,
  canManageMembers,
  memberAssignmentCounts,
  members,
  onCreateMember,
  onCreateTeam,
  onSaveCalendar,
  onSaveMember,
  onSaveTeam,
  onSyncComplete,
  onToggleTeamMember,
  onUpdateMemberLifecycle,
  team,
  teams,
}: MasterSettingsPageProps) {
  const [activeSection, setActiveSection] = useState<MasterSettingsSection>("teams");
  const [editingTeamId, setEditingTeamId] = useState(team.id);
  const selectedTeam = useMemo(
    () => teams.find((candidate) => candidate.id === editingTeamId) ?? team,
    [editingTeamId, team, teams],
  );

  useEffect(() => setEditingTeamId(team.id), [team.id]);
  useEffect(() => {
    if (!canManageMembers && (activeSection === "members" || activeSection === "pjmgt" || activeSection === "audit")) {
      setActiveSection("teams");
    }
  }, [activeSection, canManageMembers]);

  return (
    <section className="master-settings-page" aria-label="マスタ管理" data-tour="master-settings">
      <div className="master-settings-page-header">
        <div>
          <span>{selectedTeam.name}</span>
          <h2>管理設定</h2>
        </div>
        <strong>
          {canManageMembers ? "チーム / メンバー / カレンダー / PJMGT連携 / 監査ログ" : "チーム / カレンダー"}
        </strong>
      </div>

      <div className="master-settings-layout">
        <MasterSettingsNavigation
          activeSection={activeSection}
          canManageMembers={canManageMembers}
          onChange={setActiveSection}
        />

        <div className="master-settings-content">
          <TeamSettingsSection
            active={activeSection === "teams"}
            members={members}
            onCreateTeam={onCreateTeam}
            onSaveTeam={onSaveTeam}
            onSelectTeam={setEditingTeamId}
            onToggleTeamMember={onToggleTeamMember}
            selectedTeam={selectedTeam}
            teams={teams}
          />
          {canManageMembers ? (
            <MemberSettingsSection
              active={activeSection === "members"}
              defaultTeamId={team.id}
              memberAssignmentCounts={memberAssignmentCounts}
              members={members}
              onCreateMember={onCreateMember}
              onSaveMember={onSaveMember}
              onUpdateMemberLifecycle={onUpdateMemberLifecycle}
              teams={teams}
            />
          ) : null}
          <CalendarSettingsSection
            active={activeSection === "calendar"}
            activeTeamProjectCount={activeTeamProjectCount}
            baseDate={baseDate}
            calendar={calendar}
            onSaveCalendar={onSaveCalendar}
            team={team}
          />
          {canManageMembers ? <PjmgtIntegrationSection active={activeSection === "pjmgt"} onSyncComplete={onSyncComplete} /> : null}
          {canManageMembers ? <AuditLogSection active={activeSection === "audit"} /> : null}
        </div>
      </div>
    </section>
  );
}
