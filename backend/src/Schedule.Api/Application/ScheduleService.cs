using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Schedule.Api.Contracts;
using Schedule.Api.Domain;
using Schedule.Api.Infrastructure;

namespace Schedule.Api.Application;

/// <summary>プロジェクト、タスク、カレンダーの保存境界を提供します。</summary>
public sealed class ScheduleService(ScheduleDbContext db)
{
    /// <summary>案件一覧用にチームと軽量案件集計だけを取得します。</summary>
    public async Task<WorkspaceSummaryDto> GetWorkspaceSummaryAsync(
        CancellationToken cancellationToken)
    {
        var teams = await db.Teams
            .Include(team => team.Members)
            .AsNoTracking()
            .OrderBy(team => team.Code)
            .ToListAsync(cancellationToken);

        return new WorkspaceSummaryDto(
            teams.Select(ScheduleMapper.ToDto).ToArray(),
            await GetProjectSummariesAsync(cancellationToken));
    }

    /// <summary>チームとプロジェクト一覧を読み込み、フロントエンドのワークスペースへ変換します。</summary>
    public async Task<ScheduleWorkspaceDto> GetWorkspaceAsync(CancellationToken cancellationToken)
    {
        var teams = await db.Teams
            .Include(team => team.Members)
            .AsNoTracking()
            .OrderBy(team => team.Code)
            .ToListAsync(cancellationToken);
        var projects = await LoadProjectsQuery()
            .AsNoTracking()
            .OrderBy(project => project.TeamId)
            .ThenBy(project => project.Workspace)
            .ToListAsync(cancellationToken);
        var members = await db.Members
            .AsNoTracking()
            .OrderBy(member => member.Id)
            .ToListAsync(cancellationToken);
        var accountsByMemberId = await LoadMemberAccountsAsync(
            members.Select(member => member.Id),
            cancellationToken);

        return new ScheduleWorkspaceDto(
            teams.Select(ScheduleMapper.ToDto).ToArray(),
            projects.Select(project => ToSnapshot(project, members, accountsByMemberId)).ToArray());
    }

    /// <summary>
    /// 案件一覧向けの軽量な集計を取得します。
    /// Gantt詳細を必要としない画面が、全タスク本文を転送せずに表示できます。
    /// </summary>
    public async Task<IReadOnlyList<ProjectSummaryDto>> GetProjectSummariesAsync(
        CancellationToken cancellationToken)
    {
        var projects = await db.Projects
            .Include(project => project.Members)
            .AsNoTracking()
            .OrderBy(project => project.TeamId)
            .ThenBy(project => project.Workspace)
            .Select(project => new
            {
                Project = project,
                TaskCount = project.Tasks.Count(task => task.Type == "task"),
                CompletedTaskCount = project.Tasks.Count(task => task.Type == "task" && task.Status == "done"),
                DelayedTaskCount = project.Tasks.Count(task => task.Type == "task" && task.Status == "delayed"),
                Progress = project.Tasks
                    .Where(task => task.Type == "task")
                    .Select(task => (int?)task.Progress)
                    .Average() ?? 0,
                MemberCount = project.Members.Count
            })
            .ToListAsync(cancellationToken);

        return projects
            .Select(row => new ProjectSummaryDto(
                ScheduleMapper.ToDto(row.Project),
                row.TaskCount,
                row.CompletedTaskCount,
                row.DelayedTaskCount,
                Convert.ToInt32(Math.Round(row.Progress)),
                row.MemberCount))
            .ToArray();
    }

    /// <summary>指定プロジェクトの最新スケジュールを取得します。</summary>
    public async Task<ScheduleSnapshotDto?> GetProjectScheduleAsync(
        string projectId,
        CancellationToken cancellationToken)
    {
        var project = await LoadProjectsQuery()
            .AsNoTracking()
            .FirstOrDefaultAsync(project => project.Id == projectId, cancellationToken);
        if (project is null || project.Calendar is null)
        {
            return null;
        }

        var memberIds = project.Members.Select(member => member.MemberId).ToHashSet();
        var taskMemberIds = project.Tasks
            .SelectMany(task => task.Assignments)
            .Select(assignment => assignment.MemberId);
        memberIds.UnionWith(taskMemberIds);
        var members = await db.Members
            .AsNoTracking()
            .Where(member => memberIds.Contains(member.Id))
            .OrderBy(member => member.Id)
            .ToListAsync(cancellationToken);
        var accountsByMemberId = await LoadMemberAccountsAsync(memberIds, cancellationToken);

        return ScheduleMapper.ToSnapshot(
            project,
            project.Calendar,
            members,
            project.Tasks.OrderBy(task => task.SortOrder).ToArray(),
            accountsByMemberId);
    }

    /// <summary>期待バージョンを検証し、プロジェクト単位でスケジュールを保存します。</summary>
    public async Task<SaveScheduleResponse?> SaveProjectScheduleAsync(
        string projectId,
        SaveScheduleRequest request,
        string changedBy,
        CancellationToken cancellationToken)
    {
        var existingProject = await LoadProjectsQuery()
            .FirstOrDefaultAsync(project => project.Id == projectId, cancellationToken);
        if (existingProject is null || existingProject.Calendar is null)
        {
            return null;
        }

        if (request.ExpectedVersion is not null && request.ExpectedVersion != existingProject.Version)
        {
            throw new ScheduleConflictException(existingProject.Version);
        }

        var oldTasks = existingProject.Tasks.ToDictionary(task => task.Id);
        var nextVersion = existingProject.Version + 1;
        var now = DateTimeOffset.UtcNow.ToString("O");

        await UpsertMembersAsync(request.Members, cancellationToken);
        ReplaceProjectMembers(existingProject, request.Project.MemberIds ?? []);
        ReplaceCalendar(existingProject, request.Calendar);
        ReplaceIssues(existingProject, request.Issues ?? []);
        ReplaceWorkLogs(existingProject, request.WorkLogs ?? []);
        ReplaceTasks(existingProject, request.Tasks);
        RecordTaskChanges(projectId, oldTasks, request.Tasks, now, changedBy);

        existingProject.TeamId = request.Project.TeamId;
        existingProject.Name = request.Project.Name;
        existingProject.Workspace = request.Project.Workspace;
        existingProject.LifecycleStatus = request.Project.LifecycleStatus;
        existingProject.RangeStart = request.Project.RangeStart;
        existingProject.RangeEnd = request.Project.RangeEnd;
        existingProject.NextMilestoneTitle = request.Project.NextMilestone.Title;
        existingProject.NextMilestoneDate = request.Project.NextMilestone.Date;
        existingProject.Status = request.Project.Status;
        existingProject.ArchivedAt = request.Project.ArchivedAt;
        existingProject.Version = nextVersion;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            var currentVersion = await db.Projects
                .AsNoTracking()
                .Where(project => project.Id == projectId)
                .Select(project => (int?)project.Version)
                .SingleOrDefaultAsync(cancellationToken);
            throw new ScheduleConflictException(currentVersion ?? existingProject.Version);
        }

        var savedSnapshot = await GetProjectScheduleAsync(projectId, cancellationToken)
            ?? throw new InvalidOperationException("Saved project disappeared.");
        return new SaveScheduleResponse("remote", $"project-{projectId}-v{nextVersion}", now, savedSnapshot);
    }

    /// <summary>プロジェクトの直近のタスク変更履歴を新しい順で取得します。</summary>
    public async Task<IReadOnlyList<ScheduleChangeLogDto>> GetChangeLogsAsync(
        string projectId,
        CancellationToken cancellationToken)
    {
        var logs = await db.ScheduleChangeLogs
            .AsNoTracking()
            .Where(log => log.ProjectId == projectId)
            .OrderByDescending(log => log.ChangedAt)
            .Take(200)
            .ToListAsync(cancellationToken);
        return logs.Select(ScheduleMapper.ToDto).ToArray();
    }

    /// <summary>プロジェクトを関連データと一緒に読み込むクエリを作成します。</summary>
    private IQueryable<ProjectEntity> LoadProjectsQuery()
    {
        return db.Projects
            .AsSplitQuery()
            .Include(project => project.Members)
            .Include(project => project.Calendar!)
                .ThenInclude(calendar => calendar.Holidays)
            .Include(project => project.Issues)
            .Include(project => project.WorkLogs)
            .Include(project => project.Tasks)
                .ThenInclude(task => task.Assignments)
            .Include(project => project.Tasks)
                .ThenInclude(task => task.Dependencies);
    }

    /// <summary>永続化エンティティを案件スケジュールのDTOへ変換します。</summary>
    private static ScheduleSnapshotDto ToSnapshot(
        ProjectEntity project,
        IReadOnlyList<MemberEntity> allMembers,
        IReadOnlyDictionary<string, UserEntity> accountsByMemberId)
    {
        if (project.Calendar is null)
        {
            throw new InvalidOperationException($"Project {project.Id} has no calendar.");
        }

        var memberIds = project.Members.Select(member => member.MemberId).ToHashSet();
        memberIds.UnionWith(project.Tasks.SelectMany(task => task.Assignments).Select(assignment => assignment.MemberId));
        var members = allMembers.Where(member => memberIds.Contains(member.Id)).ToArray();
        return ScheduleMapper.ToSnapshot(
            project,
            project.Calendar,
            members,
            project.Tasks.OrderBy(task => task.SortOrder).ToArray(),
            accountsByMemberId);
    }

    /// <summary>指定されたメンバーに紐づくログインアカウントをまとめて読み込みます。</summary>
    private async Task<IReadOnlyDictionary<string, UserEntity>> LoadMemberAccountsAsync(
        IEnumerable<string> memberIds,
        CancellationToken cancellationToken)
    {
        var ids = memberIds.ToHashSet();
        return await db.Users
            .AsNoTracking()
            .Where(user => user.MemberId != null && ids.Contains(user.MemberId))
            .ToDictionaryAsync(user => user.MemberId!, cancellationToken);
    }

    /// <summary>受信したメンバー情報を新規作成または更新します。</summary>
    private async Task UpsertMembersAsync(
        IReadOnlyList<MemberDto> memberDtos,
        CancellationToken cancellationToken)
    {
        var existingMembers = await db.Members
            .Where(member => memberDtos.Select(dto => dto.Id).Contains(member.Id))
            .ToDictionaryAsync(member => member.Id, cancellationToken);

        foreach (var dto in memberDtos)
        {
            if (!existingMembers.TryGetValue(dto.Id, out var member))
            {
                db.Members.Add(ScheduleMapper.ToEntity(dto));
                continue;
            }

            member.Name = dto.Name;
            member.Initials = dto.Initials;
            member.Role = dto.Role;
            member.Color = dto.Color;
            member.CapacityHours = dto.CapacityHours;
            member.Status = dto.Status;
            member.InactiveAt = dto.InactiveAt;
            member.AvailabilityOverridesJson = ScheduleMapper.WriteJson(dto.AvailabilityOverrides);
        }
    }

    /// <summary>プロジェクトのメンバー関連を受信内容で置き換えます。</summary>
    private static void ReplaceProjectMembers(ProjectEntity project, IReadOnlyList<string> memberIds)
    {
        project.Members.Clear();
        foreach (var memberId in memberIds.Distinct())
        {
            project.Members.Add(new ProjectMemberEntity
            {
                ProjectId = project.Id,
                MemberId = memberId
            });
        }
    }

    /// <summary>プロジェクトの稼働カレンダーと休日を受信内容で更新します。</summary>
    private static void ReplaceCalendar(ProjectEntity project, CalendarDefinitionDto dto)
    {
        project.Calendar!.Id = dto.Id;
        project.Calendar.Name = dto.Name;
        project.Calendar.WorkWeekJson = ScheduleMapper.WriteJson(dto.WorkWeek) ?? "[1,2,3,4,5]";
        project.Calendar.Holidays.Clear();
        foreach (var holiday in dto.Holidays)
        {
            project.Calendar.Holidays.Add(new CalendarHolidayEntity
            {
                CalendarId = dto.Id,
                Date = holiday.Date,
                Name = holiday.Name
            });
        }
    }

    /// <summary>タスクをID単位で差分更新し、変更のない行を再作成しません。</summary>
    /// <summary>タスクをID単位で追加・更新・削除し、並び順を同期します。</summary>
    private void ReplaceTasks(ProjectEntity project, IReadOnlyList<ScheduleTaskDto> tasks)
    {
        var taskIds = tasks.Select(task => task.Id).ToHashSet();
        var existingTasks = project.Tasks.ToDictionary(task => task.Id);
        var removedTasks = project.Tasks.Where(task => !taskIds.Contains(task.Id)).ToArray();
        foreach (var removedTask in removedTasks)
        {
            project.Tasks.Remove(removedTask);
        }
        db.Tasks.RemoveRange(removedTasks);
        for (var index = 0; index < tasks.Count; index += 1)
        {
            var dto = tasks[index];
            if (!existingTasks.TryGetValue(dto.Id, out var entity))
            {
                project.Tasks.Add(ScheduleMapper.ToEntity(dto, project.Id, index));
                continue;
            }

            ApplyTask(entity, dto, index);
        }
    }

    /// <summary>既存タスクの値と関連行を必要な範囲だけ更新します。</summary>
    /// <summary>1件のタスク本体と担当者・依存関係を更新します。</summary>
    private static void ApplyTask(TaskEntity entity, ScheduleTaskDto dto, int sortOrder)
    {
        entity.ParentId = dto.ParentId;
        entity.Title = dto.Title;
        entity.Type = dto.Type;
        entity.Status = dto.Status;
        entity.Start = dto.Start;
        entity.End = dto.End;
        entity.Progress = dto.Progress;
        entity.Color = dto.Color;
        entity.Expanded = dto.Expanded;
        entity.SortOrder = sortOrder;
        entity.Description = dto.Description;
        entity.EffortHours = dto.EffortHours;
        entity.BaselineStart = dto.BaselineStart;
        entity.BaselineEnd = dto.BaselineEnd;
        entity.BaselineCapturedAt = dto.BaselineCapturedAt;
        entity.ChecklistJson = ScheduleMapper.WriteJson(dto.Checklist);
        entity.CommentsJson = ScheduleMapper.WriteJson(dto.Comments);
        entity.LinksJson = ScheduleMapper.WriteJson(dto.Links);

        var allocations = (dto.AssigneeAllocations ?? [])
            .GroupBy(allocation => allocation.MemberId)
            .ToDictionary(group => group.Key, group => group.Last().Percent);
        var assigneeIds = dto.AssigneeIds.Distinct().ToHashSet();
        entity.Assignments.RemoveAll(assignment => !assigneeIds.Contains(assignment.MemberId));
        foreach (var assignment in entity.Assignments)
        {
            assignment.Percent = allocations.GetValueOrDefault(assignment.MemberId);
        }
        foreach (var memberId in assigneeIds.Where(memberId =>
                     entity.Assignments.All(assignment => assignment.MemberId != memberId)))
        {
            entity.Assignments.Add(new TaskAssignmentEntity
            {
                MemberId = memberId,
                Percent = allocations.GetValueOrDefault(memberId),
                TaskId = entity.Id
            });
        }

        var dependencyIds = (dto.Dependencies ?? []).Distinct().ToHashSet();
        entity.Dependencies.RemoveAll(dependency => !dependencyIds.Contains(dependency.DependsOnTaskId));
        foreach (var dependencyId in dependencyIds.Where(dependencyId =>
                     entity.Dependencies.All(dependency => dependency.DependsOnTaskId != dependencyId)))
        {
            entity.Dependencies.Add(new TaskDependencyEntity
            {
                DependsOnTaskId = dependencyId,
                TaskId = entity.Id
            });
        }
    }

    /// <summary>課題をID単位で差分更新し、変更のない行を再作成しません。</summary>
    /// <summary>課題をID単位で追加・更新・削除します。</summary>
    private void ReplaceIssues(ProjectEntity project, IReadOnlyList<ProjectIssueDto> issues)
    {
        var issueIds = issues.Select(issue => issue.Id).ToHashSet();
        var existingIssues = project.Issues.ToDictionary(issue => issue.Id);
        var removedIssues = project.Issues.Where(issue => !issueIds.Contains(issue.Id)).ToArray();
        foreach (var removedIssue in removedIssues)
        {
            project.Issues.Remove(removedIssue);
        }
        db.ProjectIssues.RemoveRange(removedIssues);

        foreach (var dto in issues)
        {
            if (!existingIssues.TryGetValue(dto.Id, out var entity))
            {
                project.Issues.Add(ScheduleMapper.ToEntity(dto, project.Id));
                continue;
            }

            ApplyIssue(entity, dto);
        }
    }

    /// <summary>作業時間をID単位で差分更新し、変更のない行を再作成しません。</summary>
    /// <summary>作業時間をID単位で追加・更新・削除します。</summary>
    private void ReplaceWorkLogs(ProjectEntity project, IReadOnlyList<ProjectWorkLogDto> workLogs)
    {
        var workLogIds = workLogs.Select(workLog => workLog.Id).ToHashSet();
        var existingWorkLogs = project.WorkLogs.ToDictionary(workLog => workLog.Id);
        var removedWorkLogs = project.WorkLogs
            .Where(workLog => !workLogIds.Contains(workLog.Id))
            .ToArray();
        foreach (var removedWorkLog in removedWorkLogs)
        {
            project.WorkLogs.Remove(removedWorkLog);
        }
        db.ProjectWorkLogs.RemoveRange(removedWorkLogs);

        foreach (var dto in workLogs)
        {
            if (!existingWorkLogs.TryGetValue(dto.Id, out var entity))
            {
                project.WorkLogs.Add(ScheduleMapper.ToEntity(dto, project.Id));
                continue;
            }

            ApplyWorkLog(entity, dto);
        }
    }

    /// <summary>1件の課題と将来のGitHub連携情報を更新します。</summary>
    private static void ApplyIssue(ProjectIssueEntity entity, ProjectIssueDto dto)
    {
        entity.Title = dto.Title;
        entity.Body = dto.Body;
        entity.Status = dto.Status;
        entity.Priority = dto.Priority;
        entity.Type = dto.Type;
        entity.AssigneeIdsJson = ScheduleMapper.WriteJson(dto.AssigneeIds.Distinct().ToArray()) ?? "[]";
        entity.TaskIdsJson = ScheduleMapper.WriteJson(dto.TaskIds.Distinct().ToArray()) ?? "[]";
        entity.RepliesJson = ScheduleMapper.WriteJson(dto.Replies) ?? "[]";
        entity.DueDate = dto.DueDate;
        entity.CreatedAt = dto.CreatedAt;
        entity.UpdatedAt = dto.UpdatedAt;
        entity.ClosedAt = dto.ClosedAt;
        entity.GitHubRepository = dto.Github?.Repository;
        entity.GitHubIssueNumber = dto.Github?.IssueNumber;
        entity.GitHubUrl = dto.Github?.Url;
        entity.GitHubState = dto.Github?.State;
        entity.GitHubSyncStatus = dto.Github?.SyncStatus;
        entity.GitHubLastSyncedAt = dto.Github?.LastSyncedAt;
    }

    /// <summary>1件の作業時間記録を更新します。</summary>
    private static void ApplyWorkLog(ProjectWorkLogEntity entity, ProjectWorkLogDto dto)
    {
        entity.Date = dto.Date;
        entity.MemberId = dto.MemberId;
        entity.Hours = dto.Hours;
        entity.Category = dto.Category;
        entity.Summary = dto.Summary;
        entity.Note = dto.Note;
        entity.TaskId = dto.TaskId;
        entity.IssueId = dto.IssueId;
        entity.Billable = dto.Billable;
        entity.CreatedBy = dto.CreatedBy;
        entity.CreatedAt = dto.CreatedAt;
        entity.UpdatedAt = dto.UpdatedAt;
    }

    /// <summary>保存前後のタスクを比較し、変更履歴を記録します。</summary>
    private void RecordTaskChanges(
        string projectId,
        Dictionary<string, TaskEntity> oldTasks,
        IReadOnlyList<ScheduleTaskDto> nextTasks,
        string changedAt,
        string changedBy)
    {
        foreach (var nextTask in nextTasks)
        {
            if (!oldTasks.TryGetValue(nextTask.Id, out var oldTask))
            {
                db.ScheduleChangeLogs.Add(CreateChange(
                    projectId,
                    nextTask.Id,
                    "created",
                    null,
                    nextTask.Title,
                    null,
                    changedAt,
                    changedBy));
                continue;
            }

            AddChangeIfDifferent(projectId, nextTask.Id, "start", oldTask.Start, nextTask.Start, changedAt, changedBy);
            AddChangeIfDifferent(projectId, nextTask.Id, "end", oldTask.End, nextTask.End, changedAt, changedBy);
            AddChangeIfDifferent(
                projectId,
                nextTask.Id,
                "progress",
                oldTask.Progress.ToString(CultureInfo.InvariantCulture),
                nextTask.Progress.ToString(CultureInfo.InvariantCulture),
                changedAt,
                changedBy);
            AddChangeIfDifferent(projectId, nextTask.Id, "status", oldTask.Status, nextTask.Status, changedAt, changedBy);

            var oldAssignees = string.Join(",", oldTask.Assignments.Select(assignment => assignment.MemberId).Order());
            var nextAssignees = string.Join(",", nextTask.AssigneeIds.Order());
            AddChangeIfDifferent(projectId, nextTask.Id, "assignees", oldAssignees, nextAssignees, changedAt, changedBy);
        }
    }

    /// <summary>指定項目に差分がある場合だけ変更履歴を追加します。</summary>
    private void AddChangeIfDifferent(
        string projectId,
        string taskId,
        string field,
        string? before,
        string? after,
        string changedAt,
        string changedBy)
    {
        if (before == after) return;
        db.ScheduleChangeLogs.Add(CreateChange(
            projectId,
            taskId,
            field,
            before,
            after,
            field is "start" or "end" ? DateDelta(before, after) : null,
            changedAt,
            changedBy));
    }

    /// <summary>タスク変更履歴の永続化エンティティを作成します。</summary>
    private static ScheduleChangeLogEntity CreateChange(
        string projectId,
        string taskId,
        string field,
        string? before,
        string? after,
        int? deltaDays,
        string changedAt,
        string changedBy)
    {
        return new ScheduleChangeLogEntity
        {
            Id = Guid.NewGuid().ToString("n"),
            ProjectId = projectId,
            TaskId = taskId,
            Field = field,
            BeforeValue = before,
            AfterValue = after,
            DeltaDays = deltaDays,
            ChangedAt = changedAt,
            ChangedBy = changedBy,
            Reason = null
        };
    }

    /// <summary>日付文字列の変更量を日数で計算します。</summary>
    private static int? DateDelta(string? before, string? after)
    {
        if (!DateOnly.TryParse(before, out var beforeDate)) return null;
        if (!DateOnly.TryParse(after, out var afterDate)) return null;
        return afterDate.DayNumber - beforeDate.DayNumber;
    }
}

/// <summary>クライアントが古いバージョンを保存しようとしたことを表します。</summary>
public sealed class ScheduleConflictException(int currentVersion) : Exception("Schedule version conflict.")
{
    public int CurrentVersion { get; } = currentVersion;
}
