namespace StyleMint.Modules.Admin.Enums;

/// <summary>
/// Identifies which onboarding application a KYC review item is
/// attached to (skill §4). The pair (ApplicantKind, ApplicationId)
/// uniquely identifies the source row in the Onboarding module —
/// queue items never cross application kinds.
/// </summary>
public enum KycApplicantKind
{
    Creator = 1,
    Vendor  = 2,
}
