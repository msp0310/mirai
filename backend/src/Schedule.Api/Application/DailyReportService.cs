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

    public async Task<IReadOnlyList<DailyReportDto>> ListAsync(CancellationToken cancellationToken)
    {
        var reports = await db.DailyReports
            .AsNoTracking()
            .OrderByDescending(report => report.Date)
            .ThenBy(report => report.MemberId)
            .ToListAsync(cancellationToken);
        return reports.Select(ToDto).ToArray();
    }

    public async Task<DailyReportDto?> SaveAsync(
        string reportId,
        SaveDailyReportRequest request,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
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
        return ToDto(report);
    }

    public async Task<bool> DeleteAsync(string reportId, CancellationToken cancellationToken)
    {
        var report = await db.DailyReports.FirstOrDefaultAsync(item => item.Id == reportId, cancellationToken);
        if (report is null) return false;
        var logs = await db.ProjectWorkLogs.Where(log => log.DailyReportId == reportId).ToListAsync(cancellationToken);
        db.ProjectWorkLogs.RemoveRange(logs);
        db.DailyReports.Remove(report);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static DailyReportDto ToDto(DailyReportEntity entity)
    {
        return new DailyReportDto(
            entity.Id,
            entity.MemberId,
            entity.Date,
            entity.Status,
            entity.Summary,
            entity.Blockers,
            entity.NextPlan,
            JsonSerializer.Deserialize<IReadOnlyList<DailyReportEntryDto>>(entity.EntriesJson, JsonOptions) ?? [],
            JsonSerializer.Deserialize<IReadOnlyList<DailyReportCommentDto>>(entity.CommentsJson, JsonOptions) ?? [],
            entity.SubmittedAt,
            entity.CreatedAt,
            entity.UpdatedAt,
            entity.Version);
    }
}

public sealed class DailyReportConflictException(int currentVersion) : Exception
{
    public int CurrentVersion { get; } = currentVersion;
}
