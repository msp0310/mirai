namespace Schedule.Api.Contracts;

/// <summary>ProjectWorkLogDtoのAPI入出力契約です。</summary>
public sealed record ProjectWorkLogDto(
    string Id,
    string Date,
    string MemberId,
    decimal Hours,
    string Category,
    string Summary,
    string? Note,
    string? TaskId,
    string? IssueId,
    bool Billable,
    string CreatedBy,
    string CreatedAt,
    string UpdatedAt,
    string? DailyReportId = null,
    string? DailyReportEntryId = null);
