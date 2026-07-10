namespace Schedule.Api.Contracts;

/// <summary>添付ファイルの表示・操作に必要なメタデータです。</summary>
public sealed record AttachmentDto(
    string Id,
    string OwnerType,
    string OwnerId,
    string? ParentId,
    string FileName,
    string ContentType,
    long SizeBytes,
    string Sha256,
    string UploadedBy,
    string UploadedAt,
    string DownloadUrl);
