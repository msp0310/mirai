using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Schedule.Api.Contracts;
using Schedule.Api.Domain;
using Schedule.Api.Infrastructure;

namespace Schedule.Api.Application;

/// <summary>プロジェクト、タスク、カレンダーの保存境界を提供します。</summary>
public sealed class ScheduleService(
    ScheduleDbContext db,
    ProjectAuthorizationService authorization,
    AuditLogService auditLogs)
{
    /// <summary>案件一覧用にチームと軽量案件集計だけを取得します。</summary>
    public async Task<WorkspaceSummaryDto> GetWorkspaceSummaryAsync(
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        var teamsQuery = db.Teams
            .Include(team => team.Members)
            .AsNoTracking();
        if (!string.Equals(user.Role, SystemRoles.Admin, StringComparison.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(user.MemberId))
            {
                return new WorkspaceSummaryDto([], []);
            }
            var visibleProjectIds = await authorization.GetVisibleProjectIdsAsync(user, cancellationToken)
                ?? new HashSet<string>(StringComparer.Ordinal);
            var visibleTeamIds = await db.Projects
                .AsNoTracking()
                .Where(project => project.TeamId != null && visibleProjectIds.Contains(project.Id))
                .Select(project => project.TeamId!)
                .Distinct()
                .ToListAsync(cancellationToken);
            teamsQuery = teamsQuery.Where(team =>
                team.Members.Any(member => member.MemberId == user.MemberId) ||
                visibleTeamIds.Contains(team.Id));
        }

        var teams = await teamsQuery
            .OrderBy(team => team.Code)
            .ToListAsync(cancellationToken);

        return new WorkspaceSummaryDto(
            teams.Select(ScheduleMapper.ToDto).ToArray(),
            await GetProjectSummariesAsync(user, cancellationToken));
    }

    /// <summary>
    /// 案件一覧向けの軽量な集計を取得します。
    /// Gantt詳細を必要としない画面が、全タスク本文を転送せずに表示できます。
    /// </summary>
    public async Task<IReadOnlyList<ProjectSummaryDto>> GetProjectSummariesAsync(
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        var visibleProjectIds = await authorization.GetVisibleProjectIdsAsync(user, cancellationToken);
        var projectsQuery = db.Projects
            .Include(project => project.Members)
            .AsNoTracking();
        if (visibleProjectIds is not null)
        {
            projectsQuery = projectsQuery.Where(project => visibleProjectIds.Contains(project.Id));
        }

        var projects = await projectsQuery
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

        var accessMap = await authorization.GetProjectAccessMapAsync(
            user,
            projects.ToDictionary(row => row.Project.Id, row => row.Project.TeamId),
            cancellationToken);
        var result = new List<ProjectSummaryDto>(projects.Count);
        foreach (var row in projects)
        {
            result.Add(new ProjectSummaryDto(
                ScheduleMapper.ToDto(row.Project),
                row.TaskCount,
                row.CompletedTaskCount,
                row.DelayedTaskCount,
                Convert.ToInt32(Math.Round(row.Progress)),
                row.MemberCount,
                accessMap[row.Project.Id]));
        }
        return result;
    }

    /// <summary>指定プロジェクトの最新スケジュールを取得します。</summary>
    public async Task<ScheduleSnapshotDto?> GetProjectScheduleAsync(
        string projectId,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        var access = await authorization.GetProjectAccessAsync(user, projectId, cancellationToken);
        if (!access.CanView)
        {
            throw new ProjectAccessDeniedException();
        }

        var project = await LoadProjectsQuery()
            .AsNoTracking()
            .FirstOrDefaultAsync(project => project.Id == projectId, cancellationToken);
        if (project is null || project.Calendar is null)
        {
            return null;
        }

        var memberIds = project.Members.Select(member => member.MemberId).ToHashSet();
        memberIds.UnionWith(project.Assignments.Select(assignment => assignment.MemberId));
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
            accountsByMemberId,
            access);
    }

    /// <summary>期待バージョンを検証し、プロジェクト単位でスケジュールを保存します。</summary>
    public async Task<SaveScheduleResponse?> SaveProjectScheduleAsync(
        string projectId,
        SaveScheduleRequest request,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        var access = await authorization.GetProjectAccessAsync(user, projectId, cancellationToken);
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

        if (!access.CanEditPlan)
        {
            return await SaveRestrictedActivityAsync(
                existingProject,
                request,
                access,
                user,
                cancellationToken);
        }

        var oldTasks = existingProject.Tasks.ToDictionary(
            task => task.Id,
            task => new TaskChangeState(
                task.Start,
                task.End,
                task.Progress,
                task.Status,
                task.Assignments.Select(assignment => assignment.MemberId).Order().ToArray()));
        var nextVersion = existingProject.Version + 1;
        var now = DateTimeOffset.UtcNow.ToString("O");

        await UpsertMembersAsync(request.Members, cancellationToken);
        ReplaceProjectMembers(
            existingProject,
            request.Project.Memberships ??
                (request.Project.MemberIds ?? [])
                    .Select(memberId => new ProjectMemberDto(memberId, ProjectRoles.Member))
                    .ToArray());
        ReplaceProjectAssignments(existingProject, request.Project.Assignments ?? []);
        ReplaceStaffingDemands(existingProject, request.Project.StaffingDemands ?? []);
        ReplaceCalendar(existingProject, request.Calendar);
        ReplaceIssues(existingProject, request.Issues ?? []);
        ReplaceWorkLogs(existingProject, request.WorkLogs ?? []);
        ReplaceTasks(existingProject, request.Tasks);
        RecordTaskChanges(
            projectId,
            oldTasks,
            request.Tasks,
            now,
            user.Name,
            NormalizeChangeReason(request.ChangeReason));

        existingProject.TeamId = request.Project.TeamId;
        existingProject.Name = request.Project.Name;
        existingProject.Workspace = request.Project.Workspace;
        existingProject.ProjectNo = string.IsNullOrWhiteSpace(request.Project.ProjectNo)
            ? null
            : request.Project.ProjectNo.Trim();
        existingProject.CustomerName = string.IsNullOrWhiteSpace(request.Project.CustomerName)
            ? null
            : request.Project.CustomerName.Trim();
        existingProject.OrderingCompanyName = string.IsNullOrWhiteSpace(request.Project.OrderingCompanyName)
            ? null
            : request.Project.OrderingCompanyName.Trim();
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

        await auditLogs.RecordAsync(
            user,
            "project.schedule.save",
            "project",
            projectId,
            "schedule",
            projectId,
            new { version = nextVersion, taskCount = request.Tasks.Count },
            cancellationToken);

        var savedSnapshot = await GetProjectScheduleAsync(projectId, user, cancellationToken)
            ?? throw new InvalidOperationException("Saved project disappeared.");
        return new SaveScheduleResponse("remote", $"project-{projectId}-v{nextVersion}", now, savedSnapshot);
    }

    /// <summary>案件設定・課題・工数を変更せず、タスク計画だけを保存します。</summary>
    public async Task<SaveScheduleResponse?> SaveTaskPlanAsync(
        string projectId,
        SaveTaskPlanRequest request,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        var access = await authorization.GetProjectAccessAsync(user, projectId, cancellationToken);
        if (!access.CanEditPlan) throw new ProjectAccessDeniedException();

        var project = await LoadProjectsQuery()
            .FirstOrDefaultAsync(entity => entity.Id == projectId, cancellationToken);
        if (project is null || project.Calendar is null) return null;
        if (request.ExpectedVersion is not null && request.ExpectedVersion != project.Version)
        {
            throw new ScheduleConflictException(project.Version);
        }

        var oldTasks = project.Tasks.ToDictionary(
            task => task.Id,
            task => new TaskChangeState(
                task.Start,
                task.End,
                task.Progress,
                task.Status,
                task.Assignments.Select(assignment => assignment.MemberId).Order().ToArray()));
        var nextVersion = project.Version + 1;
        var now = DateTimeOffset.UtcNow.ToString("O");

        ReplaceTasks(project, request.Tasks);
        RecordTaskChanges(
            projectId,
            oldTasks,
            request.Tasks,
            now,
            user.Name,
            NormalizeChangeReason(request.ChangeReason));
        project.Version = nextVersion;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            var currentVersion = await db.Projects
                .AsNoTracking()
                .Where(entity => entity.Id == projectId)
                .Select(entity => (int?)entity.Version)
                .SingleOrDefaultAsync(cancellationToken);
            throw new ScheduleConflictException(currentVersion ?? project.Version);
        }

        await auditLogs.RecordAsync(
            user,
            "project.tasks.save",
            "project",
            projectId,
            "tasks",
            projectId,
            new { version = nextVersion, taskCount = request.Tasks.Count },
            cancellationToken);

        var savedSnapshot = await GetProjectScheduleAsync(projectId, user, cancellationToken)
            ?? throw new InvalidOperationException("Saved project disappeared.");
        return new SaveScheduleResponse("remote", $"project-{projectId}-v{nextVersion}", now, savedSnapshot);
    }

    /// <summary>計画を変更できない利用者について、運用データだけを制限付きで保存します。</summary>
    private async Task<SaveScheduleResponse> SaveRestrictedActivityAsync(
        ProjectEntity project,
        SaveScheduleRequest request,
        ProjectAccessDto access,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        if ((!access.CanComment && !access.CanEnterActual) ||
            CreatePlanFingerprint(project) != CreatePlanFingerprint(request))
        {
            throw new ProjectAccessDeniedException();
        }

        if (access.CanComment)
        {
            ReplaceIssues(project, request.Issues ?? []);
            ApplyTaskComments(project.Tasks, request.Tasks, user);
        }
        else if (!TaskCommentsMatch(project.Tasks, request.Tasks) ||
                 !JsonEquals(
                     project.Issues.Select(ScheduleMapper.ToDto).OrderBy(issue => issue.Id),
                     (request.Issues ?? []).OrderBy(issue => issue.Id)))
        {
            throw new ProjectAccessDeniedException();
        }

        if (access.CanEnterActual)
        {
            ReplaceOwnedWorkLogs(project, request.WorkLogs ?? [], user);
        }
        else if (!JsonEquals(
                     project.WorkLogs.Select(ScheduleMapper.ToDto).OrderBy(log => log.Id),
                     (request.WorkLogs ?? []).OrderBy(log => log.Id)))
        {
            throw new ProjectAccessDeniedException();
        }

        project.Version += 1;
        var now = DateTimeOffset.UtcNow.ToString("O");
        await db.SaveChangesAsync(cancellationToken);
        await auditLogs.RecordAsync(
            user,
            "project.activity.save",
            "project",
            project.Id,
            "activity",
            project.Id,
            new
            {
                version = project.Version,
                issueCount = request.Issues?.Count ?? 0,
                workLogCount = request.WorkLogs?.Count ?? 0
            },
            cancellationToken);

        var snapshot = await GetProjectScheduleAsync(project.Id, user, cancellationToken)
            ?? throw new InvalidOperationException("Saved project disappeared.");
        return new SaveScheduleResponse(
            "remote",
            $"project-{project.Id}-v{project.Version}",
            now,
            snapshot);
    }

    /// <summary>担当タスクの状態・進捗・実績日だけを更新し、親行の進捗を再集計します。</summary>
    public async Task<ScheduleSnapshotDto?> UpdateTaskActualAsync(
        string projectId,
        string taskId,
        UpdateTaskActualRequest request,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        var access = await authorization.GetProjectAccessAsync(user, projectId, cancellationToken);
        if (!access.CanEnterActual) throw new ProjectAccessDeniedException();

        var project = await LoadProjectsQuery()
            .FirstOrDefaultAsync(entity => entity.Id == projectId, cancellationToken);
        if (project?.Calendar is null) return null;
        if (request.ExpectedProjectVersion is not null && request.ExpectedProjectVersion != project.Version)
        {
            throw new ScheduleConflictException(project.Version);
        }

        var task = project.Tasks.FirstOrDefault(entity => entity.Id == taskId);
        if (task is null) return null;
        var unrestricted = access.Role is SystemRoles.Admin or ProjectRoles.Owner or ProjectRoles.Planner;
        if (!unrestricted && (string.IsNullOrWhiteSpace(user.MemberId) ||
            task.Assignments.All(assignment => assignment.MemberId != user.MemberId)))
        {
            throw new ProjectAccessDeniedException();
        }

        task.Status = NormalizeActualStatus(request.Status);
        task.Progress = Math.Clamp(request.Progress, 0, 100);
        task.ActualStart = NormalizeOptionalDate(request.ActualStart);
        task.ActualEnd = NormalizeOptionalDate(request.ActualEnd);
        if (task.ActualStart is not null && task.ActualEnd is not null &&
            string.CompareOrdinal(task.ActualStart, task.ActualEnd) > 0)
        {
            throw new ArgumentException("実績終了日は実績開始日以降を指定してください。");
        }

        RecalculateParentProgress(project.Tasks, task.ParentId);
        project.Version += 1;
        await db.SaveChangesAsync(cancellationToken);
        await auditLogs.RecordAsync(
            user,
            "task.actual.update",
            "project",
            projectId,
            "task",
            taskId,
            new { task.Status, task.Progress, task.ActualStart, task.ActualEnd },
            cancellationToken);
        return await GetProjectScheduleAsync(projectId, user, cancellationToken);
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
            .Include(project => project.Assignments)
            .Include(project => project.StaffingDemands)
            .Include(project => project.Tasks)
                .ThenInclude(task => task.Assignments)
            .Include(project => project.Tasks)
                .ThenInclude(task => task.Dependencies);
    }

    private static string NormalizeActualStatus(string status)
    {
        return status.Trim() switch
        {
            "notStarted" or "inProgress" or "done" or "delayed" => status.Trim(),
            "todo" => "notStarted",
            "in_progress" => "inProgress",
            _ => throw new ArgumentException("状態の値が不正です。")
        };
    }

    private static string? NormalizeOptionalDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return DateOnly.TryParse(value, out var parsed)
            ? parsed.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            : throw new ArgumentException("実績日はyyyy-MM-dd形式で指定してください。");
    }

    private static void RecalculateParentProgress(IReadOnlyList<TaskEntity> tasks, string? parentId)
    {
        while (!string.IsNullOrWhiteSpace(parentId))
        {
            var parent = tasks.FirstOrDefault(task => task.Id == parentId);
            if (parent is null) return;
            var children = tasks.Where(task => task.ParentId == parent.Id).ToArray();
            if (children.Length > 0)
            {
                parent.Progress = Convert.ToInt32(Math.Round(children.Average(child => child.Progress)));
                parent.Status = children.All(child => child.Status == "done")
                    ? "done"
                    : children.Any(child => child.Status is "inProgress" or "done" or "delayed")
                        ? "inProgress"
                        : "notStarted";
            }
            parentId = parent.ParentId;
        }
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
        memberIds.UnionWith(project.Assignments.Select(assignment => assignment.MemberId));
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
    private static void ReplaceProjectMembers(
        ProjectEntity project,
        IReadOnlyList<ProjectMemberDto> memberships)
    {
        project.Members.Clear();
        foreach (var membership in memberships
                     .GroupBy(item => item.MemberId)
                     .Select(group => group.Last()))
        {
            project.Members.Add(new ProjectMemberEntity
            {
                ProjectId = project.Id,
                MemberId = membership.MemberId,
                ProjectRole = ProjectRoles.IsValid(membership.Role)
                    ? membership.Role
                    : ProjectRoles.Member
            });
        }
    }

    /// <summary>案件への要員アサイン計画を受信内容で置き換えます。</summary>
    private void ReplaceProjectAssignments(
        ProjectEntity project,
        IReadOnlyList<ProjectAssignmentDto> assignments)
    {
        var assignmentIds = assignments.Select(assignment => assignment.Id).ToHashSet();
        var existingAssignments = project.Assignments.ToDictionary(assignment => assignment.Id);
        var removedAssignments = project.Assignments
            .Where(assignment => !assignmentIds.Contains(assignment.Id))
            .ToArray();
        foreach (var removed in removedAssignments) project.Assignments.Remove(removed);
        db.ProjectAssignments.RemoveRange(removedAssignments);
        foreach (var assignment in assignments)
        {
            if (!existingAssignments.TryGetValue(assignment.Id, out var entity))
            {
                entity = new ProjectAssignmentEntity { Id = assignment.Id, ProjectId = project.Id };
                project.Assignments.Add(entity);
            }
            entity.MemberId = assignment.MemberId;
            entity.Role = assignment.Role;
            entity.StartDate = assignment.StartDate;
            entity.EndDate = assignment.EndDate;
            entity.AllocationPercent = assignment.AllocationPercent;
            entity.Status = assignment.Status;
        }
    }

    /// <summary>案件の未充足要員要求を受信内容で置き換えます。</summary>
    private void ReplaceStaffingDemands(
        ProjectEntity project,
        IReadOnlyList<StaffingDemandDto> demands)
    {
        var demandIds = demands.Select(demand => demand.Id).ToHashSet();
        var existingDemands = project.StaffingDemands.ToDictionary(demand => demand.Id);
        var removedDemands = project.StaffingDemands
            .Where(demand => !demandIds.Contains(demand.Id))
            .ToArray();
        foreach (var removed in removedDemands) project.StaffingDemands.Remove(removed);
        db.StaffingDemands.RemoveRange(removedDemands);
        foreach (var demand in demands)
        {
            if (!existingDemands.TryGetValue(demand.Id, out var entity))
            {
                entity = new StaffingDemandEntity { Id = demand.Id, ProjectId = project.Id };
                project.StaffingDemands.Add(entity);
            }
            entity.Role = demand.Role;
            entity.StartDate = demand.StartDate;
            entity.EndDate = demand.EndDate;
            entity.RequiredCount = demand.RequiredCount;
            entity.AllocationPercent = demand.AllocationPercent;
            entity.Status = demand.Status;
        }
    }

    /// <summary>プロジェクトの稼働カレンダーと休日を受信内容で更新します。</summary>
    private static void ReplaceCalendar(ProjectEntity project, CalendarDefinitionDto dto)
    {
        var calendarId = project.Calendar!.Id;
        project.Calendar.Name = dto.Name;
        project.Calendar.WorkWeekJson = ScheduleMapper.WriteJson(dto.WorkWeek) ?? "[1,2,3,4,5]";
        project.Calendar.Holidays.Clear();
        foreach (var holiday in dto.Holidays)
        {
            project.Calendar.Holidays.Add(new CalendarHolidayEntity
            {
                CalendarId = calendarId,
                Date = holiday.Date,
                Name = holiday.Name
            });
        }
    }

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
        entity.ActualStart = dto.ActualStart;
        entity.ActualEnd = dto.ActualEnd;
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

    /// <summary>作業時間をID単位で追加・更新・削除します。</summary>
    private void ReplaceWorkLogs(ProjectEntity project, IReadOnlyList<ProjectWorkLogDto> workLogs)
    {
        var workLogIds = workLogs.Select(workLog => workLog.Id).ToHashSet();
        var existingWorkLogs = project.WorkLogs.ToDictionary(workLog => workLog.Id);
        var removedWorkLogs = project.WorkLogs
            .Where(workLog => workLog.DailyReportId is null && !workLogIds.Contains(workLog.Id))
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

            // 日報連携の実績は日報APIを正本とし、案件画面の古い状態で上書きしません。
            if (entity.DailyReportId is not null)
            {
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
        entity.DailyReportId = dto.DailyReportId;
        entity.DailyReportEntryId = dto.DailyReportEntryId;
    }

    /// <summary>本人が入力した作業実績だけを追加・更新・削除します。</summary>
    private void ReplaceOwnedWorkLogs(
        ProjectEntity project,
        IReadOnlyList<ProjectWorkLogDto> workLogs,
        AuthUserDto user)
    {
        if (string.IsNullOrWhiteSpace(user.MemberId)) throw new ProjectAccessDeniedException();

        var incomingById = workLogs.ToDictionary(log => log.Id);
        foreach (var existing in project.WorkLogs.Where(log =>
                     log.DailyReportId is not null || log.MemberId != user.MemberId))
        {
            if (!incomingById.TryGetValue(existing.Id, out var incoming) ||
                !JsonEquals(ScheduleMapper.ToDto(existing), incoming))
            {
                throw new ProjectAccessDeniedException();
            }
        }

        var ownedIncoming = workLogs
            .Where(log => log.MemberId == user.MemberId && log.DailyReportId is null)
            .ToArray();
        if (workLogs.Any(log =>
                log.MemberId != user.MemberId &&
                project.WorkLogs.All(existing => existing.Id != log.Id)))
        {
            throw new ProjectAccessDeniedException();
        }

        var ownedIds = ownedIncoming.Select(log => log.Id).ToHashSet();
        var removed = project.WorkLogs
            .Where(log => log.MemberId == user.MemberId &&
                          log.DailyReportId is null &&
                          !ownedIds.Contains(log.Id))
            .ToArray();
        foreach (var entity in removed) project.WorkLogs.Remove(entity);
        db.ProjectWorkLogs.RemoveRange(removed);

        foreach (var dto in ownedIncoming)
        {
            var existing = project.WorkLogs.FirstOrDefault(log => log.Id == dto.Id);
            var normalized = dto with
            {
                MemberId = user.MemberId,
                CreatedBy = existing?.CreatedBy ?? user.Name,
                CreatedAt = existing?.CreatedAt ?? dto.CreatedAt
            };
            if (existing is null)
            {
                project.WorkLogs.Add(ScheduleMapper.ToEntity(normalized, project.Id));
            }
            else
            {
                ApplyWorkLog(existing, normalized);
            }
        }
    }

    /// <summary>既存コメントの改ざんを防ぎ、新しいコメントの投稿者をログイン利用者で確定します。</summary>
    private static void ApplyTaskComments(
        IReadOnlyList<TaskEntity> tasks,
        IReadOnlyList<ScheduleTaskDto> requestedTasks,
        AuthUserDto user)
    {
        var requestedById = requestedTasks.ToDictionary(task => task.Id);
        foreach (var task in tasks)
        {
            if (!requestedById.TryGetValue(task.Id, out var requested))
            {
                throw new ProjectAccessDeniedException();
            }
            var existing = ScheduleMapper.ToDto(task).Comments ?? [];
            var incoming = requested.Comments ?? [];
            var existingById = existing.ToDictionary(comment => comment.Id);
            if (existing.Any(comment =>
                    incoming.All(candidate => candidate.Id != comment.Id)) ||
                incoming.Any(comment =>
                    existingById.TryGetValue(comment.Id, out var original) && original != comment))
            {
                throw new ProjectAccessDeniedException();
            }

            var normalized = incoming.Select(comment =>
                existingById.TryGetValue(comment.Id, out var original)
                    ? original
                    : comment with
                    {
                        Author = user.Name,
                        CreatedAt = DateTimeOffset.UtcNow.ToString("O")
                    }).ToArray();
            task.CommentsJson = ScheduleMapper.WriteJson(normalized) ?? "[]";
        }
    }

    private static bool TaskCommentsMatch(
        IReadOnlyList<TaskEntity> tasks,
        IReadOnlyList<ScheduleTaskDto> requestedTasks)
    {
        var requestedById = requestedTasks.ToDictionary(task => task.Id);
        return tasks.All(task =>
            requestedById.TryGetValue(task.Id, out var requested) &&
            JsonEquals(ScheduleMapper.ToDto(task).Comments ?? [], requested.Comments ?? []));
    }

    /// <summary>運用データを除いた計画項目を正規化し、権限外変更の有無を比較します。</summary>
    private static string CreatePlanFingerprint(ProjectEntity project)
    {
        if (project.Calendar is null) throw new InvalidOperationException("Calendar is required.");
        return CreatePlanFingerprint(
            ScheduleMapper.ToDto(project),
            ScheduleMapper.ToDto(project.Calendar),
            project.Tasks.Select(ScheduleMapper.ToDto).ToArray());
    }

    private static string CreatePlanFingerprint(SaveScheduleRequest request) =>
        CreatePlanFingerprint(request.Project, request.Calendar, request.Tasks);

    private static string CreatePlanFingerprint(
        ProjectDto project,
        CalendarDefinitionDto calendar,
        IReadOnlyList<ScheduleTaskDto> tasks)
    {
        var normalized = new
        {
            Project = new
            {
                project.Id,
                project.TeamId,
                project.Name,
                project.Workspace,
                project.LifecycleStatus,
                MemberIds = (project.MemberIds ?? []).Order().ToArray(),
                project.RangeStart,
                project.RangeEnd,
                project.NextMilestone,
                project.Status,
                project.ArchivedAt,
                Assignments = (project.Assignments ?? []).OrderBy(item => item.Id).ToArray(),
                StaffingDemands = (project.StaffingDemands ?? []).OrderBy(item => item.Id).ToArray(),
                project.ProjectNo,
                Memberships = (project.Memberships ?? [])
                    .OrderBy(item => item.MemberId)
                    .ToArray()
            },
            Calendar = new
            {
                calendar.Id,
                calendar.Name,
                WorkWeek = calendar.WorkWeek.Order().ToArray(),
                Holidays = calendar.Holidays.OrderBy(item => item.Date).ToArray()
            },
            Tasks = tasks.OrderBy(task => task.Id).Select(task => new
            {
                task.Id,
                task.ParentId,
                task.Title,
                task.Type,
                task.Status,
                task.Start,
                task.End,
                task.Progress,
                AssigneeIds = task.AssigneeIds.Order().ToArray(),
                AssigneeAllocations = (task.AssigneeAllocations ?? [])
                    .OrderBy(item => item.MemberId)
                    .ToArray(),
                task.Color,
                task.Expanded,
                Dependencies = (task.Dependencies ?? []).Order().ToArray(),
                task.Description,
                task.EffortHours,
                task.BaselineStart,
                task.BaselineEnd,
                task.BaselineCapturedAt,
                Checklist = task.Checklist ?? [],
                Links = task.Links ?? [],
                task.ActualStart,
                task.ActualEnd
            }).ToArray()
        };
        return JsonSerializer.Serialize(normalized);
    }

    private static bool JsonEquals<T>(T left, T right) =>
        JsonSerializer.Serialize(left) == JsonSerializer.Serialize(right);

    /// <summary>保存前後のタスクを比較し、変更履歴を記録します。</summary>
    private void RecordTaskChanges(
        string projectId,
        IReadOnlyDictionary<string, TaskChangeState> oldTasks,
        IReadOnlyList<ScheduleTaskDto> nextTasks,
        string changedAt,
        string changedBy,
        string? changeReason)
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

            AddChangeIfDifferent(projectId, nextTask.Id, "start", oldTask.Start, nextTask.Start, changedAt, changedBy, changeReason);
            AddChangeIfDifferent(projectId, nextTask.Id, "end", oldTask.End, nextTask.End, changedAt, changedBy, changeReason);
            AddChangeIfDifferent(
                projectId,
                nextTask.Id,
                "progress",
                oldTask.Progress.ToString(CultureInfo.InvariantCulture),
                nextTask.Progress.ToString(CultureInfo.InvariantCulture),
                changedAt,
                changedBy,
                null);
            AddChangeIfDifferent(projectId, nextTask.Id, "status", oldTask.Status, nextTask.Status, changedAt, changedBy, null);

            var oldAssignees = string.Join(",", oldTask.AssigneeIds);
            var nextAssignees = string.Join(",", nextTask.AssigneeIds.Order());
            AddChangeIfDifferent(projectId, nextTask.Id, "assignees", oldAssignees, nextAssignees, changedAt, changedBy, null);
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
        string changedBy,
        string? reason)
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
            changedBy,
            reason));
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
        string changedBy,
        string? reason = null)
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
            Reason = reason
        };
    }

    /// <summary>空白だけの変更理由を履歴へ保存しないよう正規化します。</summary>
    private static string? NormalizeChangeReason(string? reason)
    {
        var normalized = reason?.Trim();
        return string.IsNullOrEmpty(normalized) ? null : normalized;
    }

    /// <summary>日付文字列の変更量を日数で計算します。</summary>
    private static int? DateDelta(string? before, string? after)
    {
        if (!DateOnly.TryParse(before, out var beforeDate)) return null;
        if (!DateOnly.TryParse(after, out var afterDate)) return null;
        return afterDate.DayNumber - beforeDate.DayNumber;
    }

    /// <summary>更新前の比較値をEntityの変更追跡から切り離して保持します。</summary>
    private sealed record TaskChangeState(
        string Start,
        string End,
        int Progress,
        string Status,
        IReadOnlyList<string> AssigneeIds);
}

/// <summary>クライアントが古いバージョンを保存しようとしたことを表します。</summary>
public sealed class ScheduleConflictException(int currentVersion) : Exception("Schedule version conflict.")
{
    public int CurrentVersion { get; } = currentVersion;
}

/// <summary>案件内権限が不足している操作を表します。</summary>
public sealed class ProjectAccessDeniedException : Exception
{
}
