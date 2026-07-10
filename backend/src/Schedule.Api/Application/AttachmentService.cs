using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Schedule.Api.Contracts;
using Schedule.Api.Domain;
using Schedule.Api.Infrastructure;

namespace Schedule.Api.Application;

/// <summary>プロジェクト内の添付ファイルを検証・保存・取得・削除します。</summary>
public sealed class AttachmentService
{
    private const long DefaultMaxFileSize = 25 * 1024 * 1024;
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".7z", ".csv", ".doc", ".docx", ".gif", ".jpeg", ".jpg", ".json", ".log", ".md",
        ".pdf", ".png", ".sql", ".tar", ".txt", ".webp", ".xls", ".xlsx", ".xml", ".zip"
    };
    private static readonly HashSet<string> OwnerTypes = new(StringComparer.Ordinal)
    {
        "issue", "issueReply", "task", "taskComment", "workLog"
    };
    private readonly ScheduleDbContext db;
    private readonly long maxFileSize;
    private readonly string storageRoot;

    public AttachmentService(
        ScheduleDbContext db,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        this.db = db;
        maxFileSize = configuration.GetValue<long?>("Attachments:MaxFileSizeBytes") ?? DefaultMaxFileSize;
        var configuredRoot = configuration["Attachments:RootPath"];
        storageRoot = Path.GetFullPath(
            string.IsNullOrWhiteSpace(configuredRoot)
                ? Path.Combine(environment.ContentRootPath, "App_Data", "attachments")
                : Path.IsPathRooted(configuredRoot)
                    ? configuredRoot
                    : Path.Combine(environment.ContentRootPath, configuredRoot));
    }

    /// <summary>案件に紐づく添付メタデータを取得します。</summary>
    public async Task<IReadOnlyList<AttachmentDto>> ListAsync(
        string projectId,
        CancellationToken cancellationToken)
    {
        var entities = await db.Attachments
            .AsNoTracking()
            .Where(attachment => attachment.ProjectId == projectId)
            .OrderByDescending(attachment => attachment.UploadedAt)
            .ThenBy(attachment => attachment.FileName)
            .ToListAsync(cancellationToken);
        return entities.Select(ToDto).ToArray();
    }

    /// <summary>添付を検証し、ファイル本体とメタデータを保存します。</summary>
    public async Task<AttachmentMutationResult> UploadAsync(
        string projectId,
        string ownerType,
        string ownerId,
        string? parentId,
        IFormFile? file,
        AuthUserDto user,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return AttachmentMutationResult.BadRequest("ファイルを選択してください。");
        }

        if (file.Length > maxFileSize)
        {
            return AttachmentMutationResult.BadRequest(
                $"ファイルサイズは {maxFileSize / (1024 * 1024)}MB 以下にしてください。");
        }

        ownerType = ownerType.Trim();
        ownerId = ownerId.Trim();
        parentId = string.IsNullOrWhiteSpace(parentId) ? null : parentId.Trim();
        if (!OwnerTypes.Contains(ownerType) || ownerId.Length == 0)
        {
            return AttachmentMutationResult.BadRequest("添付先が不正です。");
        }

        var fileName = Path.GetFileName(file.FileName).Trim();
        var extension = Path.GetExtension(fileName);
        if (fileName.Length == 0 || fileName.Length > 180 || !AllowedExtensions.Contains(extension))
        {
            return AttachmentMutationResult.BadRequest("許可されていないファイル形式です。");
        }

        if (!await db.Projects.AnyAsync(project => project.Id == projectId, cancellationToken))
        {
            return AttachmentMutationResult.NotFound();
        }

        if (!await OwnerExistsAsync(projectId, ownerType, ownerId, parentId, cancellationToken))
        {
            return AttachmentMutationResult.BadRequest("添付先が見つかりません。");
        }

        var now = DateTimeOffset.UtcNow.ToString("O");
        var id = Guid.NewGuid().ToString("N");
        var storageDirectory = Path.Combine(storageRoot, SanitizePathSegment(projectId));
        var storageFileName = $"{id}{extension.ToLowerInvariant()}";
        var fullPath = Path.Combine(storageDirectory, storageFileName);
        Directory.CreateDirectory(storageDirectory);

        try
        {
            var sha256 = await CopyAndHashAsync(file, fullPath, cancellationToken);
            var entity = new AttachmentEntity
            {
                Id = id,
                ProjectId = projectId,
                OwnerType = ownerType,
                OwnerId = ownerId,
                ParentId = parentId,
                FileName = fileName,
                StorageKey = Path.Combine(SanitizePathSegment(projectId), storageFileName),
                ContentType = string.IsNullOrWhiteSpace(file.ContentType)
                    ? "application/octet-stream"
                    : file.ContentType,
                SizeBytes = file.Length,
                Sha256 = sha256,
                UploadedBy = user.Name,
                UploadedAt = now
            };
            db.Attachments.Add(entity);
            await db.SaveChangesAsync(cancellationToken);
            return AttachmentMutationResult.Success(ToDto(entity));
        }
        catch
        {
            TryDelete(fullPath);
            throw;
        }
    }

    /// <summary>添付の保存本体を開きます。</summary>
    public async Task<AttachmentDownload?> OpenDownloadAsync(
        string projectId,
        string attachmentId,
        CancellationToken cancellationToken)
    {
        var entity = await db.Attachments
            .AsNoTracking()
            .SingleOrDefaultAsync(
                attachment => attachment.ProjectId == projectId && attachment.Id == attachmentId,
                cancellationToken);
        if (entity is null) return null;

        var path = GetStoragePath(entity);
        if (!File.Exists(path)) return null;
        var stream = new FileStream(
            path,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            bufferSize: 64 * 1024,
            options: FileOptions.Asynchronous | FileOptions.SequentialScan);
        return new AttachmentDownload(stream, entity.ContentType, entity.FileName, entity.SizeBytes);
    }

    /// <summary>添付メタデータと本体を削除します。</summary>
    public async Task<bool> DeleteAsync(
        string projectId,
        string attachmentId,
        CancellationToken cancellationToken)
    {
        var entity = await db.Attachments.SingleOrDefaultAsync(
            attachment => attachment.ProjectId == projectId && attachment.Id == attachmentId,
            cancellationToken);
        if (entity is null) return false;

        db.Attachments.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        TryDelete(GetStoragePath(entity));
        return true;
    }

    private async Task<bool> OwnerExistsAsync(
        string projectId,
        string ownerType,
        string ownerId,
        string? parentId,
        CancellationToken cancellationToken)
    {
        return ownerType switch
        {
            "issue" => await db.ProjectIssues.AnyAsync(
                issue => issue.ProjectId == projectId && issue.Id == ownerId,
                cancellationToken),
            "issueReply" => parentId is not null && await db.ProjectIssues.AnyAsync(
                issue => issue.ProjectId == projectId && issue.Id == parentId,
                cancellationToken),
            "task" => await db.Tasks.AnyAsync(
                task => task.ProjectId == projectId && task.Id == ownerId,
                cancellationToken),
            "taskComment" => parentId is not null && await db.Tasks.AnyAsync(
                task => task.ProjectId == projectId && task.Id == parentId,
                cancellationToken),
            "workLog" => await db.ProjectWorkLogs.AnyAsync(
                workLog => workLog.ProjectId == projectId && workLog.Id == ownerId,
                cancellationToken),
            _ => false
        };
    }

    private AttachmentDto ToDto(AttachmentEntity entity)
    {
        return new AttachmentDto(
            entity.Id,
            entity.OwnerType,
            entity.OwnerId,
            entity.ParentId,
            entity.FileName,
            entity.ContentType,
            entity.SizeBytes,
            entity.Sha256,
            entity.UploadedBy,
            entity.UploadedAt,
            $"/api/projects/{Uri.EscapeDataString(entity.ProjectId)}/attachments/{entity.Id}/download");
    }

    private string GetStoragePath(AttachmentEntity entity)
    {
        return Path.Combine(storageRoot, entity.StorageKey);
    }

    private static string SanitizePathSegment(string value)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var sanitized = new string(value.Select(character => invalid.Contains(character) ? '_' : character).ToArray());
        return string.IsNullOrWhiteSpace(sanitized) ? "project" : sanitized;
    }

    private static async Task<string> CopyAndHashAsync(
        IFormFile file,
        string path,
        CancellationToken cancellationToken)
    {
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        await using var input = file.OpenReadStream();
        await using var output = new FileStream(
            path,
            FileMode.CreateNew,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 64 * 1024,
            options: FileOptions.Asynchronous | FileOptions.SequentialScan);
        var buffer = new byte[64 * 1024];
        int read;
        while ((read = await input.ReadAsync(buffer.AsMemory(), cancellationToken)) > 0)
        {
            hash.AppendData(buffer, 0, read);
            await output.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
        }
        return Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant();
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch (IOException)
        {
            // メタデータ削除を優先し、残った本体は運用時のクリーンアップで回収します。
        }
    }
}

/// <summary>添付の登録結果です。</summary>
public sealed record AttachmentMutationResult(AttachmentDto? Attachment, string? Error, int StatusCode)
{
    public static AttachmentMutationResult BadRequest(string error) => new(null, error, StatusCodes.Status400BadRequest);

    public static AttachmentMutationResult NotFound() => new(null, null, StatusCodes.Status404NotFound);

    public static AttachmentMutationResult Success(AttachmentDto attachment) => new(attachment, null, StatusCodes.Status200OK);
}

/// <summary>添付ダウンロード用のストリーム情報です。</summary>
public sealed record AttachmentDownload(Stream Stream, string ContentType, string FileName, long Length);
