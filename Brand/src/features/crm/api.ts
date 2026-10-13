import { crm, type CrmPage } from './client';

/**
 * Typed CRM endpoints (OmniFlow `api/v1/crm/*`, controllers `lead360/src/OmniFlow.API/Controllers/v1/Crm*.cs`,
 * DTOs `OmniFlow.Entity/DTOs/CRM`). Enums are integers. Responses arrive unwrapped and redacted
 * (see client.ts) — buyer phone/email are never present here.
 */

// ---------------------------------------------------------------- enums

export const TaskStatus = { Open: 1, InProgress: 2, Done: 3, Cancelled: 4 } as const;
export const taskStatusLabel: Record<number, string> = { 1: 'Open', 2: 'In progress', 3: 'Done', 4: 'Cancelled' };
export const taskStatusColor: Record<number, string> = { 1: 'blue', 2: 'amber', 3: 'forest', 4: 'gray' };

export const TaskPriority = { Low: 1, Medium: 2, High: 3 } as const;
export const taskPriorityLabel: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' };
export const taskPriorityColor: Record<number, string> = { 1: 'gray', 2: 'blue', 3: 'signal' };

/** CrmSignalSubjectKind — what a task is about. */
export const SubjectKind = { Contact: 2, Deal: 4 } as const;
/** CrmCommentableKind */
export const CommentableKind = { Contact: 1, Deal: 2 } as const;

export const MeetingStatus = {
  ProposalDrafted: 1,
  ProposalSent: 2,
  CustomerAccepted: 3,
  CustomerDeclined: 4,
  Rescheduling: 5,
  Booked: 6,
  Cancelled: 7,
  Completed: 8,
  Escalated: 9,
} as const;
export const meetingStatusLabel: Record<number, string> = {
  1: 'Draft',
  2: 'Invite sent',
  3: 'Accepted',
  4: 'Declined',
  5: 'Rescheduling',
  6: 'Booked',
  7: 'Cancelled',
  8: 'Completed',
  9: 'Escalated',
};
export const meetingStatusColor: Record<number, string> = { 1: 'gray', 2: 'blue', 3: 'forest', 4: 'signal', 5: 'amber', 6: 'forest', 7: 'gray', 8: 'forest', 9: 'signal' };

export const CampaignStatus = { Draft: 1, Scheduled: 2, Running: 3, Completed: 4, Cancelled: 5 } as const;
export const campaignStatusLabel: Record<number, string> = { 1: 'Draft', 2: 'Scheduled', 3: 'Sending', 4: 'Sent', 5: 'Cancelled' };
export const campaignStatusColor: Record<number, string> = { 1: 'gray', 2: 'blue', 3: 'amber', 4: 'forest', 5: 'gray' };

/**
 * CrmCampaignChannelType. For seller workspaces the backend delivers through StyleMint channels
 * (app notification / in-app, email only to consenting buyers) — never the CRM's own email/SMS.
 */
export const CampaignChannel = { Email: 1, WhatsApp: 2, Sms: 3 } as const;
export const campaignChannelLabel: Record<number, string> = {
  1: 'StyleMint app & email',
  2: 'StyleMint app',
  3: 'StyleMint app',
};

export const NpsClass = { Promoter: 1, Passive: 2, Detractor: 3 } as const;
export const npsClassLabel: Record<number, string> = { 1: 'Promoter', 2: 'Passive', 3: 'Detractor' };
export const npsClassColor: Record<number, string> = { 1: 'forest', 2: 'gray', 3: 'signal' };

export const feedbackTypeLabel: Record<number, string> = {
  1: 'Request',
  2: 'Problem',
  3: 'Complaint',
  4: 'Praise',
  5: 'Suggestion',
  6: 'Comparison',
};
export const feedbackTypeColor: Record<number, string> = { 1: 'blue', 2: 'signal', 3: 'signal', 4: 'forest', 5: 'cyan', 6: 'gray' };

export const SegmentStatus = { Discovered: 1, Adopted: 2, Archived: 3 } as const;

export const DealStatus = { Open: 1, Won: 2, Lost: 3 } as const;
export const dealStatusLabel: Record<number, string> = { 1: 'Open', 2: 'Won', 3: 'Lost' };
export const dealStatusColor: Record<number, string> = { 1: 'blue', 2: 'forest', 3: 'gray' };

export const QuoteStatus = { Draft: 1, Sent: 2, Accepted: 3, Rejected: 4, Expired: 5 } as const;
export const quoteStatusLabel: Record<number, string> = { 1: 'Draft', 2: 'Sent', 3: 'Accepted', 4: 'Rejected', 5: 'Expired' };
export const quoteStatusColor: Record<number, string> = { 1: 'gray', 2: 'blue', 3: 'forest', 4: 'signal', 5: 'gray' };

export const proposalStatusLabel: Record<number, string> = {
  1: 'Draft',
  2: 'In review',
  3: 'Ready to send',
  4: 'Sent',
  5: 'Accepted',
  6: 'Rejected',
  7: 'Archived',
};
export const proposalStatusColor: Record<number, string> = { 1: 'gray', 2: 'amber', 3: 'blue', 4: 'blue', 5: 'forest', 6: 'signal', 7: 'gray' };

/** CrmActivityEventKind → a short label for the customer timeline. */
export const activityKindLabel: Record<number, string> = {
  1: 'Note',
  2: 'Stage changed',
  3: 'Deal created',
  4: 'Owner changed',
  5: 'Task done',
  6: 'Activity',
  7: 'Updated',
  8: 'Quote drafted',
  9: 'Quote sent',
  10: 'Quote accepted',
  11: 'Quote rejected',
  12: 'Proposal drafted',
  13: 'Proposal sent',
  14: 'Proposal accepted',
  15: 'Proposal rejected',
  16: 'Task created',
  17: 'Call',
  18: 'Meeting',
  19: 'Note',
  20: 'Order placed',
  21: 'Order confirmed',
  22: 'Order delivered',
  23: 'Order cancelled',
  24: 'Payment received',
  25: 'Return requested',
  26: 'Return approved',
  27: 'Return rejected',
  28: 'Return received',
  29: 'Return inspected',
  30: 'Return resolved',
  31: 'Return cancelled',
  43: 'Created',
  44: 'Updated',
  45: 'Deleted',
};
export function activityColor(kind: number): string {
  if (kind >= 20 && kind <= 24) return 'forest';
  if (kind >= 25 && kind <= 31) return 'amber';
  if (kind === 1 || kind === 19) return 'blue';
  return 'gray';
}

// ---------------------------------------------------------------- DTOs

export interface ContactDto {
  id: string;
  fullName: string;
  jobTitle?: string | null;
  sourceKind?: number;
  ownedByUserId?: string | null;
  tagsJson?: string | null;
  notes?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  status: number;
  priority: number;
  sourceKind?: number;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
  dueDate: string | null;
  completedAt: string | null;
  subjectKind: number | null;
  subjectId: string | null;
  dealId: string | null;
  createdAt: string;
}

export interface TaskCreate {
  title: string;
  description?: string | null;
  priority: number;
  dueDate?: string | null;
  subjectKind?: number | null;
  subjectId?: string | null;
  dealId?: string | null;
  assignedToUserId?: string | null;
}

export interface CommentDto {
  id: string;
  authorUserId: string;
  commentableKind: number;
  commentableId: string;
  content: string;
  parentCommentId: string | null;
  editedAt: string | null;
  createdAt: string;
  authorName?: string | null;
}

export interface ActivityEventDto {
  id: string;
  entityKind: number;
  entityId: string;
  eventKind: number;
  actorUserId: string | null;
  summary: string;
  metaJson: string | null;
  occurredAt: string;
}

export interface SignalDto {
  id: string;
  kind: number;
  occurredAt: string;
  summary: string | null;
  sentiment?: number | null;
  payloadJson?: string | null;
}

export interface PredictionDto {
  id: string;
  kind: number;
  probability: number;
  probabilityLabel: string;
  computedAt: string;
}

export interface ContactProfileDto {
  contact: ContactDto;
  aiSummary: { headline: string; sentiment: string; keyTopics: string[]; recommendedActions: string[] } | null;
  recentSignals: SignalDto[];
  predictions: PredictionDto[];
  openTasks: TaskDto[];
}

export interface ContactTimelineDto {
  contact: ContactDto;
  deals: { dealId: string; dealName: string; stageName: string | null; status: number; amount: number | null; currency: string | null; closeDate: string | null }[];
  signals: SignalDto[];
}

export interface MeetingListItem {
  id: string;
  contactId: string;
  dealId: string | null;
  title: string;
  status: number;
  acceptedSlot: string | null;
  durationMinutes: number;
  createdAt: string;
  joinUrl?: string | null;
  contactName?: string | null;
  dealName?: string | null;
}

export interface MeetingCreate {
  contactId: string;
  dealId?: string | null;
  title: string;
  agendaText?: string | null;
  joinUrl?: string | null;
  durationMinutes: number;
  scheduledAt?: string | null;
  generateSlots?: boolean;
}

export interface DiscoveredSegment {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  retentionRate: number;
  actionRecommendations: string[];
  status: number;
  discoveredAt: string;
}

/** CrmCampaignTargetFilter — the rule set a campaign (and a saved segment) targets. */
export interface TargetFilter {
  tags?: string[];
  tagMatchMode?: 'any' | 'all';
  cities?: string[];
  lastSignalDaysAgo?: number | null;
  hasOpenDeals?: boolean | null;
}

export interface CampaignSummary {
  id: string;
  name: string;
  description: string | null;
  channelType: number;
  status: number;
  totalRecipients: number;
  sentCount: number;
  openedCount: number;
  repliedCount: number;
  failedCount: number;
  clickCount: number;
  convertedCount: number;
  scheduledAt: string | null;
  launchedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  /** Seller workspaces: how many recipients have marketing consent (when the backend reports it). */
  consentedRecipients?: number | null;
  skippedNoConsent?: number | null;
}

export interface CampaignDetail extends CampaignSummary {
  subject: string | null;
  bodyTemplate: string;
  targetFilterJson: string;
}

export interface CampaignCreate {
  name: string;
  description?: string | null;
  channelType: number;
  subject?: string | null;
  bodyTemplate: string;
  targetFilterJson: string;
  scheduledAt?: string | null;
}

export interface CampaignPreview {
  estimatedRecipients: number;
  /** Seller workspaces: recipients with recorded marketing consent — the only ones who get the message. */
  consentedRecipients?: number | null;
  contacts: { contactId: string; fullName: string; canMessage?: boolean | null; hasMarketingConsent?: boolean | null; marketingConsent?: boolean | null }[];
}

export interface RecipientOptions {
  availableTags: string[];
  availableCities: string[];
  totalContacts: number;
}

export interface CampaignStats {
  campaignId: string;
  totalRecipients: number;
  sentCount: number;
  openedCount: number;
  repliedCount: number;
  failedCount: number;
  clickCount: number;
  convertedCount: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  deliveryRate: number;
  attributedRevenue: number;
  consentedRecipients?: number | null;
  skippedNoConsent?: number | null;
}

export interface CampaignAggregate {
  totalCampaigns: number;
  runningCount: number;
  completedCount: number;
  totalSent: number;
  totalOpened: number;
  totalConverted: number;
  overallOpenRate: number;
  overallConversionRate: number;
  totalAttributedRevenue: number;
}

export interface WorkflowDto {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  isActive: boolean;
  executionCount: number;
  lastTriggeredAt: string | null;
  steps: { id: string; stepOrder: number; actionType: string; delayMinutes: number }[];
  createdAt: string;
}

export interface NpsSurvey {
  id: string;
  contactId: string;
  contactName: string | null;
  score: number | null;
  classification: number | null;
  comment: string | null;
  trigger: number;
  sentAt: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface NpsSummary {
  npsScore: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
  totalResponded: number;
  trend: string;
}

export interface CsatSummary {
  avgCsatScore: number;
  totalRecords: number;
  trend: string;
}

export interface FeedbackTheme {
  topicTag: string;
  count: number;
  mostCommonType: number;
  avgSentiment: number;
}

export interface FeedbackItem {
  id: string;
  contactId: string;
  feedbackType: number;
  subject: string;
  quoteText: string;
  topicTag: string | null;
  sentimentScore: number;
  severityLevel: number;
  frequencyCount: number;
  isActedOn: boolean;
  createdAt: string;
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  stageCount: number;
}

export interface DealStage {
  id: string;
  name: string;
  order: number;
  isClosed: boolean;
  isWon: boolean;
  color: string | null;
  pipelineId: string | null;
}

export interface Deal {
  id: string;
  name: string;
  accountName: string | null;
  stageId: string;
  stageName: string | null;
  amount: number | null;
  currency: string;
  closeDate: string | null;
  status: number;
  ownedByUserName: string | null;
  pipelineId: string | null;
  createdAt: string;
  notes?: string | null;
  lostReason?: string | null;
  winReason?: string | null;
}

export interface DealCreate {
  name: string;
  stageId: string;
  pipelineId?: string | null;
  contactId?: string | null;
  amount?: number | null;
  currency: string;
  closeDate?: string | null;
  notes?: string | null;
}

export interface QuoteLine {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  dealId: string | null;
  dealName: string | null;
  contactId: string | null;
  contactName: string | null;
  status: number;
  currency: string;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  validUntil: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  lineItems: QuoteLine[];
  createdAt: string;
  revisionNumber?: number;
}

export interface QuoteDraft {
  dealId?: string | null;
  contactId?: string | null;
  currency: string;
  lineItems: { description: string; quantity: number; unit?: string | null; unitPrice: number; discountPercent?: number }[];
  taxPercent?: number;
  notes?: string | null;
}

export interface ProposalListItem {
  id: string;
  dealId: string;
  title: string;
  status: number;
  sectionCount: number;
  sentAt: string | null;
  createdAt: string;
  dealName?: string | null;
  contactName?: string | null;
}

export interface Proposal {
  id: string;
  dealId: string;
  title: string;
  status: number;
  sentAt: string | null;
  acceptedAt: string | null;
  sections: { id: string; ordinal: number; title: string; content: string }[];
  createdAt: string;
}

export interface ContactStats {
  total: number;
  createdThisMonth: number;
  createdLastMonth: number;
}

export interface DealStats {
  openCount: number;
  closedWonCount: number;
  closedLostCount: number;
  winRate: number;
  avgDealSize: number;
  totalPipelineValue: number;
}

export interface NpsAnalytics {
  totalSent: number;
  totalResponded: number;
  responseRate: number;
  npsScore: number;
  promoters: number;
  passives: number;
  detractors: number;
  monthlyTrend: { monthLabel: string; npsScore: number; responded: number }[];
}

export interface ChurnAnalytics {
  totalContacts: number;
  churn30: { highRiskCount: number; mediumRiskCount: number; lowRiskCount: number; contactsScored: number };
  topAtRisk: { contactId: string; fullName: string; churnProbabilityPct: number }[];
}

export interface ActivityAnalytics {
  totalSignals30d: number;
  totalSignals7d: number;
  dailyTrend: { date: string; dateLabel: string; count: number }[];
}

export interface RevenueAnalytics {
  weightedForecast: number;
  expectedThisMonth: number;
  totalWonAllTime: number;
  monthlyTrend: { monthLabel: string; wonAmount: number; wonCount: number }[];
}

// ---------------------------------------------------------------- customers (contacts + StyleMint sync)

/**
 * A buyer as the seller sees them. Built from the CRM contact plus the StyleMint order stats the
 * sync writes (name, city, first/last order, order count, lifetime value, returns, review average,
 * marketing consent). No phone, no email — ever.
 */
export interface Customer {
  id: string;
  name: string;
  city: string | null;
  tags: string[];
  orderCount: number | null;
  lifetimeValue: number | null;
  currency: string;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  returnsCount: number | null;
  reviewAverage: number | null;
  reviewCount: number | null;
  questionsCount: number | null;
  /** true = recorded marketing consent (can be messaged), false = no consent, null = unknown. */
  marketingConsent: boolean | null;
  /** Which StyleMint channels the buyer agreed to. */
  consentChannels: { push: boolean; email: boolean } | null;
  /** The buyer deleted their StyleMint account: anonymised. */
  erased: boolean;
  lastActivityAt: string | null;
  createdAt: string | null;
  avatarUrl: string | null;
}

type Bag = Record<string, unknown>;

function nested(dto: Bag): Bag[] {
  const out: Bag[] = [dto];
  for (const k of ['stylemint', 'styleMint', 'buyer', 'commerce', 'stats', 'orderStats', 'customer', 'customFields', 'attributes']) {
    const v = dto[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(v as Bag);
  }
  return out;
}

function pick(dto: Bag, names: string[]): unknown {
  for (const bag of nested(dto)) {
    for (const n of names) {
      const v = bag[n];
      if (v !== undefined && v !== null && v !== '') return v;
    }
  }
  return null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'object' && v && 'amount' in v) return num((v as { amount: unknown }).amount);
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function bool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || v === 'true' || v === 'granted' || v === 'Granted') return true;
  if (v === 0 || v === '0' || v === 'false' || v === 'revoked' || v === 'Revoked' || v === 'none') return false;
  return null;
}

export function parseTags(tagsJson: unknown): string[] {
  if (Array.isArray(tagsJson)) return tagsJson.filter((t): t is string => typeof t === 'string');
  if (typeof tagsJson !== 'string' || !tagsJson.trim()) return [];
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return tagsJson
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
}

export function toCustomer(dto: Bag): Customer {
  const consentObj = dto.consent && typeof dto.consent === 'object' ? (dto.consent as Bag) : null;
  const channels = consentObj ? { push: consentObj.push === true, email: consentObj.email === true } : null;
  const canMessage = bool(dto.canMessage);
  const erased = dto.erased === true;
  const money = pick(dto, ['lifetimeValue', 'totalSpent', 'lifetimeSpend', 'totalRevenue']);
  const currency = str(pick(dto, ['currency', 'lifetimeValueCurrency'])) ?? (money && typeof money === 'object' && 'currency' in money ? String((money as { currency: unknown }).currency) : 'NPR');
  return {
    id: String(dto.contactId ?? dto.id ?? ''),
    name: erased ? 'Deleted customer' : (str(dto.fullName) ?? str(dto.name) ?? 'Customer'),
    city: str(pick(dto, ['city', 'buyerCity', 'location'])),
    tags: parseTags(dto.tags ?? dto.tagsJson),
    orderCount: num(pick(dto, ['orderCount', 'ordersCount', 'totalOrders'])),
    lifetimeValue: num(money),
    currency,
    firstOrderAt: str(pick(dto, ['firstOrderUtc', 'firstOrderAt', 'firstOrderDate'])),
    lastOrderAt: str(pick(dto, ['lastOrderUtc', 'lastOrderAt', 'lastOrderDate'])),
    returnsCount: num(pick(dto, ['returnsCount', 'returnCount', 'totalReturns'])),
    reviewAverage: num(pick(dto, ['averageRating', 'reviewAverage', 'reviewAvg', 'avgRating'])),
    reviewCount: num(pick(dto, ['reviewCount', 'reviewsCount'])),
    questionsCount: num(pick(dto, ['questionsCount', 'questionCount'])),
    marketingConsent: erased
      ? false
      : (canMessage ?? (channels ? channels.push || channels.email : bool(pick(dto, ['marketingConsent', 'hasMarketingConsent', 'marketingOptIn'])))),
    consentChannels: erased ? null : channels,
    erased,
    lastActivityAt: str(dto.lastActivityUtc ?? dto.lastActivityAt),
    createdAt: str(dto.createdAt),
    avatarUrl: str(dto.avatarUrl),
  };
}

// ---------------------------------------------------------------- endpoints

/** `GET crm/seller/customers` query (plan "Backend notes" §4). */
export interface CustomerFilter {
  search?: string;
  city?: string;
  /** push | email = can be messaged on that channel. Omitted = everyone. */
  consent?: 'push' | 'email';
  minOrders?: number;
  sort?: 'lastOrder' | 'ltv' | 'orders' | 'name';
  page: number;
  pageSize: number;
}

/** `GET crm/seller/me` */
export interface SellerCrmInfo {
  tenantId: string;
  businessName: string;
  role: string;
  customerCount: number;
  lastSyncedUtc: string | null;
  backfill: { state: 'NotStarted' | 'Running' | 'Done' | string; completedUtc: string | null } | null;
}

/** A merged timeline entry: CRM activity events plus the StyleMint sync's signals. */
export interface TimelineEntry {
  id: string;
  at: string;
  label: string;
  color: string;
  summary: string;
}

const SIGNAL_TYPES: Record<string, { label: string; color: string }> = {
  'stylemint.order.placed': { label: 'Order placed', color: 'forest' },
  'stylemint.order.paid': { label: 'Paid', color: 'forest' },
  'stylemint.order.state': { label: 'Order update', color: 'blue' },
  'stylemint.order.cancelled': { label: 'Cancelled', color: 'gray' },
  'stylemint.return.submitted': { label: 'Return requested', color: 'amber' },
  'stylemint.return.completed': { label: 'Returned', color: 'amber' },
  'stylemint.review': { label: 'Review', color: 'yellow' },
  'stylemint.question': { label: 'Question', color: 'cyan' },
};
const signalKindLabel: Record<number, string> = { 1: 'Message', 2: 'Call', 3: 'Meeting', 4: 'Chat', 5: 'Note', 9: 'Activity', 10: 'Order' };

export function signalEntry(s: SignalDto & { payloadJson?: string | null }): TimelineEntry {
  let type: string | null = null;
  try {
    const p = s.payloadJson ? (JSON.parse(s.payloadJson) as { type?: unknown }) : null;
    type = typeof p?.type === 'string' ? p.type : null;
  } catch {
    type = null;
  }
  const known = type ? SIGNAL_TYPES[type] : undefined;
  return {
    id: `s-${s.id}`,
    at: s.occurredAt,
    label: known?.label ?? signalKindLabel[s.kind] ?? 'Activity',
    color: known?.color ?? 'gray',
    summary: s.summary ?? '',
  };
}

export function activityEntry(e: ActivityEventDto): TimelineEntry {
  return { id: `a-${e.id}`, at: e.occurredAt, label: activityKindLabel[e.eventKind] ?? 'Activity', color: activityColor(e.eventKind), summary: e.summary };
}

export const crmApi = {
  // customers
  sellerMe: () => crm.get<SellerCrmInfo>('/seller/me'),
  customers: async (f: CustomerFilter): Promise<CrmPage<Customer>> => {
    const page = await crm.page<Bag>('/seller/customers', { ...f });
    return { ...page, items: page.items.map(toCustomer) };
  },
  sellerCustomer: async (id: string): Promise<Customer> => toCustomer(await crm.get<Bag>(`/seller/customers/${id}`)),
  contact: (id: string) => crm.get<ContactDto>(`/contacts/${id}`),
  customerProfile: (id: string) => crm.get<ContactProfileDto>(`/contacts/${id}/profile`),
  customerTimeline: (id: string) => crm.get<ContactTimelineDto>(`/contacts/${id}/timeline`),
  updateCustomerTags: (id: string, tags: string[]) => crm.put<ContactDto>(`/contacts/${id}`, { tagsJson: JSON.stringify(tags) }),
  activity: (kind: 'Contact' | 'Deal', id: string, page: number, pageSize = 20) =>
    crm.page<ActivityEventDto>(`/timeline/${kind}/${id}`, { page, pageSize }),

  // notes (comments)
  notes: (kind: number, entityId: string) => crm.get<CommentDto[]>('/comments', { kind, entityId }),
  addNote: (kind: number, entityId: string, content: string) =>
    crm.post<CommentDto>('/comments', { commentableKind: kind, commentableId: entityId, content, mentionedUserIds: [] }),
  deleteNote: (id: string) => crm.del<void>(`/comments/${id}`),

  // tasks
  tasks: (f: { status?: number | null; priority?: number | null; page: number; pageSize: number }) => crm.page<TaskDto>('/tasks', { ...f }),
  tasksFor: (subjectKind: 'Contact' | 'Deal', id: string) => crm.get<TaskDto[]>(`/tasks/subject/${subjectKind}/${id}`),
  createTask: (t: TaskCreate) => crm.post<TaskDto>('/tasks', { sourceKind: 1, ...t }),
  completeTask: (id: string, notes?: string) => crm.post<TaskDto>(`/tasks/${id}/complete`, { completionNotes: notes ?? null }),
  updateTask: (id: string, patch: Partial<{ status: number; priority: number; dueDate: string | null; title: string; description: string | null }>) =>
    crm.put<TaskDto>(`/tasks/${id}`, patch),
  deleteTask: (id: string) => crm.del<void>(`/tasks/${id}`),

  // meetings
  meetings: (f: { status?: number | null; contactId?: string; page: number; pageSize: number }) => crm.page<MeetingListItem>('/meetings', { ...f }),
  createMeeting: (m: MeetingCreate) => crm.post<{ id: string }>('/meetings', { attendees: [], generateSlots: false, ...m }),
  cancelMeeting: (id: string, reason: string) => crm.post<void>(`/meetings/${id}/cancel`, { reason }),
  completeMeeting: (id: string, notes?: string) => crm.put<void>(`/meetings/${id}`, { status: MeetingStatus.Completed, notes: notes ?? null }),

  // segments
  aiSegments: () => crm.get<DiscoveredSegment[]>('/customer-segments'),
  discoverSegments: () => crm.post<DiscoveredSegment[]>('/customer-segments/discover'),
  adoptSegment: (id: string, name: string) => crm.post<DiscoveredSegment>(`/customer-segments/${id}/adopt`, { name }),
  recipientOptions: () => crm.get<RecipientOptions>('/campaigns/recipient-builder/options'),
  previewAudience: (filter: TargetFilter) => crm.post<CampaignPreview>('/campaigns/preview', { targetFilterJson: JSON.stringify(filter) }),

  // campaigns & automations
  campaigns: () => crm.get<CampaignSummary[]>('/campaigns'),
  campaign: (id: string) => crm.get<CampaignDetail>(`/campaigns/${id}`),
  campaignStats: (id: string) => crm.get<CampaignStats>(`/campaigns/${id}/stats`),
  campaignAggregate: () => crm.get<CampaignAggregate>('/campaigns/aggregate'),
  createCampaign: (c: CampaignCreate) => crm.post<CampaignDetail>('/campaigns', { budgetCurrency: 'NPR', defaultAttributionModel: 1, ...c }),
  launchCampaign: (id: string) => crm.post<CampaignDetail>(`/campaigns/${id}/launch`),
  scheduleCampaign: (id: string, scheduledAt: string) => crm.post<CampaignDetail>(`/campaigns/${id}/schedule`, { scheduledAt }),
  cancelCampaign: (id: string) => crm.post<CampaignDetail>(`/campaigns/${id}/cancel`),
  deleteCampaign: (id: string) => crm.del<void>(`/campaigns/${id}`),
  automations: (page: number, pageSize: number) => crm.page<WorkflowDto>('/workflows', { page, pageSize }),
  setAutomationActive: (id: string, isActive: boolean) => crm.put<WorkflowDto>(`/workflows/${id}`, { isActive }),

  // feedback
  npsSurveys: (f: { classification?: number | null; search?: string; page: number; pageSize: number }) => crm.page<NpsSurvey>('/nps', { ...f }),
  npsSummary: () => crm.get<NpsSummary>('/nps/summary'),
  npsForCustomer: (contactId: string) => crm.get<NpsSurvey[]>(`/nps/contacts/${contactId}`),
  sendNps: (contactId: string) => crm.post<NpsSurvey>('/nps/send', { contactId, trigger: 4 }),
  csatSummary: () => crm.get<CsatSummary>('/csat/summary'),
  feedbackThemes: () => crm.get<FeedbackTheme[]>('/feedback/aggregated'),
  feedbackByTheme: (tag: string) => crm.get<FeedbackItem[]>(`/feedback/topics/${encodeURIComponent(tag)}`),
  feedbackForCustomer: (contactId: string) => crm.get<FeedbackItem[]>(`/feedback/contacts/${contactId}`),
  markFeedbackActed: (id: string, note: string) => crm.post<void>(`/feedback/${id}/mark-acted`, { note }),

  // deals & quotes
  pipelines: () => crm.get<Pipeline[]>('/pipelines'),
  stages: (pipelineId: string | null) =>
    pipelineId ? crm.get<DealStage[]>(`/pipelines/${pipelineId}/stages`) : crm.get<DealStage[]>('/deals/stages'),
  deals: (f: { pipelineId?: string | null; status?: number | null; search?: string; contactId?: string; page: number; pageSize: number }) =>
    crm.page<Deal>('/deals', { ...f }),
  deal: (id: string) => crm.get<Deal>(`/deals/${id}`),
  createDeal: (d: DealCreate) => crm.post<Deal>('/deals', { dealType: 1, ...d }),
  moveDeal: (id: string, stageId: string) => crm.put<Deal>(`/deals/${id}/stage`, { stageId }),
  closeDeal: (id: string, isWon: boolean, reason: string | null) =>
    crm.post<Deal>(`/deals/${id}/close`, { isWon, winReason: isWon ? reason : null, lostReason: isWon ? null : reason }),
  deleteDeal: (id: string) => crm.del<void>(`/deals/${id}`),
  quotes: (f: { status?: number | null; dealId?: string; page: number; pageSize: number }) => crm.page<Quote>('/quotes', { ...f }),
  quote: (id: string) => crm.get<Quote>(`/quotes/${id}`),
  draftQuote: (q: QuoteDraft) => crm.post<Quote>('/quotes', q),
  setQuoteStatus: (id: string, status: number) => crm.put<Quote>(`/quotes/${id}/status`, { status }),
  acceptQuote: (id: string) => crm.post<Quote>(`/quotes/${id}/accept`),
  rejectQuote: (id: string) => crm.post<Quote>(`/quotes/${id}/reject`),
  reviseQuote: (id: string) => crm.post<Quote>(`/quotes/${id}/revise`),
  proposals: (f: { status?: number | null; page: number; pageSize: number }) => crm.page<ProposalListItem>('/proposals', { ...f }),
  proposal: (id: string) => crm.get<Proposal>(`/proposals/${id}`),
  acceptProposal: (id: string) => crm.post<Proposal>(`/proposals/${id}/accept`, {}),
  rejectProposal: (id: string) => crm.post<Proposal>(`/proposals/${id}/reject`, {}),

  // reports
  contactStats: () => crm.get<ContactStats>('/analytics/contacts'),
  dealStats: () => crm.get<DealStats>('/analytics/deals'),
  npsAnalytics: (months = 6) => crm.get<NpsAnalytics>('/analytics/nps', { months }),
  churnAnalytics: () => crm.get<ChurnAnalytics>('/analytics/churn'),
  activityAnalytics: () => crm.get<ActivityAnalytics>('/analytics/activity'),
  revenueAnalytics: () => crm.get<RevenueAnalytics>('/analytics/revenue'),
};
