// Matches KycReviewItemDto from backend
export interface KycReviewItem {
  id:                  string
  applicantKind:       1 | 2           // 1=Creator, 2=Vendor
  applicationId:       string
  accountId:           string
  state:               1 | 2 | 3       // 1=Pending, 2=InReview, 3=Decided
  assignedReviewerId:  string | null
  submittedUtc:        string
  dueByUtc:            string
  decidedUtc:          string | null
  decision:            1 | 2 | 3 | null // 1=Approved, 2=RejectedRetryable, 3=RejectedTerminal
  decisionReasonCode:  string | null
  decisionNote:        string | null
  rowVersion:          string | null
}

// Matches PagedList<KycReviewItemDto>
export interface KycQueuePage {
  items:       KycReviewItem[]
  totalCount:  number
  pageNumber:  number
  pageSize:    number
  totalPages:  number
  hasPrevious: boolean
  hasNext:     boolean
}

// GET /v1/admin/kyc/queue params
export interface KycQueueFilter {
  pageNumber:    number
  pageSize:      number
  applicantKind?: 1 | 2
  state?:         1 | 2 | 3
  reviewerId?:    string
  overdueOnly?:   boolean
}

// POST /v1/admin/kyc/:id/assign  — AssignKycVm
export interface AssignKycRequest {
  reviewerAdminId: string
}

// POST /v1/admin/kyc/:id/decide  — DecideKycVm
export interface DecideKycRequest {
  decision:           1 | 2 | 3
  decisionReasonCode?: string | null
  decisionNote?:       string | null
}
