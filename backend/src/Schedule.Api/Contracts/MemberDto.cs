namespace Schedule.Api.Contracts;

/// <summary>MemberDtoのAPI入出力契約です。</summary>
public sealed record MemberDto(
    string Id,
    string Name,
    string Initials,
    string Role,
    string Color,
    decimal CapacityHours,
    string? Status,
    string? InactiveAt,
    IReadOnlyList<MemberAvailabilityOverrideDto>? AvailabilityOverrides,
    string? LoginEmail,
    string? PermissionRole,
    bool LoginEnabled,
    string? LoginCreatedAt,
    string? LastLoginAt,
    string? PasswordChangedAt,
    bool PasswordResetRequired,
    string? EmployeeNo = null);
