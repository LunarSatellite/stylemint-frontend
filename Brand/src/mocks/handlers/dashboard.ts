import { http, HttpResponse } from 'msw'
import { buildDashboard } from '../factories/dashboard.factory'

export const dashboardHandlers = [
  http.get('/v1/vendor/dashboard', () =>
    HttpResponse.json(buildDashboard()),
  ),
]
