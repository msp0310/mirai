import { ArrowsUpDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

import type { PortfolioFilter, PortfolioSort } from "../../projectPortfolioModel";

const filterOptions: { label: string; value: PortfolioFilter }[] = [
  { label: "全件", value: "all" },
  { label: "計画", value: "planning" },
  { label: "進行中", value: "inProgress" },
  { label: "完了済み", value: "completed" },
  { label: "要対応", value: "attention" },
  { label: "お気に入り", value: "favorites" },
  { label: "低進捗", value: "lowProgress" },
];

const sortLabels: Record<PortfolioSort, string> = {
  milestone: "マイルストーンが近い順",
  name: "名称順",
  priority: "優先度順",
  progressAsc: "進捗が低い順",
  progressDesc: "進捗が高い順",
};

type PortfolioControlsProps = {
  filter: PortfolioFilter;
  onFilterChange: (filter: PortfolioFilter) => void;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: PortfolioSort) => void;
  query: string;
  sort: PortfolioSort;
};

/** 案件検索、状態絞り込み、並び替えを一つの操作列にまとめます。 */
export function PortfolioControls({
  filter,
  onFilterChange,
  onQueryChange,
  onSortChange,
  query,
  sort,
}: PortfolioControlsProps) {
  return (
    <div
      className="portfolio-controls"
      aria-label="プロジェクト絞り込み"
      data-tour="portfolio-search"
    >
      <label className="portfolio-search">
        <MagnifyingGlassIcon />
        <input
          aria-label="プロジェクト検索"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="プロジェクトNo.・案件名・マイルストーンで検索"
          value={query}
        />
      </label>
      <div className="portfolio-filter-tabs" aria-label="状態フィルタ">
        {filterOptions.map((option) => (
          <button
            className={filter === option.value ? "active" : ""}
            key={option.value}
            onClick={() => onFilterChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className="portfolio-sort">
        <ArrowsUpDownIcon />
        <select
          aria-label="プロジェクト並び替え"
          onChange={(event) => onSortChange(event.target.value as PortfolioSort)}
          value={sort}
        >
          {Object.entries(sortLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
