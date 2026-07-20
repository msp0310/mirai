import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { type CSSProperties, useEffect, useState } from "react";

import { getActiveMembers } from "../../../../lib/members";
import type { Member, Team } from "../../../../types/schedule";
import { getActiveTeamMemberCount, updateTeamMembershipRole } from "../../model/masterSettings";

type TeamSettingsSectionProps = {
  active: boolean;
  canDeleteTeam: boolean;
  members: Member[];
  onCreateTeam: (team: Team) => void;
  onDeleteTeam: (teamId: string) => Promise<boolean>;
  onSaveTeam: (team: Team) => void;
  onSelectTeam: (teamId: string) => void;
  onToggleTeamMember: (teamId: string, memberId: string, enabled: boolean) => void;
  selectedTeam: Team;
  teams: Team[];
};

/** チーム一覧、基本情報、所属メンバーを一つの編集単位として扱います。 */
export function TeamSettingsSection({
  active,
  canDeleteTeam,
  members,
  onCreateTeam,
  onDeleteTeam,
  onSaveTeam,
  onSelectTeam,
  onToggleTeamMember,
  selectedTeam,
  teams,
}: TeamSettingsSectionProps) {
  const [name, setName] = useState(selectedTeam.name);
  const [code, setCode] = useState(selectedTeam.code);
  const [description, setDescription] = useState(selectedTeam.description);
  const [newTeamName, setNewTeamName] = useState("");
  const activeMembers = getActiveMembers(members);
  const activeMemberCount = getActiveTeamMemberCount(selectedTeam, members);

  useEffect(() => {
    setName(selectedTeam.name);
    setCode(selectedTeam.code);
    setDescription(selectedTeam.description);
  }, [selectedTeam.code, selectedTeam.description, selectedTeam.id, selectedTeam.name]);

  function createTeam() {
    const trimmedName = newTeamName.trim();
    if (!trimmedName) {
      return;
    }
    const id = `team-${Date.now().toString(36)}`;
    onCreateTeam({
      code: trimmedName.slice(0, 1),
      description: "新しいチーム",
      id,
      memberIds: [],
      name: trimmedName,
    });
    onSelectTeam(id);
    setNewTeamName("");
  }

  function saveTeam() {
    onSaveTeam({
      ...selectedTeam,
      code: code.trim().slice(0, 2) || selectedTeam.code,
      description: description.trim(),
      name: name.trim() || selectedTeam.name,
    });
  }

  async function deleteTeam() {
    if (!window.confirm(`チーム「${selectedTeam.name}」を削除しますか？\n所属プロジェクトがあるチームは削除できません。`)) {
      return;
    }
    await onDeleteTeam(selectedTeam.id);
  }

  return (
    <div hidden={!active}>
      <div className="master-settings-summary">
        <div>
          <span>チーム</span>
          <strong>{teams.length}件</strong>
        </div>
        <div>
          <span>所属メンバー</span>
          <strong>{activeMemberCount}名</strong>
        </div>
        <div>
          <span>登録メンバー</span>
          <strong>{activeMembers.length}名</strong>
        </div>
      </div>

      <div className="team-master-layout">
        <section className="settings-card team-list-card">
          <div className="settings-card-heading">
            <strong>チーム一覧</strong>
            <span>{teams.length}件</span>
          </div>
          <div className="team-master-list">
            {teams.map((team) => (
              <button
                aria-current={team.id === selectedTeam.id ? "true" : undefined}
                className={
                  team.id === selectedTeam.id ? "team-master-row active" : "team-master-row"
                }
                key={team.id}
                onClick={() => onSelectTeam(team.id)}
                type="button"
              >
                <span>{team.code}</span>
                <div>
                  <strong>{team.name}</strong>
                  <small>{team.description || "説明なし"}</small>
                </div>
                <em>{getActiveTeamMemberCount(team, members)}名</em>
              </button>
            ))}
          </div>
          <div className="team-create-control">
            <input
              aria-label="新規チーム名"
              onChange={(event) => setNewTeamName(event.target.value)}
              placeholder="新しいチーム名"
              value={newTeamName}
            />
            <button onClick={createTeam} type="button">
              <PlusIcon />
              追加
            </button>
          </div>
        </section>

        <section className="settings-card team-edit-card">
          <div className="settings-card-heading">
            <strong>チーム編集</strong>
            <span>{selectedTeam.name}</span>
          </div>
          <div className="settings-fields">
            <label>
              チーム名
              <input onChange={(event) => setName(event.target.value)} value={name} />
            </label>
            <div className="two-col">
              <label>
                チーム記号
                <input
                  maxLength={2}
                  onChange={(event) => setCode(event.target.value)}
                  value={code}
                />
              </label>
              <label>
                説明
                <input
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                />
              </label>
            </div>
          </div>

          <div className="settings-card-heading team-members-heading">
            <strong>所属メンバー</strong>
            <span>{activeMemberCount}名</span>
          </div>
          <div className="team-member-checks">
            {activeMembers.map((member) => {
              const assigned = selectedTeam.memberIds.includes(member.id);
              return (
                <label key={member.id}>
                  <input
                    checked={assigned}
                    onChange={(event) =>
                      onToggleTeamMember(selectedTeam.id, member.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span style={{ "--avatar-color": member.color } as CSSProperties}>
                    {member.initials}
                  </span>
                  <strong>{member.name}</strong>
                  <small>{member.role}</small>
                  {assigned ? (
                    <select
                      aria-label={`${member.name}のチーム権限`}
                      onChange={(event) =>
                        onSaveTeam(
                          updateTeamMembershipRole(
                            selectedTeam,
                            member.id,
                            event.target.value as "manager" | "member",
                          ),
                        )
                      }
                      value={
                        (selectedTeam.memberships ?? []).find(
                          (membership) => membership.memberId === member.id,
                        )?.role ?? "member"
                      }
                    >
                      <option value="member">メンバー</option>
                      <option value="manager">チーム管理者</option>
                    </select>
                  ) : null}
                </label>
              );
            })}
          </div>
        </section>
      </div>

      <div className="settings-actions">
        {canDeleteTeam ? (
          <button className="danger-button" onClick={deleteTeam} type="button">
            <TrashIcon />
            チームを削除
          </button>
        ) : null}
        <button className="primary-button" onClick={saveTeam} type="button">
          チームを保存
        </button>
      </div>
    </div>
  );
}
