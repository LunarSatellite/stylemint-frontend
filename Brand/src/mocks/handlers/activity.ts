import { http, HttpResponse } from 'msw'
import { buildActivity } from '../factories/activity.factory'

export const activityHandlers = [
  http.get('/v1/vendor/activity', () =>
    HttpResponse.json({
      items:      Array.from({ length: 5 }, () => buildActivity()),
      nextCursor: null,
      totalCount: 5,
    }),
  ),
]
