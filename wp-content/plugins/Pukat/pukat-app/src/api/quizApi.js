import { get, post, del } from './client.js'

export const quizApi = {
  questions:      ()           => get('/quiz/questions'),
  createQuestion: (data)       => post('/quiz/questions', data),
  deleteQuestion: (id)         => del(`/quiz/questions/${id}`),
  submit:         (data)       => post('/quiz/submit', data),
  results:        (campaignId) => get(`/quiz/results/${campaignId}`),
}

export default quizApi
