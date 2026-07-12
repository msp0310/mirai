import { getTaskTimelineSpan } from "../../../lib/schedule";
import type { DependencyIssue } from "../../../lib/schedule";
import type { TaskRow, TimelineDay } from "../../../types/schedule";
import type { VisibleTimelineSlotWindow } from "../types/ganttState";
import { buildDependencyPath } from "../lib/timelineGeometry";
import { rowHeight } from "./constants";

type TimelineDependencyOverlayProps = {
  dayWidth: number;
  dependencyIssueByTaskId: Map<string, DependencyIssue[]>;
  rowIndexOffset: number;
  rows: TaskRow[];
  timeline: TimelineDay[];
  visibleSlotWindow: VisibleTimelineSlotWindow;
};

/** 表示中のタスク間にある依存関係だけをSVGで描画します。 */
export function TimelineDependencyOverlay({
  dayWidth,
  dependencyIssueByTaskId,
  rowIndexOffset,
  rows,
  timeline,
  visibleSlotWindow,
}: TimelineDependencyOverlayProps) {
  const rowById = new Map(
    rows.map((task, index) => [task.id, { task, index: rowIndexOffset + index }]),
  );
  const paths: DependencyPath[] = [];
  const visibleLeft = visibleSlotWindow.start * dayWidth - dayWidth;
  const visibleRight = visibleSlotWindow.end * dayWidth + dayWidth;

  rows.forEach((task, targetIndex) => {
    (task.dependencies ?? []).forEach((dependencyId) => {
      const source = rowById.get(dependencyId);
      if (!source) {
        return;
      }
      const sourceSpan = getTaskTimelineSpan(source.task, timeline);
      const targetSpan = getTaskTimelineSpan(task, timeline);
      const x1 = getDependencyAnchorX(source.task, sourceSpan, dayWidth, "end");
      const y1 = source.index * rowHeight + rowHeight / 2;
      const x2 = getDependencyAnchorX(task, targetSpan, dayWidth, "start");
      const y2 = (rowIndexOffset + targetIndex) * rowHeight + rowHeight / 2;
      const mid = Math.max(x1 + 16, (x1 + x2) / 2);
      if (Math.max(x1, x2, mid) < visibleLeft || Math.min(x1, x2, mid) > visibleRight) {
        return;
      }
      paths.push({
        issue: (dependencyIssueByTaskId.get(task.id) ?? []).some(
          (issue) => issue.dependency.id === dependencyId,
        ),
        path: buildDependencyPath(x1, y1, x2, y2),
        sourceId: source.task.id,
        targetId: task.id,
        x1,
        x2,
        y1,
        y2,
      });
    });
  });

  return (
    <svg className="dependency-overlay" aria-hidden="true">
      {paths.map((item) => (
        <path
          className={item.issue ? "dependency-warning-path" : undefined}
          data-dependency-source-id={item.sourceId}
          data-dependency-target-id={item.targetId}
          data-source-x={item.x1}
          data-source-y={item.y1}
          data-target-x={item.x2}
          data-target-y={item.y2}
          d={item.path}
          key={`${item.sourceId}-${item.targetId}`}
        />
      ))}
    </svg>
  );
}

type DependencyPath = {
  issue: boolean;
  path: string;
  sourceId: string;
  targetId: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
};

function getDependencyAnchorX(
  task: TaskRow,
  span: ReturnType<typeof getTaskTimelineSpan>,
  dayWidth: number,
  edge: "end" | "start",
) {
  if (task.type === "milestone") {
    return span.offset * dayWidth + 15;
  }
  const left = span.offset * dayWidth + 7;
  const width = Math.max(span.duration * dayWidth - 12, 10);
  return edge === "start" ? left : left + width;
}
