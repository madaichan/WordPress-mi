import { useQuery } from '@tanstack/react-query'
import { quizApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

/** Returns { entity_name, questions } for the entity's question bank. */
export function useQuizQuestions(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.quiz.questions(params),
    queryFn: () => quizApi.questions(params),
    ...options,
  })
}

/** A single bank question including its image_data (edit form / preview). */
export function useQuizQuestion(id, options = {}) {
  return useQuery({
    queryKey: queryKeys.quiz.question(id),
    queryFn: () => quizApi.question(id),
    enabled: Boolean(id),
    refetchOnWindowFocus: false,
    ...options,
  })
}

/** The entity's quizzes for the builder list (metadata only). */
export function useQuizPages(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.quiz.pages(params),
    queryFn: () => quizApi.listPages(params),
    ...options,
  })
}

/**
 * One quiz page (by `id`, or the entity default when none). Carries the live
 * linter report, the answer key count and the lock state, so the builder can
 * show what blocks a publish before it is attempted. An empty shell (id null)
 * when the entity has no quiz yet.
 */
export function useQuizPage(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.quiz.page(params),
    queryFn: () => quizApi.getPage(params),
    // The editor holds unsaved text; a focus refetch must not race it.
    refetchOnWindowFocus: false,
    ...options,
  })
}

/** Admin-only: every quiz across all entities with usage + chain linkage. */
export function useQuizPagesOverview(options = {}) {
  return useQuery({
    queryKey: queryKeys.quiz.overview(),
    queryFn: () => quizApi.pagesOverview(),
    ...options,
  })
}

/**
 * Live preview of the quiz page generated from the builder's current, unsaved
 * inputs. `input` should be a debounced snapshot of { template_id, field_values,
 * selected_question_ids, entity? } so it does not refetch on every keystroke.
 */
export function useQuizPagePreview(input = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.quiz.preview(input),
    queryFn: () => quizApi.previewPage(input),
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    ...options,
  })
}

/** The reusable quiz template catalogue (metadata + placeholder declarations). */
export function useQuizTemplates(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.quiz.templates(params),
    queryFn: () => quizApi.templates(params),
    ...options,
  })
}

/** One full template, including its html_body (admin editing). */
export function useQuizTemplate(id, options = {}) {
  return useQuery({
    queryKey: queryKeys.quiz.template(id),
    queryFn: () => quizApi.template(id),
    enabled: Boolean(id),
    refetchOnWindowFocus: false,
    ...options,
  })
}

/** Graded results for one GoPhish campaign. */
export function useQuizResults(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.quiz.results(params),
    queryFn: () => quizApi.results(params),
    ...options,
  })
}
