import { useState } from "react";

import type { ScheduleSnapshot } from "../../../data/scheduleRepository";
import type { Member, ProjectAssignment, StaffingDemand } from "../../../types/schedule";

import * as styles from "./WorkloadOverviewPage.css";

export type AssignmentEditorState = {
  assignment: ProjectAssignment;
  demandId?: string;
  projectId: string;
};

export type DemandEditorState = {
  demand: StaffingDemand;
  projectId: string;
};

export function DemandEditor({
  onClose,
  onSave,
  projects,
  state,
}: {
  onClose: () => void;
  onSave: (state: DemandEditorState) => void;
  projects: ScheduleSnapshot[];
  state: DemandEditorState;
}) {
  const [draft, setDraft] = useState(state);
  const selectedProject = projects.find((item) => item.project.id === draft.projectId)?.project;
  function update(patch: Partial<StaffingDemand>) {
    setDraft((current) => ({ ...current, demand: { ...current.demand, ...patch } }));
  }
  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside className={styles.editor} aria-label="要員要求編集">
        <header className={styles.editorHeader}>
          <h3 className={styles.editorTitle}>要員要求</h3>
          <button
            aria-label="閉じる"
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        <label className={styles.field}>
          プロジェクト
          <select
            className={styles.input}
            onChange={(event) => {
              const project = projects.find(
                (item) => item.project.id === event.target.value,
              )?.project;
              setDraft((current) => ({
                ...current,
                projectId: event.target.value,
                demand: project
                  ? { ...current.demand, startDate: project.rangeStart, endDate: project.rangeEnd }
                  : current.demand,
              }));
            }}
            value={draft.projectId}
          >
            {projects.map((item) => (
              <option key={item.project.id} value={item.project.id}>
                {item.project.workspace}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          必要な役割
          <input
            className={styles.input}
            onChange={(event) => update({ role: event.target.value })}
            value={draft.demand.role}
          />
        </label>
        <div className={styles.dateFields}>
          <label className={styles.field}>
            開始日
            <input
              className={styles.input}
              min={selectedProject?.rangeStart}
              onChange={(event) => update({ startDate: event.target.value })}
              type="date"
              value={draft.demand.startDate}
            />
          </label>
          <label className={styles.field}>
            終了日
            <input
              className={styles.input}
              max={selectedProject?.rangeEnd}
              onChange={(event) => update({ endDate: event.target.value })}
              type="date"
              value={draft.demand.endDate}
            />
          </label>
        </div>
        <div className={styles.dateFields}>
          <label className={styles.field}>
            必要人数
            <input
              className={styles.input}
              min="1"
              onChange={(event) => update({ requiredCount: Number(event.target.value) })}
              type="number"
              value={draft.demand.requiredCount}
            />
          </label>
          <label className={styles.field}>
            配分率
            <input
              className={styles.input}
              max="100"
              min="10"
              onChange={(event) => update({ allocationPercent: Number(event.target.value) })}
              step="10"
              type="number"
              value={draft.demand.allocationPercent}
            />
          </label>
        </div>
        <div className={styles.editorActions}>
          <span />
          <button
            className={styles.primaryAction}
            disabled={!draft.demand.role || draft.demand.startDate > draft.demand.endDate}
            onClick={() => onSave(draft)}
            type="button"
          >
            要求を追加
          </button>
        </div>
      </aside>
    </>
  );
}

export function AssignmentEditor({
  members,
  onClose,
  onDelete,
  onSave,
  projects,
  state,
}: {
  members: Member[];
  onClose: () => void;
  onDelete: () => void;
  onSave: (state: AssignmentEditorState) => void;
  projects: ScheduleSnapshot[];
  state: AssignmentEditorState;
}) {
  const [draft, setDraft] = useState(state);
  const selectedProject = projects.find((item) => item.project.id === draft.projectId)?.project;
  function update(patch: Partial<ProjectAssignment>) {
    setDraft((current) => ({ ...current, assignment: { ...current.assignment, ...patch } }));
  }
  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside className={styles.editor} aria-label="アサイン編集">
        <header className={styles.editorHeader}>
          <h3 className={styles.editorTitle}>アサイン編集</h3>
          <button
            aria-label="閉じる"
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        <label className={styles.field}>
          プロジェクト
          <select
            className={styles.input}
            onChange={(event) => {
              const project = projects.find(
                (item) => item.project.id === event.target.value,
              )?.project;
              setDraft((current) => ({
                ...current,
                projectId: event.target.value,
                assignment: project
                  ? {
                      ...current.assignment,
                      startDate: project.rangeStart,
                      endDate: project.rangeEnd,
                    }
                  : current.assignment,
              }));
            }}
            value={draft.projectId}
          >
            {projects.map((item) => (
              <option key={item.project.id} value={item.project.id}>
                {item.project.workspace}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          メンバー
          <select
            className={styles.input}
            onChange={(event) => update({ memberId: event.target.value })}
            value={draft.assignment.memberId}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} / {member.role}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          役割
          <input
            className={styles.input}
            onChange={(event) => update({ role: event.target.value })}
            value={draft.assignment.role}
          />
        </label>
        <div className={styles.dateFields}>
          <label className={styles.field}>
            参画開始
            <input
              className={styles.input}
              max={draft.assignment.endDate}
              min={selectedProject?.rangeStart}
              onChange={(event) => update({ startDate: event.target.value })}
              type="date"
              value={draft.assignment.startDate}
            />
          </label>
          <label className={styles.field}>
            参画終了
            <input
              className={styles.input}
              max={selectedProject?.rangeEnd}
              min={draft.assignment.startDate}
              onChange={(event) => update({ endDate: event.target.value })}
              type="date"
              value={draft.assignment.endDate}
            />
          </label>
        </div>
        <label className={styles.field}>
          配分率
          <input
            className={styles.input}
            max="100"
            min="10"
            onChange={(event) => update({ allocationPercent: Number(event.target.value) })}
            step="10"
            type="number"
            value={draft.assignment.allocationPercent}
          />
        </label>
        <label className={styles.field}>
          状態
          <select
            className={styles.input}
            onChange={(event) =>
              update({ status: event.target.value as ProjectAssignment["status"] })
            }
            value={draft.assignment.status}
          >
            <option value="draft">仮アサイン</option>
            <option value="confirmed">確定</option>
          </select>
        </label>
        <div className={styles.editorActions}>
          <button className={styles.deleteAction} onClick={onDelete} type="button">
            削除
          </button>
          <button
            className={styles.primaryAction}
            disabled={
              !draft.assignment.memberId || draft.assignment.startDate > draft.assignment.endDate
            }
            onClick={() => onSave(draft)}
            type="button"
          >
            計画へ反映
          </button>
        </div>
      </aside>
    </>
  );
}
