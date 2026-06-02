import type { ValueOf } from '@/lib/types'
import type { BrandBriefState, VendorActivityKind } from '@/lib/enums'

export interface BriefListFilter {
  state?: ValueOf<typeof BrandBriefState>[]
}

export interface ActivityFilter {
  kind?: ValueOf<typeof VendorActivityKind>[]
}

export interface AnalyticsWindow {
  windowDays: number
}

export const bsQk = {
  briefs: {
    list:   (f: BriefListFilter)  => ['bs', 'briefs', 'list', f]   as const,
    detail: (id: string)           => ['bs', 'briefs', 'detail', id] as const,
  },
  dashboard:  (windowDays: number)  => ['bs', 'dashboard', windowDays]  as const,
  activity:   (f: ActivityFilter)   => ['bs', 'activity', f]            as const,
  analytics: {
    overview:            (w: AnalyticsWindow) => ['bs', 'analytics', 'overview', w]            as const,
    products:            (w: AnalyticsWindow) => ['bs', 'analytics', 'products', w]            as const,
    creators:            (w: AnalyticsWindow) => ['bs', 'analytics', 'creators', w]            as const,
    product:             (id: string, w: AnalyticsWindow) => ['bs', 'analytics', 'product', id, w]             as const,
    creatorByPartnership:(pid: string, w: AnalyticsWindow) => ['bs', 'analytics', 'creatorPartnership', pid, w] as const,
  },
  goalTemplates: {
    list:   (goal: number) => ['bs', 'goalTemplates', 'list', goal]   as const,
    active: (goal: number) => ['bs', 'goalTemplates', 'active', goal] as const,
  },
  policies: {
    detail: (vendorId: string) => ['bs', 'policies', vendorId] as const,
  },
} as const
