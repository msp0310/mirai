using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Schedule.Api.Contracts;
using Schedule.Api.Domain;
using Schedule.Api.Infrastructure;

namespace Schedule.Api.Application;

/// <summary>ログイン、セッション、メンバーアカウントを扱う認証サービスです。</summary>
public sealed class AuthService(ScheduleDbContext db)
{
    public const string SessionCookieName = "compass_session";
    public const string CsrfCookieName = "compass_csrf";
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(12);
    private const string DefaultRole = SystemRoles.User;

    /// <summary>有効なユーザーを認証し、ハッシュ化したトークンのセッションを発行します。</summary>
    public async Task<AuthLoginResult?> LoginAsync(
        string email,
        string password,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = NormalizeEmail(email);
        if (normalizedEmail.Length == 0 || password.Length == 0)
        {
            return null;
        }

        var user = await db.Users
            .SingleOrDefaultAsync(
                entity => entity.EmailNormalized == normalizedEmail && entity.IsActive,
                cancellationToken);
        if (user is null || !PasswordHasher.VerifyPassword(password, user.PasswordHash))
        {
            return null;
        }

        var now = DateTimeOffset.UtcNow;
        var token = CreateToken();
        user.LastLoginAt = now.ToString("O");
        var session = new AuthSessionEntity
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = user.Id,
            TokenHash = HashToken(token),
            CreatedAt = now.ToString("O"),
            ExpiresAt = now.Add(SessionLifetime).ToString("O")
        };

        db.AuthSessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);

        return new AuthLoginResult(new AuthSessionDto(MapUser(user), session.ExpiresAt), token, CreateToken());
    }

    /// <summary>メンバーと紐づくログインアカウントを管理画面向けに取得します。</summary>
    public async Task<IReadOnlyList<MemberDto>> ListMembersWithAccountsAsync(
        CancellationToken cancellationToken)
    {
        var members = await db.Members
            .AsNoTracking()
            .OrderBy(entity => entity.Name)
            .ThenBy(entity => entity.Id)
            .ToListAsync(cancellationToken);
        var accountsByMemberId = await db.Users
            .AsNoTracking()
            .Where(entity => entity.MemberId != null)
            .ToDictionaryAsync(entity => entity.MemberId!, cancellationToken);

        return members
            .Select(member => ScheduleMapper.ToDto(
                member,
                accountsByMemberId.TryGetValue(member.Id, out var account) ? account : null))
            .ToList();
    }

    /// <summary>メンバーのメールアドレス、権限、ログイン可否を保存します。</summary>
    public async Task<MemberAccountMutationResult> SaveMemberAccountAsync(
        string memberId,
        SaveMemberAccountRequest request,
        CancellationToken cancellationToken)
    {
        var member = await db.Members
            .SingleOrDefaultAsync(entity => entity.Id == memberId, cancellationToken);
        if (member is null)
        {
            return MemberAccountMutationResult.NotFound();
        }

        var email = request.Email.Trim();
        var normalizedEmail = NormalizeEmail(email);
        if (normalizedEmail.Length == 0)
        {
            return MemberAccountMutationResult.Conflict("メールアドレスを入力してください。");
        }

        var account = await db.Users
            .SingleOrDefaultAsync(entity => entity.MemberId == memberId, cancellationToken);
        if (await db.Users.AnyAsync(
            entity => entity.Id != (account == null ? "" : account.Id) &&
                entity.EmailNormalized == normalizedEmail,
            cancellationToken))
        {
            return MemberAccountMutationResult.Conflict("このメールアドレスは既に使われています。");
        }

        var now = DateTimeOffset.UtcNow.ToString("O");
        string? temporaryPassword = null;
        if (account is null)
        {
            var password = string.IsNullOrWhiteSpace(request.Password)
                ? CreateTemporaryPassword()
                : request.Password.Trim();
            temporaryPassword = password;
            account = new UserEntity
            {
                Id = await CreateAccountIdAsync(member.Id, cancellationToken),
                MemberId = member.Id,
                CreatedAt = now,
                PasswordHash = PasswordHasher.HashPassword(password),
                PasswordChangedAt = now,
                PasswordResetRequired = true
            };
            db.Users.Add(account);
        }
        else if (!string.IsNullOrWhiteSpace(request.Password))
        {
            account.PasswordHash = PasswordHasher.HashPassword(request.Password.Trim());
            account.PasswordChangedAt = now;
            account.PasswordResetRequired = true;
            await RevokeUserSessionsAsync(account.Id, cancellationToken);
        }

        account.Email = email;
        account.EmailNormalized = normalizedEmail;
        account.Name = member.Name;
        account.Role = NormalizeRole(request.PermissionRole);
        account.IsActive = request.LoginEnabled;

        if (!account.IsActive)
        {
            await RevokeUserSessionsAsync(account.Id, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        return MemberAccountMutationResult.Success(ScheduleMapper.ToDto(member, account), temporaryPassword);
    }

    /// <summary>メンバーのパスワードを再設定し、既存セッションを無効化します。</summary>
    public async Task<MemberAccountMutationResult> ResetMemberPasswordAsync(
        string memberId,
        ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var member = await db.Members
            .SingleOrDefaultAsync(entity => entity.Id == memberId, cancellationToken);
        var account = await db.Users
            .SingleOrDefaultAsync(entity => entity.MemberId == memberId, cancellationToken);
        if (member is null || account is null)
        {
            return MemberAccountMutationResult.NotFound();
        }

        var password = string.IsNullOrWhiteSpace(request.Password)
            ? CreateTemporaryPassword()
            : request.Password.Trim();
        var now = DateTimeOffset.UtcNow.ToString("O");
        account.PasswordHash = PasswordHasher.HashPassword(password);
        account.PasswordChangedAt = now;
        account.PasswordResetRequired = request.PasswordResetRequired;
        await RevokeUserSessionsAsync(account.Id, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        return MemberAccountMutationResult.Success(ScheduleMapper.ToDto(member, account), password);
    }

    /// <summary>アクセストークンを検証し、現在のユーザーを返します。</summary>
    public async Task<AuthUserDto?> GetUserByTokenAsync(
        string? token,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var tokenHash = HashToken(token.Trim());
        var session = await db.AuthSessions
            .Include(entity => entity.User)
            .SingleOrDefaultAsync(
                entity => entity.TokenHash == tokenHash && entity.RevokedAt == null,
                cancellationToken);
        if (session?.User is null || !session.User.IsActive)
        {
            return null;
        }

        if (!DateTimeOffset.TryParse(session.ExpiresAt, out var expiresAt) ||
            expiresAt <= DateTimeOffset.UtcNow)
        {
            return null;
        }

        return MapUser(session.User);
    }

    /// <summary>アクセストークンに対応するセッションを明示的に失効させます。</summary>
    public async Task LogoutAsync(string? token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return;
        }

        var tokenHash = HashToken(token.Trim());
        var session = await db.AuthSessions
            .SingleOrDefaultAsync(
                entity => entity.TokenHash == tokenHash && entity.RevokedAt == null,
                cancellationToken);
        if (session is null)
        {
            return;
        }

        session.RevokedAt = DateTimeOffset.UtcNow.ToString("O");
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>メールアドレスを一意性比較用の表記へ正規化します。</summary>
    public static string NormalizeEmail(string email)
    {
        return email.Trim().ToUpperInvariant();
    }

    /// <summary>永続化エンティティから認証レスポンス用DTOへ変換します。</summary>
    public static AuthUserDto MapUser(UserEntity user)
    {
        return new AuthUserDto(user.Id, user.MemberId, user.Email, user.Name, user.Role, user.PasswordResetRequired);
    }

    /// <summary>AuthorizationヘッダーからBearerトークンを安全に取り出します。</summary>
    public static string? GetBearerToken(HttpRequest request)
    {
        var authorization = request.Headers.Authorization.ToString();
        const string prefix = "Bearer ";
        return authorization.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            ? authorization[prefix.Length..].Trim()
            : null;
    }

    /// <summary>HttpOnly Cookieを優先し、移行期間中はBearerも受け付けます。</summary>
    public static string? GetSessionToken(HttpRequest request)
    {
        return request.Cookies[SessionCookieName] ?? GetBearerToken(request);
    }

    /// <summary>ログイン中ユーザーのパスワードを検証して変更します。</summary>
    public async Task<bool> ChangePasswordAsync(
        AuthUserDto currentUser,
        ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(entity => entity.Id == currentUser.Id, cancellationToken);
        if (user is null || !PasswordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash)) return false;
        if (request.NewPassword.Length < 12 || request.NewPassword.Length > 128)
            throw new ArgumentException("新しいパスワードは12文字以上128文字以下で入力してください。");
        user.PasswordHash = PasswordHasher.HashPassword(request.NewPassword);
        user.PasswordChangedAt = DateTimeOffset.UtcNow.ToString("O");
        user.PasswordResetRequired = false;
        await RevokeUserSessionsAsync(user.Id, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    /// <summary>セッションに使用する暗号学的に安全なトークンを生成します。</summary>
    private static string CreateToken()
    {
        return Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
    }

    /// <summary>管理者が初期パスワードを再発行するときの一時パスワードを生成します。</summary>
    private static string CreateTemporaryPassword()
    {
        // 推測しやすい連番を避け、再設定までの短時間でも十分なエントロピーを確保します。
        return $"COMPASS-{Base64UrlEncode(RandomNumberGenerator.GetBytes(12))}7!";
    }

    /// <summary>ロールを許可された値へ正規化します。</summary>
    private static string NormalizeRole(string role)
    {
        var normalized = role.Trim().ToLowerInvariant();
        return normalized switch
        {
            SystemRoles.Admin => SystemRoles.Admin,
            SystemRoles.User or "member" => SystemRoles.User,
            _ => DefaultRole
        };
    }

    /// <summary>メンバーに紐づく一意なユーザーIDを作成します。</summary>
    private async Task<string> CreateAccountIdAsync(
        string memberId,
        CancellationToken cancellationToken)
    {
        if (!await db.Users.AnyAsync(entity => entity.Id == memberId, cancellationToken))
        {
            return memberId;
        }

        return Guid.NewGuid().ToString("N");
    }

    /// <summary>指定ユーザーの既存セッションを無効化します。</summary>
    private async Task RevokeUserSessionsAsync(string userId, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        var sessions = await db.AuthSessions
            .Where(entity => entity.UserId == userId && entity.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var session in sessions)
        {
            session.RevokedAt = now;
        }
    }

    /// <summary>Bearerトークンを保存用のSHA-256ハッシュへ変換します。</summary>
    private static string HashToken(string token)
    {
        return Base64UrlEncode(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)));
    }

    /// <summary>バイト列をURL安全なBase64文字列へ変換します。</summary>
    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}

/// <summary>Cookie発行に必要な秘密値と公開セッション情報です。</summary>
public sealed record AuthLoginResult(AuthSessionDto Session, string SessionToken, string CsrfToken);

/// <summary>メンバーアカウント更新の成功、未検出、競合を表します。</summary>
public sealed class MemberAccountMutationResult
{
    /// <summary>アカウント更新結果の状態を初期化します。</summary>
    private MemberAccountMutationResult(
        string? conflictMessage,
        bool notFound,
        string? temporaryPassword,
        MemberDto? member)
    {
        ConflictMessage = conflictMessage;
        IsNotFound = notFound;
        TemporaryPassword = temporaryPassword;
        Member = member;
    }

    public string? ConflictMessage { get; }
    public bool IsNotFound { get; }
    public string? TemporaryPassword { get; }
    public MemberDto? Member { get; }

    /// <summary>入力または一意性制約に関する競合結果を作成します。</summary>
    public static MemberAccountMutationResult Conflict(string message)
    {
        return new MemberAccountMutationResult(message, false, null, null);
    }

    /// <summary>対象が存在しない結果を作成します。</summary>
    public static MemberAccountMutationResult NotFound()
    {
        return new MemberAccountMutationResult(null, true, null, null);
    }

    /// <summary>メンバーアカウント更新が成功した結果を作成します。</summary>
    public static MemberAccountMutationResult Success(
        MemberDto member,
        string? temporaryPassword)
    {
        return new MemberAccountMutationResult(null, false, temporaryPassword, member);
    }
}
