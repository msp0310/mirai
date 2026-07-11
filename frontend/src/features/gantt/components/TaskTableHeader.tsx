import type { GanttColumnVisibility } from "../../../types/schedule";

export type TaskTableSortKey = "assignee" | "end" | "progress" | "start" | "status" | "title";

export type TaskTableSortState = {
  direction: "asc" | "desc";
  key: TaskTableSortKey | null;
};

type TaskTableHeaderProps = {
  columnVisibility: GanttColumnVisibility;
  displayMode: "gantt" | "table";
  onSortChange: (key: TaskTableSortKey) => void;
  sort: TaskTableSortState;
};

/** ガント左側と表表示で共有するタスク列ヘッダーです。 */
export function TaskTableHeader({
  columnVisibility,
  displayMode,
  onSortChange,
  sort,
}: TaskTableHeaderProps) {
  const sortable = displayMode === "table";

  return (
    <div className="table-header">
      <HeaderCell
        label="タスク名"
        onClick={sortable ? () => onSortChange("title") : undefined}
        sort={sort}
        sortKey="title"
      />
      {displayMode === "table" ? (
        <HeaderCell
          label="開始日"
          onClick={() => onSortChange("start")}
          sort={sort}
          sortKey="start"
        />
      ) : null}
      {displayMode === "table" ? (
        <HeaderCell
          label="終了日"
          onClick={() => onSortChange("end")}
          sort={sort}
          sortKey="end"
        />
      ) : null}
      {displayMode === "table" || columnVisibility.assignee ? (
        <HeaderCell
          label="担当者"
          onClick={sortable ? () => onSortChange("assignee") : undefined}
          sort={sort}
          sortKey="assignee"
        />
      ) : null}
      {columnVisibility.status ? (
        <HeaderCell
          label="状況"
          onClick={sortable ? () => onSortChange("status") : undefined}
          sort={sort}
          sortKey="status"
        />
      ) : null}
      {displayMode === "table" || columnVisibility.progress ? (
        <HeaderCell
          label="進捗"
          onClick={sortable ? () => onSortChange("progress") : undefined}
          sort={sort}
          sortKey="progress"
        />
      ) : null}
    </div>
  );
}

function HeaderCell({
  label,
  onClick,
  sort,
  sortKey,
}: {
  label: string;
  onClick?: () => void;
  sort: TaskTableSortState;
  sortKey: TaskTableSortKey;
}) {
  const active = sort.key === sortKey;
  const content = (
    <>
      <span>{label}</span>
      {active ? <span aria-hidden="true">{sort.direction === "asc" ? "↑" : "↓"}</span> : null}
    </>
  );

  return (
    <div aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
      {onClick ? (
        <button
          aria-label={`${label}で並べ替え`}
          className={active ? "table-sort-button active" : "table-sort-button"}
          onClick={onClick}
          type="button"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </div>
  );
}
