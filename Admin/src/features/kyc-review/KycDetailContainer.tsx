import type { ReactNode } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft, Clock, Eye, CheckCircle2, XCircle, FileClock, Copy,
  User, Store, CalendarClock, Share2,
} from 'lucide-react'
import type { CreatorApplicationDto, VendorApplicationDto } from '@/api/schema'
import { ApplicationState } from '@/lib/enums'
import {
  ApplicationStateLabel, AudienceSizeBandLabel, BusinessTypeLabel,
  SocialIdentityProviderLabel, CatalogSizeEstimateLabel, VendorApplicationDocumentKindLabel,
  formatDate, formatCurrency,
} from '@/lib/formatters'
import { KycDecisionForm } from './KycDecisionForm'


type LocationState = { application: CreatorApplicationDto | VendorApplicationDto; kind: 'creator' | 'vendor' } | null

const cardCls = 'rounded-[14px] border p-6 shadow-soft'

function SectionHeading({ icon: Icon, className, children }: { icon: typeof User; className?: string; children: ReactNode }) {
  return (
    <h2 className={`m-0 flex items-center gap-2 text-[14px] font-bold text-text-primary ${className ?? ''}`}>
      <Icon size={15} className="text-primary" />
      {children}
    </h2>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4A7A6A]">{label}</span>
      <span className="text-[13px] text-text-secondary">{value ?? '—'}</span>
    </div>
  )
}

function CopyableAccountId({ accountId }: { accountId: string | null | undefined }) {
  if (!accountId) return <span className="text-[13px] text-text-muted">—</span>

  function handleCopy() {
    navigator.clipboard.writeText(accountId!)
    toast.success('Account ID copied')
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[12px] text-text-secondary" title={accountId}>{accountId.slice(0, 12)}…</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy full account ID"
        className="cursor-pointer rounded-[4px] p-[3px] text-[#4A7A6A] transition-colors duration-[150ms] hover:bg-white/[0.06] hover:text-text-secondary"
      >
        <Copy size={11} />
      </button>
    </span>
  )
}

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
      className="inline-flex items-center gap-[6px] rounded-full px-[13px] py-[5px] text-[12px] font-semibold"
      style={{ background: c.bg, color: c.color }}
    >
      <Icon size={12} />
      {ApplicationStateLabel[state]}
    </span>
  )
}

// ── Creator detail ─────────────────────────────────────────────────────────────
function CreatorDetail({ item }: { item: CreatorApplicationDto }) {
  return (
    <div className={`${cardCls} flex flex-col gap-5`}>
      <SectionHeading icon={User}>Creator Application</SectionHeading>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Account ID"   value={<CopyableAccountId accountId={item.accountId} />} />
        <Field label="Audience Band" value={item.audienceBand ? AudienceSizeBandLabel[item.audienceBand] : null} />
        <Field label="Bio"          value={item.bio} />
        <Field label="Other Category" value={item.otherCategoryDescription} />
      </div>

      {item.socials && item.socials.length > 0 && (
        <>
          <div className="h-px bg-white/[0.05]" />
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#4A7A6A]">
              <Share2 size={11} /> Socials
            </span>
            {item.socials.map(s => (
              <div key={s.id} className="flex items-center gap-3 text-[13px] text-text-secondary">
                <span className="font-semibold">{s.provider ? SocialIdentityProviderLabel[s.provider] : '—'}</span>
                <span className="text-text-muted">@{s.handle}</span>
                {s.followerCountSelfReported != null && (
                  <span className="text-[12px] text-[#4A7A6A]">{s.followerCountSelfReported.toLocaleString()} followers</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Vendor Brand Profile ──────────────────────────────────────────────────────
function VendorBrandProfile({ item }: { item: VendorApplicationDto }) {
  return (
    <div
      className="h-fit rounded-2xl border p-6"
      style={{
        borderColor: 'rgba(0,217,138,0.18)',
        background: 'linear-gradient(135deg, rgba(0,217,138,0.05) 0%, rgba(0,217,138,0.01) 100%)',
      }}
    >
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <span className="text-[14px] font-bold text-text-primary">Brand Profile</span>
      </div>

      {/* Two-column: left=circle only, right=all fields stacked */}
      <div className="flex items-center gap-6">
        {/* Left — profile circle only */}
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 shadow-md"
          style={{
            background: 'rgba(0,217,138,0.09)',
            borderColor: 'rgba(0,217,138,0.4)',
          }}
        >
          <span className="text-[26px] font-bold text-[var(--primary)]">
            {item.brandName ? item.brandName.slice(0, 2).toUpperCase() : '—'}
          </span>
        </div>

        {/* Right — 2 columns: left=labels, right=values */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">

          {/* Brand Name */}
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">Brand Name</span>
          <span className="text-[14px] font-bold text-text-primary leading-tight">{item.brandName ?? '—'}</span>

          {/* Legal Business Name */}
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">Legal Business Name</span>
          <span className="text-[14px] font-medium text-text-secondary leading-tight">{item.legalBusinessName ?? '—'}</span>

          {/* Business Type */}
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">Business Type</span>
          <span className="text-[14px] font-medium text-text-secondary leading-tight">
            {item.businessType ? BusinessTypeLabel[item.businessType] : '—'}
          </span>

          {/* Country */}
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">Country</span>
          <span className="text-[14px] font-medium text-text-secondary leading-tight">{item.countryCode?.toUpperCase() ?? '—'}</span>

          {/* Website */}
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">Website</span>
          {item.website ? (
            <a
              href={item.website}
              target="_blank"
              rel="noreferrer"
              className="text-[14px] font-medium text-primary hover:underline leading-tight"
            >
              {item.website.replace(/^https?:\/\//, '')}
            </a>
          ) : (
            <span className="text-[14px] text-text-muted leading-tight">—</span>
          )}

          {/* Tax ID */}
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">Tax ID</span>
          <span className="font-mono text-[14px] font-medium text-text-secondary leading-tight">{item.taxId ?? '—'}</span>

          {/* Commission Range */}
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">Commission Range</span>
          <span className="text-[14px] font-medium text-text-secondary leading-tight">
            {item.commissionMinPercent}% – {item.commissionMaxPercent}%
          </span>

          {/* BRN */}
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">BRN</span>
          <span className="font-mono text-[14px] font-medium text-text-secondary leading-tight">{item.businessRegistrationNumber ?? '—'}</span>

        </div>
      </div>
    </div>
  )
}

// ── Vendor Catalog & Pricing ───────────────────────────────────────────────────
function VendorCatalogPricing({ item }: { item: VendorApplicationDto }) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        borderColor: 'rgba(0,217,138,0.18)',
        background: 'linear-gradient(135deg, rgba(0,217,138,0.05) 0%, rgba(0,217,138,0.01) 100%)',
      }}
    >
      {/* Header */}
      <div className="mb-5 flex items-center gap-2">
        <span className="text-[14px] font-bold text-text-primary">Catalog &amp; Pricing</span>
      </div>

      {/* Fields — 2 columns: left=labels, right=values */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">

        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">Catalog Size</span>
        <span className="text-[14px] font-medium text-text-secondary leading-tight">
          {item.catalogSize ? CatalogSizeEstimateLabel[item.catalogSize] : '—'}
        </span>

        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">Price Range</span>
        <span className="text-[14px] font-medium text-text-secondary leading-tight">
          {item.priceRangeMinAmount != null && item.priceRangeMaxAmount != null
            ? `${formatCurrency(item.priceRangeMinAmount, item.priceRangeCurrency ?? 'USD')} – ${formatCurrency(item.priceRangeMaxAmount, item.priceRangeCurrency ?? 'USD')}`
            : '—'}
        </span>

      </div>
    </div>
  )
}

// ── Vendor Address ──────────────────────────────────────────────────────────────
function VendorAddress({ item }: { item: VendorApplicationDto }) {
  if (!item.addressLine1 && !item.city && !item.stateProvince && !item.postalCode) return null

  return (
    <div
      className="h-fit rounded-2xl border p-6"
      style={{
        borderColor: 'rgba(0,217,138,0.18)',
        background: 'linear-gradient(135deg, rgba(0,217,138,0.05) 0%, rgba(0,217,138,0.01) 100%)',
      }}
    >
      {/* Header */}
      <div className="mb-5 flex items-center gap-2">
        <span className="text-[14px] font-bold text-text-primary">Address</span>
      </div>

      {/* Address fields — 2 columns: left=labels, right=values */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">

        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">Address Line 1</span>
        <span className="text-[14px] font-medium text-text-secondary leading-tight">{item.addressLine1 ?? '—'}</span>

        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">Address Line 2</span>
        <span className="text-[14px] font-medium text-text-secondary leading-tight">{item.addressLine2 ?? '—'}</span>

        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">City</span>
        <span className="text-[14px] font-medium text-text-secondary leading-tight">{item.city ?? '—'}</span>

        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">State / Province</span>
        <span className="text-[14px] font-medium text-text-secondary leading-tight">{item.stateProvince ?? '—'}</span>

        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">Postal Code</span>
        <span className="text-[14px] font-medium text-text-secondary leading-tight">{item.postalCode ?? '—'}</span>

      </div>
    </div>
  )
}

// ── Vendor Bank Account ─────────────────────────────────────────────────────────
function VendorBankAccount({ item }: { item: VendorApplicationDto }) {
  if (!item.bankAccount) return null

  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        borderColor: 'rgba(0,217,138,0.18)',
        background: 'linear-gradient(135deg, rgba(0,217,138,0.05) 0%, rgba(0,217,138,0.01) 100%)',
      }}
    >
      {/* Header */}
      <div className="mb-5 flex items-center gap-2">
        <span className="text-[14px] font-bold text-text-primary">Bank Account</span>
      </div>

      {/* Fields — 2 columns: left=labels, right=values */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">

        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">Bank</span>
        <span className="text-[14px] font-medium text-text-secondary leading-tight">{item.bankAccount.bankName ?? '—'}</span>

        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">Account Holder</span>
        <span className="text-[14px] font-medium text-text-secondary leading-tight">{item.bankAccount.accountHolderName ?? '—'}</span>

        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">Last 4 Digits</span>
        <span className="text-[14px] font-medium text-text-secondary leading-tight">
          {item.bankAccount.lastFourAccountDigits ? `•••• ${item.bankAccount.lastFourAccountDigits}` : '—'}
        </span>

        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4A7A6A]">W-9 On File</span>
        <span className={`text-[14px] font-medium leading-tight ${item.bankAccount.hasW9OnFile ? 'text-[var(--primary)]' : 'text-text-muted'}`}>
          {item.bankAccount.hasW9OnFile ? 'Yes' : 'No'}
        </span>

      </div>
    </div>
  )
}

// ── Vendor detail ──────────────────────────────────────────────────────────────
function VendorDetail({ item }: { item: VendorApplicationDto }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid rgba(0,217,138,0.18)', background: 'linear-gradient(135deg, rgba(0,217,138,0.05) 0%, rgba(0,217,138,0.01) 100%)', borderRadius: '16px', padding: '24px', width: '90%' }}>

      {/* Header */}
      <SectionHeading icon={Store}>Vendor Application</SectionHeading>

      {/* Brand Profile + Catalog & Pricing + Bank Account — grid */}
      <div className="grid grid-cols-[6fr_5fr] gap-4">
        <div className="flex flex-col gap-4">
          <VendorBrandProfile item={item} />
          <VendorCatalogPricing item={item} />
        </div>
        <div className="flex flex-col gap-4">
          <VendorAddress item={item} />
          <VendorBankAccount item={item} />
        </div>
      </div>

      {/* Brand Story */}
      {item.brandStory && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1 border-t border-white/[0.06]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4A7A6A]">Brand Story</span>
            <div className="h-px flex-1 border-t border-white/[0.06]" />
          </div>
          <p className="text-[13px] leading-relaxed text-text-secondary">{item.brandStory}</p>
        </div>
      )}

      {/* Documents */}
      {item.documents && item.documents.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1 border-t border-white/[0.06]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4A7A6A]">Documents</span>
            <div className="h-px flex-1 border-t border-white/[0.06]" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {item.documents.map(doc => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[12px] font-semibold text-text-primary">
                    {VendorApplicationDocumentKindLabel[doc.kind] ?? 'Other'}
                  </span>
                  {doc.storageUri && (
                    <a
                      href={doc.storageUri}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-primary hover:underline"
                    >
                      View document ↗
                    </a>
                  )}
                </div>
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-md"
                  style={{ background: 'rgba(0,217,138,0.08)', border: '1px solid rgba(0,217,138,0.15)' }}
                >
                  <span className="text-[10px] font-bold text-[var(--primary)]">PDF</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function KycDetailContainer({ id }: { id: string }) {
  const location = useLocation()
  const state     = (location.state as LocationState)

  if (!state?.application) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-[14px] text-text-muted">Application data not found.</p>
        <Link to="/kyc" className="text-[13px] text-primary no-underline hover:underline">← Back to Queue</Link>
      </div>
    )
  }

  const { application: item, kind } = state
  const canDecide = item.state === ApplicationState.Submitted || item.state === ApplicationState.UnderReview

  return (
    <div className="flex flex-col gap-6">

      {/* Back link */}
      <div className="flex justify-end -mt-1">
        <Link
          to="/kyc"
          className="group inline-flex items-center gap-2 text-[13px] font-medium text-text-muted no-underline transition-all hover:gap-3 hover:text-primary"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" /> Back to Queue
        </Link>
      </div>

      {/* Header card */}
      <div
        className="relative overflow-hidden rounded-2xl border px-6 py-5 shadow-lg"
        style={{
          borderColor: 'var(--border-primary)',
          background: 'var(--bg-card)',
        }}
      >
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-md"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--border-primary)',
              }}
            >
              {kind === 'creator' ? <User size={20} className="text-primary" /> : <Store size={20} className="text-primary" />}
            </div>
            <div>
              <h1
                className="m-0 text-[20px] font-bold tracking-tight capitalize"
                style={{
                  background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >{kind} KYC Review</h1>
              <span className="font-mono text-[11px] text-text-muted">{id}</span>
            </div>
          </div>
          <StateBadge state={item.state!} />
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-5">

        {/* Left — application data (wider) */}
        <div style={{ gridColumn: 'span 4' }}>
          {kind === 'creator'
            ? <CreatorDetail item={item as CreatorApplicationDto} />
            : (
              <>
                {/* Vendor Application */}
                <VendorDetail item={item as VendorApplicationDto} />
              </>
            )
          }
        </div>

        {/* Right — timeline + decision (narrower) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', gridColumn: 'span 1', marginLeft: '-100px' }}>
          <div
            className="rounded-xl border p-5 shadow-md"
            style={{
              background: 'rgba(0,217,138,0.04)',
              borderColor: 'var(--surface-border)',
              width: '330px',
            }}
          >
            <div className="mb-4 flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}
              >
                <CalendarClock size={14} className="text-primary" />
              </div>
              <h3 className="text-[13px] font-bold text-text-primary">Timeline</h3>
            </div>
            <div className="flex flex-col gap-3">
              <TimelineItem label="Drafted" date={formatDate(item.createdUtc)} icon={FileClock} color="#7A9B8E" />
              <TimelineItem label="Submitted" date={item.submittedAtUtc ? formatDate(item.submittedAtUtc) : null} icon={Clock} color="#fbbf24" />
              <TimelineItem label="Expected By" date={item.expectedDecisionByUtc ? formatDate(item.expectedDecisionByUtc) : null} icon={Eye} color="#60a5fa" />
              {item.state === ApplicationState.UnderReview && (
                <TimelineItem label="Under Review" date={item.decisionAtUtc ? formatDate(item.decisionAtUtc) : 'In Progress'} icon={Eye} color="#60a5fa" />
              )}
              {item.state === ApplicationState.Approved && (
                <TimelineItem label="Approved" date={item.decisionAtUtc ? formatDate(item.decisionAtUtc) : null} icon={CheckCircle2} color="#00D98A" />
              )}
              {item.state === ApplicationState.Rejected && (
                <TimelineItem label="Rejected" date={item.decisionAtUtc ? formatDate(item.decisionAtUtc) : null} icon={XCircle} color="#f87171" />
              )}
            </div>
          </div>

          {canDecide ? (
            <KycDecisionForm applicationId={id} kind={kind} />
          ) : (
            <div
              className="rounded-xl border p-5 shadow-md"
              style={{
                background: 'rgba(0,217,138,0.04)',
                borderColor: 'rgba(0,217,138,0.18)',
                width: '330px',
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{
                    background: item.state === ApplicationState.Approved
                      ? 'rgba(0,217,138,0.15)' : 'rgba(248,113,113,0.15)',
                  }}
                >
                  {item.state === ApplicationState.Approved
                    ? <CheckCircle2 size={14} className="text-[#00D98A]" />
                    : <XCircle size={14} className="text-[#f87171]" />
                  }
                </div>
                <h3 className="text-[13px] font-bold text-text-primary">
                  {item.state === ApplicationState.Approved ? 'Application Approved' : 'Application Rejected'}
                </h3>
              </div>
              {item.decisionAtUtc && (
                <p className="text-[12px] text-text-muted">
                  {item.state === ApplicationState.Approved ? 'Approved on' : 'Rejected on'} {formatDate(item.decisionAtUtc)}
                </p>
              )}
              {item.state === ApplicationState.Rejected && item.rejectionReason && (
                <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Rejection Reason</span>
                  <p className="mt-1 text-[12px] leading-relaxed text-red-300">{item.rejectionReason}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TimelineItem({ label, date, icon: Icon, color }: { label: string; date: string | null; icon: typeof Clock; color: string }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{ background: `${color}20` }}
      >
        <Icon size={12} style={{ color }} />
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] font-medium text-text-muted">{label}</span>
        <span className="text-[13px] font-semibold text-text-primary">{date ?? '—'}</span>
      </div>
    </div>
  )
}
