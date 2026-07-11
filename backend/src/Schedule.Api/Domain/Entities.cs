using System.ComponentModel.DataAnnotations;

namespace Schedule.Api.Domain;

/// <summary>ログインユーザーの永続化エンティティです。</summary>
public sealed class UserEntity
{
    [Key]
    public string Id { get; set; } = "";
    public string? MemberId { get; set; }
    public string Email { get; set; } = "";
    public string EmailNormalized { get; set; } = "";
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public string CreatedAt { get; set; } = "";
    public string? LastLoginAt { get; set; }
    public string? PasswordChangedAt { get; set; }
    public bool PasswordResetRequired { get; set; }
    public List<AuthSessionEntity> Sessions { get; set; } = [];
}

/// <summary>Bearerトークンのサーバーセッションエンティティです。</summary>
public sealed class AuthSessionEntity
{
    [Key]
    public string Id { get; set; } = "";
    public string UserId { get; set; } = "";
    public string TokenHash { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public string ExpiresAt { get; set; } = "";
    public string? RevokedAt { get; set; }
    public UserEntity? User { get; set; }
}

/// <summary>チームマスターの永続化エンティティです。</summary>
public sealed class TeamEntity
{
    [Key]
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Code { get; set; } = "";
    public string Description { get; set; } = "";
    public List<TeamMemberEntity> Members { get; set; } = [];
}

/// <summary>チームとメンバーの多対多関係を表します。</summary>
public sealed class TeamMemberEntity
{
    public string TeamId { get; set; } = "";
    public string MemberId { get; set; } = "";
    public TeamEntity? Team { get; set; }
    public MemberEntity? Member { get; set; }
}

/// <summary>担当者・ユーザー表示情報の永続化エンティティです。</summary>
public sealed class MemberEntity
{
    [Key]
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Initials { get; set; } = "";
    public string Role { get; set; } = "";
    public string Color { get; set; } = "";
    public decimal CapacityHours { get; set; }
    public string? Status { get; set; }
    public string? InactiveAt { get; set; }
    public string? AvailabilityOverridesJson { get; set; }
}

/// <summary>チームに所属するプロジェクトの永続化エンティティです。</summary>
public sealed class ProjectEntity
{
    [Key]
    public string Id { get; set; } = "";
    public string TeamId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Workspace { get; set; } = "";
    public string? LifecycleStatus { get; set; }
    public string RangeStart { get; set; } = "";
    public string RangeEnd { get; set; } = "";
    public string NextMilestoneTitle { get; set; } = "";
    public string NextMilestoneDate { get; set; } = "";
    public string? Status { get; set; }
    public string? ArchivedAt { get; set; }
    public int Version { get; set; } = 1;
    public TeamEntity? Team { get; set; }
    public CalendarEntity? Calendar { get; set; }
    public List<ProjectIssueEntity> Issues { get; set; } = [];
    public List<ProjectMemberEntity> Members { get; set; } = [];
    public List<TaskEntity> Tasks { get; set; } = [];
    public List<ProjectWorkLogEntity> WorkLogs { get; set; } = [];
    public List<AttachmentEntity> Attachments { get; set; } = [];
    public List<ProjectAssignmentEntity> Assignments { get; set; } = [];
    public List<StaffingDemandEntity> StaffingDemands { get; set; } = [];
}

/// <summary>案件単位の要員アサイン計画です。</summary>
public sealed class ProjectAssignmentEntity
{
    [Key]
    public string Id { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string MemberId { get; set; } = "";
    public string Role { get; set; } = "";
    public string StartDate { get; set; } = "";
    public string EndDate { get; set; } = "";
    public int AllocationPercent { get; set; }
    public string Status { get; set; } = "draft";
    public ProjectEntity? Project { get; set; }
}

/// <summary>案件側で未充足となっている要員要求です。</summary>
public sealed class StaffingDemandEntity
{
    [Key]
    public string Id { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string Role { get; set; } = "";
    public string StartDate { get; set; } = "";
    public string EndDate { get; set; } = "";
    public int RequiredCount { get; set; }
    public int AllocationPercent { get; set; }
    public string Status { get; set; } = "open";
    public ProjectEntity? Project { get; set; }
}

/// <summary>プロジェクト内の課題、作業ログ、コメントに紐づく添付ファイルのメタデータです。</summary>
public sealed class AttachmentEntity
{
    [Key]
    public string Id { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string OwnerType { get; set; } = "";
    public string OwnerId { get; set; } = "";
    public string? ParentId { get; set; }
    public string FileName { get; set; } = "";
    public string StorageKey { get; set; } = "";
    public string ContentType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }
    public string Sha256 { get; set; } = "";
    public string UploadedBy { get; set; } = "";
    public string UploadedAt { get; set; } = "";
    public ProjectEntity? Project { get; set; }
}

/// <summary>プロジェクト課題の永続化エンティティです。</summary>
public sealed class ProjectIssueEntity
{
    [Key]
    public string Id { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string Status { get; set; } = "open";
    public string Priority { get; set; } = "medium";
    public string Type { get; set; } = "task";
    public string AssigneeIdsJson { get; set; } = "[]";
    public string TaskIdsJson { get; set; } = "[]";
    public string RepliesJson { get; set; } = "[]";
    public string? DueDate { get; set; }
    public string CreatedAt { get; set; } = "";
    public string UpdatedAt { get; set; } = "";
    public string? ClosedAt { get; set; }
    public string? GitHubRepository { get; set; }
    public int? GitHubIssueNumber { get; set; }
    public string? GitHubUrl { get; set; }
    public string? GitHubState { get; set; }
    public string? GitHubSyncStatus { get; set; }
    public string? GitHubLastSyncedAt { get; set; }
    public ProjectEntity? Project { get; set; }
}

/// <summary>プロジェクトとメンバーの多対多関係を表します。</summary>
public sealed class ProjectMemberEntity
{
    public string ProjectId { get; set; } = "";
    public string MemberId { get; set; } = "";
    public ProjectEntity? Project { get; set; }
    public MemberEntity? Member { get; set; }
}

/// <summary>プロジェクトの作業時間記録エンティティです。</summary>
public sealed class ProjectWorkLogEntity
{
    [Key]
    public string Id { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string Date { get; set; } = "";
    public string MemberId { get; set; } = "";
    public decimal Hours { get; set; }
    public string Category { get; set; } = "maintenance";
    public string Summary { get; set; } = "";
    public string? Note { get; set; }
    public string? TaskId { get; set; }
    public string? IssueId { get; set; }
    public bool Billable { get; set; } = true;
    public string CreatedBy { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public string UpdatedAt { get; set; } = "";
    public string? DailyReportId { get; set; }
    public string? DailyReportEntryId { get; set; }
    public ProjectEntity? Project { get; set; }
}

/// <summary>複数案件の作業実績を一日単位でまとめる日報です。</summary>
public sealed class DailyReportEntity
{
    [Key]
    public string Id { get; set; } = "";
    public string MemberId { get; set; } = "";
    public string Date { get; set; } = "";
    public string Status { get; set; } = "draft";
    public string Summary { get; set; } = "";
    public string? Blockers { get; set; }
    public string? NextPlan { get; set; }
    public string EntriesJson { get; set; } = "[]";
    public string CommentsJson { get; set; } = "[]";
    public string? SubmittedAt { get; set; }
    public string CreatedAt { get; set; } = "";
    public string UpdatedAt { get; set; } = "";
    public int Version { get; set; } = 1;
}

/// <summary>プロジェクトに適用する稼働カレンダーのエンティティです。</summary>
public sealed class CalendarEntity
{
    [Key]
    public string Id { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string Name { get; set; } = "";
    public string WorkWeekJson { get; set; } = "[1,2,3,4,5]";
    public ProjectEntity? Project { get; set; }
    public List<CalendarHolidayEntity> Holidays { get; set; } = [];
}

/// <summary>カレンダー上の休日エンティティです。</summary>
public sealed class CalendarHolidayEntity
{
    public string CalendarId { get; set; } = "";
    public string Date { get; set; } = "";
    public string Name { get; set; } = "";
    public CalendarEntity? Calendar { get; set; }
}

/// <summary>ガントチャートのタスク・フェーズ・マイルストーンエンティティです。</summary>
public sealed class TaskEntity
{
    [Key]
    public string Id { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string? ParentId { get; set; }
    public string Title { get; set; } = "";
    public string Type { get; set; } = "task";
    public string Status { get; set; } = "notStarted";
    public string Start { get; set; } = "";
    public string End { get; set; } = "";
    public int Progress { get; set; }
    public string Color { get; set; } = "#89b7ff";
    public bool? Expanded { get; set; }
    public int SortOrder { get; set; }
    public string? Description { get; set; }
    public decimal? EffortHours { get; set; }
    public string? BaselineStart { get; set; }
    public string? BaselineEnd { get; set; }
    public string? BaselineCapturedAt { get; set; }
    public string? ChecklistJson { get; set; }
    public string? CommentsJson { get; set; }
    public string? LinksJson { get; set; }
    public string? ExternalSource { get; set; }
    public string? ExternalId { get; set; }
    public ProjectEntity? Project { get; set; }
    public List<TaskAssignmentEntity> Assignments { get; set; } = [];
    public List<TaskDependencyEntity> Dependencies { get; set; } = [];
}

/// <summary>タスクと担当者の割当エンティティです。</summary>
public sealed class TaskAssignmentEntity
{
    public string TaskId { get; set; } = "";
    public string MemberId { get; set; } = "";
    public decimal? Percent { get; set; }
    public TaskEntity? Task { get; set; }
    public MemberEntity? Member { get; set; }
}

/// <summary>タスク間の先行依存関係エンティティです。</summary>
public sealed class TaskDependencyEntity
{
    public string TaskId { get; set; } = "";
    public string DependsOnTaskId { get; set; } = "";
    public TaskEntity? Task { get; set; }
}

/// <summary>タスクの計画変更を分析するための履歴エンティティです。</summary>
public sealed class ScheduleChangeLogEntity
{
    [Key]
    public string Id { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string TaskId { get; set; } = "";
    public string Field { get; set; } = "";
    public string? BeforeValue { get; set; }
    public string? AfterValue { get; set; }
    public int? DeltaDays { get; set; }
    public string ChangedAt { get; set; } = "";
    public string ChangedBy { get; set; } = "";
    public string? Reason { get; set; }
}

/// <summary>外部ファイル取込の状態を管理するエンティティです。</summary>
public sealed class ImportJobEntity
{
    [Key]
    public string Id { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string Source { get; set; } = "";
    public string FileName { get; set; } = "";
    public string Status { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public string? AppliedAt { get; set; }
    public string? PayloadJson { get; set; }
}
