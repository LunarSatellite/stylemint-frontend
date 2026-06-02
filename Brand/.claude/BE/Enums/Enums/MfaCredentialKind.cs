namespace StyleMint.Modules.Admin.Enums;

/// <summary>
/// Phase 5 admin hardening — kind of MFA credential held by an admin.
/// One credential of each kind per admin (uniqueness enforced at the
/// EF index). Adding a new kind is forward-compatible: existing
/// credentials are untouched and the verifier dispatches on this enum.
/// </summary>
public enum MfaCredentialKind : short
{
    /// <summary>RFC 6238 TOTP (HMAC-SHA1, 30s step, 6 digits).</summary>
    Totp     = 1,

    /// <summary>FIDO2 / WebAuthn. Reserved — stub interface exists in
    /// Shared.Infrastructure but no admin-side flow yet.</summary>
    WebAuthn = 2,
}
