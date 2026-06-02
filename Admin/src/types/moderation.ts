// Matches ModerationItemDto from backend
export interface ModerationItem {
  id:                  string
  targetKind:          1 | 2 | 3 | 4           // Reel | Review | ReelComment | Profile
  targetId:            string                    // stringified key into owning module
  source:              1 | 2 | 3               // UserReport | AutomatedScanner | AdminSpot
  reporterAccountId:   string | null             // present only when source = UserReport
  reportReasonCode:    string | null             // present only when source = UserReport
  state:               1 | 2 | 3               // Open | InReview | Decided
  assignedReviewerId:  string | null
  submittedUtc:        string
  decidedUtc:          string | null
  action:              1 | 2 | 3 | 4 | 5 | 6 | null
  decisionNote:        string | null
  rowVersion:          string | null
}

// Matches PagedList<ModerationItemDto>
export interface ModerationQueuePage {
  items:       ModerationItem[]
  totalCount:  number
  pageNumber:  number
  pageSize:    number
  totalPages:  number
  hasPrevious: boolean
  hasNext:     boolean
}

// GET /v1/admin/moderation/queue params
export interface ModerationQueueFilter {
  pageNumber:  number
  pageSize:    number
  state?:      1 | 2 | 3
  targetKind?: 1 | 2 | 3 | 4
  source?:     1 | 2 | 3
}

// POST /v1/admin/moderation/:id/assign
export interface AssignModerationRequest {
  reviewerAdminId: string
}

// POST /v1/admin/moderation/:id/decide
export interface DecideModerationRequest {
  action:        1 | 2 | 3 | 4 | 5 | 6
  decisionNote?: string | null
}
