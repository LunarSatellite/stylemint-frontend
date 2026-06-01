namespace StyleMint.Modules.Admin.Entity.Dtos;

/// <summary>
/// Returned from <c>GET /v1/admin/me/mfa</c>. Summarizes whether the
/// calling admin has a confirmed step-up credential on file, and
/// whether their CURRENT session has a fresh step-up timestamp
/// (within the configured max-age window — default 5 min).
/// </summary>
public sealed record AdminMfaStatusDto(
    bool                            HasTotp,
    bool                            TotpConfirmed,
    DateTimeOffset?                 TotpLastVerifiedUtc,
    bool                            TotpLocked,
    DateTimeOffset?                 SessionLastStepUpUtc,
    bool                            SessionStepUpFresh,
    int                             StepUpMaxAgeMinutes);
