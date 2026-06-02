// GENERATED — never edit manually
// Run: npm run codegen
// Populated by hand until backend Swagger is available — replace entirely with codegen output

export type components = {
  schemas: {
    // ── KYC ────────────────────────────────────────────────────────────────────
    KycReviewItemDto: {
      id:                 string
      applicantKind:      1 | 2
      applicationId:      string
      accountId:          string
      state:              1 | 2 | 3
      assignedReviewerId: string | null
      submittedUtc:       string
      dueByUtc:           string
      decidedUtc:         string | null
      decision:           1 | 2 | 3 | null
      decisionReasonCode: string | null
      decisionNote:       string | null
      rowVersion:         string | null
    }
    KycReviewItemDtoPagedList: {
      items:       components['schemas']['KycReviewItemDto'][]
      totalCount:  number
      pageNumber:  number
      pageSize:    number
      totalPages:  number
      hasPrevious: boolean
      hasNext:     boolean
    }
    KycQueueParams: {
      pageNumber:    number
      pageSize:      number
      applicantKind?: 1 | 2
      state?:         1 | 2 | 3
      reviewerId?:    string
      overdueOnly?:   boolean
    }
    AssignKycVm: {
      reviewerAdminId: string
    }
    DecideKycVm: {
      decision:            1 | 2 | 3
      decisionReasonCode?: string | null
      decisionNote?:       string | null
    }

    // ── Moderation ─────────────────────────────────────────────────────────────
    ModerationItemDto: {
      id:                 string
      targetKind:         1 | 2 | 3 | 4
      targetId:           string
      source:             1 | 2 | 3
      reporterAccountId:  string | null
      reportReasonCode:   string | null
      state:              1 | 2 | 3
      assignedReviewerId: string | null
      submittedUtc:       string
      decidedUtc:         string | null
      action:             1 | 2 | 3 | 4 | 5 | 6 | null
      decisionNote:       string | null
      rowVersion:         string | null
    }
    ModerationItemDtoPagedList: {
      items:       components['schemas']['ModerationItemDto'][]
      totalCount:  number
      pageNumber:  number
      pageSize:    number
      totalPages:  number
      hasPrevious: boolean
      hasNext:     boolean
    }
    ModerationQueueParams: {
      pageNumber:  number
      pageSize:    number
      state?:      1 | 2 | 3
      targetKind?: 1 | 2 | 3 | 4
      source?:     1 | 2 | 3
    }
    AssignModerationVm: {
      reviewerAdminId: string
    }
    DecideModerationVm: {
      action:        1 | 2 | 3 | 4 | 5 | 6
      decisionNote?: string | null
    }
  }
}
