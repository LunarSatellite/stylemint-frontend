namespace StyleMint.Modules.Admin.Enums;

/// <summary>
/// Lifecycle of an <see cref="Entity.AdminAccount"/>. Skill §2:
/// admins authenticate via corporate SSO; a Disabled admin cannot
/// exchange an SSO assertion for a Style Mint admin session, even if
/// the IdP still considers them active.
/// </summary>
public enum AdminAccountState
{
    Active   = 1,
    Disabled = 2,
}
