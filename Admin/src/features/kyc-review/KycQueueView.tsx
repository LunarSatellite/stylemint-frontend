import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import type { components } from '@/api/schema'

type KycReviewItem  = components['schemas']['KycReviewItemDto']
type KycQueueFilter = components['schemas']['KycQueueParams']
import { KycReviewState, KycDecision, KycApplicantKind } from '@/lib/enums'
import {
  KycReviewStateLabel, KycDecisionLabel,
  KycApplicantKindLabel, formatDateShort, isOverdue,
} from '@/lib/formatters'

// ── Badge helpers ─────────────────────────────────────────────────────────────
function StateBadge({ state }: { state: number }) {
  const cfg: Record<number, { bg: string; color: string; dot: string }> = {
    [KycReviewState.Pending]:  { bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24', dot: '#fbbf24' },
    [KycReviewState.InReview]: { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa', dot: '#60a5fa' },
    [KycReviewState.Decided]:  { bg: 'rgba(0,217,138,0.1)',   color: '#00D98A', dot: '#00D98A' },
  }
  const c = cfg[state] ?? cfg[1]
  return (
    <span
      className="inline-flex items-center gap-[5px] rounded-full px-[10px] py-[3px] text-[11px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      <span className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: c.dot }} />
      {KycReviewStateLabel[state] ?? state}
    </span>
  )
}

function DecisionBadge({ decision }: { decision: number | null }) {
  if (!decision) return null
  const cfg: Record<number, { bg: string; color: string }> = {
    [KycDecision.Approved]:          { bg: 'rgba(0,217,138,0.1)',   color: '#00D98A' },
    [KycDecision.RejectedRetryable]: { bg: 'rgba(251,146,60,0.1)',  color: '#fb923c' },
    [KycDecision.RejectedTerminal]:  { bg: 'rgba(248,113,113,0.1)', color: '#f87171' },
  }
  const c = cfg[decision] ?? { bg: 'rgba(255,255,255,0.05)', color: '#7A9B8E' }
  return (
    <span
      className="rounded-full px-2 py-[2px] text-[10px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      {KycDecisionLabel[decision]}
    </span>
  )
}

function KindBadge({ kind }: { kind: number }) {
  const isCreator = kind === KycApplicantKind.Creator
  return (
    <span
      className="rounded-full px-[10px] py-[3px] text-[11px] font-semibold"
      style={{
        background: isCreator ? 'rgba(167,139,250,0.12)' : 'rgba(251,146,60,0.1)',
        color:      isCreator ? '#a78bfa' : '#fb923c',
      }}
    >
      {KycApplicantKindLabel[kind] ?? kind}
    </span>
  )
}

function DueDateCell({ dueByUtc }: { dueByUtc: string }) {
  const overdue = isOverdue(dueByUtc)
  return (
    <span className={`inline-flex items-center gap-[5px] text-[13px] ${overdue ? 'text-red-400' : 'text-text-muted'}`}>
      {overdue && <AlertTriangle size={12} className="shrink-0" />}
      {formatDateShort(dueByUtc)}
    </span>
  )
}

// ── Filter bar ────────────────────────────────────────────────────────────────
interface FilterBarProps {
  filter:         KycQueueFilter
  onFilterChange: <K extends keyof KycQueueFilter>(key: K, value: KycQueueFilter[K]) => void
}

const selectCls =
  'cursor-pointer rounded-lg border border-[var(--border-subtle)] bg-bg-elevated px-3 py-[7px] text-[13px] text-text-secondary outline-none'

function FilterBar({ filter, onFilterChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-[10px]">
      <Filter size={14} className="text-[#4A7A6A]" />

      <select
        value={filter.state ?? ''}
        onChange={e => onFilterChange('state', e.target.value ? Number(e.target.value) as 1|2|3 : undefined)}
        className={selectCls}
      >
        <option value="">All States</option>
        <option value="1">Pending</option>
        <option value="2">In Review</option>
        <option value="3">Decided</option>
      </select>

      <select
        value={filter.applicantKind ?? ''}
        onChange={e => onFilterChange('applicantKind', e.target.value ? Number(e.target.value) as 1|2 : undefined)}
        className={selectCls}
      >
        <option value="">All Kinds</option>
        <option value="1">Creator</option>
        <option value="2">Vendor</option>
      </select>

      <label className="flex cursor-pointer select-none items-center gap-1.5">
        <input
          type="checkbox"
          checked={filter.overdueOnly ?? false}
          onChange={e => onFilterChange('overdueOnly', e.target.checked || undefined)}
          className="h-[14px] w-[14px] accent-primary"
        />
        <span className="text-[13px] font-medium text-text-muted">Overdue only</span>
      </label>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
interface KycQueueViewProps {
  data:           KycReviewItem[]
  totalCount:     number
  pageNumber:     number
  pageSize:       number
  totalPages:     number
  hasNext:        boolean
  hasPrevious:    boolean
  filter:         KycQueueFilter
  isLoading?:     boolean
  onPageChange:   (p: number) => void
  onFilterChange: <K extends keyof KycQueueFilter>(key: K, value: KycQueueFilter[K]) => void
}

export function KycQueueView({
  data, totalCount, pageNumber, totalPages,
  hasNext, hasPrevious, filter, isLoading,
  onPageChange, onFilterChange,
}: KycQueueViewProps) {
  return (
    <div className="flex flex-col gap-4">

      {/* Filter bar + count */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar filter={filter} onFilterChange={onFilterChange} />
        <span className="text-[12px] text-[#4A7A6A]">
          {totalCount} item{totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[12px] border border-white/[0.06] bg-bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {['Account ID', 'Kind', 'State', 'Decision', 'Due By', 'Submitted', ''].map(h => (
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
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-[14px]">
                      <div
                        className="h-[14px] rounded-[6px] bg-white/[0.05]"
                        style={{ width: j === 0 ? 140 : 80 }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[14px] text-[#4A7A6A]">
                  No KYC items match the current filters.
                </td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`transition-colors duration-[150ms] hover:bg-white/[0.02] ${
                    idx < data.length - 1 ? 'border-b border-white/[0.04]' : ''
                  }`}
                >
                  <td className="px-4 py-[14px]">
                    <span className="font-mono text-[12px] text-text-secondary">
                      {item.accountId.slice(0, 8)}…
                    </span>
                  </td>
                  <td className="px-4 py-[14px]">
                    <KindBadge kind={item.applicantKind} />
                  </td>
                  <td className="px-4 py-[14px]">
                    <StateBadge state={item.state} />
                  </td>
                  <td className="px-4 py-[14px]">
                    <DecisionBadge decision={item.decision} />
                  </td>
                  <td className="px-4 py-[14px]">
                    <DueDateCell dueByUtc={item.dueByUtc} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-[14px] text-[13px] text-text-muted">
                    {formatDateShort(item.submittedUtc)}
                  </td>
                  <td className="px-4 py-[14px] text-right">
                    <Link
                      to={`/kyc/${item.id}`}
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#4A7A6A]">
            Page {pageNumber} of {totalPages}
          </span>
          <div className="flex gap-2">
            <PaginationBtn disabled={!hasPrevious} onClick={() => onPageChange(pageNumber - 1)}>
              <ChevronLeft size={14} /> Prev
            </PaginationBtn>
            <PaginationBtn disabled={!hasNext} onClick={() => onPageChange(pageNumber + 1)}>
              Next <ChevronRight size={14} />
            </PaginationBtn>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Pagination button ─────────────────────────────────────────────────────────
function PaginationBtn({
  children, disabled, onClick,
}: {
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
