import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { type CSSProperties, useEffect, useMemo, useState } from "react";

import { type AuditLog, listAuditLogs } from "../../../data/administrationRepository";
import {
  AuthRequestError,
  type SaveMemberAccountInput,
  authRepository,
} from "../../../data/authRepository";
import { fetchJapanesePublicHolidays, mergeCalendarHolidays } from "../../../data/publicHolidays";
import { isMemberActive } from "../../../lib/members";
import type { CalendarDefinition, CalendarHoliday, Member, Team } from "../../../types/schedule";
import { ColorSwatches, getNextMemberColor } from "./settings/ColorSwatches";
import { MemberAccountTable } from "./settings/MemberAccountTable";

type MasterSettingsSection = "teams" | "members" | "calendar" | "audit";

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
  onToggleTeamMember: (teamId: string, memberId: string, enabled: boolean) => void;
  onUpdateMemberLifecycle: (memberId: string, status: "active" | "inactive") => void;
  team: Team;
  teams: Team[];
};

const weekdays = [
  { label: "日", value: 0 },
  { label: "月", value: 1 },
  { label: "火", value: 2 },
  { label: "水", value: 3 },
  { label: "木", value: 4 },
  { label: "金", value: 5 },
  { label: "土", value: 6 },
];

/** チーム、メンバー、カレンダーなど全体マスタを管理するページです。 */
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
  onToggleTeamMember,
  onUpdateMemberLifecycle,
  team,
  teams,
}: MasterSettingsPageProps) {
  const [activeSection, setActiveSection] = useState<MasterSettingsSection>("teams");
  const [editingTeamId, setEditingTeamId] = useState(team.id);
  const selectedTeam = teams.find((item) => item.id === editingTeamId) ?? team;
  const [teamName, setTeamName] = useState(selectedTeam.name);
  const [teamCode, setTeamCode] = useState(selectedTeam.code);
  const [teamDescription, setTeamDescription] = useState(selectedTeam.description);
  const [newTeamName, setNewTeamName] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("SE");
  const [newMemberInitials, setNewMemberInitials] = useState("");
  const [newMemberColor, setNewMemberColor] = useState(getNextMemberColor(members.length));
  const [newMemberTeamId, setNewMemberTeamId] = useState<string | null>(team.id);
  const [lifecycleConfirmMemberId, setLifecycleConfirmMemberId] = useState<string | null>(null);
  const [calendarName, setCalendarName] = useState(calendar.name);
  const [workWeek, setWorkWeek] = useState<number[]>(calendar.workWeek);
  const [holidays, setHolidays] = useState<CalendarHoliday[]>(calendar.holidays);
  const [holidayDate, setHolidayDate] = useState(calendar.holidays[0]?.date ?? baseDate);
  const [holidayName, setHolidayName] = useState("会社休日");
  const [holidayImporting, setHolidayImporting] = useState(false);
  const [holidayImportMessage, setHolidayImportMessage] = useState("");
  const [accountMembers, setAccountMembers] = useState<Member[]>([]);
  const [accountMembersLoading, setAccountMembersLoading] = useState(false);
  const [accountMembersError, setAccountMembersError] = useState<string | null>(null);
  const [savingUserRowKey, setSavingUserRowKey] = useState<string | null>(null);
  const [temporaryPasswords, setTemporaryPasswords] = useState<Record<string, string>>({});
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    setEditingTeamId(team.id);
    setNewMemberTeamId(team.id);
  }, [team.id]);

  useEffect(() => {
    if (!canManageMembers && activeSection === "members") {
      setActiveSection("teams");
    }
  }, [activeSection, canManageMembers]);

  useEffect(() => {
    setTeamName(selectedTeam.name);
    setTeamCode(selectedTeam.code);
    setTeamDescription(selectedTeam.description);
  }, [selectedTeam]);

  useEffect(() => {
    setCalendarName(calendar.name);
    setWorkWeek(calendar.workWeek);
    setHolidays(calendar.holidays);
    setHolidayDate(calendar.holidays[0]?.date ?? baseDate);
    setHolidayName("会社休日");
    setHolidayImportMessage("");
  }, [baseDate, calendar]);

  const selectedTeamActiveMemberCount = members.filter(
    (member) => selectedTeam.memberIds.includes(member.id) && isMemberActive(member),
  ).length;
  const sortedHolidays = useMemo(
    () => [...holidays].toSorted((a, b) => a.date.localeCompare(b.date)),
    [holidays],
  );
  const membersWithAccountSettings = useMemo(() => {
    const accountMembersById = new Map(accountMembers.map((member) => [member.id, member]));
    return members.map((member) =>
      mergeMemberAccountFields(member, accountMembersById.get(member.id)),
    );
  }, [accountMembers, members]);

  useEffect(() => {
    if (activeSection !== "members") {
      return;
    }
    void loadMemberAccounts();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "audit" || !canManageMembers) {
      return;
    }
    setAuditLoading(true);
    listAuditLogs()
      .then(setAuditLogs)
      .catch(() => setAuditLogs([]))
      .finally(() => setAuditLoading(false));
  }, [activeSection, canManageMembers]);

  function saveTeam() {
    onSaveTeam({
      ...selectedTeam,
      code: teamCode.trim().slice(0, 2) || selectedTeam.code,
      description: teamDescription.trim(),
      name: teamName.trim() || selectedTeam.name,
    });
  }

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
    setEditingTeamId(id);
    setNewTeamName("");
  }

  function createMember() {
    const trimmedName = newMemberName.trim();
    const trimmedEmail = newMemberEmail.trim();
    if (!trimmedName || !trimmedEmail) {
      return;
    }
    const id = `member-${Date.now().toString(36)}`;
    const initials =
      newMemberInitials.trim().toUpperCase().slice(0, 3) || trimmedName.slice(0, 2).toUpperCase();
    onCreateMember(
      {
        capacityHours: 40,
        color: newMemberColor,
        id,
        initials,
        loginEmail: trimmedEmail,
        loginEnabled: false,
        name: trimmedName,
        permissionRole: "user",
        role: newMemberRole.trim() || "SE",
        status: "active",
      },
      newMemberTeamId,
    );
    setNewMemberName("");
    setNewMemberEmail("");
    setNewMemberInitials("");
    setNewMemberRole("SE");
    setNewMemberColor(getNextMemberColor(members.length + 1));
  }

  function toggleWeekday(weekday: number) {
    setWorkWeek((current) =>
      current.includes(weekday)
        ? current.filter((day) => day !== weekday)
        : [...current, weekday].toSorted((a, b) => a - b),
    );
  }

  function addHoliday() {
    if (!holidayDate) {
      return;
    }
    const name = holidayName.trim() || "会社休日";
    setHolidays((current) =>
      [
        ...current.filter((holiday) => holiday.date !== holidayDate),
        { date: holidayDate, name },
      ].sort((a, b) => a.date.localeCompare(b.date)),
    );
    setHolidayName("会社休日");
  }

  function removeHoliday(target: CalendarHoliday) {
    setHolidays((current) =>
      current.filter((holiday) => holiday.date !== target.date || holiday.name !== target.name),
    );
  }

  function saveCalendar() {
    onSaveCalendar({
      ...calendar,
      holidays: sortedHolidays,
      name: calendarName.trim() || calendar.name,
      workWeek,
    });
  }

  async function importJapanesePublicHolidays() {
    const parsedYear = Number(baseDate.slice(0, 4));
    const baseYear =
      Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : new Date().getFullYear();
    const from = `${baseYear}-01-01`;
    const to = `${baseYear + 1}-12-31`;

    setHolidayImporting(true);
    setHolidayImportMessage("");
    try {
      const imported = await fetchJapanesePublicHolidays(from, to);
      const result = mergeCalendarHolidays(holidays, imported);
      setHolidays(result.holidays);
      setHolidayImportMessage(
        `国民の祝日 ${result.importedCount}件を取得 / ${result.addedCount}件を追加`,
      );
    } catch (error) {
      setHolidayImportMessage(
        error instanceof Error ? error.message : "祝日データを取得できませんでした。",
      );
    } finally {
      setHolidayImporting(false);
    }
  }

  async function loadMemberAccounts() {
    setAccountMembersLoading(true);
    setAccountMembersError(null);
    try {
      setAccountMembers(await authRepository.listMembersWithAccounts());
    } catch (error) {
      setAccountMembersError(formatAuthAdminError(error));
    } finally {
      setAccountMembersLoading(false);
    }
  }

  async function saveMemberAccount(
    memberId: string,
    input: SaveMemberAccountInput,
    rowKey: string,
  ) {
    setSavingUserRowKey(rowKey);
    setAccountMembersError(null);
    try {
      const result = await authRepository.saveMemberAccount(memberId, input);
      setAccountMembers((current) => upsertMemberAccount(current, result.member));
      if (result.temporaryPassword) {
        setTemporaryPasswords((current) => ({
          ...current,
          [result.member.id]: result.temporaryPassword ?? "",
        }));
      }
    } catch (error) {
      setAccountMembersError(formatAuthAdminError(error));
    } finally {
      setSavingUserRowKey(null);
    }
  }

  async function resetMemberPassword(memberId: string, password: string, rowKey: string) {
    setSavingUserRowKey(rowKey);
    setAccountMembersError(null);
    try {
      const result = await authRepository.resetMemberPassword(memberId, {
        password: password || null,
        passwordResetRequired: true,
      });
      setAccountMembers((current) => upsertMemberAccount(current, result.member));
      if (result.temporaryPassword) {
        setTemporaryPasswords((current) => ({
          ...current,
          [result.member.id]: result.temporaryPassword ?? "",
        }));
      }
    } catch (error) {
      setAccountMembersError(formatAuthAdminError(error));
    } finally {
      setSavingUserRowKey(null);
    }
  }

  return (
    <section className="master-settings-page" aria-label="マスタ管理" data-tour="master-settings">
      <div className="master-settings-page-header">
        <div>
          <span>{selectedTeam.name}</span>
          <h2>管理設定</h2>
        </div>
        <strong>
          {canManageMembers ? "チーム / メンバー / カレンダー / 監査ログ" : "チーム / カレンダー"}
        </strong>
      </div>

      <div className="master-settings-layout">
        <nav
          className="settings-section-tabs"
          aria-label="管理設定カテゴリ"
          data-tour="settings-tabs"
        >
          <button
            className={activeSection === "teams" ? "active" : ""}
            data-tour="settings-teams"
            onClick={() => setActiveSection("teams")}
            type="button"
          >
            チーム
          </button>
          {canManageMembers ? (
            <button
              className={activeSection === "members" ? "active" : ""}
              data-tour="settings-members"
              onClick={() => setActiveSection("members")}
              type="button"
            >
              メンバー
            </button>
          ) : null}
          <button
            className={activeSection === "calendar" ? "active" : ""}
            data-tour="settings-calendar"
            onClick={() => setActiveSection("calendar")}
            type="button"
          >
            カレンダー
          </button>
          {canManageMembers ? (
            <button
              className={activeSection === "audit" ? "active" : ""}
              data-tour="settings-audit"
              onClick={() => setActiveSection("audit")}
              type="button"
            >
              監査ログ
            </button>
          ) : null}
        </nav>

        <div className="master-settings-content">
          {activeSection === "teams" ? (
            <>
              <div className="master-settings-summary">
                <div>
                  <span>チーム</span>
                  <strong>{teams.length}件</strong>
                </div>
                <div>
                  <span>所属メンバー</span>
                  <strong>{selectedTeam.memberIds.length}名</strong>
                </div>
                <div>
                  <span>有効メンバー</span>
                  <strong>{selectedTeamActiveMemberCount}名</strong>
                </div>
              </div>

              <div className="team-master-layout">
                <section className="settings-card team-list-card">
                  <div className="settings-card-heading">
                    <strong>チーム一覧</strong>
                    <span>{teams.length}件</span>
                  </div>
                  <div className="team-master-list">
                    {teams.map((item) => {
                      const activeCount = members.filter(
                        (member) => item.memberIds.includes(member.id) && isMemberActive(member),
                      ).length;
                      return (
                        <button
                          aria-current={item.id === selectedTeam.id ? "true" : undefined}
                          className={
                            item.id === selectedTeam.id
                              ? "team-master-row active"
                              : "team-master-row"
                          }
                          key={item.id}
                          onClick={() => setEditingTeamId(item.id)}
                          type="button"
                        >
                          <span>{item.code}</span>
                          <div>
                            <strong>{item.name}</strong>
                            <small>{item.description || "説明なし"}</small>
                          </div>
                          <em>{activeCount}名</em>
                        </button>
                      );
                    })}
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
                      <input
                        onChange={(event) => setTeamName(event.target.value)}
                        value={teamName}
                      />
                    </label>
                    <div className="two-col">
                      <label>
                        チーム記号
                        <input
                          maxLength={2}
                          onChange={(event) => setTeamCode(event.target.value)}
                          value={teamCode}
                        />
                      </label>
                      <label>
                        説明
                        <input
                          onChange={(event) => setTeamDescription(event.target.value)}
                          value={teamDescription}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="settings-card-heading team-members-heading">
                    <strong>所属メンバー</strong>
                    <span>
                      有効{selectedTeamActiveMemberCount}名 / 全{selectedTeam.memberIds.length}名
                    </span>
                  </div>
                  <div className="team-member-checks">
                    {members.map((member) => (
                      <label className={isMemberActive(member) ? "" : "inactive"} key={member.id}>
                        <input
                          checked={selectedTeam.memberIds.includes(member.id)}
                          onChange={(event) =>
                            onToggleTeamMember(selectedTeam.id, member.id, event.target.checked)
                          }
                          type="checkbox"
                        />
                        <span style={{ "--avatar-color": member.color } as CSSProperties}>
                          {member.initials}
                        </span>
                        <strong>{member.name}</strong>
                        <small>
                          {member.role}
                          {!isMemberActive(member) ? " / 休止中" : ""}
                        </small>
                        {selectedTeam.memberIds.includes(member.id) ? (
                          <select
                            aria-label={`${member.name}のチーム権限`}
                            onChange={(event) =>
                              onSaveTeam({
                                ...selectedTeam,
                                memberships: [
                                  ...(
                                    selectedTeam.memberships ??
                                    selectedTeam.memberIds.map((memberId) => ({
                                      memberId,
                                      role: "member" as const,
                                    }))
                                  ).filter((item) => item.memberId !== member.id),
                                  {
                                    memberId: member.id,
                                    role: event.target.value as "manager" | "member",
                                  },
                                ],
                              })
                            }
                            value={
                              (selectedTeam.memberships ?? []).find(
                                (item) => item.memberId === member.id,
                              )?.role ?? "member"
                            }
                          >
                            <option value="member">メンバー</option>
                            <option value="manager">チーム管理者</option>
                          </select>
                        ) : null}
                      </label>
                    ))}
                  </div>
                </section>
              </div>

              <div className="settings-actions">
                <button className="primary-button" onClick={saveTeam} type="button">
                  チームを保存
                </button>
              </div>
            </>
          ) : null}

          {canManageMembers && activeSection === "members" ? (
            <>
              <section className="settings-card member-create-card">
                <div className="settings-card-heading">
                  <strong>メンバー追加</strong>
                  <span>未所属のまま追加できます</span>
                </div>
                <div className="member-create-grid master-member-create-grid">
                  <input
                    aria-label="新規メンバー名"
                    onChange={(event) => setNewMemberName(event.target.value)}
                    placeholder="氏名"
                    value={newMemberName}
                  />
                  <input
                    aria-label="新規メンバーメールアドレス"
                    onChange={(event) => setNewMemberEmail(event.target.value)}
                    placeholder="メールアドレス（必須）"
                    type="email"
                    value={newMemberEmail}
                  />
                  <input
                    aria-label="新規メンバー略称"
                    onChange={(event) => setNewMemberInitials(event.target.value)}
                    placeholder="略称"
                    value={newMemberInitials}
                  />
                  <input
                    aria-label="新規メンバーロール"
                    onChange={(event) => setNewMemberRole(event.target.value)}
                    placeholder="ロール"
                    value={newMemberRole}
                  />
                  <select
                    aria-label="新規メンバー所属"
                    onChange={(event) => setNewMemberTeamId(event.target.value || null)}
                    value={newMemberTeamId ?? ""}
                  >
                    <option value="">未所属</option>
                    {teams.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="primary-button"
                    disabled={!newMemberName.trim() || !newMemberEmail.trim()}
                    onClick={createMember}
                    type="button"
                  >
                    <PlusIcon />
                    追加
                  </button>
                </div>
                <ColorSwatches
                  label="新規メンバー色"
                  onChange={setNewMemberColor}
                  value={newMemberColor}
                />
              </section>

              <MemberAccountTable
                error={accountMembersError}
                lifecycleConfirmMemberId={lifecycleConfirmMemberId}
                loading={accountMembersLoading}
                memberAssignmentCounts={memberAssignmentCounts}
                members={membersWithAccountSettings}
                onLifecycleConfirm={setLifecycleConfirmMemberId}
                onRefresh={loadMemberAccounts}
                onResetPassword={resetMemberPassword}
                onSaveAccount={saveMemberAccount}
                onSaveMember={onSaveMember}
                onUpdateMemberLifecycle={onUpdateMemberLifecycle}
                savingRowKey={savingUserRowKey}
                teams={teams}
                temporaryPasswords={temporaryPasswords}
              />
            </>
          ) : null}

          {activeSection === "calendar" ? (
            <>
              <div className="master-settings-summary">
                <div>
                  <span>適用先</span>
                  <strong>{team.name}</strong>
                </div>
                <div>
                  <span>対象案件</span>
                  <strong>{activeTeamProjectCount}件</strong>
                </div>
                <div>
                  <span>休日</span>
                  <strong>{sortedHolidays.length}日</strong>
                </div>
              </div>

              <div className="settings-fields">
                <label>
                  カレンダー名
                  <input
                    onChange={(event) => setCalendarName(event.target.value)}
                    value={calendarName}
                  />
                </label>
              </div>

              <section className="settings-card">
                <div className="settings-card-heading">
                  <strong>稼働曜日</strong>
                  <span>{workWeek.length}日/週</span>
                </div>
                <div className="weekday-toggle-grid" aria-label="稼働曜日">
                  {weekdays.map((weekday) => (
                    <button
                      className={workWeek.includes(weekday.value) ? "selected" : ""}
                      key={weekday.value}
                      onClick={() => toggleWeekday(weekday.value)}
                      type="button"
                    >
                      {weekday.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="settings-card">
                <div className="settings-card-heading">
                  <strong>会社休日</strong>
                  <span>{sortedHolidays.length}日</span>
                </div>
                <button
                  className="subtle-action full"
                  disabled={holidayImporting}
                  onClick={importJapanesePublicHolidays}
                  type="button"
                >
                  {holidayImporting ? "祝日を取得中" : "国民の祝日を取込"}
                </button>
                {holidayImportMessage ? (
                  <p className="holiday-import-message">{holidayImportMessage}</p>
                ) : null}
                <div className="calendar-holiday-create">
                  <input
                    aria-label="休日"
                    onChange={(event) => setHolidayDate(event.target.value)}
                    onInput={(event) => setHolidayDate(event.currentTarget.value)}
                    type="date"
                    value={holidayDate}
                  />
                  <input
                    aria-label="休日名"
                    onChange={(event) => setHolidayName(event.target.value)}
                    placeholder="休日名"
                    value={holidayName}
                  />
                  <button
                    className="subtle-action"
                    disabled={!holidayDate}
                    onClick={addHoliday}
                    type="button"
                  >
                    <PlusIcon />
                    追加
                  </button>
                </div>
                <div className="calendar-holiday-list">
                  {sortedHolidays.map((holiday) => (
                    <span key={`${holiday.date}-${holiday.name}`}>
                      <strong>{formatHolidayDate(holiday.date)}</strong>
                      <small>{holiday.name}</small>
                      <button
                        aria-label={`${holiday.date} ${holiday.name} を削除`}
                        onClick={() => removeHoliday(holiday)}
                        type="button"
                      >
                        <TrashIcon />
                      </button>
                    </span>
                  ))}
                </div>
              </section>

              <div className="settings-actions">
                <button
                  className="primary-button"
                  disabled={workWeek.length === 0}
                  onClick={saveCalendar}
                  type="button"
                >
                  カレンダーを保存
                </button>
              </div>
            </>
          ) : null}

          {canManageMembers && activeSection === "audit" ? (
            <section className="settings-card audit-log-card">
              <div className="settings-card-heading">
                <strong>監査ログ</strong>
                <span>{auditLoading ? "読み込み中" : `直近${auditLogs.length}件`}</span>
              </div>
              <div className="audit-log-table-wrap">
                <table className="audit-log-table">
                  <thead>
                    <tr>
                      <th>日時</th>
                      <th>操作者</th>
                      <th>操作</th>
                      <th>対象</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatAuditDate(log.createdAt)}</td>
                        <td>{log.userName}</td>
                        <td>{auditActionLabels[log.action] ?? log.action}</td>
                        <td>{formatAuditTarget(log)}</td>
                        <td>{log.ipAddress ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!auditLoading && auditLogs.length === 0 ? (
                  <p className="settings-empty">監査ログはまだありません。</p>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const auditActionLabels: Record<string, string> = {
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

function formatAuditDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ja-JP");
}

function formatAuditTarget(log: AuditLog) {
  const type = log.targetType ?? log.scopeType;
  const id = log.targetId ?? log.scopeId;
  return id ? `${type} / ${id}` : type;
}

function formatHolidayDate(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function mergeMemberAccountFields(member: Member, accountMember?: Member): Member {
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

function upsertMemberAccount(current: Member[], updated: Member) {
  return current.some((member) => member.id === updated.id)
    ? current.map((member) => (member.id === updated.id ? updated : member))
    : [...current, updated];
}

function formatAuthAdminError(error: unknown) {
  if (error instanceof AuthRequestError) {
    if (error.status === 403) {
      return "メンバー管理は管理者権限が必要です。";
    }
    if (error.status === 401) {
      return "ログイン状態を確認できませんでした。再ログインしてください。";
    }
    try {
      const parsed = JSON.parse(error.message) as { message?: string };
      if (parsed.message) {
        return parsed.message;
      }
    } catch {
      return error.message;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "メンバー管理情報を取得できませんでした。";
}
