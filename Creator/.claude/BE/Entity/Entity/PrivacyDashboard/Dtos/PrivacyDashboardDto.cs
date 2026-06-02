namespace StyleMint.Modules.Admin.Entity.Dtos;

public sealed record PrivacyDashboardDto
{
    public int DataExportRequests { get; init; }
    public int OptOutsFromRecommendations { get; init; }
    public int ActivePauses { get; init; }
    public int ConsentWithdrawals { get; init; }
    public IReadOnlyList<PrivacyMetricPoint> WeeklyTrend { get; init; } = Array.Empty<PrivacyMetricPoint>();
}

public sealed record PrivacyMetricPoint
{
    public DateTime Date { get; init; }
    public int DataExportRequests { get; init; }
    public int OptOutsFromRecommendations { get; init; }
    public int ActivePauses { get; init; }
    public int ConsentWithdrawals { get; init; }
}
