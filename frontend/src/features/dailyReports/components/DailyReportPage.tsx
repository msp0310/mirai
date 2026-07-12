import {
  ExclamationTriangleIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";

import { MarkdownPreview } from "../../../components/common/MarkdownPreview";
import type { AuthUser } from "../../../data/authRepository";
import {
  addDailyReportComment,
  deleteDailyReport,
  listDailyReports,
  markDailyReportRead,
  saveDailyReport,
  sendDailyReportReminders,
} from "../../../data/dailyReportRepository";
import type { ScheduleSnapshot } from "../../../data/scheduleRepository";
import type {
  DailyReport,
  DailyReportEntry,
  Member,
  Team,
  WorkLogCategory,
} from "../../../types/schedule";
import { TeamDailyReportsView } from "./TeamDailyReportsView";

import * as styles from "./DailyReportPage.css";

type DailyReportPageProps = {
  currentUser: AuthUser;
  schedules: ScheduleSnapshot[];
  team: Team;
  todayKey: string;
};

const categoryLabels: Record<WorkLogCategory, string> = {
  improvement: "改善",
  incident: "障害",
  maintenance: "保守",
  meeting: "会議",
  other: "その他",
  support: "問い合わせ",
};

/** 複数案件の作業実績を一日単位で記録し、提出後のコメントまで管理します。 */
export function DailyReportPage({ currentUser, schedules, team, todayKey }: DailyReportPageProps) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DailyReport | null>(null);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("読み込み中...");
  const [viewMode, setViewMode] = useState<"mine" | "team">("team");
  const members = useMemo(() => collectMembers(schedules), [schedules]);
  const teamMembers = useMemo(() => {
    const memberIds = new Set(team.memberIds);
    return members.filter((member) => memberIds.has(member.id));
  }, [members, team.memberIds]);
  const teamMemberIds = useMemo(
    () => new Set(teamMembers.map((member) => member.id)),
    [teamMembers],
  );
  const teamReports = useMemo(
    () => reports.filter((report) => teamMemberIds.has(report.memberId)),
    [reports, teamMemberIds],
  );
  const currentMember =
    members.find((member) => member.id === currentUser.memberId) ??
    members.find((member) => member.name === currentUser.name) ??
    members[0];
  const canManageTeam =
    currentUser.role === "admin" ||
    (team.memberships ?? []).some(
      (membership) => membership.memberId === currentUser.memberId && membership.role === "manager",
    );
  const personalReports = useMemo(
    () => reports.filter((report) => report.memberId === currentMember?.id),
    [currentMember?.id, reports],
  );
  const visibleReports = useMemo(
    () =>
      draft && !personalReports.some((report) => report.id === draft.id)
        ? [draft, ...personalReports]
        : personalReports,
    [draft, personalReports],
  );

  useEffect(() => {
    let active = true;
    listDailyReports(team.id)
      .then((items) => {
        if (!active) {
          return;
        }
        setReports(items);
        setMessage(items.length === 0 ? "日報はまだありません。" : "");
      })
      .catch(() => active && setMessage("日報を読み込めませんでした。"));
    return () => {
      active = false;
    };
  }, [team.id]);

  function createReport(date = todayKey) {
    if (!currentMember || schedules.length === 0) {
      return;
    }
    const existing = personalReports.find((report) => report.date === date);
    if (existing) {
      selectReport(existing);
      setViewMode("mine");
      return;
    }
    const now = new Date().toISOString();
    const report: DailyReport = {
      comments: [],
      createdAt: now,
      date,
      entries: [createEntry(schedules[0].project.id)],
      id: `daily-report-${currentMember.id}-${date}-${Date.now()}`,
      memberId: currentMember.id,
      status: "draft",
      summary: "",
      updatedAt: now,
      version: 0,
    };
    setSelectedId(report.id);
    setDraft(report);
    setViewMode("mine");
  }

  function selectReport(report: DailyReport) {
    setSelectedId(report.id);
    setDraft({ ...structuredClone(report), unreadCommentCount: 0 });
    if (report.unreadCommentCount) {
      void markDailyReportRead(report.id);
      setReports((items) =>
        items.map((item) => (item.id === report.id ? { ...item, unreadCommentCount: 0 } : item)),
      );
    }
  }

  function openTeamReport(report: DailyReport) {
    selectReport(report);
    setViewMode("mine");
  }

  async function persist(status: DailyReport["status"] = draft?.status ?? "draft") {
    if (!draft) {
      return;
    }
    setMessage("保存中...");
    try {
      const saved = await saveDailyReport({ ...draft, status });
      setReports((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setDraft(saved);
      setSelectedId(saved.id);
      setMessage(
        status === "submitted"
          ? "日報を提出し、案件実績へ反映しました。"
          : "下書きを保存しました。",
      );
    } catch {
      setMessage("日報を保存できませんでした。内容を確認してください。");
    }
  }

  async function removeReport() {
    if (!draft || draft.version === 0) {
      setDraft(null);
      setSelectedId(null);
      return;
    }
    await deleteDailyReport(draft.id);
    setReports((items) => items.filter((item) => item.id !== draft.id));
    setDraft(null);
    setSelectedId(null);
    setMessage("日報を削除しました。");
  }

  async function addComment() {
    if (!draft || !comment.trim()) {
      return;
    }
    try {
      const saved = await addDailyReportComment(draft.id, comment.trim());
      setDraft(saved);
      setReports((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setComment("");
      setMessage("コメントを追加しました。");
    } catch {
      setMessage("コメントを保存できませんでした。");
    }
  }

  return (
    <section className={styles.page} aria-label="日報">
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.heading}>日報</h2>
          <span className={styles.description}>一日の作業をまとめ、案件・タスク別の実績へ反映</span>
        </div>
        <div className={styles.pageActions}>
          <div className={styles.viewSwitch} aria-label="日報表示">
            <button
              className={viewMode === "mine" ? styles.viewSwitchActive : ""}
              onClick={() => setViewMode("mine")}
              type="button"
            >
              自分の日報
            </button>
            <button
              className={viewMode === "team" ? styles.viewSwitchActive : ""}
              onClick={() => setViewMode("team")}
              type="button"
            >
              みんなの日報
            </button>
          </div>
          {viewMode === "mine" ? (
            <button className={styles.primaryButton} onClick={() => createReport()} type="button">
              <PlusIcon className={styles.buttonIcon} />
              日報を作成
            </button>
          ) : null}
        </div>
      </header>
      {viewMode === "team" ? (
        <TeamDailyReportsView
          canManage={canManageTeam}
          currentMemberId={currentMember?.id ?? currentUser.memberId}
          members={teamMembers}
          onComment={async (reportId, body) => {
            const saved = await addDailyReportComment(reportId, body);
            setReports((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
            setMessage("コメントを追加しました。");
          }}
          onOpenReport={openTeamReport}
          onOpenOwnReport={(date) => {
            const ownReport = personalReports.find((report) => report.date === date);
            if (ownReport) {
              openTeamReport(ownReport);
            } else {
              createReport(date);
            }
          }}
          onRemind={async (date, memberIds) => {
            await sendDailyReportReminders(team.id, date, memberIds);
            setMessage(`${memberIds.length}名へ日報提出のリマインドを送りました。`);
          }}
          reports={teamReports}
          schedules={schedules}
          teamName={team.name}
          todayKey={todayKey}
        />
      ) : (
        <div className={styles.layout}>
          <aside className={styles.reportList} aria-label="日報一覧">
            <div className={styles.listHeading}>
              <strong>最近の日報</strong>
              <span>{visibleReports.length}件</span>
            </div>
            {visibleReports.map((report) => (
              <button
                className={`${styles.reportListItem} ${selectedId === report.id ? styles.reportListItemActive : ""}`}
                key={report.id}
                onClick={() => selectReport(report)}
                type="button"
              >
                <span className={styles.reportDate}>{formatReportDate(report.date)}</span>
                <strong>{report.summary.trim() || "未入力の日報"}</strong>
                <span className={styles.reportMeta}>
                  <small>{report.status === "submitted" ? "提出済み" : "下書き"}</small>
                  <small>{sumHours(report.entries)}h</small>
                  {report.unreadCommentCount ? (
                    <small>{report.unreadCommentCount}件未読</small>
                  ) : null}
                </span>
              </button>
            ))}
            {visibleReports.length === 0 ? <span className={styles.empty}>{message}</span> : null}
          </aside>
          {draft ? (
            <DailyReportEditor
              comment={comment}
              currentUser={currentUser}
              members={members}
              onCommentChange={setComment}
              onAddComment={addComment}
              onChange={setDraft}
              onDelete={removeReport}
              onSave={() => persist("draft")}
              onSubmit={() => persist("submitted")}
              readOnly={draft.memberId !== currentMember?.id && !canManageTeam}
              report={draft}
              schedules={schedules}
            />
          ) : (
            <div className={styles.welcome}>
              <strong>日報を選択または作成してください</strong>
              <span>入力した作業時間は案件実績へ自動反映されます。</span>
            </div>
          )}
        </div>
      )}
      {message && reports.length > 0 ? <div className={styles.message}>{message}</div> : null}
    </section>
  );
}

function DailyReportEditor({
  comment,
  currentUser,
  members,
  onAddComment,
  onChange,
  onCommentChange,
  onDelete,
  onSave,
  onSubmit,
  readOnly,
  report,
  schedules,
}: {
  comment: string;
  currentUser: AuthUser;
  members: Member[];
  onAddComment: () => void;
  onChange: (report: DailyReport) => void;
  onCommentChange: (value: string) => void;
  onDelete: () => void;
  onSave: () => void;
  onSubmit: () => void;
  readOnly: boolean;
  report: DailyReport;
  schedules: ScheduleSnapshot[];
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const update = (patch: Partial<DailyReport>) => onChange({ ...report, ...patch });
  const updateEntry = (entryId: string, patch: Partial<DailyReportEntry>) =>
    update({
      entries: report.entries.map((entry) =>
        entry.id === entryId ? { ...entry, ...patch } : entry,
      ),
    });
  const projectTotals = report.entries.reduce<Map<string, number>>((totals, entry) => {
    totals.set(entry.projectId, (totals.get(entry.projectId) ?? 0) + entry.hours);
    return totals;
  }, new Map());
  const projectPlans = report.entries.reduce<Map<string, number>>((plans, entry) => {
    if (!entry.taskId) {
      return plans;
    }
    const task = schedules
      .find((schedule) => schedule.project.id === entry.projectId)
      ?.tasks.find((item) => item.id === entry.taskId);
    if (task?.effortHours) {
      plans.set(entry.projectId, (plans.get(entry.projectId) ?? 0) + task.effortHours);
    }
    return plans;
  }, new Map());

  return (
    <article className={styles.editor}>
      <header className={styles.editorHeader}>
        <div className={styles.headerFields}>
          <input
            aria-label="日報日付"
            className={styles.dateInput}
            disabled={readOnly}
            onChange={(event) => update({ date: event.target.value })}
            type="date"
            value={report.date}
          />
          <select
            aria-label="日報作成者"
            className={styles.select}
            disabled={readOnly}
            onChange={(event) => update({ memberId: event.target.value })}
            value={report.memberId}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <span className={report.status === "submitted" ? styles.submitted : styles.draft}>
            {report.status === "submitted" ? "提出済み" : "下書き"}
          </span>
        </div>
        <div className={styles.editorActions}>
          <button
            aria-label="日報を削除"
            className={styles.iconButton}
            disabled={readOnly}
            onClick={() => setDeleteConfirmOpen(true)}
            type="button"
          >
            <TrashIcon />
          </button>
          <button
            className={styles.secondaryButton}
            disabled={readOnly}
            onClick={onSave}
            type="button"
          >
            下書き保存
          </button>
          <button
            className={styles.primaryButton}
            disabled={readOnly || !report.summary.trim() || report.entries.length === 0}
            onClick={onSubmit}
            type="button"
          >
            提出して実績反映
          </button>
        </div>
      </header>
      <div className={styles.editorBody}>
        <main className={styles.editorMain}>
          <MarkdownField
            label="本日のまとめ"
            onChange={(summary) => update({ summary })}
            readOnly={readOnly}
            value={report.summary}
          />
          <section className={styles.entrySection}>
            <header className={styles.sectionHeader}>
              <div>
                <strong>作業明細</strong>
                <span>合計 {sumHours(report.entries)}h</span>
              </div>
              <button
                className={styles.secondaryButton}
                disabled={readOnly}
                onClick={() =>
                  update({
                    entries: [...report.entries, createEntry(schedules[0]?.project.id ?? "")],
                  })
                }
                type="button"
              >
                <PlusIcon className={styles.buttonIcon} />
                明細追加
              </button>
            </header>
            <div className={styles.entryLabels} aria-hidden="true">
              <span>案件</span>
              <span>タスク</span>
              <span>時間</span>
              <span>分類</span>
            </div>
            {report.entries.map((entry) => {
              const schedule = schedules.find((item) => item.project.id === entry.projectId);
              return (
                <div className={styles.entry} key={entry.id}>
                  <select
                    aria-label="案件"
                    className={styles.select}
                    disabled={readOnly}
                    onChange={(event) =>
                      updateEntry(entry.id, { projectId: event.target.value, taskId: undefined })
                    }
                    value={entry.projectId}
                  >
                    {schedules.map((item) => (
                      <option key={item.project.id} value={item.project.id}>
                        {item.project.workspace}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="タスク"
                    className={styles.select}
                    disabled={readOnly}
                    onChange={(event) =>
                      updateEntry(entry.id, { taskId: event.target.value || undefined })
                    }
                    value={entry.taskId ?? ""}
                  >
                    <option value="">タスク未指定</option>
                    {schedule?.tasks
                      .filter((task) => task.type === "task")
                      .map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                  </select>
                  <input
                    aria-label="作業時間"
                    className={styles.hoursInput}
                    disabled={readOnly}
                    min="0.25"
                    onChange={(event) =>
                      updateEntry(entry.id, { hours: Number(event.target.value) })
                    }
                    step="0.25"
                    type="number"
                    value={entry.hours}
                  />
                  <select
                    aria-label="作業分類"
                    className={styles.select}
                    disabled={readOnly}
                    onChange={(event) =>
                      updateEntry(entry.id, { category: event.target.value as WorkLogCategory })
                    }
                    value={entry.category}
                  >
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="作業内容"
                    className={styles.summaryInput}
                    disabled={readOnly}
                    onChange={(event) => updateEntry(entry.id, { summary: event.target.value })}
                    placeholder="作業内容"
                    value={entry.summary}
                  />
                  <button
                    aria-label="明細を削除"
                    className={`${styles.iconButton} ${styles.entryDelete}`}
                    disabled={readOnly}
                    onClick={() =>
                      update({ entries: report.entries.filter((item) => item.id !== entry.id) })
                    }
                    type="button"
                  >
                    <TrashIcon />
                  </button>
                </div>
              );
            })}
          </section>
          <div className={styles.twoColumns}>
            <MarkdownField
              label="課題・相談事項"
              onChange={(blockers) => update({ blockers })}
              readOnly={readOnly}
              value={report.blockers ?? ""}
            />
            <MarkdownField
              label="翌日の予定"
              onChange={(nextPlan) => update({ nextPlan })}
              readOnly={readOnly}
              value={report.nextPlan ?? ""}
            />
          </div>
        </main>
        <aside className={styles.editorSide}>
          <section className={styles.actualSummary}>
            <strong>案件実績への反映</strong>
            {[...projectTotals.entries()].map(([projectId, hours]) => (
              <div key={projectId}>
                <span>
                  {schedules.find((item) => item.project.id === projectId)?.project.workspace ??
                    projectId}
                </span>
                <b>
                  {hours}h
                  {projectPlans.get(projectId) ? ` / 予定${projectPlans.get(projectId)}h` : ""}
                </b>
              </div>
            ))}
            {[...projectTotals.entries()].some(
              ([projectId, hours]) =>
                hours > (projectPlans.get(projectId) ?? Number.POSITIVE_INFINITY),
            ) ? (
              <span className={styles.actualWarning}>予定工数を超過している明細があります。</span>
            ) : null}
          </section>
          <section className={styles.comments}>
            <h3>コメント</h3>
            {report.comments.map((item) => (
              <article className={styles.comment} key={item.id}>
                <header>
                  <strong>{item.authorName}</strong>
                  <time>{new Date(item.createdAt).toLocaleString("ja-JP")}</time>
                </header>
                <MarkdownPreview content={item.body} />
              </article>
            ))}
            {report.comments.length === 0 ? (
              <span className={styles.empty}>コメントはありません。</span>
            ) : null}
            <textarea
              aria-label="日報コメント"
              className={styles.commentInput}
              onChange={(event) => onCommentChange(event.target.value)}
              placeholder={`${currentUser.name}としてコメント`}
              value={comment}
            />
            <button
              className={styles.secondaryButton}
              disabled={!comment.trim() || report.version === 0}
              onClick={onAddComment}
              type="button"
            >
              コメントを追加
            </button>
          </section>
        </aside>
      </div>
      {deleteConfirmOpen ? (
        <div className={styles.dialogOverlay} role="presentation">
          <aside
            aria-label="日報の削除確認"
            aria-modal="true"
            className={styles.deleteDialog}
            role="dialog"
          >
            <header>
              <div>
                <strong>日報を削除しますか？</strong>
                <span>
                  {formatReportDate(report.date)} /{" "}
                  {members.find((member) => member.id === report.memberId)?.name}
                </span>
              </div>
              <button aria-label="閉じる" onClick={() => setDeleteConfirmOpen(false)} type="button">
                <XMarkIcon />
              </button>
            </header>
            <section>
              <ExclamationTriangleIcon />
              <div>
                <strong>案件実績も同時に取り消されます</strong>
                <p>日報に紐づく作業時間とコメントは元に戻せません。</p>
              </div>
            </section>
            <footer>
              <button onClick={() => setDeleteConfirmOpen(false)} type="button">
                キャンセル
              </button>
              <button
                className={styles.deleteConfirmButton}
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  onDelete();
                }}
                type="button"
              >
                削除する
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </article>
  );
}

function MarkdownField({
  label,
  onChange,
  readOnly,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  value: string;
}) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  return (
    <section className={styles.markdownField}>
      <header className={styles.markdownHeader}>
        <strong>{label}</strong>
        <div className={styles.modeSwitch}>
          <button
            className={mode === "edit" ? styles.modeActive : ""}
            onClick={() => setMode("edit")}
            type="button"
          >
            <PencilSquareIcon />
            編集
          </button>
          <button
            className={mode === "preview" ? styles.modeActive : ""}
            onClick={() => setMode("preview")}
            type="button"
          >
            <EyeIcon />
            プレビュー
          </button>
        </div>
      </header>
      {mode === "edit" ? (
        <textarea
          aria-label={label}
          disabled={readOnly}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`${label}をMarkdownで入力`}
          value={value}
        />
      ) : (
        <div className={styles.preview}>
          <MarkdownPreview content={value || "_未入力_"} />
        </div>
      )}
    </section>
  );
}

function createEntry(projectId: string): DailyReportEntry {
  return {
    category: "maintenance",
    hours: 1,
    id: `daily-entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    summary: "",
  };
}

function collectMembers(schedules: ScheduleSnapshot[]) {
  return [
    ...new Map(
      schedules.flatMap((item) => item.members).map((member) => [member.id, member]),
    ).values(),
  ];
}

function sumHours(entries: DailyReportEntry[]) {
  return entries.reduce((sum, entry) => sum + (Number.isFinite(entry.hours) ? entry.hours : 0), 0);
}

function formatReportDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(parsed);
}
