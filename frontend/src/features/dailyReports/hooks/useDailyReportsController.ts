import { useEffect, useMemo, useState } from "react";

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
import type { DailyReport, Team } from "../../../types/schedule";
import {
  canManageTeamReports,
  collectScheduleMembers,
  createDailyReportDraft,
  findCurrentMember,
} from "../model/dailyReports";

type UseDailyReportsControllerOptions = {
  currentUser: AuthUser;
  schedules: ScheduleSnapshot[];
  team: Team;
  todayKey: string;
};

/** 日報の取得、選択、保存、提出、コメントを画面から分離したI/O境界です。 */
export function useDailyReportsController({
  currentUser,
  schedules,
  team,
  todayKey,
}: UseDailyReportsControllerOptions) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DailyReport | null>(null);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("読み込み中...");
  const [viewMode, setViewMode] = useState<"mine" | "team">("team");
  const members = useMemo(() => collectScheduleMembers(schedules), [schedules]);
  const currentMember = findCurrentMember(members, currentUser);
  const canManageTeam = canManageTeamReports(team, currentUser);
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
        if (active) {
          setReports(items);
          setMessage(items.length === 0 ? "日報はまだありません。" : "");
        }
      })
      .catch(() => active && setMessage("日報を読み込めませんでした。"));
    return () => {
      active = false;
    };
  }, [team.id]);

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

  function openOwnReport(date = todayKey) {
    const existing = personalReports.find((report) => report.date === date);
    if (existing) {
      selectReport(existing);
    } else if (currentMember && schedules.length > 0) {
      const report = createDailyReportDraft(currentMember.id, date, schedules[0].project.id);
      setSelectedId(report.id);
      setDraft(report);
    }
    setViewMode("mine");
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

  async function addComment(reportId = draft?.id, body = comment) {
    if (!reportId || !body.trim()) {
      return;
    }
    try {
      const saved = await addDailyReportComment(reportId, body.trim());
      if (draft?.id === reportId) {
        setDraft(saved);
      }
      setReports((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setComment("");
      setMessage("コメントを追加しました。");
    } catch {
      setMessage("コメントを保存できませんでした。");
    }
  }

  async function remind(date: string, memberIds: string[]) {
    await sendDailyReportReminders(team.id, date, memberIds);
    setMessage(`${memberIds.length}名へ日報提出のリマインドを送りました。`);
  }

  return {
    addComment,
    canManageTeam,
    comment,
    currentMember,
    draft,
    members,
    message,
    openOwnReport,
    openTeamReport,
    persist,
    personalReports,
    remind,
    removeReport,
    reports,
    selectedId,
    selectReport,
    setComment,
    setDraft,
    setViewMode,
    teamMembers,
    teamReports,
    viewMode,
    visibleReports,
  };
}
