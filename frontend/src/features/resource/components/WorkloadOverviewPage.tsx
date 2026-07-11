import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useMemo, useState, type CSSProperties } from "react";
import type { ScheduleSnapshot } from "../../../data/scheduleRepository";
import { buildCrossProjectResourceRows } from "../../../lib/resourceCalculations";
import { buildTimeline, buildWeekColumns } from "../../../lib/schedule";
import { isMemberActive } from "../../../lib/members";
import type {
  CalendarDefinition,
  Member,
  ProjectAssignment,
  ResourceRowModel,
  StaffingDemand,
  Team,
} from "../../../types/schedule";
import { Avatar } from "../../../components/ui/Avatar";
import * as styles from "./WorkloadOverviewPage.css";

type WorkloadOverviewPageProps = {
  calendar: CalendarDefinition;
  calendarAware: boolean;
  onOpenProject: (projectId: string) => void;
  onOpenTeam: (teamId: string) => void;
  onUpdateProjectStaffing: (
    projectId: string,
    assignments: ProjectAssignment[],
    staffingDemands: StaffingDemand[],
  ) => void;
  schedules: ScheduleSnapshot[];
  teams: Team[];
};

type ViewMode = "plan" | "member" | "team";
type HorizonMonths = 3 | 6 | 12;
type AssignmentWithProject = ProjectAssignment & { projectId: string; projectName: string };
type AssignmentEditorState = {
  assignment: ProjectAssignment;
  demandId?: string;
  projectId: string;
};
type DemandEditorState = { demand: StaffingDemand; projectId: string };

/** 全案件をメンバーまたはチーム単位で横断して、週次負荷を比較します。 */
export function WorkloadOverviewPage({
  calendar,
  calendarAware,
  onOpenProject,
  onOpenTeam,
  onUpdateProjectStaffing,
  schedules,
  teams,
}: WorkloadOverviewPageProps) {
  const [mode, setMode] = useState<ViewMode>("plan");
  const [teamId, setTeamId] = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [horizonMonths, setHorizonMonths] = useState<HorizonMonths>(6);
  const [editorState, setEditorState] = useState<AssignmentEditorState | null>(null);
  const [demandEditorState, setDemandEditorState] = useState<DemandEditorState | null>(null);
  const activeSchedules = useMemo(
    () => schedules.filter((snapshot) => snapshot.project.status !== "archived"),
    [schedules],
  );
  const members = useMemo(() => collectMembers(activeSchedules), [activeSchedules]);
  const weeks = useMemo(() => {
    const start = activeSchedules.map((item) => item.project.rangeStart).sort()[0];
    const projectEnd = activeSchedules
      .map((item) => item.project.rangeEnd)
      .sort()
      .at(-1);
    if (!start || !projectEnd) return [];
    const end = [projectEnd, addDateMonths(start, 12)].sort().at(-1)!;
    return buildWeekColumns(buildTimeline(start, end, calendar, calendarAware, "day"));
  }, [activeSchedules, calendar, calendarAware]);
  const visibleWeekCount = horizonMonths === 3 ? 13 : horizonMonths === 6 ? 26 : 52;
  const maxOffset = Math.max(weeks.length - visibleWeekCount, 0);
  const visibleOffset = Math.min(weekOffset, maxOffset);
  const visibleWeeks = weeks.slice(visibleOffset, visibleOffset + visibleWeekCount);
  const scopedSchedules = useMemo(
    () =>
      teamId === "all"
        ? activeSchedules
        : activeSchedules.filter((item) => item.project.teamId === teamId),
    [activeSchedules, teamId],
  );
  const scopedMembers = useMemo(
    () =>
      getScopedMembers(
        members,
        scopedSchedules,
        teams.find((team) => team.id === teamId),
      ),
    [members, scopedSchedules, teamId, teams],
  );
  const memberRows = useMemo(
    () =>
      buildCrossProjectResourceRows({
        baseCalendar: calendar,
        calendarAware,
        members: scopedMembers,
        schedules: scopedSchedules,
        weeks: visibleWeeks,
      }),
    [calendar, calendarAware, scopedMembers, scopedSchedules, visibleWeeks],
  );
  const projectAssignments = useMemo(
    () =>
      scopedSchedules.flatMap((snapshot) =>
        getProjectAssignments(snapshot, members).map((assignment) => ({
          ...assignment,
          projectId: snapshot.project.id,
          projectName: snapshot.project.workspace,
        })),
      ),
    [members, scopedSchedules],
  );
  const openDemands = useMemo(
    () =>
      scopedSchedules.flatMap((snapshot) =>
        (snapshot.project.staffingDemands ?? [])
          .filter((demand) => demand.status === "open")
          .map((demand) => ({
            demand,
            projectId: snapshot.project.id,
            projectName: snapshot.project.workspace,
          })),
      ),
    [scopedSchedules],
  );
  const teamRows = useMemo(
    () =>
      teams.map((team) => {
        const teamSchedules = activeSchedules.filter((item) => item.project.teamId === team.id);
        const teamMembers = getScopedMembers(members, teamSchedules, team);
        const rows = buildCrossProjectResourceRows({
          baseCalendar: calendar,
          calendarAware,
          members: teamMembers,
          schedules: teamSchedules,
          weeks: visibleWeeks,
        });
        return { rows, team, projectCount: teamSchedules.length };
      }),
    [activeSchedules, calendar, calendarAware, members, teams, visibleWeeks],
  );
  const overloadedCount =
    mode !== "team"
      ? memberRows.filter((row) => row.cells.some((cell) => cell.percent >= 100)).length
      : teamRows.filter((item) =>
          visibleWeeks.some(
            (week, index) => aggregateTeamCell(item.rows, index, week.key).percent >= 100,
          ),
        ).length;
  const availableCount =
    mode !== "team"
      ? memberRows.filter((row) => row.cells.every((cell) => cell.percent < 70)).length
      : teamRows.filter((item) =>
          visibleWeeks.every(
            (week, index) => aggregateTeamCell(item.rows, index, week.key).percent < 70,
          ),
        ).length;
  const unassignedCount = scopedSchedules.reduce(
    (count, snapshot) =>
      count +
      snapshot.tasks.filter((task) => task.type === "task" && task.assigneeIds.length === 0).length,
    0,
  );

  function openNewAssignment(projectId = scopedSchedules[0]?.project.id, demand?: StaffingDemand) {
    const project = scopedSchedules.find((item) => item.project.id === projectId)?.project;
    const member = scopedMembers[0];
    if (!project || !member) return;
    setEditorState({
      assignment: {
        allocationPercent: demand?.allocationPercent ?? 50,
        endDate: demand?.endDate ?? project.rangeEnd,
        id: `assignment-${project.id}-${Date.now()}`,
        memberId: member.id,
        role: demand?.role ?? member.role,
        startDate: demand?.startDate ?? project.rangeStart,
        status: "draft",
      },
      demandId: demand?.id,
      projectId: project.id,
    });
  }

  function saveAssignment(state: AssignmentEditorState) {
    const snapshot = activeSchedules.find((item) => item.project.id === state.projectId);
    if (!snapshot) return;
    const assignments = getProjectAssignments(snapshot, members);
    const exists = assignments.some((item) => item.id === state.assignment.id);
    const nextAssignments = exists
      ? assignments.map((item) => (item.id === state.assignment.id ? state.assignment : item))
      : [...assignments, state.assignment];
    const nextDemands = (snapshot.project.staffingDemands ?? []).map((demand) =>
      demand.id === state.demandId ? { ...demand, status: "filled" as const } : demand,
    );
    onUpdateProjectStaffing(state.projectId, nextAssignments, nextDemands);
    setEditorState(null);
  }

  function deleteAssignment(state: AssignmentEditorState) {
    const snapshot = activeSchedules.find((item) => item.project.id === state.projectId);
    if (!snapshot) return;
    onUpdateProjectStaffing(
      state.projectId,
      getProjectAssignments(snapshot, members).filter((item) => item.id !== state.assignment.id),
      snapshot.project.staffingDemands ?? [],
    );
    setEditorState(null);
  }

  function openNewDemand() {
    const project = scopedSchedules[0]?.project;
    if (!project) return;
    setDemandEditorState({
      demand: {
        allocationPercent: 50,
        endDate: project.rangeEnd,
        id: `demand-${project.id}-${Date.now()}`,
        requiredCount: 1,
        role: "BE",
        startDate: project.rangeStart,
        status: "open",
      },
      projectId: project.id,
    });
  }

  function saveDemand(state: DemandEditorState) {
    const snapshot = activeSchedules.find((item) => item.project.id === state.projectId);
    if (!snapshot) return;
    const demands = snapshot.project.staffingDemands ?? [];
    const exists = demands.some((item) => item.id === state.demand.id);
    onUpdateProjectStaffing(
      state.projectId,
      getProjectAssignments(snapshot, members),
      exists
        ? demands.map((item) => (item.id === state.demand.id ? state.demand : item))
        : [...demands, state.demand],
    );
    setDemandEditorState(null);
  }

  return (
    <section className={styles.page} aria-label="稼働・要員計画">
      <header className={styles.header}>
        <div>
          <h2 className={styles.heading}>稼働・要員計画</h2>
          <span className={styles.description}>
            全案件の稼働を確認し、必要な要員とアサインを週単位で計画
          </span>
        </div>
        <div className={styles.segmented} aria-label="稼働・要員計画の表示軸">
          <button
            className={`${styles.segment} ${mode === "plan" ? styles.segmentActive : ""}`}
            onClick={() => setMode("plan")}
            type="button"
          >
            アサイン計画
          </button>
          <button
            className={`${styles.segment} ${mode === "member" ? styles.segmentActive : ""}`}
            onClick={() => setMode("member")}
            type="button"
          >
            人別
          </button>
          <button
            className={`${styles.segment} ${mode === "team" ? styles.segmentActive : ""}`}
            onClick={() => setMode("team")}
            type="button"
          >
            チーム別
          </button>
        </div>
      </header>

      <div className={styles.summary}>
        <Summary
          label={mode === "team" ? "表示チーム" : "表示メンバー"}
          value={mode === "team" ? `${teamRows.length}チーム` : `${memberRows.length}名`}
        />
        <Summary
          label="稼働超過"
          value={`${overloadedCount}${mode === "team" ? "チーム" : "名"}`}
        />
        <Summary label="余力あり" value={`${availableCount}${mode === "team" ? "チーム" : "名"}`} />
        <Summary
          label={mode === "plan" ? "未充足要員" : "未アサインタスク"}
          value={`${mode === "plan" ? openDemands.length : unassignedCount}件`}
        />
      </div>

      <div className={styles.controls}>
        {mode !== "team" ? (
          <select
            className={styles.select}
            aria-label="表示チーム"
            onChange={(event) => setTeamId(event.target.value)}
            value={teamId}
          >
            <option value="all">すべてのチーム</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        ) : (
          <span />
        )}
        <div className={styles.timelineControls}>
          <div className={styles.horizon} aria-label="表示期間">
            {([3, 6, 12] as const).map((months) => (
              <button
                className={`${styles.horizonButton} ${horizonMonths === months ? styles.horizonButtonActive : ""}`}
                key={months}
                onClick={() => {
                  setHorizonMonths(months);
                  setWeekOffset(0);
                }}
                type="button"
              >
                {months}か月
              </button>
            ))}
          </div>
          <div className={styles.pager} aria-label="表示期間の切り替え">
            <button
              aria-label="前の期間"
              className={styles.pagerButton}
              disabled={visibleOffset === 0}
              onClick={() => setWeekOffset(Math.max(visibleOffset - visibleWeekCount, 0))}
              type="button"
            >
              <ChevronLeftIcon className={styles.pagerIcon} />
            </button>
            <span className={styles.period}>{formatPeriod(visibleWeeks)}</span>
            <button
              aria-label="次の期間"
              className={styles.pagerButton}
              disabled={visibleOffset >= maxOffset}
              onClick={() => setWeekOffset(Math.min(visibleOffset + visibleWeekCount, maxOffset))}
              type="button"
            >
              <ChevronRightIcon className={styles.pagerIcon} />
            </button>
          </div>
        </div>
      </div>

      {mode === "plan" ? (
        <>
          <div className={styles.planActions}>
            <button
              className={styles.primaryAction}
              onClick={() => openNewAssignment()}
              type="button"
            >
              アサイン追加
            </button>
            <button className={styles.secondaryAction} onClick={openNewDemand} type="button">
              要員要求追加
            </button>
          </div>
          <div className={styles.demandBand}>
            <span className={styles.demandHeading}>未充足の要員要求</span>
            <div className={styles.demands}>
              {openDemands.map(({ demand, projectId, projectName }) => (
                <button
                  className={styles.demand}
                  key={demand.id}
                  onClick={() => openNewAssignment(projectId, demand)}
                  type="button"
                >
                  <strong className={styles.demandTitle}>
                    {projectName} / {demand.role} {demand.requiredCount}名
                  </strong>
                  <span className={styles.demandMeta}>
                    {demand.startDate} - {demand.endDate} / {demand.allocationPercent}%
                  </span>
                </button>
              ))}
              {openDemands.length === 0 ? (
                <span className={styles.description}>未充足の要員要求はありません。</span>
              ) : null}
            </div>
          </div>
          <AssignmentPlanBoard
            assignments={projectAssignments}
            members={scopedMembers}
            onEdit={(assignment) => setEditorState({ assignment, projectId: assignment.projectId })}
            weeks={visibleWeeks}
          />
        </>
      ) : mode === "member" ? (
        <MemberGrid onOpenProject={onOpenProject} rows={memberRows} weeks={visibleWeeks} />
      ) : (
        <TeamGrid
          onOpenProject={onOpenProject}
          onOpenTeam={onOpenTeam}
          rows={teamRows}
          weeks={visibleWeeks}
        />
      )}
      {editorState ? (
        <AssignmentEditor
          members={members}
          onClose={() => setEditorState(null)}
          onDelete={() => deleteAssignment(editorState)}
          onSave={saveAssignment}
          projects={activeSchedules}
          state={editorState}
        />
      ) : null}
      {demandEditorState ? (
        <DemandEditor
          onClose={() => setDemandEditorState(null)}
          onSave={saveDemand}
          projects={activeSchedules}
          state={demandEditorState}
        />
      ) : null}
    </section>
  );
}

function AssignmentPlanBoard({
  assignments,
  members,
  onEdit,
  weeks,
}: {
  assignments: AssignmentWithProject[];
  members: Member[];
  onEdit: (assignment: AssignmentWithProject) => void;
  weeks: ReturnType<typeof buildWeekColumns>;
}) {
  const visibleStart = weeks[0]?.start;
  const visibleEnd = addDateDays(weeks.at(-1)?.start, 6);
  const monthGroups = buildMonthGroups(weeks);
  const timelineMinWidth = Math.max(920, weeks.length * 48 + 220);
  return (
    <div className={styles.planBoard} aria-label="アサイン計画ボード">
      <div style={{ minWidth: timelineMinWidth }}>
        <div className={styles.planHeader}>
          <div className={styles.planMemberHead}>メンバー / 参画案件</div>
          <div className={styles.planWeeks} aria-label="月・週の時間軸">
            <div
              className={styles.planMonthRow}
              style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
            >
              {monthGroups.map((month) => (
                <div
                  className={styles.planMonth}
                  key={month.key}
                  style={{ gridColumn: `span ${month.span}` }}
                >
                  {month.label}
                </div>
              ))}
            </div>
            <div
              className={styles.planWeekRow}
              style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
            >
              {weeks.map((week) => (
                <div className={styles.planWeek} key={week.key}>
                  {formatWeekNumber(week.start)}
                </div>
              ))}
            </div>
          </div>
        </div>
        {members.map((member) => {
          const memberAssignments = assignments.filter(
            (assignment) =>
              assignment.memberId === member.id &&
              visibleStart &&
              visibleEnd &&
              assignment.endDate >= visibleStart &&
              assignment.startDate <= visibleEnd,
          );
          return (
            <div
              className={styles.planRow}
              key={member.id}
              style={{ minHeight: Math.max(58, memberAssignments.length * 38 + 10) }}
            >
              <div className={styles.planMember}>
                <Avatar member={member} />
                <span className={styles.entityText}>
                  <strong className={styles.entityName}>{member.name}</strong>
                  <small className={styles.entityMeta}>{member.role}</small>
                </span>
              </div>
              <div
                className={styles.planTrack}
                style={{ backgroundSize: `${100 / Math.max(weeks.length, 1)}% 100%` }}
              >
                {memberAssignments.map((assignment, index) => {
                  const position = getAssignmentPosition(assignment, visibleStart!, visibleEnd!);
                  return (
                    <button
                      className={`${styles.assignmentBar} ${assignment.status === "draft" ? styles.assignmentDraft : ""}`}
                      key={assignment.id}
                      onClick={() => onEdit(assignment)}
                      style={
                        {
                          "--assignment-color": getProjectColor(assignment.projectId),
                          left: `${position.left}%`,
                          top: 6 + index * 38,
                          width: `${position.width}%`,
                        } as CSSProperties
                      }
                      title={`${assignment.projectName} / ${assignment.role} / ${assignment.allocationPercent}%`}
                      type="button"
                    >
                      <strong className={styles.assignmentName}>{assignment.projectName}</strong>
                      <span className={styles.assignmentMeta}>
                        {assignment.role} / {assignment.allocationPercent}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {members.length === 0 ? (
          <div className={styles.empty}>表示対象のメンバーがいません。</div>
        ) : null}
      </div>
    </div>
  );
}

function DemandEditor({
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

function AssignmentEditor({
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

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <article className={styles.summaryItem}>
      <span className={styles.summaryLabel}>{label}</span>
      <strong className={styles.summaryValue}>{value}</strong>
    </article>
  );
}

function TimelineHeader({
  entityLabel,
  weeks,
}: {
  entityLabel: string;
  weeks: ReturnType<typeof buildWeekColumns>;
}) {
  const monthGroups = buildMonthGroups(weeks);
  return (
    <>
      <div
        className={`${styles.cell} ${styles.head} ${styles.entityCell} ${styles.timelineEntityHead}`}
      >
        {entityLabel}
      </div>
      {monthGroups.map((month) => (
        <div
          className={`${styles.cell} ${styles.head} ${styles.monthHead}`}
          key={month.key}
          style={{ gridColumn: `span ${month.span}` }}
        >
          {month.label}
        </div>
      ))}
      {weeks.map((week) => (
        <div className={`${styles.cell} ${styles.head} ${styles.weekHead}`} key={week.key}>
          {formatWeekNumber(week.start)}
        </div>
      ))}
    </>
  );
}

function MemberGrid({
  onOpenProject,
  rows,
  weeks,
}: {
  onOpenProject: (projectId: string) => void;
  rows: ResourceRowModel[];
  weeks: ReturnType<typeof buildWeekColumns>;
}) {
  return (
    <div className={styles.gridScroll}>
      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `220px repeat(${weeks.length}, minmax(72px, 1fr))` }}
      >
        <TimelineHeader entityLabel="メンバー" weeks={weeks} />
        {rows.map((row) => (
          <MemberGridRow key={row.member.id} onOpenProject={onOpenProject} row={row} />
        ))}
      </div>
      {rows.length === 0 ? (
        <div className={styles.empty}>表示対象のメンバーがいません。</div>
      ) : null}
    </div>
  );
}

function MemberGridRow({
  onOpenProject,
  row,
}: {
  onOpenProject: (projectId: string) => void;
  row: ResourceRowModel;
}) {
  return (
    <>
      <div className={`${styles.cell} ${styles.entityCell}`}>
        <Avatar member={row.member} />
        <span className={styles.entityText}>
          <strong className={styles.entityName}>{row.member.name}</strong>
          <small className={styles.entityMeta}>{row.member.role}</small>
        </span>
      </div>
      {row.cells.map((cell) => (
        <LoadCell cell={cell} key={cell.week} onOpenProject={onOpenProject} />
      ))}
    </>
  );
}

function TeamGrid({
  onOpenProject,
  onOpenTeam,
  rows,
  weeks,
}: {
  onOpenProject: (projectId: string) => void;
  onOpenTeam: (teamId: string) => void;
  rows: Array<{ projectCount: number; rows: ResourceRowModel[]; team: Team }>;
  weeks: ReturnType<typeof buildWeekColumns>;
}) {
  return (
    <div className={styles.gridScroll}>
      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `220px repeat(${weeks.length}, minmax(72px, 1fr))` }}
      >
        <TimelineHeader entityLabel="チーム" weeks={weeks} />
        {rows.map(({ projectCount, rows: memberRows, team }) => (
          <TeamGridRow
            key={team.id}
            memberRows={memberRows}
            onOpenProject={onOpenProject}
            onOpenTeam={onOpenTeam}
            projectCount={projectCount}
            team={team}
            weeks={weeks}
          />
        ))}
      </div>
    </div>
  );
}

function TeamGridRow({
  memberRows,
  onOpenProject,
  onOpenTeam,
  projectCount,
  team,
  weeks,
}: {
  memberRows: ResourceRowModel[];
  onOpenProject: (projectId: string) => void;
  onOpenTeam: (teamId: string) => void;
  projectCount: number;
  team: Team;
  weeks: ReturnType<typeof buildWeekColumns>;
}) {
  return (
    <>
      <div className={`${styles.cell} ${styles.entityCell}`}>
        <span className={styles.entityText}>
          <button className={styles.teamButton} onClick={() => onOpenTeam(team.id)} type="button">
            {team.name}
          </button>
          <small className={styles.entityMeta}>
            {projectCount}案件 / {memberRows.length}名
          </small>
        </span>
      </div>
      {weeks.map((week, index) => (
        <LoadCell
          cell={aggregateTeamCell(memberRows, index, week.key)}
          key={week.key}
          onOpenProject={onOpenProject}
        />
      ))}
    </>
  );
}

function LoadCell({
  cell,
  onOpenProject,
}: {
  cell: ResourceRowModel["cells"][number];
  onOpenProject: (projectId: string) => void;
}) {
  const projects = [
    ...new Map(
      cell.contributions
        .filter((item) => item.projectId)
        .map((item) => [item.projectId!, item.projectName ?? item.projectId!]),
    ).entries(),
  ].slice(0, 2);
  const tone =
    cell.percent >= 100 ? styles.loadDanger : cell.percent >= 82 ? styles.loadWarning : "";
  return (
    <div className={`${styles.cell} ${styles.weekCell}`}>
      <div className={styles.loadLine}>
        <strong className={styles.loadValue}>{cell.percent}%</strong>
        <span className={styles.loadHours}>{cell.hours}h</span>
      </div>
      <div className={styles.loadTrack}>
        <div
          className={`${styles.loadBar} ${tone}`}
          style={{ width: `${Math.min(cell.percent, 100)}%` }}
        />
      </div>
      <div className={styles.projectLinks}>
        {projects.map(([id, name]) => (
          <button
            className={styles.projectLink}
            key={id}
            onClick={() => onOpenProject(id)}
            title={name}
            type="button"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function aggregateTeamCell(
  rows: ResourceRowModel[],
  index: number,
  week: string,
): ResourceRowModel["cells"][number] {
  const cells = rows.map((row) => row.cells[index]).filter(Boolean);
  const hours = cells.reduce((sum, cell) => sum + cell.hours, 0);
  const capacityHours = cells.reduce((sum, cell) => sum + cell.capacityHours, 0);
  const percent = capacityHours > 0 ? Math.round((hours / capacityHours) * 100) : 0;
  return {
    week,
    hours,
    capacityHours,
    percent,
    tone: percent >= 100 ? "danger" : percent >= 82 ? "warning" : "good",
    unavailableDays: cells.reduce((sum, cell) => sum + cell.unavailableDays, 0),
    contributions: cells.flatMap((cell) => cell.contributions),
  };
}

function collectMembers(schedules: ScheduleSnapshot[]): Member[] {
  const members = new Map<string, Member>();
  schedules.forEach((snapshot) =>
    snapshot.members.forEach((member) => members.set(member.id, member)),
  );
  return [...members.values()].filter(isMemberActive);
}

function getScopedMembers(members: Member[], schedules: ScheduleSnapshot[], team?: Team): Member[] {
  const assignedIds = new Set(
    schedules.flatMap((snapshot) => snapshot.tasks.flatMap((task) => task.assigneeIds)),
  );
  const teamIds = new Set(team?.memberIds ?? []);
  return members.filter((member) => !team || teamIds.has(member.id) || assignedIds.has(member.id));
}

function formatPeriod(weeks: ReturnType<typeof buildWeekColumns>) {
  if (weeks.length === 0) return "対象期間なし";
  const start = weeks[0]?.start;
  const end = addDateDays(weeks.at(-1)?.start, 6);
  return start && end ? `${formatMonthDay(start)} - ${formatMonthDay(end)}` : "対象期間なし";
}

function buildMonthGroups(weeks: ReturnType<typeof buildWeekColumns>) {
  return weeks.reduce<Array<{ key: string; label: string; span: number }>>((groups, week) => {
    const key = week.start?.slice(0, 7) ?? "unknown";
    const current = groups.at(-1);
    if (current?.key === key) {
      current.span += 1;
      return groups;
    }
    const [year, month] = key.split("-");
    groups.push({
      key,
      label: key === "unknown" ? "期間未設定" : `${year}/${Number(month)}`,
      span: 1,
    });
    return groups;
  }, []);
}

function formatWeekNumber(dateKey: string | undefined) {
  if (!dateKey) return "W--";
  const date = new Date(`${dateKey}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `W${week}`;
}

function formatMonthDay(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function getProjectAssignments(snapshot: ScheduleSnapshot, members: Member[]): ProjectAssignment[] {
  if ((snapshot.project.assignments?.length ?? 0) > 0) return snapshot.project.assignments ?? [];
  const memberById = new Map(members.map((member) => [member.id, member]));
  return (snapshot.project.memberIds ?? []).map((memberId) => ({
    allocationPercent: 50,
    endDate: snapshot.project.rangeEnd,
    id: `derived-${snapshot.project.id}-${memberId}`,
    memberId,
    role: memberById.get(memberId)?.role ?? "SE",
    startDate: snapshot.project.rangeStart,
    status: "confirmed",
  }));
}

function addDateDays(dateKey: string | undefined, days: number) {
  if (!dateKey) return undefined;
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addDateMonths(dateKey: string, months: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function getAssignmentPosition(
  assignment: ProjectAssignment,
  visibleStart: string,
  visibleEnd: string,
) {
  const totalDays = Math.max(diffDateDays(visibleStart, visibleEnd) + 1, 1);
  const start = assignment.startDate < visibleStart ? visibleStart : assignment.startDate;
  const end = assignment.endDate > visibleEnd ? visibleEnd : assignment.endDate;
  return {
    left: (Math.max(diffDateDays(visibleStart, start), 0) / totalDays) * 100,
    width: (Math.max(diffDateDays(start, end) + 1, 1) / totalDays) * 100,
  };
}

function diffDateDays(start: string, end: string) {
  return Math.round(
    (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) /
      86_400_000,
  );
}

function getProjectColor(projectId: string) {
  const colors = ["#5f85eb", "#45a882", "#8a70df", "#e29a42", "#4d9db5", "#d46f83"];
  const hash = [...projectId].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
