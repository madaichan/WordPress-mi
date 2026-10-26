import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { quizApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

// queryKeys.quiz.all is a prefix of every quiz key, so it refreshes the bank,
// the page and the results together.
const QUIZ_KEYS = [queryKeys.quiz.all]

function useQuizMutation(mutationFn, successMessage, options) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: (data, variables, context) => {
      // A publish reports three outcomes of its own (GoPhish page sync, quiz
      // master, chain). The local publish succeeded either way, so the toast
      // follows whichever step actually failed rather than claiming success.
      const step = [data?.sync, data?.master, data?.chain].find(s => s && s.ok === false)
      if (step) {
        toast.error(step.message || successMessage)
      } else {
        toast.success(typeof successMessage === 'function' ? successMessage(data) : successMessage)
      }
      QUIZ_KEYS.forEach(queryKey => qc.invalidateQueries({ queryKey }))
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}

export function useCreateQuizQuestionMutation(options = {}) {
  return useQuizMutation(data => quizApi.createQuestion(data), 'Question added.', options)
}

export function useUpdateQuizQuestionMutation(options = {}) {
  return useQuizMutation(({ id, data }) => quizApi.updateQuestion(id, data), 'Question updated.', options)
}

export function useDeleteQuizQuestionMutation(options = {}) {
  return useQuizMutation(id => quizApi.deleteQuestion(id), 'Question deleted.', options)
}

export function useCreateQuizPageMutation(options = {}) {
  return useQuizMutation(({ data } = {}) => quizApi.createPage(data), 'Quiz created.', options)
}

export function useSetDefaultQuizPageMutation(options = {}) {
  return useQuizMutation(({ data } = {}) => quizApi.setDefaultPage(data), 'Default follow-up quiz set.', options)
}

export function useDeleteQuizPageMutation(options = {}) {
  return useQuizMutation(({ data } = {}) => quizApi.deletePage(data), 'Quiz deleted.', options)
}

export function useSaveQuizPageMutation(options = {}) {
  return useQuizMutation(({ data }) => quizApi.savePage(data), 'Quiz page draft saved.', options)
}

export function usePublishQuizPageMutation(options = {}) {
  return useQuizMutation(({ data } = {}) => quizApi.publishPage(data), 'Quiz page published and synced to GoPhish.', options)
}

export function useUnpublishQuizPageMutation(options = {}) {
  return useQuizMutation(({ data } = {}) => quizApi.unpublishPage(data), 'Quiz page unpublished.', options)
}

export function useSyncQuizPageMutation(options = {}) {
  return useQuizMutation(({ data } = {}) => quizApi.syncPage(data), 'Quiz page synced to GoPhish.', options)
}

export function useCreateQuizTemplateMutation(options = {}) {
  return useQuizMutation(data => quizApi.createTemplate(data), 'Template created.', options)
}

export function useUpdateQuizTemplateMutation(options = {}) {
  return useQuizMutation(({ id, data }) => quizApi.updateTemplate(id, data), 'Template updated.', options)
}

export function useDeleteQuizTemplateMutation(options = {}) {
  return useQuizMutation(id => quizApi.deleteTemplate(id), 'Template deleted.', options)
}

/**
 * Pull the newest quiz answers from GoPhish, then write the response straight
 * into the results cache.
 *
 * Deliberately not built on useQuizMutation: there is no toast on success (the
 * dashboard shows "last refreshed" instead, and a toast on every page open
 * would be noise) and no invalidation either — the response already IS the
 * fresh payload, so invalidating would only make the page fetch what it just
 * received. Failure is quiet too: stale numbers with a visible timestamp beat
 * an error banner over data that is still perfectly readable.
 */
export function useRefreshQuizResultsMutation(params = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: () => quizApi.refreshResults(params),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.quiz.results(params), data)
    },
  })
}
