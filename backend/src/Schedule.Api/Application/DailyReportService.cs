using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Schedule.Api.Contracts;
using Schedule.Api.Domain;
using Schedule.Api.Infrastructure;

namespace Schedule.Api.Application;

/// <summary>日報と案件別作業実績を同一トランザクションで保存します。</summary>
public sealed class DailyReportService(ScheduleDbContext db)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<IReadOnlyList<DailyReportDto>> ListAsync(
        AuthUserDto user,
        string? teamId,
        CancellationToken cancellationToken)
    {
        var query = db.DailyReports.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(teamId))
        {
            if (!await CanViewTeamAsync(user, teamId, cancellationToken))
            {
                return [];
            }
            var memberIds = db.TeamMembers
                .Where(item => item.TeamId == teamId)
                .Select(item => item.MemberId);
            query = query.Where(report => memberIds.Contains(report.MemberId));
        }
        else if (!await IsManagerAsync(user, cancellationToken))
        {
            if (string.IsNullOrWhiteSpace(user.MemberId)) return [];
            query = query.Where(report => report.MemberId == user.MemberId);
        }

        var reports = await query
            .AsNoTracking()
            .OrderByDescending(report => report.Date)
            .ThenBy(report => report.MemberId)
            .ToListAsync(cancellationToken);
        var reportIds = reports.Select(report => report.Id).ToArray();
        var reads = await db.DailyReportReads
            .AsNoTracking()
            .Where(read => read.UserId == user.Id && reportIds.Contains(read.ReportId))
            .ToDictionaryAsync(read => read.ReportId, read => read.CommentCount, cancellationToken);
        return reports.Select(report => ToDto(report, reads.GetValueOrDefault(report.Id))).ToArray();
    }

    public async Task<DailyReportDto?> SaveAsync(
        string reportId,
        SaveDailyReportRequest request,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        if (!await CanEditMemberAsync(user, request.MemberId, cancellationToken))
        {
            throw new UnauthorizedAccessException("この日報を編集する権限がありません。");
        }
        if (!await db.Members.AnyAsync(member => member.Id == request.MemberId, cancellationToken))
        {
            return null;
        }

        var projectIds = request.Entries.Select(entry => entry.ProjectId).Distinct().ToArray();
        var existingProjectIds = await db.Projects
            .Where(project => projectIds.Contains(project.Id))
            .Select(project => project.Id)
            .ToListAsync(cancellationToken);
        if (existingProjectIds.Count != projectIds.Length)
        {
            throw new ArgumentException("日報明細に存在しないプロジェクトが含まれています。");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var report = await db.DailyReports.FirstOrDefaultAsync(item => item.Id == reportId, cancellationToken);
        var now = DateTimeOffset.UtcNow.ToString("O");
        if (report is null)
        {
            report = new DailyReportEntity { Id = reportId, CreatedAt = now, Version = 1 };
            db.DailyReports.Add(report);
        }
        else
        {
            if (report.Version != request.Version)
            {
                throw new DailyReportConflictException(report.Version);
            }
            report.Version += 1;
        }

        var linkedLogs = await db.ProjectWorkLogs
            .Where(log => log.DailyReportId == reportId)
            .ToDictionaryAsync(log => log.DailyReportEntryId!, cancellationToken);
        var entryIds = request.Entries.Select(entry => entry.Id).ToHashSet();
        db.ProjectWorkLogs.RemoveRange(linkedLogs.Values.Where(log => !entryIds.Contains(log.DailyReportEntryId!)));

        var savedEntries = new List<DailyReportEntryDto>(request.Entries.Count);
        foreach (var entry in request.Entries)
        {
            var workLogId = entry.WorkLogId ?? $"daily-{reportId}-{entry.Id}";
            if (!linkedLogs.TryGetValue(entry.Id, out var log))
            {
                log = new ProjectWorkLogEntity
                {
                    Id = workLogId,
                    DailyReportId = reportId,
                    DailyReportEntryId = entry.Id,
                    CreatedAt = now,
                    CreatedBy = user.Name,
                    Billable = false
                };
                db.ProjectWorkLogs.Add(log);
            }
            log.ProjectId = entry.ProjectId;
            log.Date = request.Date;
            log.MemberId = request.MemberId;
            log.Hours = entry.Hours;
            log.Category = entry.Category;
            log.Summary = entry.Summary;
            log.Note = entry.Note;
            log.TaskId = entry.TaskId;
            log.UpdatedAt = now;
            savedEntries.Add(entry with { WorkLogId = workLogId });
        }

        report.MemberId = request.MemberId;
        report.Date = request.Date;
        report.Status = request.Status;
        report.Summary = request.Summary;
        report.Blockers = request.Blockers;
        report.NextPlan = request.NextPlan;
        report.EntriesJson = JsonSerializer.Serialize(savedEntries, JsonOptions);
        report.CommentsJson = JsonSerializer.Serialize(request.Comments, JsonOptions);
        report.SubmittedAt = request.Status == "submitted" ? report.SubmittedAt ?? now : null;
        report.UpdatedAt = now;
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await MarkReadAsync(report.Id, user, cancellationToken);
        return ToDto(report, request.Comments.Count);
    }

    public async Task<DailyReportDto?> AddCommentAsync(
        string reportId,
        AddDailyReportCommentRequest request,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        var report = await db.DailyReports.FirstOrDefaultAsync(item => item.Id == reportId, cancellationToken);
        if (report is null || !await CanViewMemberAsync(user, report.MemberId, cancellationToken)) return null;
        var comments = JsonSerializer.Deserialize<List<DailyReportCommentDto>>(report.CommentsJson, JsonOptions) ?? [];
        comments.Add(new DailyReportCommentDto(
            $"daily-comment-{Guid.NewGuid():N}",
            user.Id,
            user.Name,
            request.Body.Trim(),
            DateTimeOffset.UtcNow.ToString("O")));
        report.CommentsJson = JsonSerializer.Serialize(comments, JsonOptions);
        report.UpdatedAt = DateTimeOffset.UtcNow.ToString("O");
        report.Version += 1;
        await db.SaveChangesAsync(cancellationToken);
        await MarkReadAsync(report.Id, user, cancellationToken);
        return ToDto(report, comments.Count);
    }

    public async Task<bool> MarkReadAsync(
        string reportId,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        var report = await db.DailyReports.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == reportId, cancellationToken);
        if (report is null || !await CanViewMemberAsync(user, report.MemberId, cancellationToken)) return false;
        var commentCount = JsonSerializer.Deserialize<IReadOnlyList<DailyReportCommentDto>>(
            report.CommentsJson,
            JsonOptions)?.Count ?? 0;
        var read = await db.DailyReportReads.FindAsync([reportId, user.Id], cancellationToken);
        if (read is null)
        {
            read = new DailyReportReadEntity { ReportId = reportId, UserId = user.Id };
            db.DailyReportReads.Add(read);
        }
        read.CommentCount = commentCount;
        read.ReadAt = DateTimeOffset.UtcNow.ToString("O");
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<IReadOnlyList<DailyReportReminderDto>> SendRemindersAsync(
        SendDailyReportReminderRequest request,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        if (!await CanManageTeamAsync(user, request.TeamId, cancellationToken))
        {
            throw new UnauthorizedAccessException("リマインドを送信する権限がありません。");
        }
        var teamMemberIds = await db.TeamMembers
            .Where(item => item.TeamId == request.TeamId && request.MemberIds.Contains(item.MemberId))
            .Select(item => item.MemberId)
            .ToListAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow.ToString("O");
        var reminders = teamMemberIds.Select(memberId => new DailyReportReminderEntity
        {
            Id = $"daily-reminder-{Guid.NewGuid():N}",
            TeamId = request.TeamId,
            Date = request.Date,
            RecipientMemberId = memberId,
            SenderUserId = user.Id,
            SenderName = user.Name,
            CreatedAt = now
        }).ToArray();
        db.DailyReportReminders.AddRange(reminders);
        await db.SaveChangesAsync(cancellationToken);
        return reminders.Select(ToDto).ToArray();
    }

    public async Task<IReadOnlyList<DailyReportReminderDto>> ListRemindersAsync(
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(user.MemberId)) return [];
        var reminders = await db.DailyReportReminders.AsNoTracking()
            .Where(item => item.RecipientMemberId == user.MemberId && item.ReadAt == null)
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync(cancellationToken);
        return reminders.Select(ToDto).ToArray();
    }

    public async Task<bool> MarkReminderReadAsync(
        string reminderId,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(user.MemberId)) return false;
        var reminder = await db.DailyReportReminders.FirstOrDefaultAsync(
            item => item.Id == reminderId && item.RecipientMemberId == user.MemberId,
            cancellationToken);
        if (reminder is null) return false;
        reminder.ReadAt = DateTimeOffset.UtcNow.ToString("O");
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> DeleteAsync(
        string reportId,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        var report = await db.DailyReports.FirstOrDefaultAsync(item => item.Id == reportId, cancellationToken);
        if (report is null) return false;
        if (!await CanEditMemberAsync(user, report.MemberId, cancellationToken))
        {
            throw new UnauthorizedAccessException("この日報を削除する権限がありません。");
        }
        var logs = await db.ProjectWorkLogs.Where(log => log.DailyReportId == reportId).ToListAsync(cancellationToken);
        db.ProjectWorkLogs.RemoveRange(logs);
        db.DailyReports.Remove(report);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static DailyReportDto ToDto(DailyReportEntity entity, int readCommentCount)
    {
        var comments = JsonSerializer.Deserialize<IReadOnlyList<DailyReportCommentDto>>(
            entity.CommentsJson,
            JsonOptions) ?? [];
        return new DailyReportDto(
            entity.Id,
            entity.MemberId,
            entity.Date,
            entity.Status,
            entity.Summary,
            entity.Blockers,
            entity.NextPlan,
            JsonSerializer.Deserialize<IReadOnlyList<DailyReportEntryDto>>(entity.EntriesJson, JsonOptions) ?? [],
            comments,
            entity.SubmittedAt,
            entity.CreatedAt,
            entity.UpdatedAt,
            entity.Version,
            Math.Max(0, comments.Count - readCommentCount));
    }

    private static DailyReportReminderDto ToDto(DailyReportReminderEntity entity) => new(
        entity.Id,
        entity.TeamId,
        entity.Date,
        entity.RecipientMemberId,
        entity.SenderName,
        entity.CreatedAt,
        entity.ReadAt);

    private async Task<bool> CanEditMemberAsync(
        AuthUserDto user,
        string memberId,
        CancellationToken cancellationToken) =>
        user.MemberId == memberId || await IsManagerAsync(user, cancellationToken);

    private async Task<bool> CanViewMemberAsync(
        AuthUserDto user,
        string memberId,
        CancellationToken cancellationToken)
    {
        if (user.MemberId == memberId || await IsManagerAsync(user, cancellationToken)) return true;
        if (string.IsNullOrWhiteSpace(user.MemberId)) return false;
        return await db.TeamMembers.AnyAsync(
            own => own.MemberId == user.MemberId && db.TeamMembers.Any(
                target => target.TeamId == own.TeamId && target.MemberId == memberId),
            cancellationToken);
    }

    private async Task<bool> CanViewTeamAsync(
        AuthUserDto user,
        string teamId,
        CancellationToken cancellationToken) =>
        await IsManagerAsync(user, cancellationToken) ||
        (!string.IsNullOrWhiteSpace(user.MemberId) && await db.TeamMembers.AnyAsync(
            item => item.TeamId == teamId && item.MemberId == user.MemberId,
            cancellationToken));

    private async Task<bool> CanManageTeamAsync(
        AuthUserDto user,
        string teamId,
        CancellationToken cancellationToken)
    {
        if (await IsManagerAsync(user, cancellationToken)) return true;
        if (string.IsNullOrWhiteSpace(user.MemberId)) return false;
        return await db.TeamMembers.AnyAsync(
            item => item.TeamId == teamId && item.MemberId == user.MemberId &&
                (item.Member!.Role == "PM" || item.Member.Role == "PL"),
            cancellationToken);
    }

    private async Task<bool> IsManagerAsync(AuthUserDto user, CancellationToken cancellationToken)
    {
        if (user.Role.Equals("admin", StringComparison.OrdinalIgnoreCase) ||
            user.Role.Equals("manager", StringComparison.OrdinalIgnoreCase)) return true;
        return !string.IsNullOrWhiteSpace(user.MemberId) && await db.Members.AnyAsync(
            member => member.Id == user.MemberId && (member.Role == "PM" || member.Role == "PL"),
            cancellationToken);
    }
}

public sealed class DailyReportConflictException(int currentVersion) : Exception
{
    public int CurrentVersion { get; } = currentVersion;
}
