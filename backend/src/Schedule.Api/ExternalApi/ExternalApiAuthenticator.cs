using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace Schedule.Api.ExternalApi;

/// <summary>平文キーを保存せず、SHA-256ハッシュを固定時間比較して認証します。</summary>
public sealed class ExternalApiAuthenticator(IOptions<ExternalApiOptions> options)
{
    public const string HeaderName = "X-Compass-Api-Key";

    public ExternalApiClient? Authenticate(HttpRequest request)
    {
        var configuration = options.Value;
        if (!configuration.Enabled || !request.Headers.TryGetValue(HeaderName, out var values))
        {
            return null;
        }

        var key = values.ToString().Trim();
        if (key.Length == 0)
        {
            return null;
        }

        var actualHash = SHA256.HashData(Encoding.UTF8.GetBytes(key));
        foreach (var client in configuration.Clients.Where(client => client.Enabled))
        {
            if (!TryDecodeHash(client.KeyHash, out var expectedHash))
            {
                continue;
            }
            if (CryptographicOperations.FixedTimeEquals(actualHash, expectedHash))
            {
                return new ExternalApiClient(client);
            }
        }
        return null;
    }

    private static bool TryDecodeHash(string value, out byte[] hash)
    {
        try
        {
            hash = Convert.FromHexString(value.Trim());
            return hash.Length == 32;
        }
        catch (FormatException)
        {
            hash = [];
            return false;
        }
    }
}
