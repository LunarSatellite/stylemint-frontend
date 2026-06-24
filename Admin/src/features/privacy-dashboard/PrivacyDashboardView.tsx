import type { PrivacyDashboardDto } from '@/api/schema'

interface Props {
  data?:      PrivacyDashboardDto
  isLoading?: boolean
}

const cardCls = 'rounded-[14px] border border-white/[0.07] bg-bg-card p-6'

function StatCard({ label, value, isLoading }: { label: string; value?: number; isLoading?: boolean }) {
  return (
    <div className={cardCls}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#4A7A6A]">{label}</p>
      {isLoading ? (
        <div className="h-8 w-16 rounded-[6px] bg-white/[0.05]" />
      ) : (
        <p className="text-[28px] font-bold text-text-primary">{value ?? 0}</p>
      )}
    </div>
  )
}

export function PrivacyDashboardView({ data, isLoading }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="m-0 mb-1 text-[20px] font-bold text-text-primary">Privacy Dashboard</h1>
        <p className="m-0 text-[13px] text-text-muted">GDPR / data-rights overview</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Data export requests"        value={data?.dataExportRequests}         isLoading={isLoading} />
        <StatCard label="Opt-outs from recommendations" value={data?.optOutsFromRecommendations} isLoading={isLoading} />
        <StatCard label="Active pauses"               value={data?.activePauses}               isLoading={isLoading} />
        <StatCard label="Consent withdrawals"         value={data?.consentWithdrawals}         isLoading={isLoading} />
      </div>

      {data?.weeklyTrend && data.weeklyTrend.length > 0 && (
        <div className={cardCls}>
          <h2 className="m-0 mb-4 text-[14px] font-bold text-text-primary">Weekly Trend</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Week', 'Exports', 'Opt-outs', 'Pauses', 'Withdrawals'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#4A7A6A]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.weeklyTrend.map((row, i) => (
                  <tr key={i} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-3 text-[13px] text-text-muted">{row.date}</td>
                    <td className="px-4 py-3 text-[13px] text-text-secondary">{row.dataExportRequests}</td>
                    <td className="px-4 py-3 text-[13px] text-text-secondary">{row.optOutsFromRecommendations}</td>
                    <td className="px-4 py-3 text-[13px] text-text-secondary">{row.activePauses}</td>
                    <td className="px-4 py-3 text-[13px] text-text-secondary">{row.consentWithdrawals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
