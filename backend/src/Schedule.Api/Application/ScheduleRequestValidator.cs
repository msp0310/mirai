using Schedule.Api.Contracts;

namespace Schedule.Api.Application;

/// <summary>スケジュール保存リクエストの整合性を検証します。</summary>
public static class ScheduleRequestValidator
{
    /// <summary>保存前に案件ID、タスク階層、依存関係、日付範囲を検証します。</summary>
    public static string? Validate(string projectId, SaveScheduleRequest request)
    {
        if (!string.Equals(projectId, request.Project.Id, StringComparison.Ordinal))
        {
            return "URLのプロジェクトIDと保存データのプロジェクトIDが一致しません。";
        }

        var taskIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var task in request.Tasks)
        {
            if (string.IsNullOrWhiteSpace(task.Id) || !taskIds.Add(task.Id))
            {
                return "タスクIDが空、または重複しています。";
            }

            if (!DateOnly.TryParse(task.Start, out var start) ||
                !DateOnly.TryParse(task.End, out var end) ||
                start > end)
            {
                return $"タスク「{task.Title}」の期間が不正です。";
            }
        }

        foreach (var task in request.Tasks)
        {
            if (task.ParentId is not null && !taskIds.Contains(task.ParentId))
            {
                return $"タスク「{task.Title}」の親タスクが存在しません。";
            }

            if ((task.Dependencies ?? []).Any(dependencyId => !taskIds.Contains(dependencyId)))
            {
                return $"タスク「{task.Title}」の依存先タスクが存在しません。";
            }
        }

        if (!DateOnly.TryParse(request.Project.RangeStart, out var projectStart) ||
            !DateOnly.TryParse(request.Project.RangeEnd, out var projectEnd) ||
            projectStart > projectEnd)
        {
            return "プロジェクト期間が不正です。";
        }

        foreach (var assignment in request.Project.Assignments ?? [])
        {
            if (!DateOnly.TryParse(assignment.StartDate, out var start) ||
                !DateOnly.TryParse(assignment.EndDate, out var end) ||
                start > end ||
                assignment.AllocationPercent is < 1 or > 100)
            {
                return $"要員アサイン「{assignment.Id}」の期間または配分率が不正です。";
            }
        }

        foreach (var demand in request.Project.StaffingDemands ?? [])
        {
            if (!DateOnly.TryParse(demand.StartDate, out var start) ||
                !DateOnly.TryParse(demand.EndDate, out var end) ||
                start > end ||
                demand.RequiredCount < 1 ||
                demand.AllocationPercent is < 1 or > 100)
            {
                return $"要員要求「{demand.Id}」の内容が不正です。";
            }
        }

        if (request.Calendar.WorkWeek.Any(day => day is < 0 or > 6))
        {
            return "稼働曜日の値が不正です。";
        }

        return null;
    }
}
