namespace StyleMint.Modules.Admin.Entity.Dtos;

public sealed class FeatureFlagDto
{
    public Guid                                    Id              { get; set; }
    public string                                  Key             { get; set; } = "";
    public bool                                    DefaultEnabled  { get; set; }
    public string?                                 Description     { get; set; }
    public DateTimeOffset                          CreatedUtc      { get; set; }
    public DateTimeOffset                          UpdatedUtc      { get; set; }
    public string?                                 RowVersion      { get; set; }
    public IReadOnlyList<FeatureFlagOverrideDto>   Overrides       { get; set; } = Array.Empty<FeatureFlagOverrideDto>();
}
