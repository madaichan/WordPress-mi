import { get, post, put, del } from './client.js'

export const flagApi = {
  // Shared Flag categories (admin-managed)
  list:   ()         => get('/flags'),
  create: (data)     => post('/flags', data),
  update: (id, data) => put(`/flags/${id}`, data),
  delete: (id)       => del(`/flags/${id}`),

  // Per-entity example gallery. `entity` is only honored for admins.
  listExamples: (params = {}) => get('/flag-examples', { params }),
  // client.js defaults to Content-Type: application/json, which makes axios
  // serialize a FormData body to JSON (the file would be silently dropped).
  // Declaring multipart here makes axios keep the FormData and let the
  // browser set the boundary itself.
  uploadExample: (formData, onUploadProgress) => post('/flag-examples', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  }),
  deleteExample: (id) => del(`/flag-examples/${id}`),
  // Downscaled base64 data URI for one example, to embed in an education page.
  exampleDataUri: (id) => get(`/flag-examples/${id}/data-uri`),

  // One education page per entity (docs/PRD_FLAG_EDUCATION_PAGES.md).
  // `entity` is only honored for admins.
  getPage:       (params = {}) => get('/flag-page', { params }),
  savePage:      (data)        => put('/flag-page', data),
  publishPage:   (data = {})   => post('/flag-page/publish', data),
  unpublishPage: (data = {})   => post('/flag-page/unpublish', data),
  syncPage:      (data = {})   => post('/flag-page/sync', data),
}

export default flagApi
