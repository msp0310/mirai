import { type CSSProperties, useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  CheckIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserMinusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { SaveMemberAccountInput } from "../../../../data/authRepository";
import { getMemberStatusLabel, isMemberActive } from "../../../../lib/members";
import type { Member, MemberAvailabilityOverride, Team } from "../../../../types/schedule";
import { ColorSwatches } from "./ColorSwatches";

type MemberAccountTableProps = {
  error: string | null;
  lifecycleConfirmMemberId: string | null;
  loading: boolean;
  memberAssignmentCounts: Record<string, number>;
  members: Member[];
  onLifecycleConfirm: (memberId: string | null) => void;
  onRefresh: () => void;
  onResetPassword: (memberId: string, password: string, rowKey: string) => Promise<void>;
  onSaveAccount: (memberId: string, input: SaveMemberAccountInput, rowKey: string) => Promise<void>;
  onSaveMember: (member: Member) => void;
  onUpdateMemberLifecycle: (memberId: string, status: "active" | "inactive") => void;
  savingRowKey: string | null;
  teams: Team[];
  temporaryPasswords: Record<string, string>;
};

type MemberAccountFilter = "all" | "loginEnabled" | "missing" | "admin" | "inactive";

type MemberAccountRowProps = {
  assignmentCount: number;
  confirmingLifecycle: boolean;
  member: Member;
  memberTeams: Team[];
  onLifecycleConfirm: (memberId: string | null) => void;
  onResetPassword: (memberId: string, password: string, rowKey: string) => Promise<void>;
  onSaveAccount: (memberId: string, input: SaveMemberAccountInput, rowKey: string) => Promise<void>;
  onSaveMember: (member: Member) => void;
  onUpdateMemberLifecycle: (memberId: string, status: "active" | "inactive") => void;
  saving: boolean;
  temporaryPassword: string | null;
};

const roleOptions = [
  { label: "管理者", value: "admin" },
  { label: "マネージャー", value: "manager" },
  { label: "メンバー", value: "member" },
];

/** メンバーのログイン情報と管理者権限を一覧で管理します。 */
export function MemberAccountTable({
  error,
  lifecycleConfirmMemberId,
  loading,
  memberAssignmentCounts,
  members,
  onLifecycleConfirm,
  onRefresh,
  onResetPassword,
  onSaveAccount,
  onSaveMember,
  onUpdateMemberLifecycle,
  savingRowKey,
  teams,
  temporaryPasswords,
}: MemberAccountTableProps) {
  const [filter, setFilter] = useState<MemberAccountFilter>("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const baseRows = useMemo(
    () =>
      members
        .map((member) => ({
          member,
          memberTeams: teams.filter((team) => team.memberIds.includes(member.id)),
        }))
        .sort((left, right) => {
          const activeDelta =
            Number(isMemberActive(right.member)) - Number(isMemberActive(left.member));
          return activeDelta || left.member.name.localeCompare(right.member.name, "ja");
        }),
    [members, teams],
  );
  const filteredRows = useMemo(
    () =>
      baseRows.filter(({ member, memberTeams }) => {
        if (!matchesAccountFilter(filter, member)) return false;
        if (!normalizedQuery) return true;
        return [
          member.name,
          member.initials,
          member.role,
          getMemberStatusLabel(member),
          ...memberTeams.map((team) => team.name),
          member.loginEmail ?? "",
          roleLabel(member.permissionRole ?? ""),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [baseRows, filter, normalizedQuery],
  );
  const activeMemberCount = members.filter(isMemberActive).length;
  const emailSetCount = members.filter(hasEmailAddress).length;
  const adminCount = members.filter(
    (member) => hasLoginAccount(member) && normalizeRole(member.permissionRole ?? "") === "admin",
  ).length;
  const missingEmailCount = members.filter((member) => !hasEmailAddress(member)).length;
  const inactiveMemberCount = members.filter((member) => !isMemberActive(member)).length;
  const filterOptions: { count: number; label: string; value: MemberAccountFilter }[] = [
    { count: baseRows.length, label: "全員", value: "all" },
    { count: emailSetCount, label: "メール設定済み", value: "loginEnabled" },
    { count: missingEmailCount, label: "メール未設定", value: "missing" },
    { count: adminCount, label: "管理者", value: "admin" },
    { count: inactiveMemberCount, label: "休止中", value: "inactive" },
  ];

  return (
    <section
      className="user-account-section member-roster-account-section"
      aria-label="メンバー一覧・ログイン"
    >
      <div className="settings-card-heading user-account-heading">
        <div>
          <strong>メンバー一覧・ログイン</strong>
          <span>一覧は見渡しやすく、権限・パスワード・非稼働日は詳細で管理</span>
        </div>
        <button className="subtle-action" disabled={loading} onClick={onRefresh} type="button">
          <ArrowPathIcon />
          再読込
        </button>
      </div>

      <div className="user-account-summary member-account-summary">
        <div>
          <span>メンバー</span>
          <strong>{members.length}名</strong>
        </div>
        <div>
          <span>有効メンバー</span>
          <strong>{activeMemberCount}名</strong>
        </div>
        <div>
          <span>メール設定済み</span>
          <strong>{emailSetCount}名</strong>
        </div>
        <div>
          <span>メール未設定</span>
          <strong>{missingEmailCount}名</strong>
        </div>
        <div>
          <span>管理者</span>
          <strong>{adminCount}名</strong>
        </div>
      </div>

      <div className="user-account-toolbar">
        <label>
          <MagnifyingGlassIcon />
          <input
            aria-label="メンバー検索"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="氏名・メール・チームで検索"
            value={query}
          />
        </label>
        <div className="user-account-filter-tabs" aria-label="メンバー絞り込み">
          {filterOptions.map((option) => (
            <button
              className={filter === option.value ? "active" : ""}
              key={option.value}
              onClick={() => setFilter(option.value)}
              type="button"
            >
              {option.label}
              <span>{option.count}</span>
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="user-account-error">{error}</p> : null}

      <div className="user-account-table-wrap member-account-table-wrap">
        <table className="user-account-table member-account-table">
          <thead>
            <tr>
              <th>メンバー</th>
              <th>メールアドレス</th>
              <th>所属</th>
              <th>ロール</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(({ member, memberTeams }) => (
              <MemberAccountRow
                assignmentCount={memberAssignmentCounts[member.id] ?? 0}
                confirmingLifecycle={lifecycleConfirmMemberId === member.id}
                key={member.id}
                member={member}
                memberTeams={memberTeams}
                onLifecycleConfirm={onLifecycleConfirm}
                onResetPassword={onResetPassword}
                onSaveAccount={onSaveAccount}
                onSaveMember={onSaveMember}
                onUpdateMemberLifecycle={onUpdateMemberLifecycle}
                saving={savingRowKey === member.id}
                temporaryPassword={temporaryPasswords[member.id] ?? null}
              />
            ))}
          </tbody>
        </table>
      </div>
      {filteredRows.length === 0 ? (
        <p className="user-account-empty">該当するメンバーはありません。</p>
      ) : null}
    </section>
  );
}

function MemberAccountRow({
  assignmentCount,
  confirmingLifecycle,
  member,
  memberTeams,
  onLifecycleConfirm,
  onResetPassword,
  onSaveAccount,
  onSaveMember,
  onUpdateMemberLifecycle,
  saving,
  temporaryPassword,
}: MemberAccountRowProps) {
  const accountExists = hasLoginAccount(member);
  const active = isMemberActive(member);
  const statusLabel = getMemberStatusLabel(member);
  const [email, setEmail] = useState(member.loginEmail ?? "");
  const [enabled, setEnabled] = useState(accountExists ? member.loginEnabled === true : true);
  const [role, setRole] = useState(normalizeRole(member.permissionRole ?? member.role));
  const [password, setPassword] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [availabilityDate, setAvailabilityDate] = useState("");
  const [availabilityLabel, setAvailabilityLabel] = useState("休暇");
  const availabilityOverrides = [...(member.availabilityOverrides ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  useEffect(() => {
    const nextAccountExists = hasLoginAccount(member);
    setEmail(member.loginEmail ?? "");
    setEnabled(nextAccountExists ? member.loginEnabled === true : true);
    setRole(normalizeRole(member.permissionRole ?? member.role));
    setPassword("");
  }, [member]);

  const dirty =
    accountExists &&
    (email.trim() !== member.loginEmail ||
      enabled !== (member.loginEnabled === true) ||
      role !== normalizeRole(member.permissionRole ?? ""));
  const rowClassName = [
    active ? "" : "member-inactive",
    accountExists && member.loginEnabled === false ? "login-disabled" : "",
    dirty ? "is-dirty" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const rowKey = member.id;

  function cancelEditing() {
    setEmail(member.loginEmail ?? "");
    setEnabled(accountExists ? member.loginEnabled === true : true);
    setRole(normalizeRole(member.permissionRole ?? member.role));
    setPassword("");
  }

  function saveAccount() {
    void onSaveAccount(
      member.id,
      {
        email: email.trim(),
        loginEnabled: enabled,
        password: password.trim() || null,
        permissionRole: role,
      },
      rowKey,
    );
  }

  function resetPassword() {
    if (!accountExists) return;
    void onResetPassword(member.id, password.trim(), rowKey);
    setPassword("");
  }

  function updateLifecycle(status: "active" | "inactive") {
    onUpdateMemberLifecycle(member.id, status);
    onLifecycleConfirm(null);
  }

  function addAvailabilityOverride() {
    if (!availabilityDate) return;
    const label = availabilityLabel.trim() || "休暇";
    const override: MemberAvailabilityOverride = {
      date: availabilityDate,
      id: `${member.id}-${availabilityDate}`,
      label,
      type: "unavailable",
    };
    const nextOverrides: MemberAvailabilityOverride[] = [
      ...availabilityOverrides.filter((override) => override.date !== availabilityDate),
      override,
    ].sort((a, b) => a.date.localeCompare(b.date));
    onSaveMember({
      ...member,
      availabilityOverrides: nextOverrides,
    });
    setAvailabilityDate("");
    setAvailabilityLabel("休暇");
  }

  function removeAvailabilityOverride(overrideId: string) {
    onSaveMember({
      ...member,
      availabilityOverrides: availabilityOverrides.filter((override) => override.id !== overrideId),
    });
  }

  return (
    <>
      <tr className={rowClassName}>
        <td>
          <div className="user-member-cell member-master-cell">
            <span style={{ "--avatar-color": member.color } as CSSProperties}>
              {member.initials}
            </span>
            <div>
              <input
                aria-label={`${member.name} の氏名`}
                className="member-inline-name"
                onChange={(event) => onSaveMember({ ...member, name: event.target.value })}
                value={member.name}
              />
              <small>{statusLabel}</small>
            </div>
          </div>
        </td>
        <td>
          <AccountEmail email={member.loginEmail ?? null} />
        </td>
        <td>
          <div className="user-team-list">
            {memberTeams.length > 0 ? memberTeams.map((team) => team.name).join(" / ") : "未所属"}
          </div>
        </td>
        <td>
          <input
            aria-label={`${member.name} のロール`}
            className="member-compact-input"
            onChange={(event) => onSaveMember({ ...member, role: event.target.value })}
            value={member.role}
          />
        </td>
        <td>
          <div className="member-status-stack">
            <span className={active ? "member-status active" : "member-status inactive"}>
              {statusLabel}
            </span>
            <small>{assignmentCount}件担当</small>
          </div>
        </td>
        <td>
          <div className="user-action-cell member-action-cell">
            <button
              className={detailOpen ? "subtle-action active" : "subtle-action"}
              onClick={() => {
                setDetailOpen((current) => !current);
              }}
              type="button"
            >
              <PencilSquareIcon />
              詳細
            </button>
            {accountExists ? (
              <button
                className="subtle-action"
                disabled={saving}
                onClick={resetPassword}
                type="button"
              >
                <KeyIcon />
                仮PW
              </button>
            ) : null}
            {active ? (
              confirmingLifecycle ? (
                <div className="member-lifecycle-confirm compact">
                  <span>既存担当は残ります</span>
                  <div>
                    <button
                      className="subtle-action"
                      onClick={() => onLifecycleConfirm(null)}
                      type="button"
                    >
                      戻る
                    </button>
                    <button
                      className="subtle-action danger"
                      onClick={() => updateLifecycle("inactive")}
                      type="button"
                    >
                      休止
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="subtle-action"
                  onClick={() => onLifecycleConfirm(member.id)}
                  type="button"
                >
                  <UserMinusIcon />
                  休止
                </button>
              )
            ) : (
              <button
                className="subtle-action"
                onClick={() => updateLifecycle("active")}
                type="button"
              >
                <ArrowPathIcon />
                復帰
              </button>
            )}
          </div>
        </td>
      </tr>
      {detailOpen ? (
        <tr className="member-detail-row">
          <td colSpan={6}>
            <div className="member-detail-panel">
              <div className="member-detail-basic">
                <strong>基本情報</strong>
                <div className="member-detail-grid">
                  <label>
                    メールアドレス
                    <input
                      aria-label={`${member.name} のメールアドレス`}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        onSaveMember({ ...member, loginEmail: event.target.value });
                      }}
                      placeholder="name@example.com"
                      type="email"
                      value={email}
                    />
                  </label>
                  <label>
                    略称
                    <input
                      aria-label={`${member.name} の略称`}
                      maxLength={3}
                      onChange={(event) =>
                        onSaveMember({
                          ...member,
                          initials:
                            event.target.value.trim().toUpperCase().slice(0, 3) || member.initials,
                        })
                      }
                      value={member.initials}
                    />
                  </label>
                  <label>
                    週キャパ
                    <input
                      aria-label={`${member.name} の週キャパ`}
                      min="1"
                      onChange={(event) =>
                        onSaveMember({
                          ...member,
                          capacityHours: Math.max(Number(event.target.value) || 1, 1),
                        })
                      }
                      type="number"
                      value={member.capacityHours}
                    />
                  </label>
                  <label>
                    権限
                    <RoleSelect onChange={setRole} value={role} />
                  </label>
                  <label className="member-detail-toggle">
                    ログイン
                    <span>
                      <input
                        checked={enabled}
                        onChange={(event) => setEnabled(event.target.checked)}
                        type="checkbox"
                      />
                      {enabled ? "有効" : "無効"}
                    </span>
                  </label>
                  <label>
                    パスワード
                    <input
                      aria-label={`${member.name} の新しいパスワード`}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={accountExists ? "空なら仮PW発行" : "初期PW（空なら発行）"}
                      type="password"
                      value={password}
                    />
                  </label>
                </div>
                <div className="member-detail-actions">
                  <RolePill role={role} />
                  <LoginPill
                    enabled={enabled}
                    missing={!hasEmailAddress({ ...member, loginEmail: email })}
                  />
                  <PasswordSummary
                    accountExists={accountExists}
                    temporaryPassword={temporaryPassword}
                  />
                  <button
                    className="subtle-action primary-lite"
                    disabled={saving || !email.trim()}
                    onClick={saveAccount}
                    type="button"
                  >
                    <CheckIcon />
                    {accountExists ? "ログインを保存" : "ログインを作成"}
                  </button>
                  <button className="subtle-action" onClick={cancelEditing} type="button">
                    <XMarkIcon />
                    入力を戻す
                  </button>
                </div>
                <div className="member-detail-color">
                  <strong>表示色</strong>
                  <ColorSwatches
                    label={`${member.name} の表示色`}
                    onChange={(color) => onSaveMember({ ...member, color })}
                    value={member.color}
                  />
                </div>
              </div>
              <div className="member-availability-editor inline">
                <div className="member-availability-heading">
                  <strong>非稼働日</strong>
                  <span>{availabilityOverrides.length}日</span>
                </div>
                <div className="member-availability-create">
                  <input
                    aria-label={`${member.name} の非稼働日`}
                    onChange={(event) => setAvailabilityDate(event.target.value)}
                    onInput={(event) => setAvailabilityDate(event.currentTarget.value)}
                    type="date"
                    value={availabilityDate}
                  />
                  <input
                    aria-label={`${member.name} の非稼働理由`}
                    onChange={(event) => setAvailabilityLabel(event.target.value)}
                    onInput={(event) => setAvailabilityLabel(event.currentTarget.value)}
                    placeholder="理由"
                    value={availabilityLabel}
                  />
                  <button
                    className="subtle-action"
                    disabled={!availabilityDate}
                    onClick={addAvailabilityOverride}
                    type="button"
                  >
                    <PlusIcon />
                    追加
                  </button>
                </div>
                {availabilityOverrides.length > 0 ? (
                  <div className="member-availability-list">
                    {availabilityOverrides.slice(0, 6).map((override) => (
                      <span className="member-availability-chip" key={override.id}>
                        {formatAvailabilityDate(override.date)}
                        <small>{override.label}</small>
                        <button
                          aria-label={`${member.name} ${override.date} の非稼働日を削除`}
                          onClick={() => removeAvailabilityOverride(override.id)}
                          type="button"
                        >
                          <TrashIcon />
                        </button>
                      </span>
                    ))}
                    {availabilityOverrides.length > 6 ? (
                      <span className="member-availability-more">
                        ほか{availabilityOverrides.length - 6}日
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <p className="member-availability-empty">登録なし</p>
                )}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function AccountEmail({ email }: { email: string | null }) {
  if (!email) {
    return (
      <div className="user-email-read empty">
        <strong>未設定</strong>
        <small>ログインなし</small>
      </div>
    );
  }
  return (
    <div className="user-email-read">
      <strong>{email}</strong>
      <small>メールアドレス</small>
    </div>
  );
}

function RolePill({ role }: { role: string }) {
  const normalizedRole = normalizeRole(role);
  return <span className={`user-role-pill ${normalizedRole}`}>{roleLabel(normalizedRole)}</span>;
}

function LoginPill({ enabled, missing }: { enabled: boolean; missing: boolean }) {
  if (missing) {
    return <span className="user-login-pill missing">未設定</span>;
  }
  return (
    <span className={enabled ? "user-login-pill enabled" : "user-login-pill disabled"}>
      {enabled ? "有効" : "停止"}
    </span>
  );
}

function PasswordSummary({
  accountExists,
  temporaryPassword,
}: {
  accountExists: boolean;
  temporaryPassword: string | null;
}) {
  if (temporaryPassword) {
    return <span className="user-temp-password">仮PW: {temporaryPassword}</span>;
  }
  return (
    <span className="user-password-summary">{accountExists ? "仮PW発行可" : "設定時に発行"}</span>
  );
}

function RoleSelect({ onChange, value }: { onChange: (role: string) => void; value: string }) {
  const normalizedValue = normalizeRole(value);
  return (
    <select
      aria-label="権限"
      onChange={(event) => onChange(event.target.value)}
      value={normalizedValue}
    >
      {roleOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function matchesAccountFilter(filter: MemberAccountFilter, member: Member) {
  switch (filter) {
    case "admin":
      return hasLoginAccount(member) && normalizeRole(member.permissionRole ?? "") === "admin";
    case "inactive":
      return !isMemberActive(member);
    case "loginEnabled":
      return hasEmailAddress(member);
    case "missing":
      return !hasEmailAddress(member);
    case "all":
      return true;
  }
}

function hasLoginAccount(member: Member) {
  return Boolean(member.loginCreatedAt || member.passwordChangedAt || member.lastLoginAt);
}

function hasEmailAddress(member: Member) {
  return Boolean(member.loginEmail?.trim());
}

function roleLabel(role: string) {
  const normalizedRole = normalizeRole(role);
  return roleOptions.find((option) => option.value === normalizedRole)?.label ?? "メンバー";
}

function normalizeRole(role: string) {
  const normalized = role.trim().toLowerCase();
  if (normalized === "admin" || normalized === "manager" || normalized === "member") {
    return normalized;
  }
  if (normalized === "pm" || normalized === "pl") return "manager";
  return "member";
}

function formatAvailabilityDate(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}
