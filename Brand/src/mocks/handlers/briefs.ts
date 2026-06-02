import { http, HttpResponse } from 'msw'
import { buildBrief } from '../factories/brief.factory'

export const briefHandlers = [
  http.get('/v1/vendor/briefs', () =>
    HttpResponse.json({ items: [buildBrief()], nextCursor: null, totalCount: 1 }),
  ),
  http.get('/v1/vendor/briefs/:id', ({ params }) =>
    HttpResponse.json(buildBrief({ id: params['id'] as string })),
  ),
  http.post('/v1/vendor/briefs', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(buildBrief({ title: body['title'] as string }), { status: 200 })
  }),
  http.patch('/v1/vendor/briefs/:id', ({ params }) =>
    HttpResponse.json(buildBrief({ id: params['id'] as string, rowVersion: '2' })),
  ),
  http.post('/v1/vendor/briefs/:id/lock', ({ params }) =>
    HttpResponse.json(buildBrief({ id: params['id'] as string, state: 2, rowVersion: '2' })),
  ),
  http.post('/v1/vendor/briefs/:id/fork', ({ params }) =>
    HttpResponse.json(buildBrief({ parentBriefId: params['id'] as string, version: 2 })),
  ),
  http.post('/v1/vendor/briefs/:id/retire', ({ params }) =>
    HttpResponse.json(buildBrief({ id: params['id'] as string, state: 3 })),
  ),
  http.post('/v1/vendor/briefs/:id/recompute-roi', () =>
    HttpResponse.json({ roiProjection: null }),
  ),
]
