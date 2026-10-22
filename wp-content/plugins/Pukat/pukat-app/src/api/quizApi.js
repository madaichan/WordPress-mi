import { get, post, put, del } from './client.js'

/**
 * Quiz Module API (docs/PRD_QUIZ_MODULE.md §8).
 *
 * There is no `submit`: the quiz page is served by GoPhish, not Pukat, so
 * answers arrive through campaign results and are graded server-side. The old
 * POST /quiz/submit route was removed with this module.
 */
export const quizApi = {
  // Per-entity question bank. `entity` is only honored for admins.
  questions:      (params = {}) => get('/quiz/questions', { params }),
  createQuestion: (data)        => post('/quiz/questions', data),
  updateQuestion: (id, data)    => put(`/quiz/questions/${id}`, data),
  deleteQuestion: (id)          => del(`/quiz/questions/${id}`),

  // Quiz pages — many per entity (Quiz Builder v2). `entity` is only honored
  // for admins; `id` targets one quiz (omit for the entity's default/first).
  listPages:     (params = {}) => get('/quiz-pages', { params }),
  // Admin-only: every quiz across all entities with usage + chain linkage.
  pagesOverview: () => get('/quiz-pages/overview'),
  createPage:    (data = {})   => post('/quiz-pages', data),
  getPage:       (params = {}) => get('/quiz-page', { params }),
  savePage:      (data)        => put('/quiz-page', data),
  setDefaultPage:(data = {})   => post('/quiz-page/default', data),
  deletePage:    (data = {})   => post('/quiz-page/delete', data),
  // Lints the given HTML without saving, so the editor can show what blocks a publish.
  validatePage:  (data = {})   => post('/quiz-page/validate', data),
  publishPage:   (data = {})   => post('/quiz-page/publish', data),
  unpublishPage: (data = {})   => post('/quiz-page/unpublish', data),
  syncPage:      (data = {})   => post('/quiz-page/sync', data),

  // Reusable quiz templates. Listing is open to operators (to pick one in the
  // builder); create/edit/delete are admin-only (backend-enforced).
  templates:        (params = {}) => get('/quiz/templates', { params }),
  template:         (id)          => get(`/quiz/templates/${id}`),
  createTemplate:   (data)        => post('/quiz/templates', data),
  updateTemplate:   (id, data)    => put(`/quiz/templates/${id}`, data),
  deleteTemplate:   (id)          => del(`/quiz/templates/${id}`),

  // Without a campaignId this returns the entity's (or one Campaign Run's)
  // graded results — the per-campaign form needs a GoPhish campaign id, which
  // only the monitoring side has.
  results: (params = {}) => (params.campaignId
    ? get(`/quiz/results/${params.campaignId}`)
    : get('/quiz/results', { params })),
}

export default quizApi
