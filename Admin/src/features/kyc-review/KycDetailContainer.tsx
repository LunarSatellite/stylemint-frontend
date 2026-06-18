import type { ReactNode } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { components } from '@/api/schema'
import { ApplicationState } from '@/lib/enums'
import {
  ApplicationStateLabel, AudienceSizeBandLabel, BusinessTypeLabel,
  SocialIdentityProviderLabel, formatDate,
} from '@/lib/formatters'
import { KycDecisionForm } from './KycDecisionForm'

type CreatorApplicationDto = components['schemas']['StyleMint.Modules.Onboarding.Entity.Dtos.CreatorApplicationDto']
type VendorApplicationDto  = components['schemas']['StyleMint.Modules.Onboarding.Entity.Dtos.VendorApplicationDto']

type LocationState = { application: CreatorApplicationDto | VendorApplicationDto; kind: 'creator' | 'vendor' } | null

const cardCls = 'rounded-[14px] border border-white/[0.07] bg-bg-card p-6'

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4A7A6A]">{label}</span>
      <span className="text-[13px] text-text-secondary">{value ?? '—'}</span>
    </div>
  )
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
  return (
    <span className="rounded-full px-3 py-[3px] text-[12px] font-semibold" style={{ background: c.bg, color: c.color }}>
      {ApplicationStateLabel[state]}
    </span>
  )
}

// ── Creator detail ─────────────────────────────────────────────────────────────
function CreatorDetail({ item }: { item: CreatorApplicationDto }) {
  return (
    <div className={`${cardCls} flex flex-col gap-5`}>
      <h2 className="m-0 text-[14px] font-bold text-text-primary">Creator Application</h2>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Account ID"   value={<span className="font-mono text-[12px]">{item.accountId?.slice(0, 12)}…</span>} />
        <Field label="Audience Band" value={item.audienceBand ? AudienceSizeBandLabel[item.audienceBand] : null} />
        <Field label="Bio"          value={item.bio} />
        <Field label="Other Category" value={item.otherCategoryDescription} />
      </div>

      {item.socials && item.socials.length > 0 && (
        <>
          <div className="h-px bg-white/[0.05]" />
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4A7A6A]">Socials</span>
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

// ── Vendor detail ──────────────────────────────────────────────────────────────
function VendorDetail({ item }: { item: VendorApplicationDto }) {
  return (
    <div className={`${cardCls} flex flex-col gap-5`}>
      <h2 className="m-0 text-[14px] font-bold text-text-primary">Vendor Application</h2>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Account ID"          value={<span className="font-mono text-[12px]">{item.accountId?.slice(0, 12)}…</span>} />
        <Field label="Brand Name"          value={item.brandName} />
        <Field label="Legal Business Name" value={item.legalBusinessName} />
        <Field label="Business Type"       value={item.businessType ? BusinessTypeLabel[item.businessType] : null} />
        <Field label="Country"             value={item.countryCode?.toUpperCase()} />
        <Field label="Website"             value={item.website} />
        <Field label="Tax ID"              value={item.taxId} />
        <Field label="Commission Range"    value={`${item.commissionMinPercent}% – ${item.commissionMaxPercent}%`} />
      </div>
      {item.brandStory && (
        <>
          <div className="h-px bg-white/[0.05]" />
          <Field label="Brand Story" value={<span className="leading-relaxed">{item.brandStory}</span>} />
        </>
      )}
      {item.bankAccount && (
        <>
          <div className="h-px bg-white/[0.05]" />
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4A7A6A]">Bank Account</span>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bank"             value={item.bankAccount.bankName} />
              <Field label="Account Holder"   value={item.bankAccount.accountHolderName} />
              <Field label="Last 4 Digits"    value={item.bankAccount.lastFourAccountDigits ? `••••${item.bankAccount.lastFourAccountDigits}` : null} />
              <Field label="W-9 On File"      value={item.bankAccount.hasW9OnFile ? 'Yes' : 'No'} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function KycDetailContainer({ id }: { id: string }) {
  const location = useLocation()
  const navigate  = useNavigate()
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
    <div className="flex flex-col gap-5">

      <div>
        <Link
          to="/kyc"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted no-underline transition-colors hover:text-text-secondary"
        >
          <ArrowLeft size={14} /> Back to Queue
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 mb-1 text-[20px] font-bold text-text-primary capitalize">{kind} KYC Review</h1>
          <span className="font-mono text-[12px] text-[#4A7A6A]">{id}</span>
        </div>
        <div className="flex items-center gap-[10px]">
          <StateBadge state={item.state!} />
        </div>
      </div>

      <div className="grid grid-cols-2 items-start gap-4">

        {/* Left — application data */}
        {kind === 'creator'
          ? <CreatorDetail item={item as CreatorApplicationDto} />
          : <VendorDetail  item={item as VendorApplicationDto}  />
        }

        {/* Right — dates + decision */}
        <div className="flex flex-col gap-4">
          <div className={`${cardCls} grid grid-cols-2 gap-4`}>
            <h2 className="col-span-2 m-0 text-[14px] font-bold text-text-primary">Timeline</h2>
            <Field label="Submitted"        value={item.submittedAtUtc ? formatDate(item.submittedAtUtc) : null} />
            <Field label="Expected By"      value={item.expectedDecisionByUtc ? formatDate(item.expectedDecisionByUtc) : null} />
            {item.decisionAtUtc && (
              <Field label="Decided At"     value={formatDate(item.decisionAtUtc)} />
            )}
            {item.rejectionReason && (
              <Field label="Rejection Reason" value={<span className="text-red-400">{item.rejectionReason}</span>} />
            )}
          </div>

          {canDecide && (
            <KycDecisionForm
              applicationId={id}
              kind={kind}
              onDecided={() => navigate('/kyc')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
