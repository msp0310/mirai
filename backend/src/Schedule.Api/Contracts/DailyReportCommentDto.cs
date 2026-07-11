namespace Schedule.Api.Contracts;

/// <summary>日報へ投稿されたコメントです。</summary>
public sealed record DailyReportCommentDto(
    string Id,
    string AuthorId,
    string AuthorName,
    string Body,
    string CreatedAt);
