

import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Filter, Clock, Eye, CheckCircle2, XCircle, FileClock, Inbox } from 'lucide-react'
import type { CreatorApplicationDto, VendorApplicationDto } from '@/api/schema'
import { ApplicationState } from '@/lib/enums'
import { ApplicationStateLabel, AudienceSizeBandLabel, formatDateShort, BusinessTypeLabel } from '@/lib/formatters'


// ── State badge ───────────────────────────────────────────────────────────────
const STATE_ICON: Record<number, typeof Clock> = {
  [ApplicationState.Draft]:       FileClock,
  [ApplicationState.Submitted]:   Clock,
  [ApplicationState.UnderReview]: Eye,
  [ApplicationState.Approved]:    CheckCircle2,
  [ApplicationState.Rejected]:    XCircle,
}

function StateBadge({ state }: { state: number }) {
  const cfg: Record<number, { bg: string; color: string }> = {
    [ApplicationState.Draft]:       { bg: 'rgba(255,255,255,0.05)', color: '#7A9B8E' },
    [ApplicationState.Submitted]:   { bg: 'rgba(251,191,36,0.1)',   color: '#fbbf24' },
    [ApplicationState.UnderReview]: { bg: 'rgba(96,165,250,0.1)',   color: '#60a5fa' },
    [ApplicationState.Approved]:    { bg: 'rgba(0,217,138,0.1)',    color: '#00D98A' },
    [ApplicationState.Rejected]:    { bg: 'rgba(248,113,113,0.1)',  color: '#f87171' },
  }
  const c = cfg[state] ?? cfg[1]
  const Icon = STATE_ICON[state] ?? Clock
  return (
    <span
      className="inline-flex items-center gap-[6px] rounded-full px-[10px] py-[4px] text-[11px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      <Icon size={11} />
      {ApplicationStateLabel[state] ?? state}
    </span>
  )
}


// ── Helpers ───────────────────────────────────────────────────────────────────

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
  'cursor-pointer rounded-lg border border-[var(--border-subtle)] bg-bg-elevated px-3 py-[7px] text-[13px] text-text-secondary outline-none transition-colors duration-[150ms] focus:border-[var(--border-primary)]'

export function KycQueueView({
  kind, items, totalCount, stateFilter, isLoading,
  hasNext, hasPrevious, onNext, onPrev, onStateFilter,
}: KycQueueViewProps) {
  const isVendor = kind === 'vendor'

  // Columns: Brand | State | Submitted | Review   (vendor tab)
  //          Display Name | Audience | State | Submitted | Review (creator tab)
  const tableHeaders = isVendor
    ? ['Brand', 'State', 'Submitted', '']
    : ['Display Name', 'Audience', 'State', 'Submitted', '']

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
            <option value={ApplicationState.Draft}>Draft</option>
            <option value={ApplicationState.Submitted}>Submitted</option>
            <option value={ApplicationState.UnderReview}>Under Review</option>
            <option value={ApplicationState.Approved}>Approved</option>
            <option value={ApplicationState.Rejected}>Rejected</option>
          </select>
        </div>
        <span
          className="rounded-full px-[10px] py-[3px] text-[12px] font-medium text-[#4A7A6A]"
          style={{ background: 'var(--surface-1)' }}
        >
          {totalCount} item{totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div
        className="overflow-hidden rounded-[14px] border shadow-soft"
        style={{ borderColor: 'var(--surface-border)', background: 'var(--bg-card)' }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {tableHeaders.map(h => (
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
                  {Array.from({ length: tableHeaders.length }).map((_, j) => (
                    <td key={j} className="px-4 py-[14px]">
                      <div className="h-[14px] animate-pulse rounded-[6px] bg-white/[0.05]" style={{ width: j === 0 ? 140 : 80 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={tableHeaders.length} className="px-4 py-16">
                  <div className="flex flex-col items-center gap-2.5 text-center">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-full"
                      style={{ background: 'var(--surface-1)' }}
                    >
                      <Inbox size={18} className="text-[#4A7A6A]" />
                    </div>
                    <span className="text-[14px] text-[#4A7A6A]">No KYC applications match the current filters.</span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const itemKind: 'creator' | 'vendor' = kind

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors duration-[150ms] hover:bg-white/[0.025] ${
                      idx < items.length - 1 ? 'border-b border-white/[0.04]' : ''
                    }`}
                  >
                    {/* Vendor: Brand name / Creator: Display Name */}
                    {isVendor ? (
                      <td className="px-4 py-[14px] text-[13px] text-text-secondary">
                        {vendorSummary(item as VendorApplicationDto)}
                      </td>
                    ) : (
                      <td className="px-4 py-[14px] text-[13px] text-text-secondary">
                        {(item as CreatorApplicationDto).displayName || '—'}
                      </td>
                    )}

                    {/* Audience — creator only */}
                    {!isVendor && (() => {
                      const creator = item as CreatorApplicationDto
                      return (
                        <td className="px-4 py-[14px] text-[13px] text-text-secondary">
                          {creator.audienceBand != null
                            ? AudienceSizeBandLabel[creator.audienceBand] ?? '—'
                            : '—'}
                        </td>
                      )
                    })()}

                    {/* State — single StateBadge for all */}
                    <td className="px-4 py-[14px]">
                      <StateBadge state={item.state!} />
                    </td>

                    {/* Submitted Date */}
                    <td className="whitespace-nowrap px-4 py-[14px] text-[13px] text-text-muted">
                      {item.submittedAtUtc ? formatDateShort(item.submittedAtUtc) : '—'}
                    </td>

                    {/* Review action */}
                    <td className="px-4 py-[14px] text-right">
                      <Link
                        to={`/kyc/${item.id}`}
                        state={{ application: item, kind: itemKind }}
                        className="group whitespace-nowrap rounded-[8px] border border-[var(--primary)] bg-[var(--primary)]/[0.10] px-3.5 py-[6px] text-[12px] font-bold text-[var(--primary)] no-underline transition-all duration-[150ms] hover:bg-[var(--primary)]/[0.18] hover:shadow-[0_0_12px_var(--glow-primary)] active:scale-[0.97]"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                )
              })
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
