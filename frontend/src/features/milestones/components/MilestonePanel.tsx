import { FlagIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";

import { Avatar } from "../../../components/ui/Avatar";
import { getActiveMembers } from "../../../lib/members";
import { formatDateWithWeekday, formatShortDate, statusLabels } from "../../../lib/schedule";
import type { CreateMilestoneInput, Member, Project, ScheduleTask } from "../../../types/schedule";

type MilestonePanelProps = {
  members: Member[];
  onCreateMilestone: (input: CreateMilestoneInput) => void;
  onSelectTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  project: Project;
  tasks: ScheduleTask[];
};

/** プロジェクトのマイルストーンを一覧・編集します。 */
export function MilestonePanel({
  members,
  onCreateMilestone,
  onSelectTask,
  onUpdateTask,
  project,
  tasks,
}: MilestonePanelProps) {
  const parentCandidates = tasks.filter((task) => task.type === "summary" || task.type === "phase");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(project.nextMilestone.date);
  const [parentId, setParentId] = useState(parentCandidates[0]?.id ?? "");
  const assigneeOptions = useMemo(() => {
    const activeMembers = getActiveMembers(members);
    return activeMembers.length > 0 ? activeMembers : members;
  }, [members]);
  const [assigneeId, setAssigneeId] = useState(assigneeOptions[0]?.id ?? "");
  const milestones = useMemo(
    () =>
      tasks
        .filter((task) => task.type === "milestone")
        .sort((a, b) => a.start.localeCompare(b.start)),
    [tasks],
  );
  const nextMilestone =
    milestones.find((milestone) => milestone.status !== "done") ?? milestones[0];

  useEffect(() => {
    if (assigneeOptions.some((member) => member.id === assigneeId)) {
      return;
    }
    setAssigneeId(assigneeOptions[0]?.id ?? "");
  }, [assigneeId, assigneeOptions]);

  function createMilestone() {
    onCreateMilestone({
      title,
      date,
      parentId: parentId || null,
      assigneeIds: assigneeId ? [assigneeId] : [],
    });
    setTitle("");
  }

  return (
    <section className="milestone-panel" aria-label="マイルストーン管理">
      <div className="milestone-header">
        <div>
          <h2>マイルストーン管理</h2>
          <span>{project.workspace} の承認点・レビュー・リリース判定</span>
        </div>
        {nextMilestone ? (
          <div className="next-milestone">
            <span>次のマイルストーン</span>
            <strong>{nextMilestone.title}</strong>
            <small>{formatDateWithWeekday(nextMilestone.start)}</small>
          </div>
        ) : null}
      </div>

      <div className="milestone-layout">
        <div className="milestone-list">
          {milestones.map((milestone) => (
            <MilestoneRow
              key={milestone.id}
              members={members}
              milestone={milestone}
              onSelectTask={onSelectTask}
              onUpdateTask={onUpdateTask}
              tasks={tasks}
            />
          ))}
        </div>

        <aside className="milestone-create">
          <div className="panel-heading">
            <strong>マイルストーン追加</strong>
          </div>
          <label className="field-stack">
            名称
            <input
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例: 基本設計承認"
              value={title}
            />
          </label>
          <div className="two-col inspector-fields">
            <label>
              日付
              <input
                onChange={(event) => setDate(event.target.value)}
                onInput={(event) => setDate(event.currentTarget.value)}
                type="date"
                value={date}
              />
            </label>
            <label>
              担当
              <select onChange={(event) => setAssigneeId(event.target.value)} value={assigneeId}>
                {assigneeOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.initials} {member.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field-stack">
            親階層
            <select onChange={(event) => setParentId(event.target.value)} value={parentId}>
              {parentCandidates.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary-button milestone-add-button"
            onClick={createMilestone}
            type="button"
          >
            <PlusIcon />
            追加
          </button>
        </aside>
      </div>
    </section>
  );
}

type MilestoneRowProps = {
  members: Member[];
  milestone: ScheduleTask;
  onSelectTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<ScheduleTask>) => void;
  tasks: ScheduleTask[];
};

function MilestoneRow({
  members,
  milestone,
  onSelectTask,
  onUpdateTask,
  tasks,
}: MilestoneRowProps) {
  const assignee = members.find((member) => member.id === milestone.assigneeIds[0]);
  const parent = tasks.find((task) => task.id === milestone.parentId);
  const readiness = getMilestoneReadiness(milestone, tasks);

  return (
    <article className={`milestone-card ${milestone.status} ${readiness.tone}`}>
      <div className="milestone-card-icon">
        <FlagIcon />
      </div>
      <div className="milestone-card-main">
        <div className="milestone-card-title">
          <input
            aria-label={`${milestone.title} の名称`}
            onChange={(event) => onUpdateTask(milestone.id, { title: event.target.value })}
            value={milestone.title}
          />
          <span className={`status-pill ${milestone.status}`}>
            <span />
            {statusLabels[milestone.status]}
          </span>
        </div>
        <div className="milestone-meta">
          <span>{parent?.title ?? "ルート"}</span>
          <span>
            {readiness.dependencies.length > 0
              ? `前提 ${readiness.dependencies.length}件`
              : "前提なし"}
          </span>
        </div>
        <div className={`milestone-readiness ${readiness.tone}`}>
          <strong>{readiness.label}</strong>
          <span>{readiness.detail}</span>
        </div>
        {readiness.dependencies.length > 0 ? (
          <div className="milestone-gate-list" aria-label="判定材料">
            {readiness.dependencies.map((dependency) => (
              <button
                className={`milestone-gate-item ${dependency.status}`}
                key={dependency.id}
                onClick={() => onSelectTask(dependency.id)}
                type="button"
              >
                <span className={`status-dot ${dependency.status}`} />
                <strong>{dependency.title}</strong>
                <small>
                  {formatShortDate(dependency.start)} - {formatShortDate(dependency.end)} /{" "}
                  {statusLabels[dependency.status]} / {dependency.progress}%
                </small>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="milestone-controls">
        <label>
          日付
          <input
            onChange={(event) => onUpdateTask(milestone.id, { start: event.target.value })}
            onInput={(event) => onUpdateTask(milestone.id, { start: event.currentTarget.value })}
            type="date"
            value={milestone.start}
          />
        </label>
        <label>
          状態
          <select
            onChange={(event) =>
              onUpdateTask(milestone.id, {
                status: event.target.value as ScheduleTask["status"],
              })
            }
            value={milestone.status}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          進捗
          <input
            max="100"
            min="0"
            onChange={(event) =>
              onUpdateTask(milestone.id, {
                progress: Number(event.target.value),
              })
            }
            type="number"
            value={milestone.progress}
          />
        </label>
      </div>
      <div className="milestone-assignee">
        {assignee ? <Avatar member={assignee} /> : null}
        <strong>{formatShortDate(milestone.start)}</strong>
        <button onClick={() => onSelectTask(milestone.id)} type="button">
          ガントで選択
        </button>
      </div>
    </article>
  );
}

function getMilestoneReadiness(milestone: ScheduleTask, tasks: ScheduleTask[]) {
  const dependencyIds = milestone.dependencies ?? [];
  const dependencies = dependencyIds
    .map((id) => tasks.find((task) => task.id === id))
    .filter((task): task is ScheduleTask => Boolean(task));
  const missingCount = dependencyIds.length - dependencies.length;
  const incompleteCount = dependencies.filter((task) => task.status !== "done").length;
  const scheduleConflictCount = dependencies.filter((task) => task.end > milestone.start).length;

  if (dependencies.length === 0) {
    return {
      dependencies,
      detail: missingCount > 0 ? `未解決の前提 ${missingCount}件` : "前提タスクは未設定です",
      label: missingCount > 0 ? "前提確認" : "前提なし",
      tone: missingCount > 0 ? "warning" : "neutral",
    };
  }

  if (incompleteCount === 0 && scheduleConflictCount === 0 && missingCount === 0) {
    return {
      dependencies,
      detail: "前提タスクは完了済みです",
      label: "準備OK",
      tone: "ready",
    };
  }

  const detail = [
    incompleteCount > 0 ? `未完了 ${incompleteCount}件` : null,
    scheduleConflictCount > 0 ? `日程確認 ${scheduleConflictCount}件` : null,
    missingCount > 0 ? `未解決 ${missingCount}件` : null,
  ]
    .filter(Boolean)
    .join(" / ");
  return {
    dependencies,
    detail,
    label: "要確認",
    tone: "warning",
  };
}
