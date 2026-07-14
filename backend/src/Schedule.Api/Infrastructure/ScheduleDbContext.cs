using Microsoft.EntityFrameworkCore;
using Schedule.Api.Domain;

namespace Schedule.Api.Infrastructure;

/// <summary>COMPASSのSQLite永続化モデルとリレーションを定義するDbContextです。</summary>
public sealed class ScheduleDbContext(DbContextOptions<ScheduleDbContext> options) : DbContext(options)
{
    public DbSet<UserEntity> Users => Set<UserEntity>();
    public DbSet<AuthSessionEntity> AuthSessions => Set<AuthSessionEntity>();
    public DbSet<TeamEntity> Teams => Set<TeamEntity>();
    public DbSet<TeamMemberEntity> TeamMembers => Set<TeamMemberEntity>();
    public DbSet<MemberEntity> Members => Set<MemberEntity>();
    public DbSet<ProjectEntity> Projects => Set<ProjectEntity>();
    public DbSet<ProjectIssueEntity> ProjectIssues => Set<ProjectIssueEntity>();
    public DbSet<ProjectMemberEntity> ProjectMembers => Set<ProjectMemberEntity>();
    public DbSet<ProjectWorkLogEntity> ProjectWorkLogs => Set<ProjectWorkLogEntity>();
    public DbSet<DailyReportEntity> DailyReports => Set<DailyReportEntity>();
    public DbSet<DailyReportReadEntity> DailyReportReads => Set<DailyReportReadEntity>();
    public DbSet<DailyReportReminderEntity> DailyReportReminders => Set<DailyReportReminderEntity>();
    public DbSet<ProjectAssignmentEntity> ProjectAssignments => Set<ProjectAssignmentEntity>();
    public DbSet<StaffingDemandEntity> StaffingDemands => Set<StaffingDemandEntity>();
    public DbSet<AttachmentEntity> Attachments => Set<AttachmentEntity>();
    public DbSet<CalendarEntity> Calendars => Set<CalendarEntity>();
    public DbSet<CalendarHolidayEntity> CalendarHolidays => Set<CalendarHolidayEntity>();
    public DbSet<TaskEntity> Tasks => Set<TaskEntity>();
    public DbSet<TaskAssignmentEntity> TaskAssignments => Set<TaskAssignmentEntity>();
    public DbSet<TaskDependencyEntity> TaskDependencies => Set<TaskDependencyEntity>();
    public DbSet<ScheduleChangeLogEntity> ScheduleChangeLogs => Set<ScheduleChangeLogEntity>();
    public DbSet<ImportJobEntity> ImportJobs => Set<ImportJobEntity>();
    public DbSet<AuditLogEntity> AuditLogs => Set<AuditLogEntity>();

    /// <summary>一意制約、複合キー、削除規則、検索用インデックスを設定します。</summary>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserEntity>().HasIndex(entity => entity.EmailNormalized).IsUnique();
        modelBuilder.Entity<UserEntity>()
            .HasIndex(entity => entity.MemberId)
            .IsUnique()
            .HasFilter("MemberId IS NOT NULL");
        modelBuilder.Entity<AuthSessionEntity>().HasIndex(entity => entity.TokenHash).IsUnique();
        modelBuilder.Entity<AuthSessionEntity>().HasIndex(entity => new { entity.UserId, entity.ExpiresAt });

        modelBuilder.Entity<AuthSessionEntity>()
            .HasOne(entity => entity.User)
            .WithMany(entity => entity.Sessions)
            .HasForeignKey(entity => entity.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TeamMemberEntity>().HasKey(entity => new { entity.TeamId, entity.MemberId });
        modelBuilder.Entity<ProjectMemberEntity>().HasKey(entity => new { entity.ProjectId, entity.MemberId });
        modelBuilder.Entity<TeamMemberEntity>().Property(entity => entity.TeamRole).HasDefaultValue("member");
        modelBuilder.Entity<ProjectMemberEntity>().Property(entity => entity.ProjectRole).HasDefaultValue("member");
        modelBuilder.Entity<CalendarHolidayEntity>().HasKey(entity => new { entity.CalendarId, entity.Date });
        modelBuilder.Entity<TaskAssignmentEntity>().HasKey(entity => new { entity.TaskId, entity.MemberId });
        modelBuilder.Entity<TaskDependencyEntity>().HasKey(entity => new { entity.TaskId, entity.DependsOnTaskId });
        modelBuilder.Entity<DailyReportReadEntity>().HasKey(entity => new { entity.ReportId, entity.UserId });

        modelBuilder.Entity<ProjectEntity>()
            .HasOne(entity => entity.Calendar)
            .WithOne(entity => entity.Project)
            .HasForeignKey<CalendarEntity>(entity => entity.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProjectEntity>()
            .HasMany(entity => entity.Tasks)
            .WithOne(entity => entity.Project)
            .HasForeignKey(entity => entity.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProjectEntity>()
            .HasMany(entity => entity.Issues)
            .WithOne(entity => entity.Project)
            .HasForeignKey(entity => entity.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProjectEntity>()
            .HasMany(entity => entity.WorkLogs)
            .WithOne(entity => entity.Project)
            .HasForeignKey(entity => entity.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProjectEntity>()
            .HasMany(entity => entity.Attachments)
            .WithOne(entity => entity.Project)
            .HasForeignKey(entity => entity.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProjectEntity>()
            .HasMany(entity => entity.Assignments)
            .WithOne(entity => entity.Project)
            .HasForeignKey(entity => entity.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProjectEntity>()
            .HasMany(entity => entity.StaffingDemands)
            .WithOne(entity => entity.Project)
            .HasForeignKey(entity => entity.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TaskEntity>()
            .HasMany(entity => entity.Assignments)
            .WithOne(entity => entity.Task)
            .HasForeignKey(entity => entity.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TaskEntity>()
            .HasMany(entity => entity.Dependencies)
            .WithOne(entity => entity.Task)
            .HasForeignKey(entity => entity.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProjectEntity>().HasIndex(entity => entity.TeamId);
        // アプリ側の期待バージョン確認に加え、DB更新時の競合も検知します。
        modelBuilder.Entity<ProjectEntity>().Property(entity => entity.Version).IsConcurrencyToken();
        modelBuilder.Entity<ProjectMemberEntity>().HasIndex(entity => entity.MemberId);
        modelBuilder.Entity<ProjectIssueEntity>().HasIndex(entity => new { entity.ProjectId, entity.UpdatedAt });
        modelBuilder.Entity<ProjectWorkLogEntity>().HasIndex(entity => new { entity.ProjectId, entity.Date });
        modelBuilder.Entity<ProjectWorkLogEntity>().HasIndex(entity => entity.DailyReportId);
        modelBuilder.Entity<DailyReportEntity>().HasIndex(entity => new { entity.MemberId, entity.Date }).IsUnique();
        modelBuilder.Entity<DailyReportReminderEntity>()
            .HasIndex(entity => new { entity.TeamId, entity.Date, entity.RecipientMemberId });
        modelBuilder.Entity<DailyReportReminderEntity>()
            .HasIndex(entity => new { entity.RecipientMemberId, entity.ReadAt });
        modelBuilder.Entity<ProjectAssignmentEntity>().HasIndex(entity => new { entity.ProjectId, entity.MemberId });
        modelBuilder.Entity<StaffingDemandEntity>().HasIndex(entity => new { entity.ProjectId, entity.Status });
        modelBuilder.Entity<AttachmentEntity>().HasIndex(entity => new
        {
            entity.ProjectId,
            entity.OwnerType,
            entity.OwnerId
        });
        modelBuilder.Entity<TaskEntity>().HasIndex(entity => new { entity.ProjectId, entity.SortOrder });
        modelBuilder.Entity<TaskEntity>().HasIndex(entity => new { entity.ProjectId, entity.Type, entity.Status });
        modelBuilder.Entity<TaskAssignmentEntity>().HasIndex(entity => entity.MemberId);
        modelBuilder.Entity<ScheduleChangeLogEntity>().HasIndex(entity => new { entity.ProjectId, entity.ChangedAt });
        modelBuilder.Entity<AuditLogEntity>().HasIndex(entity => new { entity.ScopeType, entity.ScopeId, entity.CreatedAt });
        modelBuilder.Entity<AuditLogEntity>().HasIndex(entity => new { entity.UserId, entity.CreatedAt });
    }
}
