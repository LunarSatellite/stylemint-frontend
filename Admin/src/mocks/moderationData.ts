import type { ModerationItem, ModerationQueuePage } from '@/types/moderation'

export const mockModerationItems: ModerationItem[] = [
  {
    id:                 'mod-001-aaaa-bbbb-cccc-ddddeeee0001',
    targetKind:          1,
    targetId:            'reel-001-aaaa-bbbb-cccc-ddddeeee0001',
    source:              1,
    reporterAccountId:   'usr-001-aaaa-bbbb-cccc-ddddeeee0001',
    reportReasonCode:    'NUDITY_OR_SEXUAL',
    state:               1,
    assignedReviewerId:  null,
    submittedUtc:        '2026-05-30T08:00:00Z',
    decidedUtc:          null,
    action:              null,
    decisionNote:        null,
    rowVersion:          'AAAAAAAAAAM=',
  },
  {
    id:                 'mod-002-aaaa-bbbb-cccc-ddddeeee0002',
    targetKind:          2,
    targetId:            'rev-002-aaaa-bbbb-cccc-ddddeeee0002',
    source:              1,
    reporterAccountId:   'usr-002-aaaa-bbbb-cccc-ddddeeee0002',
    reportReasonCode:    'SPAM',
    state:               2,
    assignedReviewerId:  'adm-001-aaaa-bbbb-cccc-ddddeeee0001',
    submittedUtc:        '2026-05-29T10:30:00Z',
    decidedUtc:          null,
    action:              null,
    decisionNote:        null,
    rowVersion:          'AAAAAAAAABM=',
  },
  {
    id:                 'mod-003-aaaa-bbbb-cccc-ddddeeee0003',
    targetKind:          3,
    targetId:            'cmt-003-aaaa-bbbb-cccc-ddddeeee0003',
    source:              1,
    reporterAccountId:   'usr-003-aaaa-bbbb-cccc-ddddeeee0003',
    reportReasonCode:    'HATE_OR_HARASSMENT',
    state:               3,
    assignedReviewerId:  'adm-001-aaaa-bbbb-cccc-ddddeeee0001',
    submittedUtc:        '2026-05-27T14:00:00Z',
    decidedUtc:          '2026-05-28T09:15:00Z',
    action:              3,
    decisionNote:        'Clear hate speech targeting a specific group. Content removed.',
    rowVersion:          'AAAAAAAAACM=',
  },
  {
    id:                 'mod-004-aaaa-bbbb-cccc-ddddeeee0004',
    targetKind:          4,
    targetId:            'prf-004-aaaa-bbbb-cccc-ddddeeee0004',
    source:              2,
    reporterAccountId:   null,
    reportReasonCode:    null,
    state:               1,
    assignedReviewerId:  null,
    submittedUtc:        '2026-05-31T06:45:00Z',
    decidedUtc:          null,
    action:              null,
    decisionNote:        null,
    rowVersion:          'AAAAAAAAADM=',
  },
  {
    id:                 'mod-005-aaaa-bbbb-cccc-ddddeeee0005',
    targetKind:          1,
    targetId:            'reel-005-aaaa-bbbb-cccc-ddddeeee0005',
    source:              1,
    reporterAccountId:   'usr-005-aaaa-bbbb-cccc-ddddeeee0005',
    reportReasonCode:    'VIOLENCE',
    state:               3,
    assignedReviewerId:  'adm-002-aaaa-bbbb-cccc-ddddeeee0002',
    submittedUtc:        '2026-05-26T11:20:00Z',
    decidedUtc:          '2026-05-27T08:00:00Z',
    action:              4,
    decisionNote:        'First offence — warning issued to author.',
    rowVersion:          'AAAAAAAAAFM=',
  },
  {
    id:                 'mod-006-aaaa-bbbb-cccc-ddddeeee0006',
    targetKind:          2,
    targetId:            'rev-006-aaaa-bbbb-cccc-ddddeeee0006',
    source:              3,
    reporterAccountId:   null,
    reportReasonCode:    null,
    state:               2,
    assignedReviewerId:  'adm-003-aaaa-bbbb-cccc-ddddeeee0003',
    submittedUtc:        '2026-05-30T15:00:00Z',
    decidedUtc:          null,
    action:              null,
    decisionNote:        null,
    rowVersion:          'AAAAAAAAAGM=',
  },
  {
    id:                 'mod-007-aaaa-bbbb-cccc-ddddeeee0007',
    targetKind:          1,
    targetId:            'reel-007-aaaa-bbbb-cccc-ddddeeee0007',
    source:              1,
    reporterAccountId:   'usr-007-aaaa-bbbb-cccc-ddddeeee0007',
    reportReasonCode:    'COUNTERFEIT_PRODUCT',
    state:               3,
    assignedReviewerId:  'adm-001-aaaa-bbbb-cccc-ddddeeee0001',
    submittedUtc:        '2026-05-24T09:00:00Z',
    decidedUtc:          '2026-05-25T11:30:00Z',
    action:              6,
    decisionNote:        'Repeat offender. Counterfeit goods promoted across multiple reels. Permanent ban enforced.',
    rowVersion:          'AAAAAAAAAHE=',
  },
  {
    id:                 'mod-008-aaaa-bbbb-cccc-ddddeeee0008',
    targetKind:          4,
    targetId:            'prf-008-aaaa-bbbb-cccc-ddddeeee0008',
    source:              2,
    reporterAccountId:   null,
    reportReasonCode:    null,
    state:               1,
    assignedReviewerId:  null,
    submittedUtc:        '2026-06-01T04:30:00Z',
    decidedUtc:          null,
    action:              null,
    decisionNote:        null,
    rowVersion:          'AAAAAAAAAIM=',
  },
]

export function buildModerationQueuePage(
  filter: Record<string, unknown>,
): ModerationQueuePage {
  let items = [...mockModerationItems]

  if (filter.state)      items = items.filter(i => i.state      === Number(filter.state))
  if (filter.targetKind) items = items.filter(i => i.targetKind === Number(filter.targetKind))
  if (filter.source)     items = items.filter(i => i.source     === Number(filter.source))

  const pageNumber = Number(filter.pageNumber ?? 1)
  const pageSize   = Number(filter.pageSize   ?? 20)
  const start      = (pageNumber - 1) * pageSize
  const paged      = items.slice(start, start + pageSize)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  return {
    items:       paged,
    totalCount:  items.length,
    pageNumber,
    pageSize,
    totalPages,
    hasPrevious: pageNumber > 1,
    hasNext:     pageNumber < totalPages,
  }
}
