namespace StyleMint.Modules.Admin.Enums;

/// <summary>
/// The closed v1.1 role set (skill §2). Roles are additive — an
/// admin holds zero or more. <see cref="SuperAdmin"/> shortcircuits
/// any per-endpoint role allowlist check.
///
/// v2.0 amendments add ai-admin, courier-ops-admin, boost-admin,
/// featured-match-curator, and audio-admin; those are intentionally
/// omitted from v1.1 and will be added in their own enum increment
/// when v2.0 surfaces land.
/// </summary>
public enum AdminRole
{
    SuperAdmin   = 1,   // everything, including role grants
    KycReviewer  = 2,   // creator + vendor application review only
    ContentMod   = 3,   // moderation queue
    SupportAgent = 4,   // tickets, read-only order/customer info
    PayoutsOps   = 5,   // payout holds + manual refunds
    Readonly     = 6,   // analytics + lookups, no writes
}
