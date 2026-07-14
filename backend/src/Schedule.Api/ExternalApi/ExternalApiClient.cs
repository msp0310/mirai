using Schedule.Api.Application;
using Schedule.Api.Contracts;

namespace Schedule.Api.ExternalApi;

/// <summary>認証済み外部クライアントと、その操作範囲を表します。</summary>
public sealed class ExternalApiClient(ExternalApiClientOptions options)
{
    private readonly HashSet<string> scopes = options.Scopes.ToHashSet(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> projectIds = options.ProjectIds.ToHashSet(StringComparer.Ordinal);

    public string Id { get; } = options.Id;
    public string Name { get; } = options.Name;
    public IReadOnlyCollection<string> Scopes => scopes;

    public bool HasScope(string scope) => scopes.Contains("*") || scopes.Contains(scope);

    public bool CanAccessProject(string projectId) => projectIds.Count == 0 || projectIds.Contains(projectId);

    /// <summary>既存の権限・監査サービスへ渡す外部主体を生成します。</summary>
    public AuthUserDto ToSystemUser() => new(
        $"external:{Id}",
        null,
        $"{Id}@external.compass.invalid",
        Name,
        SystemRoles.Admin,
        false);
}

/// <summary>外部APIのスコープ名を一か所で管理します。</summary>
public static class ExternalApiScopes
{
    public const string ProjectsRead = "projects:read";
    public const string TasksRead = "tasks:read";
    public const string TasksWrite = "tasks:write";
    public const string ActualsWrite = "actuals:write";
}
