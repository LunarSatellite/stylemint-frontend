import { http, HttpResponse } from 'msw'
import { faker } from '@faker-js/faker'
import type { GoalTemplateVersionDto } from '@/api/schema'

function buildTemplate(overrides: Partial<GoalTemplateVersionDto> = {}): GoalTemplateVersionDto {
  return {
    id:            faker.string.uuid(),
    goal:          1,
    version:       1,
    promptText:    'You are a creative director. Write a compelling brief for...',
    notes:         null,
    state:         1,
    effectiveFrom: new Date().toISOString(),
    effectiveTo:   null,
    createdUtc:    new Date().toISOString(),
    updatedUtc:    new Date().toISOString(),
    rowVersion:    '1',
    ...overrides,
  }
}

export const goalTemplateHandlers = [
  http.get('/v1/admin/brand-studio/goal-templates', () =>
    HttpResponse.json([buildTemplate()]),
  ),
  http.get('/v1/admin/brand-studio/goal-templates/active', () =>
    HttpResponse.json(buildTemplate()),
  ),
  http.post('/v1/admin/brand-studio/goal-templates', () =>
    HttpResponse.json(buildTemplate(), { status: 201 }),
  ),
  http.post('/v1/admin/brand-studio/goal-templates/:id/supersede', ({ params }) =>
    HttpResponse.json(buildTemplate({ id: params['id'] as string, version: 2 })),
  ),
  http.post('/v1/admin/brand-studio/goal-templates/:id/retire', ({ params }) =>
    HttpResponse.json(buildTemplate({ id: params['id'] as string, state: 3 })),
  ),
]
