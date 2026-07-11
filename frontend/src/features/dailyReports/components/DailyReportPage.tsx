import {
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import type { AuthUser } from "../../../data/authRepository";
import {
  deleteDailyReport,
  listDailyReports,
  saveDailyReport,
} from "../../../data/dailyReportRepository";
import type { ScheduleSnapshot } from "../../../data/scheduleRepository";
import type {
  DailyReport,
  DailyReportEntry,
  Member,
  WorkLogCategory,
} from "../../../types/schedule";
import { MarkdownPreview } from "../../../components/common/MarkdownPreview";
import * as styles from "./DailyReportPage.css";

type DailyReportPageProps = {
  currentUser: AuthUser;
  schedules: ScheduleSnapshot[];
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
export function DailyReportPage({ currentUser, schedules, todayKey }: DailyReportPageProps) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DailyReport | null>(null);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("読み込み中...");
  const members = useMemo(() => collectMembers(schedules), [schedules]);
  const currentMember = members.find((member) => member.name === currentUser.name) ?? members[0];
  const visibleReports = useMemo(
    () =>
      draft && !reports.some((report) => report.id === draft.id) ? [draft, ...reports] : reports,
    [draft, reports],
  );

  useEffect(() => {
    let active = true;
    listDailyReports()
      .then((items) => {
        if (!active) return;
        setReports(items);
        setMessage(items.length === 0 ? "日報はまだありません。" : "");
      })
      .catch(() => active && setMessage("日報を読み込めませんでした。"));
    return () => {
      active = false;
    };
  }, []);

  function createReport() {
    if (!currentMember || schedules.length === 0) return;
    const now = new Date().toISOString();
    const report: DailyReport = {
      comments: [],
      createdAt: now,
      date: todayKey,
      entries: [createEntry(schedules[0].project.id)],
      id: `daily-report-${currentMember.id}-${todayKey}-${Date.now()}`,
      memberId: currentMember.id,
      status: "draft",
      summary: "",
      updatedAt: now,
      version: 0,
    };
    setSelectedId(report.id);
    setDraft(report);
  }

  function selectReport(report: DailyReport) {
    setSelectedId(report.id);
    setDraft(structuredClone(report));
  }

  async function persist(status: DailyReport["status"] = draft?.status ?? "draft") {
    if (!draft) return;
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
    if (!draft || !comment.trim()) return;
    const next = {
      ...draft,
      comments: [
        ...draft.comments,
        {
          authorId: currentUser.id,
          authorName: currentUser.name,
          body: comment.trim(),
          createdAt: new Date().toISOString(),
          id: `daily-comment-${Date.now()}`,
        },
      ],
    };
    setDraft(next);
    setComment("");
    try {
      const saved = await saveDailyReport(next);
      setDraft(saved);
      setReports((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
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
        <button className={styles.primaryButton} onClick={createReport} type="button">
          <PlusIcon className={styles.buttonIcon} />
          日報を作成
        </button>
      </header>
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
  report: DailyReport;
  schedules: ScheduleSnapshot[];
}) {
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

  return (
    <article className={styles.editor}>
      <header className={styles.editorHeader}>
        <div className={styles.headerFields}>
          <input
            aria-label="日報日付"
            className={styles.dateInput}
            onChange={(event) => update({ date: event.target.value })}
            type="date"
            value={report.date}
          />
          <select
            aria-label="日報作成者"
            className={styles.select}
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
            onClick={onDelete}
            type="button"
          >
            <TrashIcon />
          </button>
          <button className={styles.secondaryButton} onClick={onSave} type="button">
            下書き保存
          </button>
          <button
            className={styles.primaryButton}
            disabled={!report.summary.trim() || report.entries.length === 0}
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
                    onChange={(event) => updateEntry(entry.id, { summary: event.target.value })}
                    placeholder="作業内容"
                    value={entry.summary}
                  />
                  <button
                    aria-label="明細を削除"
                    className={`${styles.iconButton} ${styles.entryDelete}`}
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
              value={report.blockers ?? ""}
            />
            <MarkdownField
              label="翌日の予定"
              onChange={(nextPlan) => update({ nextPlan })}
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
                <b>{hours}h</b>
              </div>
            ))}
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
    </article>
  );
}

function MarkdownField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
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
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(parsed);
}
