import { CalendarDaysIcon, RectangleStackIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

import { type ProjectTemplateId, projectTemplates } from "../../../data/projectTemplates";
import type { Team } from "../../../types/schedule";

export type CreateProjectTemplateInput = {
  projectName: string;
  projectNo: string;
  startDate: string;
  templateId: ProjectTemplateId;
  workspace: string;
};

type ProjectCreateSheetProps = {
  defaultStartDate: string;
  nextProjectIndex: number;
  onClose: () => void;
  onCreateProject: (input: CreateProjectTemplateInput) => void;
  team?: Team;
};

/** テンプレートから新しいプロジェクトを作成する画面です。 */
export function ProjectCreateSheet({
  defaultStartDate,
  nextProjectIndex,
  onClose,
  onCreateProject,
  team,
}: ProjectCreateSheetProps) {
  const [templateId, setTemplateId] = useState<ProjectTemplateId>("standard-si");
  const [workspace, setWorkspace] = useState(`新規SIプロジェクト ${nextProjectIndex}`);
  const [projectName, setProjectName] = useState("SI案件 プロジェクト管理");
  const [projectNo, setProjectNo] = useState("");
  const [startDate, setStartDate] = useState(defaultStartDate);

  function submit() {
    const safeWorkspace = workspace.trim();
    const safeProjectName = projectName.trim();
    if (!safeWorkspace || !safeProjectName || !startDate) {
      return;
    }
    onCreateProject({
      projectName: safeProjectName,
      projectNo: projectNo.trim(),
      startDate,
      templateId,
      workspace: safeWorkspace,
    });
  }

  return (
    <aside className="project-create-sheet">
      <div className="panel-heading">
        <strong>プロジェクト追加</strong>
        <button aria-label="閉じる" className="close-button" onClick={onClose} type="button">
          <XMarkIcon />
        </button>
      </div>
      <div className="project-create-team">
        <span>{team?.code ?? "未"}</span>
        <div>
          <strong>{team?.name ?? "未所属"}</strong>
          <small>{team ? `${team.memberIds.length}名のチーム` : "所属チームなし"}</small>
        </div>
      </div>
      <label className="field-stack">
        プロジェクト名
        <input onChange={(event) => setWorkspace(event.target.value)} value={workspace} />
      </label>
      <label className="field-stack">
        プロジェクトNo.
        <input
          autoComplete="off"
          maxLength={64}
          onChange={(event) => setProjectNo(event.target.value)}
          placeholder="例: PJ-2026-001"
          value={projectNo}
        />
      </label>
      <label className="field-stack">
        管理名
        <input onChange={(event) => setProjectName(event.target.value)} value={projectName} />
      </label>
      <label className="field-stack">
        開始日
        <span className="date-input-with-icon">
          <CalendarDaysIcon />
          <input
            onChange={(event) => setStartDate(event.target.value)}
            type="date"
            value={startDate}
          />
        </span>
      </label>
      <section className="project-template-picker">
        <div className="project-template-heading">
          <span>テンプレート</span>
          <small>{projectTemplates.length}件</small>
        </div>
        <div className="project-template-grid">
          {projectTemplates.map((template) => (
            <button
              className={templateId === template.id ? "selected" : ""}
              key={template.id}
              onClick={() => setTemplateId(template.id)}
              type="button"
            >
              <RectangleStackIcon />
              <strong>{template.name}</strong>
              <span>{template.description}</span>
              <small>
                {template.taskCount}行 / {template.durationLabel}
              </small>
            </button>
          ))}
        </div>
      </section>
      <button
        className="primary-button full"
        disabled={!workspace.trim() || !projectName.trim() || !startDate}
        onClick={submit}
        type="button"
      >
        プロジェクトを作成
      </button>
    </aside>
  );
}
