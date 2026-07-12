import { ChevronDownIcon, Cog6ToothIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";

import { Avatar } from "../../../components/ui/Avatar";
import { formatShortDate, statusLabels } from "../../../lib/schedule";
import type {
  ResourceCell,
  ResourceDisplaySettings,
  ResourceRowModel,
  ResourceScope,
  TaskInspectorFocusTarget,
  TimelineColumn,
  UtilizationTone,
} from "../../../types/schedule";

type ResourcePanelProps = {
  displaySettings: ResourceDisplaySettings;
  onDisplaySettingsChange: (settings: ResourceDisplaySettings) => void;
  onMoveTask: (taskId: string, deltaDays: number) => void;
  onScopeChange: (scope: ResourceScope) => void;
  onSelectTask: (
    taskId: string,
    focusTarget?: TaskInspectorFocusTarget,
    projectId?: string,
  ) => void;
  onShareTask: (taskId: string, memberId: string) => void;
  resourceRows: ResourceRowModel[];
  scope: ResourceScope;
  scopeDescription: string;
  scopeLabel: string;
  weeks: TimelineColumn[];
};

/** メンバー別の稼働状況と案件横断リソースを表示します。 */
export function ResourcePanel({
  displaySettings,
  onDisplaySettingsChange,
  onMoveTask,
  onScopeChange,
  onSelectTask,
  onShareTask,
  resourceRows,
  scope,
  scopeDescription,
  scopeLabel,
  weeks,
}: ResourcePanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
  const { compact, showHours, showPercent, warningThreshold } = displaySettings;
  function updateDisplaySettings(patch: Partial<ResourceDisplaySettings>) {
    onDisplaySettingsChange({
      ...displaySettings,
      ...patch,
    });
  }
  const visibleMetricLabel = [showHours ? "時間" : null, showPercent ? "率" : null]
    .filter(Boolean)
    .join(" / ");
  const selectedCell = useMemo(
    () => findResourceCell(resourceRows, selectedCellKey),
    [resourceRows, selectedCellKey],
  );
  const selectedWeekLabel = selectedCell
    ? (weeks.find((week) => week.key === selectedCell.cell.week)?.label ?? selectedCell.cell.week)
    : "";

  return (
    <section
      className={compact ? "resource-panel compact" : "resource-panel"}
      aria-label="チームの作業量"
    >
      <div className="resource-header">
        <div>
          <h2>チームの作業量（週次）</h2>
          <span>
            {scopeDescription}・表示：
            {visibleMetricLabel || "バーのみ"}
          </span>
        </div>
        <div className="resource-header-actions">
          <div className="resource-scope-toggle" aria-label="表示範囲">
            {[
              ["project", "このプロジェクト"],
              ["team", "チーム横断"],
            ].map(([value, label]) => (
              <button
                className={scope === value ? "active" : ""}
                key={value}
                onClick={() => onScopeChange(value as ResourceScope)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="resource-settings-wrap">
            <button
              className={settingsOpen ? "subtle-action active" : "subtle-action"}
              onClick={() => setSettingsOpen((open) => !open)}
              type="button"
            >
              <Cog6ToothIcon />
              表示設定
              <ChevronDownIcon />
            </button>
            {settingsOpen ? (
              <div className="resource-settings-popover">
                <strong>表示設定</strong>
                <label className="check-row">
                  <input
                    checked={showHours}
                    onChange={(event) => updateDisplaySettings({ showHours: event.target.checked })}
                    type="checkbox"
                  />
                  工数を表示
                </label>
                <label className="check-row">
                  <input
                    checked={showPercent}
                    onChange={(event) =>
                      updateDisplaySettings({ showPercent: event.target.checked })
                    }
                    type="checkbox"
                  />
                  稼働率を表示
                </label>
                <label className="check-row">
                  <input
                    checked={compact}
                    onChange={(event) => updateDisplaySettings({ compact: event.target.checked })}
                    type="checkbox"
                  />
                  コンパクト表示
                </label>
                <label className="threshold-control">
                  警告しきい値
                  <input
                    max="120"
                    min="50"
                    onChange={(event) =>
                      updateDisplaySettings({
                        warningThreshold: Number(event.target.value),
                      })
                    }
                    type="range"
                    value={warningThreshold}
                  />
                  <span>{warningThreshold}%</span>
                </label>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="resource-scope-note">
        <strong>{scopeLabel}</strong>
        <span>{scopeDescription}</span>
      </div>
      {selectedCell ? (
        <ResourceDrilldown
          cell={selectedCell.cell}
          currentMemberId={selectedCell.row.member.id}
          memberName={selectedCell.row.member.name}
          onClose={() => setSelectedCellKey(null)}
          onMoveTask={onMoveTask}
          onSelectTask={onSelectTask}
          onShareTask={onShareTask}
          resourceRows={resourceRows}
          scope={scope}
          weekLabel={selectedWeekLabel}
        />
      ) : null}
      <div
        className="resource-grid"
        style={{
          gridTemplateColumns: `150px 126px 82px repeat(${weeks.length}, minmax(112px, 1fr))`,
        }}
      >
        <div className="resource-head member-col">メンバー</div>
        <div className="resource-head role-col">ロール</div>
        <div className="resource-head load-col">稼働率</div>
        {weeks.map((week) => (
          <div className="resource-head week-col" key={week.key}>
            <strong>{week.label.split(" ")[0]}</strong>
            <span>{week.label.split(" ")[1]}</span>
          </div>
        ))}
        {resourceRows.map((row) => (
          <ResourceRow
            key={row.member.id}
            row={row}
            showHours={showHours}
            showPercent={showPercent}
            selectedCellKey={selectedCellKey}
            onSelectCell={(cell) =>
              setSelectedCellKey(getResourceCellKey(row.member.id, cell.week))
            }
            warningThreshold={warningThreshold}
          />
        ))}
      </div>
    </section>
  );
}

type ResourceRowProps = {
  onSelectCell: (cell: ResourceCell) => void;
  row: ResourceRowModel;
  selectedCellKey: string | null;
  showHours: boolean;
  showPercent: boolean;
  warningThreshold: number;
};

function ResourceRow({
  onSelectCell,
  row,
  selectedCellKey,
  showHours,
  showPercent,
  warningThreshold,
}: ResourceRowProps) {
  return (
    <>
      <div className="resource-cell member-col">
        <Avatar member={row.member} />
        <strong>{row.member.name}</strong>
      </div>
      <div className="resource-cell role-col">{row.member.role}</div>
      <div className={`resource-cell load-col load-${getLoadTone(row.utilization)}`}>
        {row.utilization}%
      </div>
      {row.cells.map((cell) => {
        const cellKey = getResourceCellKey(row.member.id, cell.week);
        const hasContributions = cell.contributions.length > 0;
        return (
          <button
            aria-pressed={selectedCellKey === cellKey}
            className={[
              "resource-cell week-col",
              cell.percent >= warningThreshold ? "over-threshold" : "",
              selectedCellKey === cellKey ? "selected" : "",
              hasContributions ? "has-contributions" : "empty",
            ]
              .filter(Boolean)
              .join(" ")}
            data-resource-cell={cellKey}
            disabled={!hasContributions}
            key={cell.week}
            onClick={() => onSelectCell(cell)}
            title={
              hasContributions
                ? `${row.member.name} / ${cell.week} / ${cell.contributions.length}件`
                : `${row.member.name} / ${cell.week} / 工数なし`
            }
            type="button"
          >
            <span className="capacity-line" />
            <span
              className={`load-bar ${cell.tone}`}
              style={{ width: `${Math.min(cell.percent, 118)}%` }}
            />
            {showHours || showPercent ? (
              <small>
                {showHours ? `${cell.hours}h` : ""}
                {showHours && showPercent ? " / " : ""}
                {showPercent ? `${cell.percent}%` : ""}
              </small>
            ) : null}
            <em>
              枠 {cell.capacityHours}h
              {cell.unavailableDays > 0 ? ` / 休${cell.unavailableDays}日` : ""}
            </em>
            {hasContributions ? (
              <span className="resource-task-count">{cell.contributions.length}件</span>
            ) : null}
          </button>
        );
      })}
    </>
  );
}

type ResourceDrilldownProps = {
  cell: ResourceCell;
  currentMemberId: string;
  memberName: string;
  onClose: () => void;
  onMoveTask: (taskId: string, deltaDays: number) => void;
  onSelectTask: (
    taskId: string,
    focusTarget?: TaskInspectorFocusTarget,
    projectId?: string,
  ) => void;
  onShareTask: (taskId: string, memberId: string) => void;
  resourceRows: ResourceRowModel[];
  scope: ResourceScope;
  weekLabel: string;
};

function ResourceDrilldown({
  cell,
  currentMemberId,
  memberName,
  onClose,
  onMoveTask,
  onSelectTask,
  onShareTask,
  resourceRows,
  scope,
  weekLabel,
}: ResourceDrilldownProps) {
  const suggestions = buildResourceAdjustmentSuggestions(cell, currentMemberId, resourceRows);
  return (
    <section className="resource-drilldown" aria-label="リソース内訳">
      <div className="resource-drilldown-heading">
        <div>
          <strong>{memberName} の工数内訳</strong>
          <span>
            {weekLabel} / {cell.hours}h / {cell.percent}% / 枠{cell.capacityHours}h
          </span>
        </div>
        <button
          aria-label="工数内訳を閉じる"
          className="icon-button"
          onClick={onClose}
          type="button"
        >
          <XMarkIcon />
        </button>
      </div>
      {suggestions.length > 0 ? (
        <div className="resource-adjustment-panel">
          <div className="resource-adjustment-summary">
            <strong>調整候補</strong>
            <span>この週の負荷を下げる効果が大きい順に表示</span>
          </div>
          <div className="resource-suggestion-list">
            {suggestions.map((suggestion) => (
              <article
                className="resource-suggestion-card"
                key={`${suggestion.contribution.projectId ?? "current"}-${suggestion.contribution.taskId}`}
              >
                <div className="resource-suggestion-main">
                  <strong>{suggestion.contribution.title}</strong>
                  <span>
                    {formatShortDate(suggestion.contribution.start)} -{" "}
                    {formatShortDate(suggestion.contribution.end)} /{" "}
                    {statusLabels[suggestion.contribution.status]} / 配分
                    {suggestion.contribution.allocationPercent}%
                  </span>
                </div>
                <div className="resource-suggestion-impact">
                  <strong>-{formatResourceHours(suggestion.reliefHours)}</strong>
                  <span>
                    {formatResourceHours(cell.hours)}
                    {" -> "}
                    {formatResourceHours(suggestion.nextHours)} / {cell.percent}%{" -> "}
                    {suggestion.nextPercent}%
                  </span>
                </div>
                <div className="resource-suggestion-actions">
                  <button
                    className="subtle-action"
                    onClick={() =>
                      onSelectTask(
                        suggestion.contribution.taskId,
                        "assignees",
                        suggestion.contribution.projectId,
                      )
                    }
                    type="button"
                  >
                    担当
                  </button>
                  {suggestion.contribution.assigneeCount > 1 ? (
                    <button
                      className="subtle-action"
                      onClick={() =>
                        onSelectTask(
                          suggestion.contribution.taskId,
                          "allocations",
                          suggestion.contribution.projectId,
                        )
                      }
                      type="button"
                    >
                      配分
                    </button>
                  ) : null}
                  {scope === "project" ? (
                    <>
                      <button
                        className="subtle-action"
                        onClick={() => onMoveTask(suggestion.contribution.taskId, -1)}
                        type="button"
                      >
                        1日前
                      </button>
                      <button
                        className="subtle-action"
                        onClick={() => onMoveTask(suggestion.contribution.taskId, 1)}
                        type="button"
                      >
                        1日後ろ
                      </button>
                    </>
                  ) : null}
                </div>
                {scope === "project" && suggestion.shareCandidates.length > 0 ? (
                  <div className="resource-share-candidates">
                    <span>分担候補</span>
                    <div className="resource-share-actions">
                      {suggestion.shareCandidates.map((candidate) => (
                        <button
                          className={`resource-share-button ${candidate.tone}`}
                          key={candidate.member.id}
                          onClick={() =>
                            onShareTask(suggestion.contribution.taskId, candidate.member.id)
                          }
                          title={`${candidate.member.name} と50/50で分担: ${formatResourceHours(
                            cell.hours,
                          )} -> ${formatResourceHours(
                            candidate.currentNextHours,
                          )} / ${candidate.targetCurrentPercent}% -> ${
                            candidate.targetNextPercent
                          }%`}
                          type="button"
                        >
                          <Avatar member={candidate.member} />
                          <span>
                            <strong>{candidate.member.name}</strong>
                            <small>
                              自分 {formatResourceHours(candidate.currentNextHours)} / 相手{" "}
                              {formatResourceHours(candidate.targetNextHours)}・
                              {candidate.targetNextPercent}%
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
      <div className="resource-drilldown-list">
        {cell.contributions.map((contribution) => (
          <button
            className="resource-contribution-row"
            key={`${contribution.projectId ?? "current"}-${contribution.taskId}`}
            onClick={() =>
              onSelectTask(
                contribution.taskId,
                contribution.assigneeCount > 1 ? "allocations" : "assignees",
                contribution.projectId,
              )
            }
            type="button"
          >
            <div>
              <strong>{contribution.title}</strong>
              <span>
                {formatShortDate(contribution.start)} - {formatShortDate(contribution.end)} /{" "}
                {statusLabels[contribution.status]} / 進捗
                {contribution.progress}%
                {contribution.projectName ? ` / ${contribution.projectName}` : ""}
              </span>
            </div>
            <small>
              {formatResourceHours(contribution.hours)}
              <em>{contribution.allocationPercent}%</em>
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}

function buildResourceAdjustmentSuggestions(
  cell: ResourceCell,
  currentMemberId: string,
  resourceRows: ResourceRowModel[],
) {
  return cell.contributions
    .map((contribution) => {
      const nextHours = Math.max(cell.hours - contribution.hours, 0);
      const nextPercent =
        cell.capacityHours > 0 ? Math.round((nextHours / cell.capacityHours) * 100) : 0;
      return {
        contribution,
        nextHours,
        nextPercent,
        reliefHours: contribution.hours,
        shareCandidates:
          contribution.assigneeCount === 1
            ? buildResourceShareCandidates(cell, contribution.hours, currentMemberId, resourceRows)
            : [],
      };
    })
    .toSorted(
      (a, b) =>
        b.reliefHours - a.reliefHours || a.contribution.start.localeCompare(b.contribution.start),
    )
    .slice(0, 3);
}

function buildResourceShareCandidates(
  cell: ResourceCell,
  contributionHours: number,
  currentMemberId: string,
  resourceRows: ResourceRowModel[],
) {
  const sharedHours = contributionHours / 2;
  const currentNextHours = Math.max(cell.hours - sharedHours, 0);
  const currentNextPercent = calculateResourcePercent(currentNextHours, cell.capacityHours);
  return resourceRows
    .filter((row) => row.member.id !== currentMemberId)
    .map((row) => {
      const targetCell = row.cells.find((candidate) => candidate.week === cell.week);
      const targetCurrentHours = targetCell?.hours ?? 0;
      const targetCapacityHours = targetCell?.capacityHours ?? Math.round(row.member.capacityHours);
      const targetCurrentPercent = calculateResourcePercent(
        targetCurrentHours,
        targetCapacityHours,
      );
      const targetNextHours = targetCurrentHours + sharedHours;
      const targetNextPercent = calculateResourcePercent(targetNextHours, targetCapacityHours);
      return {
        currentNextHours,
        currentNextPercent,
        member: row.member,
        targetCurrentHours,
        targetCurrentPercent,
        targetNextHours,
        targetNextPercent,
        tone: getLoadTone(targetNextPercent),
      };
    })
    .toSorted(
      (a, b) =>
        Math.max(a.currentNextPercent, a.targetNextPercent) -
          Math.max(b.currentNextPercent, b.targetNextPercent) ||
        a.targetNextPercent - b.targetNextPercent ||
        a.targetCurrentPercent - b.targetCurrentPercent ||
        a.member.name.localeCompare(b.member.name),
    )
    .slice(0, 3);
}

function findResourceCell(resourceRows: ResourceRowModel[], selectedCellKey: string | null) {
  if (!selectedCellKey) {
    return null;
  }
  for (const row of resourceRows) {
    for (const cell of row.cells) {
      if (getResourceCellKey(row.member.id, cell.week) === selectedCellKey) {
        return { cell, row };
      }
    }
  }
  return null;
}

function getResourceCellKey(memberId: string, week: string) {
  return `${memberId}:${week}`;
}

function formatResourceHours(hours: number) {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

function calculateResourcePercent(hours: number, capacityHours: number) {
  if (capacityHours <= 0) {
    return hours > 0 ? 100 : 0;
  }
  return Math.round((hours / capacityHours) * 100);
}

function getLoadTone(value: number): UtilizationTone {
  if (value >= 90) {
    return "danger";
  }
  if (value >= 80) {
    return "warning";
  }
  return "good";
}
