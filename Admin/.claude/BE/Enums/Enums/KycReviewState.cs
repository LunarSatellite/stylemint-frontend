namespace StyleMint.Modules.Admin.Enums;

/// <summary>
/// KYC review item lifecycle (skill §14):
///
///   Pending   → InReview   (AssignAsync)
///   InReview  → InReview   (reassignment to a different reviewer)
///   InReview  → Decided    (DecideAsync, terminal)
///
/// Once Decided the item is immutable — corrections require a new
/// audit row referencing the original, never an update of this state.
/// </summary>
public enum KycReviewState
{
    Pending  = 1,
    InReview = 2,
    Decided  = 3,
}
