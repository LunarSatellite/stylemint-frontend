import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import type { components } from '@/api/schema'
import { ApplicationState } from '@/lib/enums'
import { ApplicationStateLabel, formatDateShort, AudienceSizeBandLabel, BusinessTypeLabel } from '@/lib/formatters'

type CreatorApplicationDto = components['schemas']['StyleMint.Modules.Onboarding.Entity.Dtos.CreatorApplicationDto']
type VendorApplicationDto  = components['schemas']['StyleMint.Modules.Onboarding.Entity.Dtos.VendorApplicationDto']

// ── State badge ───────────────────────────────────────────────────────────────
function StateBadge({ state }: { state: number }) {
  const cfg: Record<number, { bg: string; color: string }> = {
    [ApplicationState.Draft]:       { bg: 'rgba(255,255,255,0.05)', color: '#7A9B8E' },
    [ApplicationState.Submitted]:   { bg: 'rgba(251,191,36,0.1)',   color: '#fbbf24' },
    [ApplicationState.UnderReview]: { bg: 'rgba(96,165,250,0.1)',   color: '#60a5fa' },
    [ApplicationState.Approved]:    { bg: 'rgba(0,217,138,0.1)',    color: '#00D98A' },
    [ApplicationState.Rejected]:    { bg: 'rgba(248,113,113,0.1)',  color: '#f87171' },
  }
  const c = cfg[state] ?? cfg[1]
  return (
    <span
      className="inline-flex items-center gap-[5px] rounded-full px-[10px] py-[3px] text-[11px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      <span className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: c.color }} />
      {ApplicationStateLabel[state] ?? state}
    </span>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function creatorSummary(item: CreatorApplicationDto): string {
  return item.audienceBand ? AudienceSizeBandLabel[item.audienceBand] : '—'
}

function vendorSummary(item: VendorApplicationDto): string {
  const parts: string[] = []
  if (item.brandName)   parts.push(item.brandName)
  if (item.businessType) parts.push(BusinessTypeLabel[item.businessType] ?? '')
  if (item.countryCode)  parts.push(item.countryCode.toUpperCase())
  return parts.join(' · ') || '—'
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface KycQueueViewProps {
  kind:          'creator' | 'vendor'
  items:         CreatorApplicationDto[] | VendorApplicationDto[]
  totalCount:    number
  stateFilter?:  number
  isLoading?:    boolean
  hasNext:       boolean
  hasPrevious:   boolean
  onNext():      void
  onPrev():      void
  onStateFilter(state: number | undefined): void
}

const selectCls =
  'cursor-pointer rounded-lg border border-[var(--border-subtle)] bg-bg-elevated px-3 py-[7px] text-[13px] text-text-secondary outline-none'

export function KycQueueView({
  kind, items, totalCount, stateFilter, isLoading,
  hasNext, hasPrevious, onNext, onPrev, onStateFilter,
}: KycQueueViewProps) {
  return (
    <div className="flex flex-col gap-4">

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-[10px]">
          <Filter size={14} className="text-[#4A7A6A]" />
          <select
            value={stateFilter ?? ''}
            onChange={e => onStateFilter(e.target.value ? Number(e.target.value) : undefined)}
            className={selectCls}
          >
            <option value="">All States</option>
            <option value={ApplicationState.Submitted}>Submitted</option>
            <option value={ApplicationState.UnderReview}>Under Review</option>
            <option value={ApplicationState.Approved}>Approved</option>
            <option value={ApplicationState.Rejected}>Rejected</option>
          </select>
        </div>
        <span className="text-[12px] text-[#4A7A6A]">{totalCount} item{totalCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[12px] border border-white/[0.06] bg-bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {['Account ID', kind === 'creator' ? 'Audience' : 'Brand', 'State', 'Submitted', ''].map(h => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#4A7A6A]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-[14px]">
                      <div className="h-[14px] rounded-[6px] bg-white/[0.05]" style={{ width: j === 0 ? 140 : 80 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[14px] text-[#4A7A6A]">
                  No KYC applications match the current filters.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`transition-colors duration-[150ms] hover:bg-white/[0.02] ${
                    idx < items.length - 1 ? 'border-b border-white/[0.04]' : ''
                  }`}
                >
                  <td className="px-4 py-[14px]">
                    <span className="font-mono text-[12px] text-text-secondary">
                      {item.accountId?.slice(0, 8)}…
                    </span>
                  </td>
                  <td className="px-4 py-[14px] text-[13px] text-text-secondary">
                    {kind === 'creator'
                      ? creatorSummary(item as CreatorApplicationDto)
                      : vendorSummary(item as VendorApplicationDto)
                    }
                  </td>
                  <td className="px-4 py-[14px]">
                    <StateBadge state={item.state!} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-[14px] text-[13px] text-text-muted">
                    {item.submittedAtUtc ? formatDateShort(item.submittedAtUtc) : '—'}
                  </td>
                  <td className="px-4 py-[14px] text-right">
                    <Link
                      to={`/kyc/${item.id}`}
                      state={{ application: item, kind }}
                      className="whitespace-nowrap rounded-[6px] border border-primary/20 bg-primary/[0.08] px-3 py-[5px] text-[12px] font-semibold text-primary no-underline transition-colors duration-[150ms] hover:bg-primary/[0.15]"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {(hasNext || hasPrevious) && (
        <div className="flex items-center justify-end gap-2">
          <PaginationBtn disabled={!hasPrevious} onClick={onPrev}>
            <ChevronLeft size={14} /> Prev
          </PaginationBtn>
          <PaginationBtn disabled={!hasNext} onClick={onNext}>
            Next <ChevronRight size={14} />
          </PaginationBtn>
        </div>
      )}
    </div>
  )
}

function PaginationBtn({ children, disabled, onClick }: {
  children: React.ReactNode; disabled: boolean; onClick(): void
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-1 rounded-lg border px-[14px] py-[7px] text-[13px] font-semibold transition-all duration-[150ms] ${
        disabled
          ? 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-[#334D42]'
          : 'cursor-pointer border-primary/20 bg-primary/[0.08] text-primary hover:bg-primary/[0.15]'
      }`}
    >
      {children}
    </button>
  )
}
