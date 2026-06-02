import type { components } from '@/api/schema'

type KycReviewItem = components['schemas']['KycReviewItemDto']
type KycQueuePage  = components['schemas']['KycReviewItemDtoPagedList']

export const mockKycItems: KycReviewItem[] = [
  {
    id:                 'kyc-001-aaaa-bbbb-cccc-ddddeeee0001',
    applicantKind:       1,
    applicationId:       'app-001-aaaa-bbbb-cccc-ddddeeee0001',
    accountId:           'acc-001-aaaa-bbbb-cccc-ddddeeee0001',
    state:               1,
    assignedReviewerId:  null,
    submittedUtc:        '2026-05-28T06:30:00Z',
    dueByUtc:            '2026-05-31T06:30:00Z',
    decidedUtc:          null,
    decision:            null,
    decisionReasonCode:  null,
    decisionNote:        null,
    rowVersion:          'AAAAAAAAAAM=',
  },
  {
    id:                 'kyc-002-aaaa-bbbb-cccc-ddddeeee0002',
    applicantKind:       2,
    applicationId:       'app-002-aaaa-bbbb-cccc-ddddeeee0002',
    accountId:           'acc-002-aaaa-bbbb-cccc-ddddeeee0002',
    state:               2,
    assignedReviewerId:  'adm-001-aaaa-bbbb-cccc-ddddeeee0001',
    submittedUtc:        '2026-05-27T09:15:00Z',
    dueByUtc:            '2026-05-30T09:15:00Z',
    decidedUtc:          null,
    decision:            null,
    decisionReasonCode:  null,
    decisionNote:        null,
    rowVersion:          'AAAAAAAAABM=',
  },
  {
    id:                 'kyc-003-aaaa-bbbb-cccc-ddddeeee0003',
    applicantKind:       1,
    applicationId:       'app-003-aaaa-bbbb-cccc-ddddeeee0003',
    accountId:           'acc-003-aaaa-bbbb-cccc-ddddeeee0003',
    state:               3,
    assignedReviewerId:  'adm-001-aaaa-bbbb-cccc-ddddeeee0001',
    submittedUtc:        '2026-05-25T11:00:00Z',
    dueByUtc:            '2026-05-28T11:00:00Z',
    decidedUtc:          '2026-05-26T14:22:00Z',
    decision:            1,
    decisionReasonCode:  null,
    decisionNote:        'All documents verified. Application approved.',
    rowVersion:          'AAAAAAAAACM=',
  },
  {
    id:                 'kyc-004-aaaa-bbbb-cccc-ddddeeee0004',
    applicantKind:       1,
    applicationId:       'app-004-aaaa-bbbb-cccc-ddddeeee0004',
    accountId:           'acc-004-aaaa-bbbb-cccc-ddddeeee0004',
    state:               3,
    assignedReviewerId:  'adm-002-aaaa-bbbb-cccc-ddddeeee0002',
    submittedUtc:        '2026-05-24T08:45:00Z',
    dueByUtc:            '2026-05-27T08:45:00Z',
    decidedUtc:          '2026-05-25T10:10:00Z',
    decision:            2,
    decisionReasonCode:  'DOCS_UNCLEAR',
    decisionNote:        'Photo of ID is too blurry to verify. Please resubmit.',
    rowVersion:          'AAAAAAAAADM=',
  },
  {
    id:                 'kyc-005-aaaa-bbbb-cccc-ddddeeee0005',
    applicantKind:       2,
    applicationId:       'app-005-aaaa-bbbb-cccc-ddddeeee0005',
    accountId:           'acc-005-aaaa-bbbb-cccc-ddddeeee0005',
    state:               1,
    assignedReviewerId:  null,
    submittedUtc:        '2026-05-20T03:00:00Z',
    dueByUtc:            '2026-05-23T03:00:00Z',
    decidedUtc:          null,
    decision:            null,
    decisionReasonCode:  null,
    decisionNote:        null,
    rowVersion:          'AAAAAAAAAFM=',
  },
  {
    id:                 'kyc-006-aaaa-bbbb-cccc-ddddeeee0006',
    applicantKind:       1,
    applicationId:       'app-006-aaaa-bbbb-cccc-ddddeeee0006',
    accountId:           'acc-006-aaaa-bbbb-cccc-ddddeeee0006',
    state:               2,
    assignedReviewerId:  'adm-003-aaaa-bbbb-cccc-ddddeeee0003',
    submittedUtc:        '2026-05-29T07:00:00Z',
    dueByUtc:            '2026-06-01T07:00:00Z',
    decidedUtc:          null,
    decision:            null,
    decisionReasonCode:  null,
    decisionNote:        null,
    rowVersion:          'AAAAAAAAAGM=',
  },
  {
    id:                 'kyc-007-aaaa-bbbb-cccc-ddddeeee0007',
    applicantKind:       2,
    applicationId:       'app-007-aaaa-bbbb-cccc-ddddeeee0007',
    accountId:           'acc-007-aaaa-bbbb-cccc-ddddeeee0007',
    state:               3,
    assignedReviewerId:  'adm-001-aaaa-bbbb-cccc-ddddeeee0001',
    submittedUtc:        '2026-05-22T13:30:00Z',
    dueByUtc:            '2026-05-25T13:30:00Z',
    decidedUtc:          '2026-05-23T09:00:00Z',
    decision:            3,
    decisionReasonCode:  'FRAUD_SUSPECTED',
    decisionNote:        'Documents appear to be forged. Terminal rejection.',
    rowVersion:          'AAAAAAAAAHE=',
  },
]

export function buildKycQueuePage(
  filter: Record<string, unknown>,
): KycQueuePage {
  let items = [...mockKycItems]

  if (filter.state)         items = items.filter(i => i.state         === Number(filter.state))
  if (filter.applicantKind) items = items.filter(i => i.applicantKind === Number(filter.applicantKind))
  if (filter.overdueOnly)   items = items.filter(i => new Date() > new Date(i.dueByUtc))

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
