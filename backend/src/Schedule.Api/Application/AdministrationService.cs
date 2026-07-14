using Microsoft.EntityFrameworkCore;
using Schedule.Api.Contracts;
using Schedule.Api.Domain;
using Schedule.Api.Infrastructure;

namespace Schedule.Api.Application;

/// <summary>管理マスターと案件作成をAPIの正本として保存します。</summary>
public sealed class AdministrationService(
    ScheduleDbContext db,
    ProjectAuthorizationService authorization,
    AuditLogService auditLogs)
{
    public async Task<TeamDto> SaveTeamAsync(
        TeamDto dto,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        var existing = await db.Teams.Include(team => team.Members)
            .SingleOrDefaultAsync(team => team.Id == dto.Id, cancellationToken);
        var isAdmin = user.Role == SystemRoles.Admin;
        if (!isAdmin && (existing is null || !await authorization.CanManageTeamAsync(user, dto.Id, cancellationToken)))
            throw new ProjectAccessDeniedException();
        if (string.IsNullOrWhiteSpace(dto.Id) || string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Code))
            throw new ArgumentException("チームID・名称・コードは必須です。");

        var team = existing ?? new TeamEntity { Id = dto.Id };
        if (existing is null) db.Teams.Add(team);
        team.Name = dto.Name.Trim();
        team.Code = dto.Code.Trim();
        team.Description = dto.Description.Trim();
        team.Members.Clear();
        foreach (var membership in (dto.Memberships ?? dto.MemberIds
                     .Select(memberId => new TeamMemberDto(memberId, TeamRoles.Member)))
                 .GroupBy(item => item.MemberId).Select(group => group.Last()))
        {
            team.Members.Add(new TeamMemberEntity
            {
                TeamId = team.Id,
                MemberId = membership.MemberId,
                TeamRole = membership.Role == TeamRoles.Manager ? TeamRoles.Manager : TeamRoles.Member
            });
        }
        await db.SaveChangesAsync(cancellationToken);
        await auditLogs.RecordAsync(user, "team.save", "team", team.Id, "team", team.Id,
            new { team.Name, team.Code, memberCount = team.Members.Count }, cancellationToken);
        return ScheduleMapper.ToDto(team);
    }

    public async Task<MemberDto> SaveMemberAsync(
        MemberDto dto,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        if (user.Role != SystemRoles.Admin) throw new ProjectAccessDeniedException();
        if (string.IsNullOrWhiteSpace(dto.Id) || string.IsNullOrWhiteSpace(dto.Name))
            throw new ArgumentException("メンバーIDと氏名は必須です。");
        var entity = await db.Members.SingleOrDefaultAsync(member => member.Id == dto.Id, cancellationToken);
        if (entity is null)
        {
            entity = ScheduleMapper.ToEntity(dto);
            db.Members.Add(entity);
        }
        else
        {
            entity.Name = dto.Name.Trim();
            entity.EmployeeNo = string.IsNullOrWhiteSpace(dto.EmployeeNo) ? null : dto.EmployeeNo.Trim();
            entity.Initials = dto.Initials.Trim();
            entity.Role = dto.Role.Trim();
            entity.Color = dto.Color;
            entity.CapacityHours = Math.Max(0, dto.CapacityHours);
            entity.Status = dto.Status;
            entity.InactiveAt = dto.InactiveAt;
            entity.AvailabilityOverridesJson = ScheduleMapper.WriteJson(dto.AvailabilityOverrides);
        }
        await db.SaveChangesAsync(cancellationToken);
        await auditLogs.RecordAsync(user, "member.save", "system", null, "member", entity.Id,
            new { entity.Name, entity.Role, entity.Status }, cancellationToken);
        var account = await db.Users.AsNoTracking().SingleOrDefaultAsync(item => item.MemberId == entity.Id, cancellationToken);
        return ScheduleMapper.ToDto(entity, account);
    }

    public async Task<ProjectDto> CreateProjectAsync(
        SaveScheduleRequest request,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        if (await db.Projects.AnyAsync(project => project.Id == request.Project.Id, cancellationToken))
            throw new InvalidOperationException("同じIDのプロジェクトが既に存在します。");
        if (request.Project.TeamId is not null && user.Role != SystemRoles.Admin &&
            !await authorization.CanManageTeamAsync(user, request.Project.TeamId, cancellationToken))
            throw new ProjectAccessDeniedException();
        if (request.Project.TeamId is null && user.Role != SystemRoles.Admin)
            throw new ProjectAccessDeniedException();

        var project = ScheduleMapper.ToEntity(request.Project, 1);
        project.Calendar = ScheduleMapper.ToEntity(request.Calendar, project.Id);
        project.Tasks = request.Tasks.Select((task, index) => ScheduleMapper.ToEntity(task, project.Id, index)).ToList();
        project.Issues = (request.Issues ?? []).Select(issue => ScheduleMapper.ToEntity(issue, project.Id)).ToList();
        project.WorkLogs = (request.WorkLogs ?? []).Select(log => ScheduleMapper.ToEntity(log, project.Id)).ToList();
        var memberships = request.Project.Memberships ?? request.Project.MemberIds?.Select(id => new ProjectMemberDto(id, ProjectRoles.Member)).ToArray() ?? [];
        project.Members = memberships.GroupBy(item => item.MemberId).Select(group => group.Last()).Select(item =>
            new ProjectMemberEntity { ProjectId = project.Id, MemberId = item.MemberId, ProjectRole = ProjectRoles.IsValid(item.Role) ? item.Role : ProjectRoles.Member }).ToList();
        if (!string.IsNullOrWhiteSpace(user.MemberId) && project.Members.All(item => item.MemberId != user.MemberId))
            project.Members.Add(new ProjectMemberEntity { ProjectId = project.Id, MemberId = user.MemberId, ProjectRole = ProjectRoles.Owner });
        else if (!string.IsNullOrWhiteSpace(user.MemberId))
            project.Members.First(item => item.MemberId == user.MemberId).ProjectRole = ProjectRoles.Owner;
        project.Assignments = (request.Project.Assignments ?? []).Select(item => new ProjectAssignmentEntity
        {
            Id = item.Id,
            ProjectId = project.Id,
            MemberId = item.MemberId,
            Role = item.Role,
            StartDate = item.StartDate,
            EndDate = item.EndDate,
            AllocationPercent = item.AllocationPercent,
            Status = item.Status
        }).ToList();
        project.StaffingDemands = (request.Project.StaffingDemands ?? []).Select(item => new StaffingDemandEntity
        {
            Id = item.Id,
            ProjectId = project.Id,
            Role = item.Role,
            StartDate = item.StartDate,
            EndDate = item.EndDate,
            RequiredCount = item.RequiredCount,
            AllocationPercent = item.AllocationPercent,
            Status = item.Status
        }).ToList();
        db.Projects.Add(project);
        await db.SaveChangesAsync(cancellationToken);
        await auditLogs.RecordAsync(user, "project.create", "project", project.Id, "project", project.Id,
            new { project.Name, project.ProjectNo, project.TeamId }, cancellationToken);
        return ScheduleMapper.ToDto(project);
    }

    public async Task<CalendarDefinitionDto> SaveTeamCalendarAsync(
        string teamId,
        CalendarDefinitionDto dto,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        if (!await authorization.CanManageTeamAsync(user, teamId, cancellationToken))
            throw new ProjectAccessDeniedException();
        var projects = await db.Projects.Include(project => project.Calendar!).ThenInclude(calendar => calendar.Holidays)
            .Where(project => project.TeamId == teamId).ToListAsync(cancellationToken);
        foreach (var project in projects)
        {
            if (project.Calendar is null) continue;
            project.Calendar.Name = dto.Name;
            project.Calendar.WorkWeekJson = ScheduleMapper.WriteJson(dto.WorkWeek) ?? "[1,2,3,4,5]";
            project.Calendar.Holidays.Clear();
            foreach (var holiday in dto.Holidays)
                project.Calendar.Holidays.Add(new CalendarHolidayEntity { CalendarId = project.Calendar.Id, Date = holiday.Date, Name = holiday.Name });
            project.Version += 1;
        }
        await db.SaveChangesAsync(cancellationToken);
        await auditLogs.RecordAsync(user, "team.calendar.save", "team", teamId, "calendar", dto.Id,
            new { projectCount = projects.Count, holidayCount = dto.Holidays.Count }, cancellationToken);
        return dto;
    }
}
