import { briefHandlers }        from './briefs'
import { dashboardHandlers }    from './dashboard'
import { analyticsHandlers }    from './analytics'
import { activityHandlers }     from './activity'
import { goalTemplateHandlers } from './goalTemplates'
import { policyHandlers }       from './policy'

export const handlers = [
  ...briefHandlers,
  ...dashboardHandlers,
  ...analyticsHandlers,
  ...activityHandlers,
  ...goalTemplateHandlers,
  ...policyHandlers,
]
