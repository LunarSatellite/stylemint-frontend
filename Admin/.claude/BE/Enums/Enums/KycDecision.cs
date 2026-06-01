namespace StyleMint.Modules.Admin.Enums;

/// <summary>
/// Terminal decision values for a KYC review (skill §4).
/// <see cref="RejectedRetryable"/> lets the applicant fix the issue
/// and resubmit; <see cref="RejectedTerminal"/> is permanent and
/// always paired with a terminal-class decision reason code
/// (FRAUD_SUSPECTED, SANCTIONS_HIT, UNDERAGE).
/// </summary>
public enum KycDecision
{
    Approved          = 1,
    RejectedRetryable = 2,
    RejectedTerminal  = 3,
}
