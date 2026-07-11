using System.Text.Json;
using Schedule.Api.Contracts;
using Schedule.Api.Domain;

namespace Schedule.Api.Application;

/// <summary>EF CoreのエンティティとAPI契約DTOの変換を一箇所に集約します。</summary>
public static class ScheduleMapper
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>チームエンティティをAPI DTOへ変換します。</summary>
    public static TeamDto ToDto(TeamEntity entity)
    {
        return new TeamDto(
            entity.Id,
            entity.Name,
            entity.Code,
            entity.Description,
            entity.Members.Select(member => member.MemberId).Order().ToArray());
    }

    /// <summary>メンバーと任意のログインアカウントをAPI DTOへ変換します。</summary>
    public static MemberDto ToDto(MemberEntity entity, UserEntity? account = null)
    {
        return new MemberDto(
            entity.Id,
            entity.Name,
            entity.Initials,
            entity.Role,
            entity.Color,
            entity.CapacityHours,
            entity.Status,
            entity.InactiveAt,
            ReadJson<IReadOnlyList<MemberAvailabilityOverrideDto>>(entity.AvailabilityOverridesJson),
            account?.Email,
            account?.Role,
            account?.IsActive ?? false,
            account?.CreatedAt,
            account?.LastLoginAt,
            account?.PasswordChangedAt,
            account?.PasswordResetRequired ?? false);
    }

    /// <summary>カレンダーエンティティを休日を含むAPI DTOへ変換します。</summary>
    public static CalendarDefinitionDto ToDto(CalendarEntity entity)
    {
        return new CalendarDefinitionDto(
            entity.Id,
            entity.Name,
            ReadJson<IReadOnlyList<int>>(entity.WorkWeekJson) ?? [1, 2, 3, 4, 5],
            entity.Holidays
                .OrderBy(holiday => holiday.Date)
                .Select(holiday => new CalendarHolidayDto(holiday.Date, holiday.Name))
                .ToArray());
    }

    /// <summary>プロジェクトエンティティをAPI DTOへ変換します。</summary>
    public static ProjectDto ToDto(ProjectEntity entity)
    {
        return new ProjectDto(
            entity.Id,
            entity.TeamId,
            entity.Name,
            entity.Workspace,
            entity.LifecycleStatus,
            entity.Members.Select(member => member.MemberId).Order().ToArray(),
            entity.RangeStart,
            entity.RangeEnd,
            new NextMilestoneDto(entity.NextMilestoneTitle, entity.NextMilestoneDate),
            entity.Status,
            entity.ArchivedAt,
            entity.Version,
            entity.Assignments
                .OrderBy(assignment => assignment.StartDate)
                .Select(assignment => new ProjectAssignmentDto(
                    assignment.Id,
                    assignment.MemberId,
                    assignment.Role,
                    assignment.StartDate,
                    assignment.EndDate,
                    assignment.AllocationPercent,
                    assignment.Status))
                .ToArray(),
            entity.StaffingDemands
                .OrderBy(demand => demand.StartDate)
                .Select(demand => new StaffingDemandDto(
                    demand.Id,
                    demand.Role,
                    demand.StartDate,
                    demand.EndDate,
                    demand.RequiredCount,
                    demand.AllocationPercent,
                    demand.Status))
                .ToArray());
    }

    /// <summary>タスクエンティティと関連付けをAPI DTOへ変換します。</summary>
    public static ScheduleTaskDto ToDto(TaskEntity entity)
    {
        return new ScheduleTaskDto(
            entity.Id,
            entity.ParentId,
            entity.Title,
            entity.Type,
            entity.Status,
            entity.Start,
            entity.End,
            entity.Progress,
            entity.Assignments
                .OrderBy(assignment => assignment.MemberId)
                .Select(assignment => assignment.MemberId)
                .ToArray(),
            entity.Assignments
                .Where(assignment => assignment.Percent is not null)
                .OrderBy(assignment => assignment.MemberId)
                .Select(assignment => new TaskAssigneeAllocationDto(
                    assignment.MemberId,
                    assignment.Percent!.Value))
                .ToArray(),
            entity.Color,
            entity.Expanded,
            entity.Dependencies
                .OrderBy(dependency => dependency.DependsOnTaskId)
                .Select(dependency => dependency.DependsOnTaskId)
                .ToArray(),
            entity.Description,
            entity.EffortHours,
            entity.BaselineStart,
            entity.BaselineEnd,
            entity.BaselineCapturedAt,
            ReadJson<IReadOnlyList<TaskChecklistItemDto>>(entity.ChecklistJson),
            ReadJson<IReadOnlyList<TaskCommentDto>>(entity.CommentsJson),
            ReadJson<IReadOnlyList<TaskReferenceLinkDto>>(entity.LinksJson));
    }

    /// <summary>課題エンティティをAPI DTOへ変換します。</summary>
    public static ProjectIssueDto ToDto(ProjectIssueEntity entity)
    {
        var github = entity.GitHubRepository is not null ||
            entity.GitHubIssueNumber is not null ||
            entity.GitHubUrl is not null ||
            entity.GitHubState is not null ||
            entity.GitHubSyncStatus is not null ||
            entity.GitHubLastSyncedAt is not null
                ? new ProjectIssueGitHubDto(
                    entity.GitHubRepository,
                    entity.GitHubIssueNumber,
                    entity.GitHubUrl,
                    entity.GitHubState,
                    entity.GitHubSyncStatus,
                    entity.GitHubLastSyncedAt)
                : null;

        return new ProjectIssueDto(
            entity.Id,
            entity.Title,
            entity.Body,
            entity.Status,
            entity.Priority,
            entity.Type,
            ReadJson<IReadOnlyList<string>>(entity.AssigneeIdsJson) ?? [],
            ReadJson<IReadOnlyList<string>>(entity.TaskIdsJson) ?? [],
            entity.DueDate,
            entity.CreatedAt,
            entity.UpdatedAt,
            entity.ClosedAt,
            ReadJson<IReadOnlyList<ProjectIssueReplyDto>>(entity.RepliesJson) ?? [],
            github);
    }

    /// <summary>作業時間エンティティをAPI DTOへ変換します。</summary>
    public static ProjectWorkLogDto ToDto(ProjectWorkLogEntity entity)
    {
        return new ProjectWorkLogDto(
            entity.Id,
            entity.Date,
            entity.MemberId,
            entity.Hours,
            entity.Category,
            entity.Summary,
            entity.Note,
            entity.TaskId,
            entity.IssueId,
            entity.Billable,
            entity.CreatedBy,
            entity.CreatedAt,
            entity.UpdatedAt,
            entity.DailyReportId,
            entity.DailyReportEntryId);
    }

    /// <summary>プロジェクトと関連データから画面用スナップショットを作成します。</summary>
    public static ScheduleSnapshotDto ToSnapshot(
        ProjectEntity project,
        CalendarEntity calendar,
        IReadOnlyList<MemberEntity> members,
        IReadOnlyList<TaskEntity> tasks,
        IReadOnlyDictionary<string, UserEntity>? accountsByMemberId = null)
    {
        return new ScheduleSnapshotDto(
            ToDto(calendar),
            project.Issues.OrderByDescending(issue => issue.UpdatedAt).Select(ToDto).ToArray(),
            members
                .Select(member => ToDto(
                    member,
                    accountsByMemberId is not null &&
                        accountsByMemberId.TryGetValue(member.Id, out var account)
                            ? account
                            : null))
                .OrderBy(member => member.Id)
                .ToArray(),
            ToDto(project),
            tasks.OrderBy(task => task.SortOrder).Select(ToDto).ToArray(),
            project.WorkLogs
                .OrderByDescending(workLog => workLog.Date)
                .ThenByDescending(workLog => workLog.UpdatedAt)
                .Select(ToDto)
                .ToArray());
    }

    /// <summary>メンバーDTOを永続化エンティティへ変換します。</summary>
    public static MemberEntity ToEntity(MemberDto dto)
    {
        return new MemberEntity
        {
            Id = dto.Id,
            Name = dto.Name,
            Initials = dto.Initials,
            Role = dto.Role,
            Color = dto.Color,
            CapacityHours = dto.CapacityHours,
            Status = dto.Status,
            InactiveAt = dto.InactiveAt,
            AvailabilityOverridesJson = WriteJson(dto.AvailabilityOverrides)
        };
    }

    /// <summary>プロジェクトDTOを永続化エンティティへ変換します。</summary>
    public static ProjectEntity ToEntity(ProjectDto dto, int version)
    {
        return new ProjectEntity
        {
            Id = dto.Id,
            TeamId = dto.TeamId,
            Name = dto.Name,
            Workspace = dto.Workspace,
            LifecycleStatus = dto.LifecycleStatus,
            RangeStart = dto.RangeStart,
            RangeEnd = dto.RangeEnd,
            NextMilestoneTitle = dto.NextMilestone.Title,
            NextMilestoneDate = dto.NextMilestone.Date,
            Status = dto.Status,
            ArchivedAt = dto.ArchivedAt,
            Version = version
        };
    }

    /// <summary>カレンダーDTOをプロジェクト所属のエンティティへ変換します。</summary>
    public static CalendarEntity ToEntity(CalendarDefinitionDto dto, string projectId)
    {
        return new CalendarEntity
        {
            Id = dto.Id,
            ProjectId = projectId,
            Name = dto.Name,
            WorkWeekJson = WriteJson(dto.WorkWeek) ?? "[1,2,3,4,5]",
            Holidays = dto.Holidays
                .Select(holiday => new CalendarHolidayEntity
                {
                    CalendarId = dto.Id,
                    Date = holiday.Date,
                    Name = holiday.Name
                })
                .ToList()
        };
    }

    /// <summary>タスクDTOと担当・依存関係をエンティティへ変換します。</summary>
    public static TaskEntity ToEntity(ScheduleTaskDto dto, string projectId, int sortOrder)
    {
        return new TaskEntity
        {
            Id = dto.Id,
            ProjectId = projectId,
            ParentId = dto.ParentId,
            Title = dto.Title,
            Type = dto.Type,
            Status = dto.Status,
            Start = dto.Start,
            End = dto.End,
            Progress = dto.Progress,
            Color = dto.Color,
            Expanded = dto.Expanded,
            SortOrder = sortOrder,
            Description = dto.Description,
            EffortHours = dto.EffortHours,
            BaselineStart = dto.BaselineStart,
            BaselineEnd = dto.BaselineEnd,
            BaselineCapturedAt = dto.BaselineCapturedAt,
            ChecklistJson = WriteJson(dto.Checklist),
            CommentsJson = WriteJson(dto.Comments),
            LinksJson = WriteJson(dto.Links),
            Assignments = dto.AssigneeIds
                .Distinct()
                .Select(memberId =>
                {
                    var percent = dto.AssigneeAllocations?
                        .FirstOrDefault(allocation => allocation.MemberId == memberId)
                        ?.Percent;
                    return new TaskAssignmentEntity
                    {
                        TaskId = dto.Id,
                        MemberId = memberId,
                        Percent = percent
                    };
                })
                .ToList(),
            Dependencies = (dto.Dependencies ?? [])
                .Distinct()
                .Select(dependencyId => new TaskDependencyEntity
                {
                    TaskId = dto.Id,
                    DependsOnTaskId = dependencyId
                })
                .ToList()
        };
    }

    /// <summary>課題DTOをプロジェクト所属のエンティティへ変換します。</summary>
    public static ProjectIssueEntity ToEntity(ProjectIssueDto dto, string projectId)
    {
        return new ProjectIssueEntity
        {
            Id = dto.Id,
            ProjectId = projectId,
            Title = dto.Title,
            Body = dto.Body,
            Status = dto.Status,
            Priority = dto.Priority,
            Type = dto.Type,
            AssigneeIdsJson = WriteJson(dto.AssigneeIds.Distinct().ToArray()) ?? "[]",
            TaskIdsJson = WriteJson(dto.TaskIds.Distinct().ToArray()) ?? "[]",
            RepliesJson = WriteJson(dto.Replies) ?? "[]",
            DueDate = dto.DueDate,
            CreatedAt = dto.CreatedAt,
            UpdatedAt = dto.UpdatedAt,
            ClosedAt = dto.ClosedAt,
            GitHubRepository = dto.Github?.Repository,
            GitHubIssueNumber = dto.Github?.IssueNumber,
            GitHubUrl = dto.Github?.Url,
            GitHubState = dto.Github?.State,
            GitHubSyncStatus = dto.Github?.SyncStatus,
            GitHubLastSyncedAt = dto.Github?.LastSyncedAt
        };
    }

    /// <summary>作業時間DTOをプロジェクト所属のエンティティへ変換します。</summary>
    public static ProjectWorkLogEntity ToEntity(ProjectWorkLogDto dto, string projectId)
    {
        return new ProjectWorkLogEntity
        {
            Id = dto.Id,
            ProjectId = projectId,
            Date = dto.Date,
            MemberId = dto.MemberId,
            Hours = dto.Hours,
            Category = dto.Category,
            Summary = dto.Summary,
            Note = dto.Note,
            TaskId = dto.TaskId,
            IssueId = dto.IssueId,
            Billable = dto.Billable,
            CreatedBy = dto.CreatedBy,
            CreatedAt = dto.CreatedAt,
            UpdatedAt = dto.UpdatedAt,
            DailyReportId = dto.DailyReportId,
            DailyReportEntryId = dto.DailyReportEntryId
        };
    }

    /// <summary>スケジュール変更履歴をAPI DTOへ変換します。</summary>
    public static ScheduleChangeLogDto ToDto(ScheduleChangeLogEntity entity)
    {
        return new ScheduleChangeLogDto(
            entity.Id,
            entity.ProjectId,
            entity.TaskId,
            entity.Field,
            entity.BeforeValue,
            entity.AfterValue,
            entity.DeltaDays,
            entity.ChangedAt,
            entity.ChangedBy,
            entity.Reason);
    }

    /// <summary>任意の契約オブジェクトをSQLite保存用JSONへ変換します。</summary>
    public static string? WriteJson<T>(T? value)
    {
        return value is null ? null : JsonSerializer.Serialize(value, JsonOptions);
    }

    /// <summary>永続化されたJSON文字列を指定型へ安全に復元します。</summary>
    private static T? ReadJson<T>(string? source)
    {
        return string.IsNullOrWhiteSpace(source) ? default : JsonSerializer.Deserialize<T>(source, JsonOptions);
    }
}
