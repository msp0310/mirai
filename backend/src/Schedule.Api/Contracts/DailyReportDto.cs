namespace Schedule.Api.Contracts;

/// <summary>個人が一日分の複数案件作業をまとめる日報です。</summary>
public sealed record DailyReportDto(
    string Id,
    string MemberId,
    string Date,
    string Status,
    string Summary,
    string? Blockers,
    string? NextPlan,
    IReadOnlyList<DailyReportEntryDto> Entries,
    IReadOnlyList<DailyReportCommentDto> Comments,
    string? SubmittedAt,
    string CreatedAt,
    string UpdatedAt,
    int Version);
