namespace StyleMint.Modules.Admin.Entity.Dtos;

public sealed class PlatformConfigEntryDto
{
    public Guid           Id          { get; set; }
    public string         Key         { get; set; } = "";
    public string         ValueJson   { get; set; } = "null";
    public string         Description { get; set; } = "";
    public DateTimeOffset CreatedUtc  { get; set; }
    public DateTimeOffset UpdatedUtc  { get; set; }
    public string?        RowVersion  { get; set; }
}
