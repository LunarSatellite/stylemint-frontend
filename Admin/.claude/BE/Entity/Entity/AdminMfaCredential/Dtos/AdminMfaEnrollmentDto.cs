namespace StyleMint.Modules.Admin.Entity.Dtos;

/// <summary>
/// Returned from <c>POST /v1/admin/auth/mfa/totp/enroll</c>. The
/// admin's authenticator app consumes <see cref="ProvisioningUri"/>
/// (typically rendered as a QR code by the client). The
/// <see cref="SecretBase32"/> is exposed as a fallback for manual
/// entry — the admin can type it into apps that don't accept
/// otpauth URIs.
///
/// <para><b>Single-shot exposure.</b> The plaintext secret is shown
/// once at enrollment and never returned again. If the admin loses it
/// before confirming, they must re-enroll (the previous credential
/// can be deleted by themselves via the DELETE endpoint or, if
/// locked out, by another SuperAdmin).</para>
/// </summary>
public sealed record AdminMfaEnrollmentDto(
    Guid    CredentialId,
    string  SecretBase32,
    string  ProvisioningUri,
    int     Digits,
    int     PeriodSeconds);
